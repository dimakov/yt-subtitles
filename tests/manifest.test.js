// Store-submission checks on extension/manifest.json, so problems Partner
// Center or the Chrome Web Store would flag fail CI first.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('extension/manifest.json', root), 'utf8'));
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

test('version is a valid extension version and matches package.json', () => {
  assert.match(manifest.version, /^\d+(\.\d+){0,3}$/);
  for (const part of manifest.version.split('.')) assert.ok(Number(part) <= 65535, `version part ${part} > 65535`);
  assert.equal(pkg.version, manifest.version, 'bump package.json together with the manifest');
});

test('name, short_name and description fit store limits', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.name.length <= 75, 'name is limited to 75 characters');
  if ('short_name' in manifest) assert.ok(manifest.short_name.length <= 12, 'short_name is limited to 12 characters');
  assert.ok(manifest.description.length <= 132, 'description is limited to 132 characters');
});

test('every file the manifest references exists', () => {
  const files = [
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
    manifest.action.default_popup,
    ...manifest.content_scripts.flatMap((script) => script.js ?? []),
  ];
  for (const file of files) assert.ok(existsSync(new URL(`extension/${file}`, root)), `missing extension/${file}`);
});
