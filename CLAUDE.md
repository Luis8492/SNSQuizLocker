# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

"SNSQuizLocker" — a quiz gate that overlays SNS pages (YouTube per-video; X/Facebook/Instagram/TikTok/Reddit site-wide) with a quiz (dictation, ear training, tsume-shogi). The page stays locked (videos force-paused) until all questions of a randomly chosen round are answered correctly.

Comments, commit messages, and UI text are all in Japanese; follow that convention.

## Repository layout (multi-platform)

- `extension/` — the Chrome extension (Manifest V3), the shipping product. No build step, no package.json, no tests — plain ES5-style vanilla JS loaded directly as content scripts. **All paths in the Architecture section below are relative to `extension/`.**
- `android/` — Android native version (in development): a thin native shell (foreground-app detection + blocking activity) hosting the quiz assets from `extension/core/` + `extension/quizzes/` in a WebView, copied in at build time by a Gradle task. Never fork/duplicate quiz code into `android/` — `extension/` stays the single source of truth for quizzes.
- `ios/` — iOS version (planned; Screen Time API shield → quiz in-app).
- `docs/` — privacy policy, store listing draft, QA checklist. `scripts/` — data/icon generation. `tmp/` — raw data, gitignored.

## Development (extension)

- No build/lint/test commands. To run: load the `extension/` folder unpacked via `chrome://extensions` (developer mode), then open a YouTube video. After edits, reload the extension there and refresh the tab.
- `continue.html` is the standalone "keep practicing" page (reached after clearing a quiz); it can be opened directly as `chrome-extension://<id>/continue.html` for quick manual testing without YouTube.
- Store package = the `extension/` subtree: `git archive -o snsquizlocker-<ver>.zip HEAD:extension`.

## Architecture: platform (`core/`) vs. quiz plugins (`quizzes/`)

Everything hangs off a shared global `window.Kansho` (K). The platform layer knows nothing about quiz types; quizzes self-register into a registry and the platform delegates to whichever one `config.js` selects.

