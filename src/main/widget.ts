import { BrowserWindow } from 'electron';
import { join } from 'path';
import { app as electronApp } from 'electron';

export async function createWidget(appContext: any): Promise<BrowserWindow> {
  const isDev = !electronApp.isPackaged;
  const BASE_WIDTH = 300;
  const BASE_HEIGHT = 200;
  
  const widget = new BrowserWindow({
    width: 300,
    height: 200,
    x: undefined,
    y: undefined,
    resizable: true,
    minWidth: 260,
    minHeight: 160,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../preload/preload.js'),
      webSecurity: !isDev,
      // メインウィンドウとセッション（ズーム状態など）を分離
      partition: 'persist:widget'
    }
  });

  // センタリングと最前面の再保証
  try {
    widget.center();
  } catch {}
  widget.setVisibleOnAllWorkspaces?.(true);
  widget.setAlwaysOnTop(true);
  // ウィジェット内でのユーザー操作によるズームを無効化（Ctrl±/Pinch）
  try {
    widget.webContents.setVisualZoomLevelLimits(1, 1);
    // Ctrl+/Ctrl- などのズームショートカットを抑止
    widget.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && (input.control || input.meta)) {
        const key = (input.key || '').toLowerCase();
        if (key === '+' || key === '=' || key === '-' || key === '_' || key === 'add' || key === 'subtract' || key === '0') {
          event.preventDefault();
        }
      }
    });
  } catch {}

  if (isDev) {
    // .env.localファイルからVITE_PORTを読み込み
    let port = process.env.VITE_PORT || '5173';
    try {
      const fs = require('fs');
      const path = require('path');
      const envLocalPath = path.resolve(__dirname, '../../../.env.local');
      console.log(`[Widget] Checking .env.local at: ${envLocalPath}`);
      if (fs.existsSync(envLocalPath)) {
        const envContent = fs.readFileSync(envLocalPath, 'utf8');
        const vitePortMatch = envContent.match(/VITE_PORT=(.+)/);
        if (vitePortMatch) {
          port = vitePortMatch[1].trim();
          console.log(`[Widget] Loaded VITE_PORT from .env.local: ${port}`);
        }
      } else {
        console.log(`[Widget] .env.local file not found at: ${envLocalPath}`);
      }
    } catch (error) {
      console.warn('[Widget] Could not read .env.local file:', error);
    }
    // Viteが実際に使用しているポートを試行
    const tryPorts = [port, '5174', '5175', '5176', '5177', '5178', '5179', '5180', '5181', '5182', '5183', '5184', '5185', '5186'];
    
    let widgetLoaded = false;
    for (const tryPort of tryPorts) {
      try {
        await widget.loadURL(`http://127.0.0.1:${tryPort}/widget.html`); // IPv4を強制使用
        console.log(`[Widget] Successfully loaded from port ${tryPort}`);
        widgetLoaded = true;
        break;
      } catch (error) {
        console.log(`[Widget] Failed to load from port ${tryPort}, trying next...`);
        continue;
      }
    }
    // いずれのポートでもロードできなければデータURLで暫定UIを表示（"出ない"問題の見える化）
    if (!widgetLoaded) {
      console.error('[Widget] Failed to load from any port, showing fallback inline widget');
      const html = encodeURIComponent(`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>Widget Fallback</title><style>html,body{margin:0;padding:0;background:transparent}body{font-family:sans-serif}#root{width:300px;height:200px;border-radius:12px;background:rgba(255,255,255,.95);border:1px solid rgba(0,0,0,.1);box-shadow:0 8px 32px rgba(0,0,0,.1);overflow:hidden}header{padding:8px 12px;background:rgba(59,130,246,.1);border-bottom:1px solid rgba(0,0,0,.05);font-size:12px;font-weight:600;color:#374151}main{padding:12px;font-size:12px;color:#6b7280}</style></head><body><div id="root"><header>Visual TODO - Fallback Widget</header><main>開発サーバーが見つかりませんでした。<br/>npm run dev の起動とポート(5173)をご確認ください。</main></div></body></html>`);
      widget.loadURL(`data:text/html;charset=UTF-8,${html}`);
    }
  } else {
    widget.loadFile(join(__dirname, '../renderer/widget.html'));
  }

  // 描画準備後に確実に表示 & 最前面
  const updateZoomToFit = () => {
    try {
      const [cw, ch] = widget.getContentSize();
      const factor = Math.max(0.6, Math.min(cw / BASE_WIDTH, ch / BASE_HEIGHT));
      widget.webContents.setZoomFactor(factor);
    } catch {}
  };

  widget.once('ready-to-show', () => {
    widget.show();
    widget.setAlwaysOnTop(true);
    widget.moveTop?.();
    // レンダラー側でウィンドウサイズにフィットさせるためにwebContentsにCSSを適用
    try {
      widget.webContents.insertCSS('html,body,#widget-root{height:100%;width:100%;margin:0;padding:0;overflow:hidden;}');
    } catch {}
    updateZoomToFit();
  });

  widget.on('closed', () => {
    // Widget was closed
  });

  // ドラッグ可能にする
  widget.on('will-move', (event, bounds) => {
    // ウィジェットの位置を保存
    appContext.store?.set('widgetBounds', bounds);
  });

  // 透明度設定の適用（DB設定が取得できるまでのデフォルト）
  widget.setOpacity(0.9);

  // マウス透過の安全対策: 初期はイベントを受け付ける
  widget.setIgnoreMouseEvents(false);

  // リサイズに追随して自動ズーム（画像・文字をスケール）
  let resizeTimer: NodeJS.Timeout | null = null;
  widget.on('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateZoomToFit, 50);
  });

  return widget;
}