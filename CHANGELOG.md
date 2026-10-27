# Changelog

Each version's section becomes its GitHub release notes, and can be pasted
into Partner Center's "Notes for certification" when the update is submitted.
Add a section here before tagging a release (see README, "Releasing").

## [1.0.1] - 2026-10-27

### Fixed

- Removed the manifest `short_name`, which exceeded Microsoft Edge's
  12-character limit and caused a Partner Center validation warning. The
  browser now shows the full name, "Subtitle Downloader for YouTube".

## [1.0.0] - 2026-10-24

### Added

- Toolbar popup that lists every subtitle track of the YouTube video in the
  current tab: uploaded subtitles and auto-generated captions.
- YouTube auto-translation into any language the video offers.
- SRT, WebVTT, plain text (optionally with `[m:ss]` timestamps) and JSON
  output, saved as `<title> [<video id>].<language>.<ext>` or copied to the
  clipboard.
- Clean, non-overlapping cues for auto-generated captions.
- Remembered format, timestamp and translation choices; light and dark themes.
