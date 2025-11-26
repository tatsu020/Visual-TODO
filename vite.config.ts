import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // 環境変数を明示的にロード
  const env = loadEnv(mode, process.cwd(), '');
  const vitePort = parseInt(env.VITE_PORT || '5173');
  
  console.log('🔧 Vite Config - Mode:', mode);
  console.log('🔧 Vite Config - VITE_PORT from env:', env.VITE_PORT);
  console.log('🔧 Vite Config - Using port:', vitePort);
  
  return {
  plugins: [react()],
  base: './',
  root: './src/renderer',
  publicDir: './assets',
  resolve: {
    alias: {
      '@': './src',
    },
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './src/renderer/index.html',
        widget: './src/renderer/widget.html'
      }
    }
  },
  server: {
    port: vitePort,
    host: '127.0.0.1', // IPv4を強制（localhostはIPv6を使用する場合がある）
    strictPort: false, // ポートが使用中の場合は自動的に別のポートを使用
    open: false,
    hmr: {
      host: '127.0.0.1', // HMRもIPv4を強制
      protocol: 'ws', // WebSocketプロトコルを明示的に指定
      // portとclientPortは自動検出に任せる（Electronでより安定）
    },
    // Hot Reload機能の強化
    watch: {
      usePolling: true, // ファイル変更監視の改善（Windowsで必要）
      interval: 100
    }
  }
  };
});