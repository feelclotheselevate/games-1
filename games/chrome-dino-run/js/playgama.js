(function () {
    'use strict';

    var COPY = {
        hint: 'Press space, tap, or click to start',
        duck: 'Down / hold Duck to dodge birds',
        revive: 'Continue',
        reviveHint: 'Watch an ad to keep running',
        restart: 'Restart',
        duckBtn: 'Duck'
    };

    var STORAGE_KEY = 'highScore';
    var runner = null;
    var hostPaused = false;
    var reviveUsedThisRun = false;
    var pendingHighScore = 0;
    var saveTimer = 0;

    function applyCopy() {
        document.documentElement.lang = 'en';
        document.documentElement.dir = 'ltr';
        document.getElementById('hint-main').textContent = COPY.hint;
        document.getElementById('hint-sub').textContent = COPY.duck;
        document.getElementById('revive-hint').textContent = COPY.reviveHint;
        document.getElementById('revive-btn').textContent = COPY.revive;
        document.getElementById('restart-btn').textContent = COPY.restart;
        document.getElementById('duck-btn').textContent = COPY.duckBtn;
    }

    function sdk() {
        return window.bridge || null;
    }

    function safely(fn) {
        try {
            return fn();
        } catch (err) {
            console.warn('[dino]', err);
            return undefined;
        }
    }

    function sendMessage(name) {
        var bridge = sdk();
        if (bridge && bridge.platform && typeof bridge.platform.sendMessage === 'function') {
            safely(function () { bridge.platform.sendMessage(name); });
        }
    }

    function setMuted(muted) {
        window.Runner.audioMuted = Boolean(muted);
        if (!muted && runner && runner.audioContext && runner.audioContext.state === 'suspended') {
            safely(function () { runner.audioContext.resume(); });
        }
    }

    var pauseReasons = { host: false, visibility: false };
    var resumeTimer = 0;

    function pauseActive() {
        return pauseReasons.host || pauseReasons.visibility;
    }

    function hideCountdown() {
        var el = document.getElementById('resume-count');
        if (el) el.hidden = true;
    }

    function cancelCountdown() {
        clearTimeout(resumeTimer);
        resumeTimer = 0;
        hideCountdown();
        if (runner) runner.holdingResume = false;
    }

    function paintFrozenFrame() {
        if (!runner || !runner.tRex || !runner.horizon) return;
        runner.tRex.reset();
        runner.clearCanvas();
        runner.horizon.update(0, runner.currentSpeed, true, runner.inverted);
        var meter = runner.distanceMeter;
        if (meter && meter.digits && meter.digits.length) {
            for (var i = meter.digits.length - 1; i >= 0; i--) {
                meter.draw(i, parseInt(meter.digits[i], 10));
            }
            if (typeof meter.drawHighScore === 'function') meter.drawHighScore();
        }
        runner.tRex.update(0);
    }

    function startCountdown() {
        if (!runner || runner.crashed || !runner.activated || pauseActive()) return;
        cancelCountdown();
        runner.stop();
        runner.holdingResume = true;
        paintFrozenFrame();

        var steps = ['1', '2', '3'];
        var step = 0;
        var el = document.getElementById('resume-count');
        function show() {
            if (!el) return;
            el.hidden = false;
            el.textContent = steps[step];
        }
        function tick() {
            if (!runner || runner.crashed || pauseActive()) {
                cancelCountdown();
                if (runner && pauseActive()) runner.stop();
                return;
            }
            step += 1;
            if (step >= steps.length) {
                cancelCountdown();
                runner.play();
                return;
            }
            show();
            resumeTimer = setTimeout(tick, 1000);
        }
        show();
        resumeTimer = setTimeout(tick, 1000);
    }

    function onHostPause(reason, paused) {
        if (reason !== 'host' && reason !== 'visibility') reason = 'host';
        pauseReasons[reason] = Boolean(paused);
        hostPaused = pauseActive();
        if (!runner) return;
        if (hostPaused) {
            cancelCountdown();
            runner.stop();
            return;
        }
        if (runner.activated && !runner.crashed) {
            startCountdown();
        }
    }

    Runner.onHostPause = onHostPause;

    function setPaused(paused) {
        onHostPause('host', paused);
    }

    function hideRevive() {
        document.getElementById('revive-panel').classList.remove('visible');
        document.body.classList.remove('crashed');
    }

    function showRevive(canRevive) {
        document.body.classList.add('crashed');
        document.body.classList.remove('playing');
        var panel = document.getElementById('revive-panel');
        var reviveBtn = document.getElementById('revive-btn');
        reviveBtn.hidden = !canRevive;
        document.getElementById('revive-hint').hidden = !canRevive;
        panel.classList.add('visible');
    }

    function persistHighScore(value) {
        pendingHighScore = value;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            var bridge = sdk();
            if (bridge && bridge.storage && typeof bridge.storage.set === 'function') {
                safely(function () {
                    bridge.storage.set([STORAGE_KEY], [String(pendingHighScore)]);
                });
            }
        }, 250);
    }

    function applyStoredHighScore(raw) {
        var value = Number(raw);
        if (!runner || !Number.isFinite(value) || value <= 0) return;
        runner.highestScore = value;
        if (runner.distanceMeter) {
            runner.distanceMeter.setHighScore(value);
        }
    }

    function currentScorePixels() {
        return runner ? Math.ceil(runner.highestScore || 0) : 0;
    }

    function isRewardedSupported() {
        var bridge = sdk();
        return Boolean(bridge && bridge.advertisement && bridge.advertisement.isRewardedSupported);
    }

    var FIRST_INTERSTITIAL_DELAY_MS = 60 * 1000;
    var INTERSTITIAL_INTERVAL_MS = 180 * 1000;
    var sessionStartedAt = Date.now();
    var lastInterstitialAt = 0;

    function configureInterstitial() {
        sessionStartedAt = Date.now();
        var bridge = sdk();
        var ads = bridge && bridge.advertisement;
        if (!ads || typeof ads.setMinimumDelayBetweenInterstitial !== 'function') return;
        safely(function () { ads.setMinimumDelayBetweenInterstitial(180); });
    }

    function showInterstitial() {
        var bridge = sdk();
        var ads = bridge && bridge.advertisement;
        if (!ads || typeof ads.showInterstitial !== 'function') return;
        if (ads.isInterstitialSupported === false) return;
        var now = Date.now();
        var elapsed = lastInterstitialAt ? now - lastInterstitialAt : now - sessionStartedAt;
        var required = lastInterstitialAt ? INTERSTITIAL_INTERVAL_MS : FIRST_INTERSTITIAL_DELAY_MS;
        if (elapsed < required) return;
        lastInterstitialAt = now;
        safely(function () { ads.showInterstitial('game_over'); });
    }

    function showRewarded() {
        return new Promise(function (resolve) {
            var bridge = sdk();
            if (!isRewardedSupported()) {
                resolve(false);
                return;
            }

            var rewarded = false;
            var eventName = bridge.EVENT_NAME && bridge.EVENT_NAME.REWARDED_STATE_CHANGED;
            var settled = false;
            function finish() {
                if (settled) return;
                settled = true;
                document.removeEventListener('visibilitychange', noop);
                resolve(rewarded);
            }
            function onState(state) {
                if (state === 'rewarded') rewarded = true;
                if (state === 'closed' || state === 'failed') {
                    finish();
                }
            }

            if (eventName && typeof bridge.advertisement.on === 'function') {
                bridge.advertisement.on(eventName, onState);
            }

            safely(function () { bridge.advertisement.showRewarded('extra_life'); });

            setTimeout(finish, 120000);
        });
    }

    function noop() {}

    function bindHostEvents() {
        var bridge = sdk();
        if (!bridge || !bridge.platform || typeof bridge.platform.on !== 'function') return;
        var events = bridge.EVENT_NAME || {};
        if (events.AUDIO_STATE_CHANGED) {
            bridge.platform.on(events.AUDIO_STATE_CHANGED, function (enabled) {
                setMuted(!enabled);
            });
        }
        if (events.PAUSE_STATE_CHANGED) {
            bridge.platform.on(events.PAUSE_STATE_CHANGED, function (paused) {
                setPaused(paused);
            });
        }
    }

    function bindHud() {
        document.getElementById('restart-btn').addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            hideRevive();
            if (runner) runner.restart();
        });

        document.getElementById('revive-btn').addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var btn = e.currentTarget;
            btn.disabled = true;
            showRewarded().then(function (ok) {
                btn.disabled = false;
                if (ok && runner) {
                    reviveUsedThisRun = true;
                    hideRevive();
                    document.body.classList.add('playing');
                    runner.continueRun();
                    sendMessage('level_started');
                }
            });
        });

        var duckBtn = document.getElementById('duck-btn');
        function duckStart(e) {
            e.preventDefault();
            e.stopPropagation();
            if (!runner || runner.holdingResume || !runner.playing || runner.crashed) return;
            if (runner.tRex.jumping) runner.tRex.setSpeedDrop();
            else runner.tRex.setDuck(true);
        }
        function duckEnd(e) {
            e.preventDefault();
            e.stopPropagation();
            if (!runner) return;
            runner.tRex.speedDrop = false;
            runner.tRex.setDuck(false);
        }
        duckBtn.addEventListener('pointerdown', duckStart);
        duckBtn.addEventListener('pointerup', duckEnd);
        duckBtn.addEventListener('pointerleave', duckEnd);
        duckBtn.addEventListener('pointercancel', duckEnd);
    }

    function detectTouch() {
        if (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) {
            document.body.classList.add('is-touch');
        }
    }

    Runner.onReady = function (instance) {
        runner = instance;
        applyStoredHighScore(pendingHighScore);
        sendMessage('game_ready');
    };

    Runner.onStart = function () {
        reviveUsedThisRun = false;
        hideRevive();
        document.body.classList.add('playing');
        sendMessage('level_started');
    };

    Runner.onRestart = function () {
        reviveUsedThisRun = false;
        hideRevive();
        document.body.classList.add('playing');
        sendMessage('level_started');
    };

    Runner.onContinue = function () {
        document.body.classList.add('playing');
    };

    Runner.onGameOver = function (instance) {
        document.body.classList.remove('playing');
        persistHighScore(currentScorePixels());
        sendMessage('level_failed');

        var canRevive = !reviveUsedThisRun && isRewardedSupported();
        showRevive(canRevive);
        showInterstitial();
        void instance;
    };

    async function boot() {
        detectTouch();
        bindHud();

        var bridge = sdk();
        if (bridge && typeof bridge.initialize === 'function' && !bridge.isInitialized) {
            try {
                var platformId = bridge.platform && bridge.platform.id;
                if (platformId !== 'mock' && platformId !== 'standalone') {
                    await bridge.initialize();
                }
            } catch (err) {
                console.warn('[dino] bridge init failed', err);
            }
        }

        document.documentElement.lang = 'en';
        document.documentElement.dir = 'ltr';
        applyCopy();

        if (bridge && bridge.platform && bridge.platform.isAudioEnabled === false) {
            setMuted(true);
        }

        configureInterstitial();
        bindHostEvents();

        if (bridge && bridge.storage && typeof bridge.storage.get === 'function') {
            try {
                var data = await bridge.storage.get([STORAGE_KEY]);
                pendingHighScore = Number(data && data[0]) || 0;
            } catch (err) {
                pendingHighScore = 0;
            }
        }

        if (typeof window.startDinoGame === 'function') {
            window.startDinoGame();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
