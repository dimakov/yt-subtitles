import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { FALLBACK_DURATION_MS, cleanText, parseJson3 } from '../extension/lib/captions.js';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('parses uploaded tracks into sorted cues and keeps legitimate overlaps', () => {
  const cues = parseJson3(fixture('standard.json3.json'));
  assert.deepEqual(cues, [
    { start: 1200, end: 3600, text: 'Welcome to the workshop.' },
    { start: 4000, end: 7000, text: 'Today we build\na bird feeder.' },
    { start: 6500, end: 8500, text: 'Tools & <safety> first' },
    { start: 9000, end: 12000, text: 'No duration here' },
    { start: 12000, end: 13500, text: 'Thanks for watching.' },
  ]);
});

test('joins ASR word segments, skips window and line-break events, and clamps roll-up overlaps', () => {
  const cues = parseJson3(fixture('asr.json3.json'), { rollingWindow: true });
  assert.deepEqual(cues, [
    { start: 400, end: 2910, text: 'so the first step' },
    { start: 2910, end: 5610, text: 'is measuring the wood' },
    { start: 5610, end: 9610, text: 'twice before cutting' },
  ]);
});

test('without rollingWindow ASR cues keep their original durations', () => {
  const cues = parseJson3(fixture('asr.json3.json'));
  assert.deepEqual(
    cues.map((cue) => cue.end),
    [5600, 9010, 9610],
  );
});

test('a last cue without duration gets the fallback duration', () => {
  const cues = parseJson3({ events: [{ tStartMs: 500, segs: [{ utf8: 'end' }] }] });
  assert.deepEqual(cues, [{ start: 500, end: 500 + FALLBACK_DURATION_MS, text: 'end' }]);
});

test('accepts parsed objects and documents without events', () => {
  assert.deepEqual(parseJson3({}), []);
  assert.deepEqual(parseJson3('{"events":[]}'), []);
});

test('cleanText trims lines, collapses spaces and drops zero-width characters', () => {
  assert.equal(cleanText('  one​  two \r\n\n three\t\t'), 'one two\nthree');
  assert.equal(cleanText('\n'), '');
});
