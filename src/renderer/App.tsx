import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { TaskProvider } from './contexts/TaskContext';
import { UserProfileProvider } from './contexts/UserProfileContext';
import { CategoryProvider } from './contexts/CategoryContext';
import { HoverImageProvider } from './contexts/HoverImageContext';
import './utils/browserMock'; // Initialize browser mock for testing
import Sidebar from './components/Sidebar';
import TaskView from './components/TaskView';
import UserProfileView from './components/UserProfileView';
import SettingsView from './components/SettingsView';
import ErrorBoundary from './components/ErrorBoundary';
import HoverImageOverlay from './components/HoverImageOverlay';

type View = 'tasks' | 'profile' | 'settings';

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // URL から現在ビューを導出（初期は tasks）
  const currentPath = location.pathname || '/tasks';
  const currentView: View = currentPath.startsWith('/profile')
    ? 'profile'
    : currentPath.startsWith('/settings')
      ? 'settings'
      : 'tasks';
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };
  
  const handleViewChange = (view: View) => {
    const path = view === 'tasks' ? '/tasks' : view === 'profile' ? '/profile' : '/settings';
    if (location.pathname !== path) {
      navigate(path);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-secondary-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-secondary-600">アプリを初期化中... (Hot Reload Test)</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary level="page">
      <UserProfileProvider>
        <CategoryProvider>
          <TaskProvider>
            <HoverImageProvider>
              <div className="h-full flex" style={{ height: 'calc(100vh - 32px)' }}>
                <ErrorBoundary level="component">
                  <Sidebar 
                    currentView={currentView} 
                    onViewChange={handleViewChange}
                    isCollapsed={isSidebarCollapsed}
                    onToggleCollapse={toggleSidebar}
                  />
                </ErrorBoundary>
                <main className="flex-1 flex flex-col min-h-0">
                  <ErrorBoundary level="component">
                    <Routes>
                      <Route path="/" element={<Navigate to="/tasks" replace />} />
                      <Route path="/tasks" element={<TaskView />} />
                      <Route path="/profile" element={<UserProfileView />} />
                      <Route path="/settings" element={<SettingsView />} />
                    </Routes>
                  </ErrorBoundary>
                </main>
              </div>
              <HoverImageOverlay />
            </HoverImageProvider>
          </TaskProvider>
        </CategoryProvider>
      </UserProfileProvider>
    </ErrorBoundary>
  );
}

export default App;