#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const appName = args.find((a) => !a.startsWith('--'));

if (!appName) {
  console.error(
    '[env] usage: node scripts/serve.mjs <app> [--env=local|stag|staging|prod|production]',
  );
  process.exit(1);
}

const envArg = args.find((a) => a.startsWith('--env='));
const rawEnv = envArg ? envArg.replace('--env=', '') : 'local';

const ALIASES = { dev: 'local', stag: 'staging', prod: 'production' };
const appEnv = ALIASES[rawEnv] ?? rawEnv;
const envFile = appEnv === 'local' ? '.env' : `.env.${appEnv}`;

if (!existsSync(envFile)) {
  console.error(`[env] file not found: ${envFile}`);
  process.exit(1);
}

function parseEnvFile(filePath) {
  const vars = {};
  for (const line of readFileSync(filePath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed
      .slice(idx + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2');
    vars[key] = val;
  }
  return vars;
}

const envVars = parseEnvFile(envFile);
console.log(`[env] APP=${appName}  file=${envFile}  vars=${Object.keys(envVars).length}`);

const child = spawn('pnpm', ['exec', 'nx', 'serve', appName], {
  stdio: 'inherit',
  // envVars spread AFTER process.env so they override Nx's auto-loaded .env
  env: { ...process.env, ...envVars, ENV_FILE: envFile },
  // Windows requires shell: true to resolve pnpm.cmd (Node CVE-2024-27980)
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 0));
