import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildFilename,
  formatClock,
  formatTimestamp,
  renderSubtitles,
  sanitizeFilenamePart,
} from '../extension/lib/formats.js';

const cues = [
  { start: 1200, end: 3600, text: 'Welcome to the workshop.' },
  { start: 4000, end: 7000, text: 'Today we build\na bird feeder.' },
  { start: 3_725_042, end: 3_727_000, text: 'Tools & <safety> first' },
];

test('formats SRT and WebVTT timestamps', () => {
  assert.equal(formatTimestamp(3_725_042, ','), '01:02:05,042');
  assert.equal(formatTimestamp(0, '.'), '00:00:00.000');
  assert.equal(formatTimestamp(-5, '.'), '00:00:00.000');
});

test('formats reading clocks for transcripts', () => {
  assert.equal(formatClock(1200), '0:01');
  assert.equal(formatClock(754_000), '12:34');
  assert.equal(formatClock(3_725_042), '1:02:05');
});

test('renders SRT with numbered blocks', () => {
  assert.equal(
    renderSubtitles('srt', cues.slice(0, 2)),
    '1\n00:00:01,200 --> 00:00:03,600\nWelcome to the workshop.\n\n' +
      '2\n00:00:04,000 --> 00:00:07,000\nToday we build\na bird feeder.\n',
  );
});

test('renders WebVTT with a header and escaped markup characters', () => {
  assert.equal(
    renderSubtitles('vtt', [cues[0], cues[2]]),
    'WEBVTT\n\n00:00:01.200 --> 00:00:03.600\nWelcome to the workshop.\n\n' +
      '01:02:05.042 --> 01:02:07.000\nTools &amp; &lt;safety&gt; first\n',
  );
});

test('renders plain text with and without timestamps', () => {
  assert.equal(
    renderSubtitles('txt', cues),
    'Welcome to the workshop.\nToday we build a bird feeder.\nTools & <safety> first\n',
  );
  assert.equal(
    renderSubtitles('txt', cues, { timestamps: true }),
    '[0:01] Welcome to the workshop.\n[0:04] Today we build a bird feeder.\n[1:02:05] Tools & <safety> first\n',
  );
  assert.equal(renderSubtitles('txt', []), '');
});

test('renders JSON with metadata and times in seconds', () => {
  const doc = JSON.parse(renderSubtitles('json', cues.slice(0, 1), { meta: { videoId: 'abcDEF12345', language: 'en' } }));
  assert.deepEqual(doc, {
    videoId: 'abcDEF12345',
    language: 'en',
    cues: [{ start: 1.2, end: 3.6, text: 'Welcome to the workshop.' }],
  });
});

test('rejects unknown formats', () => {
  assert.throws(() => renderSubtitles('ass', cues), /Unknown subtitle format/);
});

test('builds yt-dlp style file names', () => {
  assert.equal(
    buildFilename({ title: 'How to: build a "bird" feeder?', videoId: 'abcDEF12345', language: 'en', extension: 'srt' }),
    'How to build a bird feeder [abcDEF12345].en.srt',
  );
  assert.equal(
    buildFilename({ title: '...', videoId: 'abcDEF12345', language: 'zh-Hant', extension: 'vtt' }),
    'YouTube video [abcDEF12345].zh-Hant.vtt',
  );
});

test('sanitizes file name parts without splitting surrogate pairs', () => {
  assert.equal(sanitizeFilenamePart(' a/b\\c|d\u0007e. '), 'a b c d e');
  const long = `${'x'.repeat(9)}\u{1F426}tail`;
  assert.equal(sanitizeFilenamePart(long, 10), `${'x'.repeat(9)}\u{1F426}`);
});
