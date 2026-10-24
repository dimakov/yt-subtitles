# Privacy Policy — Subtitle Downloader for YouTube

Effective date: 24 October 2026

Subtitle Downloader for YouTube ("the extension") is a browser extension that
downloads the subtitles of the YouTube video open in your current tab. This
policy explains what the extension accesses and what it does with it.

## Summary

The extension does not collect, store, sell or share any personal data. It has
no servers, no accounts, no analytics and no advertising. Everything it does
happens in your browser.

## What the extension accesses

When you open the extension's popup on a YouTube video page, the extension
reads, inside that tab:

- the video's ID, title, channel name and length;
- the list of available subtitle tracks and translation languages;
- the subtitle text of the track you choose to download or copy.

To get this information, the extension makes requests **only to youtube.com**,
from the YouTube tab, in the same way the YouTube player does. YouTube handles
those requests under Google's own privacy policy. The extension does not send
any data to the developer or to any other third party.

## What the extension stores

Only three popup preferences, kept in your browser's local storage for the
extension: the last subtitle format, whether timestamps are enabled, and the
last translation language. They never leave your device, and you can clear
them by removing the extension.

Subtitle files you download are saved by your browser to your Downloads folder
(or the location you choose). Text you copy goes to your clipboard. The
extension keeps no copy of either.

## Permissions

- **Access to www.youtube.com and m.youtube.com**: the only sites the extension
  works on. It is needed to read the caption track list and fetch subtitles.
- **scripting**: runs the extension's own packaged script in the YouTube tab.
  The extension never loads code from the internet.
- **downloads**: saves the subtitle file you chose.

## Children

The extension does not knowingly collect any data from anyone, including
children.

## Changes

If this policy changes, the new version will be published at this address,
with a new effective date.

## Contact

Questions or concerns: open an issue at
https://github.com/dimakov/yt-subtitles/issues

The extension is an independent project and is not affiliated with, endorsed
by or sponsored by YouTube or Google.
