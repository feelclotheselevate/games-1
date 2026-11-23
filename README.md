# games-1

Self-hosted HTML5 games, served with GitHub Pages: https://feelclotheselevate.github.io/games-1/

Each game lives in `games/<slug>/` with a `_capture.json` noting where it was downloaded from and its entry file.
Files that the original game loaded from a second asset host are stored under `games/<slug>/_cdn/<host>/`.
`games.json` lists every game and its launch URL. `.nojekyll` keeps Pages from hiding the `_cdn` folders.
