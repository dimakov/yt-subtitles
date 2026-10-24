# Microsoft Edge Add-ons submission kit

Everything to paste or upload in Partner Center for
**Subtitle Downloader for YouTube**, in the order the pages appear. Images are
in `store/images/`. Regenerate them with `node scripts/capture_store_images.mjs`
(Windows Node) after UI changes.

## Packages

Upload `dist/subtitle-downloader-for-youtube-<version>.zip` (built by
`python3 scripts/package.py`). Every update needs a higher `version` in
`extension/manifest.json`.

## Availability

- Visibility: **Public**
- Markets: all markets (default)

## Properties

- Category: **Productivity**
- Website: `https://github.com/dimakov/yt-subtitles`
- Support contact: `https://github.com/dimakov/yt-subtitles/issues`
- Mature content: not checked

## Privacy

**Single purpose description**

```
Downloads the subtitles or captions of the YouTube video in the current tab as an SRT, WebVTT, plain-text or JSON file (or copies them to the clipboard), optionally translated with YouTube's built-in auto-translation.
```

**Permission justification**

- `scripting`:
  ```
  Runs the extension's own packaged script (page/page-api.js) in the YouTube tab the user is viewing, to read that video's list of caption tracks and fetch the caption file the user picked. No remote code is loaded.
  ```
- `downloads`:
  ```
  Saves the subtitle file the user chose (SRT, VTT, TXT or JSON) when they press Download.
  ```
- Host permissions `https://www.youtube.com/*`, `https://m.youtube.com/*`:
  ```
  YouTube is the only site the extension works on. Access is needed to run the content script on video pages and to request the video's captions from youtube.com.
  ```

**Are you using remote code?** No, I am not using remote code.

**Data usage**

- What user data do you plan to collect: check **nothing**. Captions and video
  details are processed only inside the user's browser and never sent to the
  developer or any third party.
- Check all three certifications (no selling or transferring data, no use
  unrelated to the single purpose, no use for creditworthiness or lending).

**Privacy policy URL**

```
https://github.com/dimakov/yt-subtitles/blob/main/PRIVACY.md
```

## Store listing (English)

The extension name and short description come from the manifest.

**Description** (about 1,500 characters; the minimum is 250)

```
Save the subtitles of any YouTube video in one click.

Open a video, click the Subtitle Downloader icon, choose a subtitle track and a format, and press Download — or Copy to put the text on your clipboard.

FEATURES
• Every subtitle track the video offers: subtitles uploaded by the creator and YouTube's auto-generated captions, in every available language.
• Auto-translation: get subtitles in another language through YouTube's built-in translation.
• Four formats:
  – SRT for video players and editors
  – WebVTT for web players
  – Plain text (TXT), optionally with [m:ss] timestamps — ideal for notes, quotes and study
  – JSON with start and end times, for developers
• Files are named "<video title> [<video id>].<language>.srt", so players such as VLC and mpv pick them up next to a downloaded video.
• Auto-generated captions are cleaned up into sequential lines without overlaps.
• Remembers your last format and translation language.
• Light and dark themes.

PRIVACY
No account, no tracking, no analytics, no ads. The extension talks only to youtube.com, from your own tab, and never sends your data anywhere. It needs access to YouTube pages and the downloads permission, and nothing else.

GOOD TO KNOW
For translations, the extension may briefly switch the player's CC button on and back off so YouTube prepares the subtitles.

Subtitle Downloader for YouTube is an independent project. It is not affiliated with, endorsed by or sponsored by YouTube or Google.
```

**Extension logo**: `store/images/logo-300.png` (300 × 300)

**Small promotional tile**: `store/images/promo-small-440x280.png`

**Large promotional tile**: `store/images/promo-large-1400x560.png`

**Screenshots** (1280 × 800, in this order):

1. `store/images/screenshot-1-download.png`
2. `store/images/screenshot-2-translate.png`
3. `store/images/screenshot-3-formats.png`
4. `store/images/screenshot-4-dark.png`

**YouTube video URL**: leave empty.

**Search terms** (7 terms, 10 words; limits are 7 terms, 30 characters each, 21 words):

```
youtube subtitles
subtitle downloader
captions
transcript
srt
vtt
translate subtitles
```

## Notes for certification

```
No account or setup is needed.

1. Open any YouTube video that has captions, for example an MIT OpenCourseWare lecture: https://www.youtube.com/watch?v=Unzc731iCUY
2. Click the Subtitle Downloader toolbar icon.
3. Choose a subtitle track, a format (SRT, VTT, TXT or JSON) and press Download. The file is saved through the browser's downloads. "Copy" puts the same text on the clipboard.
4. Optional: choose a language under "Translate to" to download YouTube's auto-translated subtitles. For this the extension may briefly toggle the player's CC button and then restore it.

The extension only runs on www.youtube.com and m.youtube.com, sends no data anywhere except requests to youtube.com from the user's tab, and contains no remote code. Source code: https://github.com/dimakov/yt-subtitles
```
