import { useApp } from '../context/AppContext';
import { ViewType } from '../types';

interface MenuItem {
  id: ViewType;
  icon: React.ReactNode;
  label: string;
}

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const ProjectsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const NewProjectIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3v18M3 12h18" />
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
);

const menuItems: MenuItem[] = [
  { id: 'settings', icon: <SettingsIcon />, label: '设置' },
  { id: 'projectList', icon: <ProjectsIcon />, label: '项目' },
  { id: 'newProject', icon: <NewProjectIcon />, label: '新建' },
];

export default function Sidebar() {
  const { state, dispatch } = useApp();

  const handleClick = (view: ViewType) => {
    dispatch({ type: 'SET_VIEW', payload: view });
  };

  // 如果在项目详情中，显示不同的侧边栏
  if (state.currentView === 'projectDetail') {
    return (
      <div className="w-[80px] bg-[#252525] flex flex-col h-full">
        <div className="h-[60px] flex items-center justify-center border-b border-[#3a3a3a]">
          <span className="text-[#3b82f6] font-bold text-lg">AN</span>
        </div>
        <div className="flex-1 flex flex-col py-4 px-2">
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'projectList' })}
            className="flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg transition-all text-[#a0a0a0] hover:bg-[#3a3a3a] hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span className="text-xs">返回</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[80px] bg-[#252525] flex flex-col h-full">
      {/* Logo区域 */}
      <div className="h-[60px] flex items-center justify-center border-b border-[#3a3a3a]">
        <span className="text-[#3b82f6] font-bold text-lg">AN</span>
      </div>

      {/* 菜单项 */}
      <div className="flex-1 flex flex-col py-4 gap-2 px-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleClick(item.id)}
            className={`
              flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg transition-all
              ${state.currentView === item.id
                ? 'bg-[#3b82f6]/20 text-[#3b82f6]'
                : 'text-[#a0a0a0] hover:bg-[#3a3a3a] hover:text-white'
              }
            `}
          >
            {item.icon}
            <span className="text-xs">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
