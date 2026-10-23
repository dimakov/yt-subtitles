// Turns YouTube "json3" timed-text documents into a flat, sorted list of cues.
//
// A cue is { start, end, text } with times in milliseconds. The parser is pure
// so the popup and the Node tests share it; fetching lives in page/page-api.js.

const ZERO_WIDTH = /[​‌‍⁠﻿]/g;

// Used when an event carries no usable duration and nothing follows it.
export const FALLBACK_DURATION_MS = 2000;

/**
 * @param {string | object} input json3 document text or parsed object.
 * @param {{ rollingWindow?: boolean }} [options] rollingWindow is for
 *   auto-generated (ASR) tracks: YouTube shows them as a two-line roll-up, so
 *   each line's duration overlaps the next line. Clamping every cue to the
 *   start of the next one gives sequential, non-overlapping subtitles.
 * @returns {{ start: number, end: number, text: string }[]}
 */
export function parseJson3(input, { rollingWindow = false } = {}) {
  const doc = typeof input === 'string' ? JSON.parse(input) : input;
  const events = Array.isArray(doc?.events) ? doc.events : [];
  const cues = [];
  for (const event of events) {
    // Window-definition events have no segments; roll-up line breaks
    // ("aAppend" events) only contain "\n" and clean to an empty string.
    if (!Array.isArray(event.segs)) continue;
    const text = cleanText(event.segs.map((seg) => seg.utf8 ?? '').join(''));
    if (!text) continue;
    const start = Math.max(0, Math.round(Number(event.tStartMs) || 0));
    const duration = Math.max(0, Math.round(Number(event.dDurationMs) || 0));
    cues.push({ start, end: start + duration, text });
  }
  cues.sort((a, b) => a.start - b.start);
  return finalizeTimings(cues, rollingWindow);
}

/** Normalises caption text: strips zero-width characters, trims lines, drops blank lines. */
export function cleanText(raw) {
  return String(raw)
    .replace(ZERO_WIDTH, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function finalizeTimings(cues, rollingWindow) {
  for (let i = 0; i < cues.length; i += 1) {
    const cue = cues[i];
    const next = cues[i + 1];
    if (rollingWindow && next && cue.end > next.start) cue.end = next.start;
    if (cue.end <= cue.start) {
      cue.end = next && next.start > cue.start ? next.start : cue.start + FALLBACK_DURATION_MS;
    }
  }
  return cues;
}
