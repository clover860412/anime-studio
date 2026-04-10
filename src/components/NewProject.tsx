import { useState, DragEvent } from 'react';
import { useApp } from '../context/AppContext';
import { Project, generateId } from '../types';

export default function NewProject() {
  const { state, dispatch, showToast, callChatAPI } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // 处理文件导入
  const handleFileImport = (file: File) => {
    if (!file.name.endsWith('.txt')) {
      showToast('请选择txt文件', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setOriginalText(content);
      showToast('导入成功', 'success');
    };
    reader.onerror = () => {
      showToast('读取文件失败', 'error');
    };
    reader.readAsText(file);
  };

  // 文件选择
  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFileImport(file);
      }
    };
    input.click();
  };

  // 拖拽处理
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileImport(file);
    }
  };

  // 创建项目 - 自动生成全剧概要
  const handleCreate = async () => {
    if (!name.trim()) {
      showToast('请输入项目名称', 'error');
      return;
    }

    if (!originalText.trim()) {
      showToast('请输入或导入原文', 'error');
      return;
    }

    // 检查是否有可用的API预设
    const hasValidPreset = state.config.modelPresets.some(p => p.apiKey);
    if (!hasValidPreset) {
      showToast('请先在设置中添加包含API KEY的模型预设', 'error');
      return;
    }

    setIsCreating(true);

    try {
      // 生成全剧概要
      let synopsis = '';
      try {
        const preset = state.config.modelPresets.find(p => p.apiKey);
        const synopsisPrompt = `请分析以下故事内容，生成一段简洁的全剧概要（100字以内），概括故事的主题、背景和主要情节走向：

${originalText}`;
        
        synopsis = await callChatAPI(synopsisPrompt, preset);
        synopsis = synopsis.trim();
        
        // 截取概要（如果太长）
        if (synopsis.length > 500) {
          synopsis = synopsis.substring(0, 500) + '...';
        }
      } catch (e) {
        console.error('生成概要失败:', e);
        synopsis = '(全剧概要生成失败，请手动填写)';
      }

      const now = new Date().toISOString();
      const project: Project = {
        id: generateId(),
        name: name.trim(),
        description: description.trim(),
        originalText: originalText.trim(),
        rewrittenText: '',
        synopsis: synopsis,
        characters: [],
        scenes: [],
        items: [],
        voiceDubbings: [],
        voiceTimbres: [
          { id: generateId(), name: '旁白', description: '默认旁白音色' }
        ],
        shots: [],
        createdAt: now,
        updatedAt: now,
      };

      dispatch({ type: 'ADD_PROJECT', payload: project });
      showToast('项目创建成功', 'success');

      // 跳转到项目详情
      dispatch({ type: 'SET_CURRENT_PROJECT', payload: project.id });
      dispatch({ type: 'SET_VIEW', payload: 'projectDetail' });
    } catch (error: any) {
      showToast(error.message || '创建失败', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  // 取消
  const handleCancel = () => {
    setName('');
    setDescription('');
    setOriginalText('');
    dispatch({ type: 'SET_VIEW', payload: 'projectList' });
  };

  return (
    <div className="h-full flex flex-col p-6">
      <h2 className="text-lg font-medium mb-6">新建项目</h2>

      <div className="flex-1 overflow-y-auto space-y-5">
        {/* 项目名称 */}
        <div>
          <label className="label">项目名称 *</label>
          <input
            type="text"
            className="input-field"
            placeholder="输入项目名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* 项目描述 */}
        <div>
          <label className="label">项目描述</label>
          <textarea
            className="input-field min-h-[60px]"
            placeholder="输入项目描述（可选）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* 原文输入 */}
        <div>
          <label className="label">原文内容 *（将用于分镜分析和生成全剧概要）</label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-lg transition-all
              ${isDragging
                ? 'border-[#3b82f6] bg-[#3b82f6]/10'
                : 'border-[#3a3a3a] hover:border-[#404040]'
              }
            `}
          >
            <textarea
              className="input-field min-h-[250px] border-0 bg-transparent"
              placeholder="直接输入原文内容，或拖拽txt文件到此处"
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
            />
          </div>
          <button
            onClick={handleFileSelect}
            className="mt-3 btn btn-secondary text-sm"
          >
            导入TXT文件
          </button>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="flex justify-end gap-3 pt-4 border-t border-[#3a3a3a] mt-4">
        <button onClick={handleCancel} className="btn btn-secondary" disabled={isCreating}>
          取消
        </button>
        <button onClick={handleCreate} className="btn btn-primary" disabled={isCreating}>
          {isCreating ? '创建中...' : '创建项目'}
        </button>
      </div>
    </div>
  );
}
