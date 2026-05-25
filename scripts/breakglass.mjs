#!/usr/bin/env node
/**
 * Breakglass CLI runner.
 *
 * Loads .env, builds the CLI app, then executes with forwarded args.
 *
 * Usage:
 *   node scripts/breakglass.mjs user --email owner@example.com --confirm
 *   node scripts/breakglass.mjs bulk --confirm
 *   node scripts/breakglass.mjs revert --since 2026-01-01T00:00:00Z --confirm
 */
import { spawn, execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

// ─── Load .env ──────────────────────────────────────────────────────────────

const envFile = '.env';
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    // Strip optional `export ` prefix (e.g. `export FOO=bar`)
    const rawKey = trimmed.slice(0, idx).trim();
    const key = rawKey.startsWith('export ') ? rawKey.slice(7).trim() : rawKey;
    const val = trimmed
      .slice(idx + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2');
    if (!(key in process.env)) process.env[key] = val;
  }
}

// ─── Build ──────────────────────────────────────────────────────────────────

try {
  execSync('pnpm exec nx build breakglass-cli --skip-nx-cache', { stdio: 'inherit' });
} catch {
  process.exit(1);
}

// ─── Run ────────────────────────────────────────────────────────────────────

const cliArgs = process.argv.slice(2).filter((a) => a !== '--');

const child = spawn('node', ['apps/breakglass-cli/dist/main.js', ...cliArgs], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
