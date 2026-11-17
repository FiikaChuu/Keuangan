import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// The normal build generates public/sw.js. Keep its original bytes in the
// working tree and retain the fresh worker only as a local QA artifact.
const originalWorker = await readFile('public/sw.js');
let exitCode = 1;
try {
  const result = spawnSync('npm', ['run', 'build'], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  const log = `${result.stdout || ''}${result.stderr || ''}`;
  await mkdir('test-results/redesign', { recursive: true });
  await writeFile('test-results/redesign/build.log', log);
  process.stdout.write(log);
  exitCode = result.status ?? 1;
  if (exitCode === 0) {
    await writeFile('test-results/redesign/build-sw.js', await readFile('public/sw.js'));
  }
} finally {
  await writeFile('public/sw.js', originalWorker);
  console.log(`npm run build exit code: ${exitCode}; original public/sw.js restored.`);
}
process.exitCode = exitCode;
