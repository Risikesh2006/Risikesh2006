# Profile graphics

`generate-profile.mjs` uses Node 24 and GitHub's REST and GraphQL APIs, with no package dependencies. Run from the repository root with `GITHUB_TOKEN` set. Never commit a token.

The daily `Refresh profile graphics` workflow uses the built-in Actions token and commits successful SVG snapshots to `assets/`. It can also be run manually from Actions. If an API request fails, the workflow fails before writing graphics, preserving the previous images. The date on each card makes stale data visible.

Statistics cover public repositories. Stars exclude forked repositories. Language bars count primary languages in owned, non-fork public repositories, not language bytes or proficiency. Contributions use GitHub's returned calendar; streaks are limited to that calendar, and an unfinished last day does not reset the current streak. Trophies are custom metric cards, not official awards or third-party trophy ranks.

The independent snake workflow publishes light and dark animations to the `output` branch every six hours. The README references those files directly. The header is a local, script-free animated SVG with a reduced-motion alternative.

If updates stop, inspect the relevant run under Actions. Both workflows require repository contents write permission. Scheduled workflows may be disabled by GitHub after prolonged repository inactivity; re-enable them in Actions if needed.
