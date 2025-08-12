const notifier = require('node-notifier');
import { join } from 'path';

export interface NotificationOptions {
  title: string;
  message: string;
  icon?: string;
  sound?: boolean;
  wait?: boolean;
  actions?: string[];
}

export class NotificationManager {
  private iconPath: string;

  constructor() {
    this.iconPath = join(__dirname, '../../assets/notification-icon.png');
  }

  show(options: NotificationOptions): Promise<string | null> {
    return new Promise((resolve) => {
      notifier.notify({
        title: options.title,
        message: options.message,
        icon: options.icon || this.iconPath,
        sound: options.sound !== false,
        wait: options.wait || false,
        actions: options.actions || [],
        dropdownLabel: 'アクション',
        closeLabel: '閉じる'
      }, (err: any, response: any, metadata: any) => {
        if (err) {
          console.error('Notification error:', err);
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  }

  showTaskReminder(taskTitle: string, imageUrl?: string): Promise<string | null> {
    return this.show({
      title: 'タスクの時間です',
      message: taskTitle,
      icon: imageUrl || this.iconPath,
      actions: ['開始', '5分後に再通知', 'スキップ'],
      wait: true
    });
  }

  showTaskCompleted(taskTitle: string): Promise<string | null> {
    return this.show({
      title: 'タスク完了！',
      message: `「${taskTitle}」を完了しました`,
      sound: true
    });
  }

  showUpcomingTask(taskTitle: string, minutesUntil: number): Promise<string | null> {
    return this.show({
      title: `${minutesUntil}分後にタスクがあります`,
      message: taskTitle,
      actions: ['今すぐ開始', 'OK']
    });
  }
}