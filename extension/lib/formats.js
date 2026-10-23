// Serialises cues (see captions.js) into downloadable subtitle files and
// builds file names that are valid on Windows, macOS and Linux.

export const FORMATS = {
  srt: { label: 'SRT', extension: 'srt', mime: 'application/x-subrip' },
  vtt: { label: 'VTT', extension: 'vtt', mime: 'text/vtt' },
  txt: { label: 'TXT', extension: 'txt', mime: 'text/plain' },
  json: { label: 'JSON', extension: 'json', mime: 'application/json' },
};

/**
 * @param {keyof FORMATS} format
 * @param {{ start: number, end: number, text: string }[]} cues
 * @param {{ timestamps?: boolean, meta?: object }} [options] timestamps applies
 *   to TXT; meta is copied into the JSON document next to the cues.
 */
export function renderSubtitles(format, cues, { timestamps = false, meta = {} } = {}) {
  switch (format) {
    case 'srt':
      return toSrt(cues);
    case 'vtt':
      return toVtt(cues);
    case 'txt':
      return toText(cues, { timestamps });
    case 'json':
      return toJson(cues, meta);
    default:
      throw new Error(`Unknown subtitle format: ${format}`);
  }
}

export function toSrt(cues) {
  return cues
    .map((cue, index) => `${index + 1}\n${formatTimestamp(cue.start, ',')} --> ${formatTimestamp(cue.end, ',')}\n${cue.text}\n`)
    .join('\n');
}

export function toVtt(cues) {
  const body = cues
    .map((cue) => `${formatTimestamp(cue.start, '.')} --> ${formatTimestamp(cue.end, '.')}\n${escapeVtt(cue.text)}\n`)
    .join('\n');
  return `WEBVTT\n\n${body}`;
}

export function toText(cues, { timestamps = false } = {}) {
  const lines = cues.map((cue) => {
    const text = cue.text.replace(/\n/g, ' ');
    return timestamps ? `[${formatClock(cue.start)}] ${text}` : text;
  });
  return lines.length ? `${lines.join('\n')}\n` : '';
}

export function toJson(cues, meta = {}) {
  const document = {
    ...meta,
    cues: cues.map((cue) => ({ start: cue.start / 1000, end: cue.end / 1000, text: cue.text })),
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}

/** HH:MM:SS<separator>mmm, as used by SRT (",") and WebVTT ("."). */
export function formatTimestamp(ms, separator) {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor(total / 60_000) % 60;
  const seconds = Math.floor(total / 1000) % 60;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}${separator}${pad(total % 1000, 3)}`;
}

/** Short reading clock for transcripts: M:SS, or H:MM:SS from one hour on. */
export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  const seconds = total % 60;
  return hours ? `${hours}:${pad(minutes, 2)}:${pad(seconds, 2)}` : `${minutes}:${pad(seconds, 2)}`;
}

/** "<title> [<videoId>].<language>.<ext>", the yt-dlp naming players already recognise. */
export function buildFilename({ title, videoId, language, extension }) {
  const name = sanitizeFilenamePart(title) || 'YouTube video';
  const id = sanitizeFilenamePart(videoId);
  const lang = sanitizeFilenamePart(language).replace(/\s+/g, '-');
  return [`${name}${id ? ` [${id}]` : ''}`, lang, extension].filter(Boolean).join('.');
}

export function sanitizeFilenamePart(value, maxLength = 120) {
  const cleaned = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Slice by code point so a surrogate pair is never split, then drop dots and
  // spaces at the ends, which Windows and the downloads API reject.
  return Array.from(cleaned).slice(0, maxLength).join('').replace(/^[.\s]+|[.\s]+$/g, '');
}

function escapeVtt(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pad(value, width) {
  return String(value).padStart(width, '0');
}
