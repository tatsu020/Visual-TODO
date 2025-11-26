import React from 'react';
import { 
  CheckSquare, 
  User, 
  Settings, 
  Menu,
  ChevronLeft,
  Trophy
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: 'tasks' | 'profile' | 'settings' | 'completed') => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, isCollapsed, onToggleCollapse }) => {
  const menuItems = [
    { id: 'tasks', label: 'タスク', icon: CheckSquare },
    { id: 'completed', label: '達成ギャラリー', icon: Trophy },
    { id: 'profile', label: 'プロファイル', icon: User },
    { id: 'settings', label: '設定', icon: Settings },
  ];

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-secondary-200 flex flex-col transition-all duration-300 ease-in-out`}>
      <div className={`${isCollapsed ? 'p-4' : 'p-6'} border-b border-secondary-200 flex items-center justify-between`}>
        {!isCollapsed && (
          <div className="flex-1">
            <h1 className="text-xl font-bold text-secondary-900">Visual TODO</h1>
            <p className="text-sm text-secondary-600 mt-1">AIイラスト付きタスク管理</p>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg text-secondary-600 hover:bg-secondary-100 transition-colors duration-200"
          title={isCollapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'}
        >
          {isCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
      
      <nav className={`flex-1 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onViewChange(item.id as 'tasks' | 'profile' | 'settings' | 'completed')}
                  className={`w-full flex items-center ${isCollapsed ? 'px-3 py-3 justify-center' : 'px-4 py-3'} rounded-lg text-left transition-colors duration-200 ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 border border-primary-200'
                      : 'text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900'
                  }`}
                  title={isCollapsed ? item.label : ''}
                >
                  <Icon className={`w-5 h-5 ${!isCollapsed ? 'mr-3' : ''}`} />
                  {!isCollapsed && <span className="font-medium">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      
      {!isCollapsed && (
        <div className="p-4 border-t border-secondary-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-secondary-700">ウィジェット</h3>
            <button
              onClick={() => window.electronAPI.widget.toggle()}
              className="text-xs px-2 py-1 bg-secondary-100 text-secondary-600 rounded hover:bg-secondary-200 transition-colors"
            >
              表示切替
            </button>
          </div>
          
          <div className="text-xs text-secondary-500">
            <div className="flex justify-between mb-1">
              <span>常駐ウィジェット</span>
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            </div>
            <p>デスクトップに現在のタスクを表示</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;