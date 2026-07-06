import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(root, '..');
const backendRoot = resolve(repoRoot, 'testing-environment-backend');

execFileSync('npm', ['run', 'openapi:generate'], { cwd: backendRoot, stdio: 'inherit' });
execFileSync('node', ['scripts/generate-api-client.mjs'], { cwd: root, stdio: 'inherit' });
execFileSync(
  'git',
  [
    'diff',
    '--exit-code',
    '--',
    'testing-environment-backend/openapi.json',
    'testing-environment-frontend/src/generated/api',
  ],
  { cwd: repoRoot, stdio: 'inherit' },
);
