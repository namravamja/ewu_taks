/* eslint-disable sonarjs/os-command */
import { execSync } from 'node:child_process';

const dirs = process.argv.slice(2);

if (dirs.length === 0) {
  // Full clean — reset Nx cache and remove all generated/cached dirs
  console.log('Running full clean...');
  execSync('npx nx reset', { stdio: 'inherit' });
  execSync(
    "npx rimraf --glob node_modules '**/node_modules' dist '**/dist' tmp .nx .cache '**/coverage'",
    { stdio: 'inherit' },
  );
} else {
  // Targeted clean — delete specified dirs recursively throughout the codebase
  const patterns = dirs.flatMap((d) => [d, `'**/${d}'`]);
  console.log(`Cleaning: ${dirs.join(', ')}`);
  execSync(`npx rimraf --glob ${patterns.join(' ')}`, { stdio: 'inherit' });
}
