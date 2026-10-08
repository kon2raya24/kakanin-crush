// Browser-only modules can't run under node, but they must at least parse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('every source module parses', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kc-syntax-'));
  for (const f of readdirSync(new URL('../src', import.meta.url)).filter((f) => f.endsWith('.mjs'))) {
    const p = join(dir, f); writeFileSync(p, readFileSync(new URL(`../src/${f}`, import.meta.url)));
    assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', p]), f);
  }
  for (const f of ['kakanin3d.mjs', 'stall3d.mjs']) assert.ok(readdirSync(new URL('../src', import.meta.url)).includes(f), `${f} exists`);
});
