import { useApp } from '../context/AppContext';

export default function Welcome() {
  const { state, dispatch } = useApp();

  const handleNewProject = () => {
    dispatch({ type: 'SET_VIEW', payload: 'newProject' });
  };

  const handleSettings = () => {
    dispatch({ type: 'SET_VIEW', payload: 'settings' });
  };

  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      {/* Logo/标题 */}
      <div className="mb-8">
        <div className="w-20 h-20 bg-[#3b82f6] rounded-2xl flex items-center justify-center mb-4 mx-auto">
          <span className="text-white text-3xl font-bold">AN</span>
        </div>
        <h1 className="text-2xl font-medium text-white mb-2">动漫工作室</h1>
        <p className="text-[#a0a0a0]">Anime Studio - 动漫生产全流程管理系统</p>
      </div>

      {/* 功能入口 */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={handleNewProject}
          className="flex flex-col items-center gap-2 p-6 bg-[#252525] rounded-lg hover:bg-[#2a2a2a] transition-all min-w-[140px]"
        >
          <div className="w-12 h-12 bg-[#3b82f6]/20 rounded-full flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
              <path d="M12 3v18M3 12h18" />
            </svg>
          </div>
          <span className="text-white font-medium">新建项目</span>
        </button>

        <button
          onClick={handleSettings}
          className="flex flex-col items-center gap-2 p-6 bg-[#252525] rounded-lg hover:bg-[#2a2a2a] transition-all min-w-[140px]"
        >
          <div className="w-12 h-12 bg-[#3b82f6]/20 rounded-full flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </div>
          <span className="text-white font-medium">系统设置</span>
        </button>
      </div>

      {/* 项目数量 */}
      {state.projects.length > 0 && (
        <p className="text-[#666666] text-sm">
          已创建 {state.projects.length} 个项目
        </p>
      )}

      {/* 快捷提示 */}
      <div className="mt-12 text-[#666666] text-sm space-y-1">
        <p>• 左侧边栏可快速切换功能</p>
        <p>• 在设置中配置API和咒语模板</p>
        <p>• 创建项目后开始动漫生产工作</p>
      </div>
    </div>
  );
}
