import { join } from 'path';

// node-notifier ships without ESM types, so use require.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const notifier = require('node-notifier');

export interface NotificationOptions {
  title: string;
  message: string;
  icon?: string;
  sound?: boolean;
  wait?: boolean;
  actions?: string[];
}

export class NotificationManager {
  private readonly iconPath: string;

  constructor() {
    this.iconPath = join(__dirname, '../../assets/notification-icon.png');
  }

  show(options: NotificationOptions): Promise<string | null> {
    return new Promise((resolve) => {
      notifier.notify(
        {
          title: options.title,
          message: options.message,
          icon: options.icon || this.iconPath,
          sound: options.sound !== false,
          wait: options.wait || false,
          actions: options.actions || [],
          dropdownLabel: 'Actions',
          closeLabel: 'Dismiss'
        },
        (err: any, response: any) => {
          if (err) {
            console.error('Notification error:', err);
            resolve(null);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  showTaskReminder(taskTitle: string, imageUrl?: string): Promise<string | null> {
    return this.show({
      title: 'Upcoming task',
      message: taskTitle,
      icon: imageUrl || this.iconPath,
      actions: ['Start now', 'Remind me in 5 min', 'Mark as done'],
      wait: true
    });
  }

  showTaskCompleted(taskTitle: string): Promise<string | null> {
    return this.show({
      title: 'Task completed',
      message: `${taskTitle} has been marked as done`,
      sound: true
    });
  }

  showUpcomingTask(taskTitle: string, minutesUntil: number): Promise<string | null> {
    return this.show({
      title: `${minutesUntil} min until task`,
      message: taskTitle,
      actions: ['Snooze', 'OK']
    });
  }
}
