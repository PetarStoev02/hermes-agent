# Local personalized Hermes (branch `local`)

This checkout is Petar's fork (`origin` = PetarStoev02/hermes-agent, `upstream` =
NousResearch/hermes-agent, push disabled). The `local` branch is a personal build of the desktop
app, "Hermes Local", installed next to the official Hermes. `AGENTS.md` still applies; these rules
add to it.

## Rules

- **Never open a PR from `local`** and never cherry-pick its personalization commits into a PR
  branch. Upstream work goes on a feature branch off `main`, then gets merged into `local`.
- **`main` mirrors upstream:** fast-forward only, no commits of its own.
- **Never modify PR branches** (e.g. `feat/nested-bot-sidebar-folders`) to fit `local`; resolve
  conflicts in the merge on `local`. Keep upstream behaviour unless a merged change replaces it on
  purpose.
- **Personalization lives in two places only,** so upstream merges stay easy:
  - `apps/desktop/product-identity.cjs`: fixed "Hermes Local" identity (own appId, userData,
    single-instance lock, `hermes-local` CLI) and `channel: null` (no update feed, no auto-update).
  - `scripts/generate_icons.py`: the Hermes Local icon flavor (white girl on a navy-indigo
    gradient). Change the icon there and regenerate; never hand-edit the PNG/ICNS outputs. After
    regenerating, restore files outside `apps/desktop/` (renderer version drift) and
    `apps/desktop/packaging/dmg-volume.icns`.
- **Plans for upcoming work** live in `plans/` (only on `local`). Start with `plans/bots-redesign/PLAN.md`.
- Upstream tests that pin the official identity or icon flavors fail on `local`; that is expected.

## Update and rebuild

```sh
git fetch upstream && git checkout main && git merge --ff-only upstream/main && git push origin main
git checkout local && git merge main && git push origin local
SDKROOT=/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX26.0.sdk scripts/build-bundle.sh
```

The build needs a clean checkout. `SDKROOT` pins Xcode 26's SDK because Xcode 26's `ld` cannot
read the Command Line Tools macOS 27 SDK. Install `apps/desktop/release/HermesBundled-*-mac-arm64.dmg`
over `/Applications/Hermes Local.app` (quit it first); settings survive because the appId is fixed.
