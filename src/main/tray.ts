import { Tray, Menu, nativeImage } from 'electron';
import { join } from 'path';

export function createTray(app: any): Tray {
  const iconPath = join(__dirname, '../../assets/tray-icon.png');
  const tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Visual TODO App',
      type: 'normal',
      enabled: false
    },
    {
      type: 'separator'
    },
    {
      label: 'メインウィンドウを開く',
      type: 'normal',
      click: () => app.showMainWindow()
    },
    {
      label: 'ウィジェット表示切替',
      type: 'checkbox',
      checked: true,
      click: () => app.toggleWidget()
    },
    {
      type: 'separator'
    },
    {
      label: '終了',
      type: 'normal',
      click: () => app.quit()
    }
  ]);

  tray.setToolTip('Visual TODO App');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    app.showMainWindow();
  });

  tray.on('double-click', () => {
    app.showMainWindow();
  });

  return tray;
}