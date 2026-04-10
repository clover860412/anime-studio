import { useApp } from '../context/AppContext';

export default function ProjectList() {
  const { state, dispatch, showToast } = useApp();

  const handleProjectClick = (projectId: string) => {
    dispatch({ type: 'SET_CURRENT_PROJECT', payload: projectId });
    dispatch({ type: 'SET_VIEW', payload: 'projectDetail' });
  };

  const handleDeleteProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (confirm('确定删除此项目？')) {
      dispatch({ type: 'DELETE_PROJECT', payload: projectId });
      showToast('项目已删除', 'success');
    }
  };

  const handleNewProject = () => {
    dispatch({ type: 'SET_VIEW', payload: 'newProject' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium">项目列表</h2>
        <button onClick={handleNewProject} className="btn btn-primary">
          + 新建项目
        </button>
      </div>

      {state.projects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-[#666666]">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-4 opacity-50">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <p>暂无项目</p>
          <p className="text-sm mt-2">点击右上角按钮创建新项目</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-3">
            {state.projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleProjectClick(project.id)}
                className="panel hover:bg-[#2a2a2a] cursor-pointer transition-all group"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-medium text-white mb-1">{project.name}</h3>
                    {project.description && (
                      <p className="text-[#a0a0a0] text-sm mb-2 line-clamp-1">
                        {project.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs text-[#666666]">
                      <span>创建: {formatDate(project.createdAt)}</span>
                      <span>分镜: {project.shots.length} 个</span>
                      <span>图片: {project.shots.filter(s => s.imageFile).length}</span>
                      <span>视频: {project.shots.filter(s => s.videoFile).length}</span>
                    </div>
                    {project.synopsis && (
                      <p className="text-xs text-[#666666] mt-2 line-clamp-1">
                        概要: {project.synopsis}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDeleteProject(e, project.id)}
                    className="text-[#666666] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-sm"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
