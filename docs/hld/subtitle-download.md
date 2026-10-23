# HLD: YouTube subtitle download

## What the feature does

The toolbar popup lists the caption tracks of the YouTube video in the active
tab: uploaded subtitles and auto-generated (ASR) captions. The user picks one,
optionally a YouTube auto-translation target, and an output format (SRT, WebVTT,
TXT with optional timestamps, or JSON), then downloads a file or copies the
text. The extension has no background service worker, no server and no
analytics.

## Components and ownership

| File | Runs in | Owns |
| --- | --- | --- |
| `extension/manifest.json` | — | Permissions (`scripting`, `downloads`, YouTube hosts) and the main-world content script at `document_start` |
| `extension/page/page-api.js` | YouTube page, main world | Video and track discovery, PO token capture, every request to youtube.com, the fallback order |
| `extension/lib/captions.js` | popup, Node tests | json3 → cue list `{ start, end, text }` in ms, ASR roll-up overlap clamping |
| `extension/lib/formats.js` | popup, Node tests | Cue serialisers, timestamps, file-name building and sanitising |
| `extension/popup/*` | extension popup | UI state, track preference, calling the page API, downloads, clipboard, remembered preferences |
| `scripts/make_icons.py` | dev machine | Icon artwork (PNG at 16/32/48/128) |
| `scripts/package.py` | dev machine | Store zip `dist/subtitle-downloader-for-youtube-<version>.zip` |

## Why the page script exists

Measured from a residential connection on 2026-10-23 and 2026-10-24:

- The web player's `captionTracks[].baseUrl` (`/api/timedtext?...&exp=xpe`)
  returns **HTTP 200 with an empty body** unless the player's PO token
  parameters (`pot`, `potc`, `c`, `cver`, ...) are added.
- The player's own timed-text XHR carries those parameters and shows up, with
  its full URL, in the page's Resource Timing entries.
- A token taken from one track's request works for every other track and
  translation of the same video when merged into that track's `baseUrl`.
- `POST /youtubei/v1/player` with client `ANDROID` (20.10.38) or `IOS`
  (20.10.4) returns caption URLs that work **without** a token. The ANDROID
  response omits `kind`, so ASR tracks are detected by `vssId` starting `a.`.
- Adding `&tlang=` to an ANDROID caption URL returned HTTP 429 at least once;
  translations with a PO token worked every time.
- Videos may set `captionsInitialState: CAPTIONS_INITIAL_STATE_ON_RECOMMENDED`.
  The player then turns captions on by itself shortly after load, which also
  yields a capturable token. A user's "captions off" choice persists across
  reloads and prevents that.

The token is available only to code running as the page, and the requests
must be same-origin youtube.com requests. That is why fetching happens in the
main world rather than in the popup.

## Data flow

```
popup.js                         page-api.js (YouTube tab, main world)            youtube.com
--------                         -------------------------------------            -----------
open ── executeScript(MAIN) ──▶  getVideoInfo()
                                   player.getPlayerResponse() (or
                                   ytInitialPlayerResponse; Innertube if
                                   the page copy has no captions)
     ◀── { video: {tracks, translationLanguages, ...} }

Download/Copy ── executeScript ─▶ fetchCaptions({videoId, vssId, languageCode, kind, tlang})
                                   1. captured token + page baseUrl  ──────────▶ /api/timedtext (cookies)
                                   2. ANDROID, then IOS player + baseUrl ──────▶ /youtubei/v1/player, /api/timedtext (no cookies)
                                   3. CC toggle → new token + page baseUrl ────▶ /api/timedtext (cookies)
                                   (with tlang: 1, 3, 2)
     ◀── { text: <json3>, source }
parseJson3 → renderSubtitles → chrome.downloads.download(data: URL) or clipboard
```

Token capture: a `PerformanceObserver({ type: 'resource', buffered: true })`
records every `/api/timedtext` URL that has `pot`, keyed by `v` (the 20 most
recent videos). Observers keep receiving entries after the Resource Timing
buffer fills, and nothing in YouTube's code is patched.

`withPlayerToken` merges every query parameter of the captured URL that the
target `baseUrl` lacks, except the track selectors `v, lang, tlang, kind, name,
fmt`. The signature parameters stay those of the target track.

CC toggle (`requestTokenFromPlayer`): click `.ytp-subtitles-button` (twice,
250 ms apart, if captions were already on), poll up to 8 s for a token URL
different from the one known before, then click once more if captions were
off at the start.

## Contracts

