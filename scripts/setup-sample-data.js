const { app, BrowserWindow } = require('electron');
const { DatabaseManager } = require('../dist/main/database');
const path = require('path');

// Set app data path for testing
if (!app.isReady()) {
  app.setPath('userData', path.join(__dirname, '../temp-data'));
}

async function setupSampleData() {
  console.log('Setting up sample data...');
  
  const database = new DatabaseManager();
  await database.initialize();
  
  try {
    // Create sample tasks
    const sampleTasks = [
      {
        title: 'サンプルタスク1',
        description: '最初のサンプルタスクです',
        category: 'work',
        priority: 'high',
        status: 'pending',
        type: 'immediate',
        estimatedDuration: 30
      },
      {
        title: 'サンプルタスク2',
        description: '完了済みのタスクです',
        category: 'health',
        priority: 'medium',
        status: 'completed',
        type: 'immediate',
        estimatedDuration: 15
      }
    ];
    
    for (const task of sampleTasks) {
      const taskId = await database.createTask(task);
      console.log(`Created task: ${task.title} (ID: ${taskId})`);
    }
    
    // Create sample settings
    const sampleSettings = [
      { key: 'theme', value: 'light' },
      { key: 'language', value: 'ja' },
      { key: 'notificationsEnabled', value: 'true' },
      { key: 'widgetOpacity', value: '90' }
    ];
    
    for (const setting of sampleSettings) {
      await database.setSetting(setting.key, setting.value);
      console.log(`Set setting: ${setting.key} = ${setting.value}`);
    }
    
    console.log('Sample data setup completed!');
    
  } catch (error) {
    console.error('Failed to setup sample data:', error);
  } finally {
    database.close();
    process.exit(0);
  }
}

if (require.main === module) {
  // Wait for app to be ready if running directly
  if (app.isReady()) {
    setupSampleData();
  } else {
    app.whenReady().then(() => setupSampleData());
  }
}

module.exports = { setupSampleData };