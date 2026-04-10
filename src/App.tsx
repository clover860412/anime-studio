import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Welcome from './components/Welcome';
import Settings from './components/Settings';
import ProjectList from './components/ProjectList';
import NewProject from './components/NewProject';
import ProjectDetail from './components/ProjectDetail';
import Toast from './components/Toast';
import './styles.css';

function AppContent() {
  const { state } = useApp();

  const renderContent = () => {
    switch (state.currentView) {
      case 'settings':
        return <Settings />;
      case 'projectList':
        return <ProjectList />;
      case 'newProject':
        return <NewProject />;
      case 'projectDetail':
        return <ProjectDetail />;
      case 'welcome':
      default:
        return <Welcome />;
    }
  };

  const getTitle = () => {
    switch (state.currentView) {
      case 'settings':
        return '系统设置';
      case 'projectList':
        return '项目列表';
      case 'newProject':
        return '新建项目';
      case 'projectDetail':
        return '项目详情';
      default:
        return '欢迎使用';
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* 侧边栏 */}
      <Sidebar />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部标题栏 */}
        <div className="h-[50px] bg-[#1a1a1a] border-b border-[#3a3a3a] flex items-center px-4">
          <span className="text-[#a0a0a0] text-sm">{getTitle()}</span>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-hidden">
          {renderContent()}
        </div>
      </div>

      {/* Toast通知 */}
      <Toast />
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
