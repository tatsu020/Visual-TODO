// Wait for Vite dev server on the port indicated by VITE_PORT (fallback 5173)
// This works cross-platform without relying on shell-specific var expansion

const waitOn = require('wait-on');
const fs = require('fs');
const path = require('path');

function resolveVitePort() {
  // 1) 環境変数最優先
  if (process.env.VITE_PORT) return String(process.env.VITE_PORT);

  // 2) .env.local を明示的に読む（worktreeでも安定）
  try {
    const envPath = path.resolve(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const m = content.match(/VITE_PORT=(.+)/);
      if (m) return m[1].trim();
    }
  } catch {}

  // 3) デフォルト
  return '5173';
}

const vitePort = resolveVitePort();
const url = `http-get://127.0.0.1:${vitePort}`;

(async () => {
  try {
    console.log(`[wait-on-vite] Waiting for: ${url}`);
    await waitOn({
      resources: [url],
      timeout: 300000, // 5 minutes
      validateStatus: function (status) {
        // Accept 200/304 and other typical dev server statuses
        return status >= 200 && status < 500;
      },
    });
    console.log(`[wait-on-vite] Vite dev server is ready on port ${vitePort}`);
    process.exit(0);
  } catch (err) {
    console.error('[wait-on-vite] Failed to detect Vite dev server:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();

