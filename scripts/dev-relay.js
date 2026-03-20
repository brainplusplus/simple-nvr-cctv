const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const root = process.cwd();
const localBinary = process.platform === 'win32'
  ? join(root, 'tmp-go2rtc', 'go2rtc.exe')
  : join(root, 'tmp-go2rtc', 'go2rtc');

const command = existsSync(localBinary) ? localBinary : 'go2rtc';

const child = spawn(command, [], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error('[dev:relay] Failed to start go2rtc.');
  console.error('[dev:relay] Expected local binary at:', localBinary);
  console.error('[dev:relay] Or `go2rtc` available in PATH.');
  console.error(error.message);
  process.exit(1);
});
