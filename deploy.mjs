/**
 * deploy.mjs
 *
 * Automated deploy script:
 *   1. Runs the test suite  (npm run test)
 *   2. Builds the app        (npm run build)
 *   3. Uploads dist/ to the  FTP server
 *
 * FTP credentials are read from .env.deploy (never commit that file).
 * Usage:  node deploy.mjs
 *         npm run deploy
 */

import { execSync }          from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname }     from 'path';
import { fileURLToPath }     from 'url';
import * as ftp              from 'basic-ftp';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
// Load .env.deploy
// ─────────────────────────────────────────────────────────────────────────────
function loadEnv(filePath) {
  const env = {};
  if (!existsSync(filePath)) return env;
  for (const line of readFileSync(filePath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
  return env;
}

const env = loadEnv(join(__dirname, '.env.deploy'));

const FTP_HOST     = env.FTP_HOST     || process.env.FTP_HOST;
const FTP_USER     = env.FTP_USER     || process.env.FTP_USER;
const FTP_PASSWORD = env.FTP_PASSWORD || process.env.FTP_PASSWORD;
const FTP_REMOTE   = env.FTP_REMOTE   || process.env.FTP_REMOTE   || '/';
const FTP_SECURE   = (env.FTP_SECURE  || process.env.FTP_SECURE   || 'false') === 'true';

if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
  console.error('\n❌  Missing FTP credentials. Make sure .env.deploy exists and defines:');
  console.error('    FTP_HOST, FTP_USER, FTP_PASSWORD\n');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function run(cmd, label) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶  ${label}`);
  console.log(`${'─'.repeat(60)}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: __dirname });
  } catch {
    console.error(`\n❌  ${label} failed — aborting deploy.\n`);
    process.exit(1);
  }
  console.log(`\n✅  ${label} passed.\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Tests
// ─────────────────────────────────────────────────────────────────────────────
run('npm run test', 'Running test suite');

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Build
// ─────────────────────────────────────────────────────────────────────────────
run('npm run build', 'Building application (Vite)');

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — FTP upload
// ─────────────────────────────────────────────────────────────────────────────
async function deploy() {
  const client = new ftp.Client();
  client.ftp.verbose = true;   // set to true for detailed FTP logs

  console.log(`${'─'.repeat(60)}`);
  console.log(`▶  Uploading dist/ to ${FTP_HOST}${FTP_REMOTE}`);
  console.log(`${'─'.repeat(60)}\n`);

  try {
    await client.access({
      host:     FTP_HOST,
      user:     FTP_USER,
      password: FTP_PASSWORD,
      secure:   FTP_SECURE,
    });

    console.log(`✅  Connected to ${FTP_HOST}\n`);

    // Ensure the remote directory exists, then upload
    await client.ensureDir(FTP_REMOTE);
    await client.uploadFromDir(join(__dirname, 'dist'));

    console.log(`\n✅  Upload complete → ${FTP_HOST}${FTP_REMOTE}\n`);

  } catch (err) {
    console.error(`\n❌  FTP upload failed: ${err.message}\n`);
    process.exit(1);
  } finally {
    client.close();
  }
}

deploy();
