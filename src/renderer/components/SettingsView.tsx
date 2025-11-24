import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Key, 
  Bell, 
  Monitor, 
  Palette, 
  Globe,
  Save,
  Eye,
  EyeOff
} from 'lucide-react';
import { SettingsSchema, ApiKeySchema, validateAndSanitize } from '../schemas';

interface SettingsData {
  geminiApiKey: string;
  openaiApiKey: string;
  imageProvider: 'gemini' | 'openai';
  notificationsEnabled: boolean;
  notificationSound: boolean;
  notificationVolume: number;
  widgetOpacity: number;
  widgetAlwaysOnTop: boolean;
  theme: 'light' | 'dark' | 'system';
  language: 'ja' | 'en';
  fontSize: 'small' | 'medium' | 'large';
}

const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<SettingsData>({
    geminiApiKey: '',
    openaiApiKey: '',
    imageProvider: 'gemini',
    notificationsEnabled: true,
    notificationSound: true,
    notificationVolume: 50,
    widgetOpacity: 90,
    widgetAlwaysOnTop: true,
    theme: 'light',
    language: 'ja',
    fontSize: 'medium'
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [widgetVisible, setWidgetVisible] = useState<boolean>(true);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const v = await window.electronAPI.store.get('widgetVisible');
        setWidgetVisible(v !== false);
      } catch {
        setWidgetVisible(true);
      }
    })();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      
      const keys = [
        'geminiApiKey',
        'openaiApiKey',
        'imageProvider',
        'notificationsEnabled',
        'notificationSound',
        'notificationVolume',
        'widgetOpacity',
        'widgetAlwaysOnTop',
        'theme',
        'language',
        'fontSize'
      ];
      const settingsData = await window.electronAPI.settings.getMany(keys);
      const values = settingsData?.success && settingsData.values ? settingsData.values : {};

      setSettings({
        geminiApiKey: values.geminiApiKey || '',
        openaiApiKey: values.openaiApiKey || '',
        imageProvider: values.imageProvider === 'openai' ? 'openai' : 'gemini',
        notificationsEnabled: values.notificationsEnabled === 'true',
        notificationSound: values.notificationSound !== 'false',
        notificationVolume: parseInt(values.notificationVolume || '50'),
        widgetOpacity: parseInt(values.widgetOpacity || '90'),
        widgetAlwaysOnTop: values.widgetAlwaysOnTop !== 'false',
        theme: (values.theme as 'light' | 'dark' | 'system') || 'light',
        language: (values.language as 'ja' | 'en') || 'ja',
        fontSize: (values.fontSize as 'small' | 'medium' | 'large') || 'medium'
      });

      // メインプロセスへ適用
      if (window.electronAPI.ai?.setProvider) {
        await window.electronAPI.ai.setProvider(values.imageProvider === 'openai' ? 'openai' : 'gemini');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      
      // 入力値検証とサニタイゼーション
      const validatedSettings = validateAndSanitize(SettingsSchema, settings);
      
      // セキュアなAPIキー設定（Gemini）
      if (validatedSettings.geminiApiKey && validatedSettings.geminiApiKey.trim().length > 0) {
        // APIキー形式の追加検証
        try {
          validateAndSanitize(ApiKeySchema, validatedSettings.geminiApiKey.trim());
        } catch (error) {
          alert(`APIキーの形式が無効です: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return;
        }
        
        const result = await window.electronAPI.settings.setApiKey(validatedSettings.geminiApiKey.trim());
        if (!result.success) {
          alert(`APIキーの設定に失敗しました: ${result.error}`);
          return;
        }
      }

      // セキュアなAPIキー設定（OpenAI）
      if (validatedSettings.openaiApiKey && validatedSettings.openaiApiKey.trim().length > 0) {
        try {
          validateAndSanitize(ApiKeySchema, validatedSettings.openaiApiKey.trim());
        } catch (error) {
          alert(`OpenAI APIキーの形式が無効です: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return;
        }
        const result = await window.electronAPI.settings.setOpenAIApiKey(validatedSettings.openaiApiKey.trim());
        if (!result.success) {
          alert(`OpenAI APIキーの設定に失敗しました: ${result.error}`);
          return;
        }
      }
      
      // その他設定をまとめて保存（APIキー以外）
      const settingsEntries = Object.entries(validatedSettings).filter(([key]) => key !== 'geminiApiKey' && key !== 'openaiApiKey' && key !== 'imageProvider');
      const settingsObject = settingsEntries.reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
      }, {});
      await window.electronAPI.settings.setMany(settingsObject);

      // プロバイダ選択を保存
      if (window.electronAPI.ai?.setProvider) {
        await window.electronAPI.ai.setProvider(settings.imageProvider);
      }
      
      alert('設定を保存しました。');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('設定の保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const testNotification = () => {
    // テスト通知を送信
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Visual TODO App', {
        body: 'これはテスト通知です。',
        icon: '/assets/notification-icon.png'
      });
    } else if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('Visual TODO App', {
            body: 'これはテスト通知です。',
            icon: '/assets/notification-icon.png'
          });
        }
      });
    }
  };

  const handleChange = (key: keyof SettingsData, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-secondary-600">設定を読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200">
          <div className="p-6 border-b border-secondary-200">
            <div className="flex items-center space-x-3">
              <Settings className="w-8 h-8 text-primary-600" />
              <div>
                <h2 className="text-2xl font-bold text-secondary-900">設定</h2>
                <p className="text-secondary-600">アプリケーションの動作をカスタマイズ</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-8">
            {/* AI画像生成プロバイダ選択 */}
            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center space-x-2">
                <Key className="w-5 h-5" />
                <span>AI画像生成</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">プロバイダ</label>
                  <select
                    value={settings.imageProvider}
                    onChange={(e) => handleChange('imageProvider', e.target.value)}
                    className="select"
                  >
                    <option value="gemini">Gemini</option>
                    <option value="openai">OpenAI (gpt-image-1)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Gemini API Key */}
            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center space-x-2">
                <Key className="w-5 h-5" />
                <span>Gemini APIキー</span>
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Google Gemini APIキー
                </label>
                <div className="flex space-x-2">
                  <div className="flex-1 relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={settings.geminiApiKey}
                      onChange={(e) => handleChange('geminiApiKey', e.target.value)}
                      placeholder="AIzaSy..."
                      className="input pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={() => window.electronAPI.shell.openExternal('https://aistudio.google.com/app/apikey')}
                    className="btn btn-secondary whitespace-nowrap"
                  >
                    取得する
                  </button>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-secondary-600">
                    AIイラスト生成にはGoogle Gemini APIキーが必要です。セキュアに暗号化して保存されます。
                  </p>
                  {settings.geminiApiKey && (
                    <button
                      onClick={async () => {
                        if (confirm('APIキーを削除しますか？')) {
                          await window.electronAPI.settings.clearApiKey();
                          setSettings(prev => ({ ...prev, geminiApiKey: '' }));
                        }
                      }}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* OpenAI API Key */}
            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center space-x-2">
                <Key className="w-5 h-5" />
                <span>OpenAI APIキー (gpt-image-1)</span>
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  OpenAI APIキー
                </label>
                <div className="flex space-x-2">
                  <div className="flex-1 relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={settings.openaiApiKey}
                      onChange={(e) => handleChange('openaiApiKey', e.target.value)}
                      placeholder="sk-..."
                      className="input pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={() => window.electronAPI.shell.openExternal('https://platform.openai.com/api-keys')}
                    className="btn btn-secondary whitespace-nowrap"
                  >
                    取得する
                  </button>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-secondary-600">
                    OpenAIのgpt-image-1を利用するにはAPIキーが必要です。セキュアに暗号化して保存されます。
                  </p>
                  {settings.openaiApiKey && (
                    <button
                      onClick={async () => {
                        if (confirm('OpenAI APIキーを削除しますか？')) {
                          await window.electronAPI.settings.clearOpenAIApiKey();
                          setSettings(prev => ({ ...prev, openaiApiKey: '' }));
                        }
                      }}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <span>通知</span>
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-secondary-700">通知を有効にする</label>
                    <p className="text-sm text-secondary-600">タスクの時間になったら通知を表示</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notificationsEnabled}
                      onChange={(e) => handleChange('notificationsEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-secondary-700">音声通知</label>
                    <p className="text-sm text-secondary-600">通知時に音を鳴らす</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notificationSound}
                      onChange={(e) => handleChange('notificationSound', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-secondary-700">音量</label>
                    <span className="text-sm text-secondary-600">{settings.notificationVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.notificationVolume}
                    onChange={(e) => handleChange('notificationVolume', parseInt(e.target.value))}
                    className="w-full h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <button
                  onClick={testNotification}
                  className="btn btn-secondary"
                >
                  テスト通知を送信
                </button>
              </div>
            </div>

            {/* Widget */}
            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center space-x-2">
                <Monitor className="w-5 h-5" />
                <span>ウィジェット</span>
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-secondary-700">ウィジェットを表示</label>
                    <p className="text-sm text-secondary-600">非表示にしてもこのトグルで再表示できます</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={widgetVisible}
                      onChange={async (e) => {
                        const v = e.target.checked;
                        setWidgetVisible(v);
                        await window.electronAPI.store.set('widgetVisible', v);
                        if (v) {
                          await window.electronAPI.widget.show();
                        } else {
                          await window.electronAPI.widget.hide();
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-secondary-700">透明度</label>
                    <span className="text-sm text-secondary-600">{settings.widgetOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={settings.widgetOpacity}
                    onChange={(e) => handleChange('widgetOpacity', parseInt(e.target.value))}
                    className="w-full h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-secondary-700">常に最前面に表示</label>
                    <p className="text-sm text-secondary-600">他のウィンドウの上に常に表示</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.widgetAlwaysOnTop}
                      onChange={(e) => handleChange('widgetAlwaysOnTop', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Appearance */}
            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center space-x-2">
                <Palette className="w-5 h-5" />
                <span>表示</span>
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">テーマ</label>
                  <select
                    value={settings.theme}
                    onChange={(e) => handleChange('theme', e.target.value)}
                    className="select"
                  >
                    <option value="light">ライト</option>
                    <option value="dark">ダーク</option>
                    <option value="system">システム設定に従う</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">フォントサイズ</label>
                  <select
                    value={settings.fontSize}
                    onChange={(e) => handleChange('fontSize', e.target.value)}
                    className="select"
                  >
                    <option value="small">小</option>
                    <option value="medium">中</option>
                    <option value="large">大</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Language */}
            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center space-x-2">
                <Globe className="w-5 h-5" />
                <span>言語</span>
              </h3>
              
              <div>
                <select
                  value={settings.language}
                  onChange={(e) => handleChange('language', e.target.value)}
                  className="select max-w-xs"
                >
                  <option value="ja">日本語</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-secondary-200">
            <button
              onClick={saveSettings}
              disabled={isSaving}
              className="btn btn-primary flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? '保存中...' : '設定を保存'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