- `core/registry.js` — creates `window.Kansho`, `K.registerQuiz(spec)`, `K.getActiveQuiz()` (random pick from `K.config.enabledQuizzes`; unset → random among all registered quizzes, which is also what makes fork-mode work: delete unwanted quiz folders and only the rest are drawn). Also owns `K.data` (quiz data namespace) and `K.config`.
- `core/ui.js` — quiz-agnostic UI helpers exposed as `K.ui`: `el` (DOM builder), `forbidCopy`/`forbidPaste`, `renderHeader` (title + progress dots + "問 i / n").
- `core/sites.js` — site adapter registry (`K.registerSite`): each target SNS declares `match(hostname)` and `lockId(href)` (YouTube locks per video `v:`/`s:`; X/Facebook/Instagram/TikTok/Reddit lock site-wide as `"site"`). `K.getActiveSite(hostname)` filters by `K.config.enabledSites` (unset → YouTube only). Unlock keys are `<siteId>:<lockId>`, held in `sessionStorage` for the tab session.
- `core/host.js` — the site-agnostic gate: detects lock targets via the site adapters (navigation via `yt-navigate-finish`, `popstate`, and a 500 ms href poll that covers all SPAs), builds the overlay, pauses all `<video>` elements on a 400 ms interval — except ads (optional site-adapter hook `isAd(video)`; YouTube = inside `.html5-video-player.ad-showing`), which are muted instead so they run out during the quiz, and unmuted again when the ad ends or the gate closes (only videos the gate itself muted); a MutationObserver on class changes of the adapter's `adWatch` element (YouTube = `.html5-video-player`) reacts to ad start/end immediately instead of waiting for the next tick, calls `quiz.start(card, { onComplete })`, and renders the post-clear choice screen ("continue practicing" → `continue.html`, or unlock). Initial check waits on `K.config.onReady` since `enabledSites` loads async.
- `core/overlay.css` — shared styles and the design-token system. All colors come from `--k-*` custom properties defined on `.ytg-overlay` (light = "学習ノート": white notebook + celadon accent; dark = "夜の書斎": ink + amber), switched via `prefers-color-scheme`. Quiz CSS must use these tokens (exceptions: real-world fixed colors like the shogi board wood and piano keys). No emoji anywhere — each quiz declares a one-kanji `badge` (rendered as an outlined square hanko-style mark in the header and options panel). Memorization content is set in mincho with a left accent "spine" line; UI text is gothic. Progress is stamp circles (✓ done / numbered current). All classes are prefixed `ytg-`.
- `config.js` — loads the selections from `chrome.storage.sync` (`enabledQuizzes` / `enabledSites`, saved by the options panel) and exposes `K.config.onReady(cb)` since that read is async — `host.js`/`continue.js` wait on it. Unset defaults: all registered quizzes / YouTube only. `K.getActiveQuiz()` picks one at random per call (= per gate / per continue-page round); a round's questions all come from that one quiz.
- `background.js` — service worker whose only job is onboarding: opens the options panel once on install so users see what will be gated before it happens.
- `options.html`/`options.js` — selection panel, opened from the toolbar icon (click = popup, right-click → オプション). Two checkbox sections: quiz plugins (`enabledQuizzes`) and target SNS sites (`enabledSites`), each multi-select with minimum one, saved to `chrome.storage.sync`; changes propagate to open tabs via `chrome.storage.onChanged` and take effect from the next gate/round.
- `continue.js`/`continue.html` — extension-internal page that loops rounds of the active quiz indefinitely.
- `quizzes/<id>/` — one folder per quiz plugin: `koten` (古典文学 dictation), `hyakunin` (百人一首), `juon` (重音(2音) ear training), `senritsu` (旋律聴音 — 4-bar melody dictation onto an SVG staff, generated on the fly), `tsume` (詰将棋 — registers three quiz ids `tsume`/`tsume5`/`tsume7` for 3/5/7手詰 from one folder via `VARIANTS`; includes its own shogi rules engine + mate solver in `shogi.js`). **Each plugin documents its behavior, data provenance, grading rules, and tuning knobs in its own `quizzes/<id>/README.md` — read that before modifying a quiz, and keep it updated.** Quizzes must stay self-contained (no cross-quiz dependencies) — koten and hyakunin deliberately duplicate their normalize/diff logic so deleting either folder never breaks the other. Quiz data goes to `K.data.<name>`; tsume's raw source data lives in `tmp/` (gitignored) with regeneration scripts in `scripts/`.

### Quiz contract

A quiz registers `{ id, title, icon, start(container, ctx) }`. `start` builds one round inside `container`; on clearing all questions it calls `ctx.onComplete({ container, body, ui, el, restart })` and the platform draws the after-clear screen. Grading and other domain logic stay inside the quiz's folder.

### Script load order matters

Content scripts run in this order and share `window.Kansho`: `core/registry.js` → `core/ui.js` → `config.js` → quiz files → `core/host.js` (host must be last so quizzes are registered before the gate starts). `continue.html` mirrors the same order with `continue.js` last.

### Adding a new quiz or file — four places to update

Any new JS/CSS file must be registered in all of:
1. `manifest.json` `content_scripts.js`/`css` (JS after `config.js`, before `core/host.js`; CSS after `core/overlay.css`)
2. `manifest.json` `web_accessible_resources`
3. `continue.html` `<script>`/`<link>` tags
4. `options.html` `<script>` tags (JS only — the panel enumerates registered quizzes; no quiz CSS needed there)

The new quiz then appears in the selection panel. Also write a `quizzes/<id>/README.md` describing the plugin. See the "新しいクイズ形式を追加する" section of README.md for the full recipe.

## Behavioral specifics worth knowing

- Unlock state is per-tab-session only: `sessionStorage` key `ytg_unlocked_ids`, one entry per lock key (`youtube:v:<id>` / `youtube:s:<id>` / `x:site`, …).
- Adding a new target site = one `K.registerSite` block in `core/sites.js` + its match patterns in `manifest.json` (`content_scripts.matches` AND `web_accessible_resources.matches` — the latter is required for the cleared-screen navigation to `continue.html` to work from that origin).
- Copy/paste/context-menu blocking is intentionally best-effort — this is a self-restraint tool, not tamper-proofing. Don't add heavier countermeasures.
- Quiz-specific behavior (grading rules, feedback style, difficulty tuning) is documented per plugin in `quizzes/<id>/README.md`.