**Page API.** `window.__ytSubtitleDownloader = { version, getVideoInfo, fetchCaptions }`.
Everything passed in or out is JSON-safe, because `executeScript` structured-clones it.

- `getVideoInfo()` → `{ video: { videoId, title, author, lengthSeconds, source, tracks: [{ vssId, languageCode, name, kind: 'standard'|'asr', isTranslatable }], translationLanguages: [{ languageCode, name }] } }`,
  or `{ reason: 'not-video' | 'no-player' }`.
- `fetchCaptions({ videoId, vssId, languageCode, kind, tlang })` → `{ text, source }`,
  where `text` is the raw json3 document. It throws if the tab now shows a
  different video, or with one message listing every strategy's failure.

`version` lets a newer build replace an older copy already in a tab. The guard
skips injection only when an equal or newer version is present. Bump
`API_VERSION` when the contract changes.

**popup → page call.** `callPage` runs an async function in the main world
that wraps results as `{ value }`, `{ error }` or `{ missing }`. On `missing`
it injects `page/page-api.js` once (for tabs opened before installation). An
empty result (the document was replaced mid-call) is retried once after 500 ms.
Each call is capped at 60 s, and every request inside the page at 15 s
(`AbortSignal.timeout`), so a stalled request moves on to the next strategy.

**json3.** `events[]` with `tStartMs`, `dDurationMs` and `segs[].utf8`. Window
definition events have no `segs`. ASR line breaks are `aAppend` events holding
only `"\n"`, and ASR word segments carry `tOffsetMs`. In ASR tracks each line's
duration overlaps the next line (two-line roll-up); `rollingWindow: true`
clamps each cue's end to the next cue's start. Uploaded tracks keep their
overlaps, since speakers can legitimately overlap.

**Downloads.** `chrome.downloads.download` with a base64 `data:` URL. A
popup-owned `blob:` URL dies if the popup closes, which happens when a Save As
dialog takes focus. `conflictAction: 'uniquify'` adds a suffix to duplicate
names.

## Persistence

Only per-profile UI conveniences: `localStorage['subtitle-downloader-prefs']` =
`{ format, timestamps, translate }` in the popup origin. Every read and write is
wrapped in try/catch. No subtitle data or video history is stored.

## Tests

- `npm test` runs `node --test` over:
  - `tests/captions.test.js`: json3 parsing, ASR clamping, text cleaning.
  - `tests/formats.test.js`: exact SRT, VTT, TXT and JSON output, timestamps, file names.
  - `tests/page-api.test.js`: runs `page-api.js` in a `vm` context with a fake
    player, CC button, PerformanceObserver and `fetch`. It covers track mapping,
    token merging, strategy order, cookie modes, CC restoration (on and off),
    429 reporting and the stale-video guard.
- Fixtures are synthetic, modelled on real json3 structure.
- Manual or CDP check in Edge, last run 2026-10-24 on Edge 155: load unpacked,
  open a captioned lecture, then download every format, an ASR track and two
  translations, and Copy.
  - Use a throwaway profile with `--disable-sync`; otherwise Edge signs the
    profile into the Windows Microsoft account and syncs.
  - Set `extensions.ui.developer_mode: true` in its Preferences. Without it,
    Edge disables `--load-extension` extensions on the next launch
    (`DISABLE_UNSUPPORTED_DEVELOPER_EXTENSION`).
  - Do not set CDP `Browser.setDownloadBehavior`; it renames downloads to `download.*`.

## Extending safely

- **New output format.** Add an entry to `FORMATS` and a branch in
  `renderSubtitles` (`lib/formats.js`) with an exact-output test. The popup
  builds its format buttons from `FORMATS`; with more than four entries, adjust
  `.segmented` in `popup.css`.
- **New fetch strategy.** Add it in `fetchCaptions` as a `[label, run]` pair.
  `run` returns the json3 text, `null` for "empty", or throws. Keep strategies
  without side effects before the CC toggle, and add a `vm` test for the
  ordering.
- **When YouTube changes.** Re-run the probes listed under "Why the page script
  exists". Client names and versions live in `INNERTUBE_CLIENTS`. The selectors
  are `#movie_player`, `#shorts-player`, `.html5-video-player` and
  `.ytp-subtitles-button`.
- **In-page button or keyboard shortcut.** Reuse the page API. Do not fetch
  from an isolated-world content script: it cannot see the player's tokens or
  `getPlayerResponse`.
- **Permissions.** Requesting more than `scripting`, `downloads` and the two
  YouTube hosts changes the store review and the install prompt; avoid it
  unless a feature needs it.
