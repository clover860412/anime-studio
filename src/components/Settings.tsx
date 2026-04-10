import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SettingsTab, generateId } from '../types';

const tabs: { id: SettingsTab; label: string }[] = [
  { id: 'basic', label: '基础' },
  { id: 'presets', label: '模型预设' },
  { id: 'prompts', label: '咒语' },
];

export default function Settings() {
  const { state, dispatch, saveConfig, resetConfig } = useApp();
  const [activeTab, setActiveTab] = useState<SettingsTab>('basic');

  const handleBasicChange = (field: string, value: string) => {
    dispatch({ type: 'UPDATE_BASIC', payload: { [field]: value } });
  };

  const handlePromptsChange = (field: string, value: string) => {
    dispatch({ type: 'UPDATE_PROMPTS', payload: { [field]: value } });
  };

  const handleSave = () => {
    saveConfig();
  };

  const handleReset = () => {
    if (confirm('确定要重置所有配置吗？')) {
      resetConfig();
    }
  };

  // 模型预设操作
  const handleAddPreset = () => {
    const newPreset = {
      id: generateId(),
      name: '新预设',
      apiAddress: '',
      apiKey: '',
      modelName: '',
    };
    dispatch({ type: 'ADD_MODEL_PRESET', payload: newPreset });
  };

  const handleUpdatePreset = (id: string, field: string, value: string) => {
    const preset = state.config.modelPresets.find(p => p.id === id);
    if (preset) {
      dispatch({ type: 'UPDATE_MODEL_PRESET', payload: { ...preset, [field]: value } });
    }
  };

  const handleDeletePreset = (id: string) => {
    if (confirm('确定删除此预设？')) {
      dispatch({ type: 'DELETE_MODEL_PRESET', payload: id });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab栏 */}
      <div className="flex border-b border-[#3a3a3a]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* 基础设置 */}
        {activeTab === 'basic' && (
          <div className="space-y-5">
            <div>
              <label className="label">项目目录</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input-field flex-1"
                  placeholder="创建项目时自动在此目录下创建项目文件夹，如 D:\我的项目"
                  value={state.config.basic.projectDir}
                  onChange={(e) => handleBasicChange('projectDir', e.target.value)}
                />
                <button
                  onClick={() => {
                    const path = prompt('请输入项目目录路径：');
                    if (path) handleBasicChange('projectDir', path);
                  }}
                  className="btn btn-secondary text-sm"
                >
                  浏览...
                </button>
              </div>
              <p className="text-xs text-[#666666] mt-1">创建新项目时会自动在此目录下创建对应的项目文件夹</p>
            </div>

            <div>
              <label className="label">导出剪映目录</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input-field flex-1"
                  placeholder="导出视频时将复制到剪映草稿箱，如 C:\Users\用户名\AppData\Local\CapCut\Projects"
                  value={state.config.basic.capcutDir}
                  onChange={(e) => handleBasicChange('capcutDir', e.target.value)}
                />
                <button
                  onClick={() => {
                    const path = prompt('请输入剪映项目目录：');
                    if (path) handleBasicChange('capcutDir', path);
                  }}
                  className="btn btn-secondary text-sm"
                >
                  浏览...
                </button>
              </div>
              <p className="text-xs text-[#666666] mt-1">导出时会将配音、图片、视频复制到剪映草稿箱，方便在剪映中直接打开编辑</p>
            </div>

            <hr className="border-[#3a3a3a]" />

            <div>
              <label className="label">ComfyUI 配音地址</label>
              <input
                type="text"
                className="input-field"
                placeholder="如 http://127.0.0.1:8188（留空则使用API生成配音）"
                value={state.config.basic.comfyuiVoiceUrl}
                onChange={(e) => handleBasicChange('comfyuiVoiceUrl', e.target.value)}
              />
              <p className="text-xs text-[#666666] mt-1">ComfyUI 的地址，用于生成配音。留空则使用 API 生成</p>
            </div>

            <div>
              <label className="label">ComfyUI 视频地址</label>
              <input
                type="text"
                className="input-field"
                placeholder="如 http://127.0.0.1:8188（留空则使用API生成视频）"
                value={state.config.basic.comfyuiVideoUrl}
                onChange={(e) => handleBasicChange('comfyuiVideoUrl', e.target.value)}
              />
              <p className="text-xs text-[#666666] mt-1">ComfyUI 的地址，用于生成视频。留空则使用 API 生成</p>
            </div>

            <hr className="border-[#3a3a3a]" />

            <div>
              <label className="label">正向提示词</label>
              <textarea
                className="input-field min-h-[100px]"
                placeholder="输入默认的正向提示词..."
                value={state.config.basic.positivePrompt}
                onChange={(e) => handleBasicChange('positivePrompt', e.target.value)}
              />
            </div>

            <div>
              <label className="label">负向提示词</label>
              <textarea
                className="input-field min-h-[80px]"
                placeholder="输入不希望出现的元素..."
                value={state.config.basic.negativePrompt}
                onChange={(e) => handleBasicChange('negativePrompt', e.target.value)}
              />
            </div>

            <div>
              <label className="label">风格</label>
              <input
                type="text"
                className="input-field"
                placeholder="输入风格，如 anime, realistic, cartoon..."
                value={state.config.basic.style}
                onChange={(e) => handleBasicChange('style', e.target.value)}
              />
            </div>

            <div>
              <label className="label">尺寸</label>
              <input
                type="text"
                className="input-field"
                placeholder="输入尺寸，如 1920x1080, 1024x1024..."
                value={state.config.basic.size}
                onChange={(e) => handleBasicChange('size', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* 模型预设 */}
        {activeTab === 'presets' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-[#a0a0a0] text-sm">模型预设用于快速调用不同的AI模型配置</p>
              <button onClick={handleAddPreset} className="btn btn-secondary text-sm">
                + 添加预设
              </button>
            </div>

            {state.config.modelPresets.length === 0 ? (
              <div className="text-center py-8 text-[#666666]">
                暂无预设，点击上方按钮添加
              </div>
            ) : (
              <div className="space-y-4">
                {state.config.modelPresets.map((preset) => (
                  <div key={preset.id} className="panel space-y-3">
                    <div className="flex justify-between items-start">
                      <input
                        type="text"
                        className="input-field w-48"
                        placeholder="预设名称"
                        value={preset.name}
                        onChange={(e) => handleUpdatePreset(preset.id, 'name', e.target.value)}
                      />
                      <button
                        onClick={() => handleDeletePreset(preset.id)}
                        className="text-red-500 hover:text-red-400 text-sm"
                      >
                        删除
                      </button>
                    </div>
                    <div>
                      <label className="label">API地址（留空使用默认: https://api.jxincm.cn）</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="如 https://api.jxincm.cn"
                        value={preset.apiAddress}
                        onChange={(e) => handleUpdatePreset(preset.id, 'apiAddress', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">API KEY *（必填）</label>
                      <input
                        type="password"
                        className="input-field"
                        placeholder="输入API密钥"
                        value={preset.apiKey}
                        onChange={(e) => handleUpdatePreset(preset.id, 'apiKey', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">模型名称</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="如 gpt-4o / gemini-2.0-flash-preview-image-generation / veo3.1-fast"
                        value={preset.modelName}
                        onChange={(e) => handleUpdatePreset(preset.id, 'modelName', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 咒语设置 */}
        {activeTab === 'prompts' && (
          <div className="space-y-5">
            <div>
              <label className="label">分镜咒语</label>
              <textarea
                className="input-field min-h-[100px]"
                placeholder="输入AI分镜提示词，用于拆分故事为分镜..."
                value={state.config.prompts.storyboardPrompt}
                onChange={(e) => handlePromptsChange('storyboardPrompt', e.target.value)}
              />
            </div>

            <div>
              <label className="label">改文咒语</label>
              <textarea
                className="input-field min-h-[100px]"
                placeholder="输入改写文本的咒语..."
                value={state.config.prompts.textPrompt}
                onChange={(e) => handlePromptsChange('textPrompt', e.target.value)}
              />
            </div>

            <div>
              <label className="label">图片咒语</label>
              <textarea
                className="input-field min-h-[100px]"
                placeholder="输入图片生成的咒语..."
                value={state.config.prompts.imagePrompt}
                onChange={(e) => handlePromptsChange('imagePrompt', e.target.value)}
              />
            </div>

            <div>
              <label className="label">动漫/视频咒语</label>
              <textarea
                className="input-field min-h-[100px]"
                placeholder="输入视频/动漫生成的咒语..."
                value={state.config.prompts.animePrompt}
                onChange={(e) => handlePromptsChange('animePrompt', e.target.value)}
              />
            </div>

            <div>
              <label className="label">人物分析咒语</label>
              <textarea
                className="input-field min-h-[100px]"
                placeholder="输入分析人物的咒语，用于提取故事中的人物信息..."
                value={state.config.prompts.characterPrompt}
                onChange={(e) => handlePromptsChange('characterPrompt', e.target.value)}
              />
            </div>

            <div>
              <label className="label">场景分析咒语</label>
              <textarea
                className="input-field min-h-[100px]"
                placeholder="输入分析场景的咒语，用于提取故事中的场景信息..."
                value={state.config.prompts.scenePrompt}
                onChange={(e) => handlePromptsChange('scenePrompt', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* 底部按钮 */}
      <div className="flex justify-end gap-3 p-4 border-t border-[#3a3a3a]">
        <button onClick={handleReset} className="btn btn-secondary">
          重置
        </button>
        <button onClick={handleSave} className="btn btn-primary">
          保存
        </button>
      </div>
    </div>
  );
}
