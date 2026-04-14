import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SettingsTab } from '../types';

const tabs: { id: SettingsTab; label: string }[] = [
  { id: 'basic', label: '基础' },
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
          <div className="space-y-8">
            {/* 📁 目录配置 */}
            <section>
              <h2 className="text-lg font-medium mb-4 text-[#3b82f6]">📁 目录配置</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">项目目录</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="如 D:\我的项目"
                    value={state.config.basic.projectDir}
                    onChange={(e) => handleBasicChange('projectDir', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">导出剪映目录</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="如 C:\Users\用户名\AppData\Local\CapCut\Projects"
                    value={state.config.basic.capcutDir}
                    onChange={(e) => handleBasicChange('capcutDir', e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* 🤖 ComfyUI 配置 */}
            <section>
              <h2 className="text-lg font-medium mb-4 text-[#8b5cf6]">🤖 ComfyUI 配置</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">🎤 ComfyUI 配音地址</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="如 http://127.0.0.1:8188"
                    value={state.config.basic.comfyuiVoiceUrl}
                    onChange={(e) => handleBasicChange('comfyuiVoiceUrl', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">🖼️ ComfyUI 生图地址</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="如 http://127.0.0.1:8188"
                    value={state.config.basic.comfyuiImageUrl}
                    onChange={(e) => handleBasicChange('comfyuiImageUrl', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">🎬 ComfyUI 生视频地址</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="如 http://127.0.0.1:8188"
                    value={state.config.basic.comfyuiVideoUrl}
                    onChange={(e) => handleBasicChange('comfyuiVideoUrl', e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* 🔍 分析模型 */}
            <section>
              <h2 className="text-lg font-medium mb-4 text-[#10b981]">🔍 分析模型</h2>
              <p className="text-xs text-[#666666] mb-4">用于：全剧概要、人物、场景、物品、改文、提示词分析等</p>
              <div className="space-y-4">
                <div>
                  <label className="label">API地址</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="如 https://api.openai.com/v1"
                    value={state.config.basic.analyzeApiUrl}
                    onChange={(e) => handleBasicChange('analyzeApiUrl', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">API KEY</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="输入API密钥"
                    value={state.config.basic.analyzeApiKey}
                    onChange={(e) => handleBasicChange('analyzeApiKey', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">模型名称</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="如 gpt-4o, gemini-2.0-flash"
                    value={state.config.basic.analyzeModelName}
                    onChange={(e) => handleBasicChange('analyzeModelName', e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* 🎤 付费配音 */}
            <section>
              <h2 className="text-lg font-medium mb-4 text-[#f59e0b]">🎤 付费配音</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">API地址</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="如 https://api.example.com/v1/audio"
                    value={state.config.basic.voiceApiUrl}
                    onChange={(e) => handleBasicChange('voiceApiUrl', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">API KEY</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="输入API密钥"
                    value={state.config.basic.voiceApiKey}
                    onChange={(e) => handleBasicChange('voiceApiKey', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">模型名称</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="如 tts-1, bark"
                    value={state.config.basic.voiceModelName}
                    onChange={(e) => handleBasicChange('voiceModelName', e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* 🖼️ 付费生图 */}
            <section>
              <h2 className="text-lg font-medium mb-4 text-[#ec4899]">🖼️ 付费生图</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">API地址</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="如 https://api.example.com/v1/images"
                    value={state.config.basic.imageApiUrl}
                    onChange={(e) => handleBasicChange('imageApiUrl', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">API KEY</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="输入API密钥"
                    value={state.config.basic.imageApiKey}
                    onChange={(e) => handleBasicChange('imageApiKey', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">模型名称</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="如 dalle-3, stable-diffusion"
                    value={state.config.basic.imageModelName}
                    onChange={(e) => handleBasicChange('imageModelName', e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* 🎬 付费视频 */}
            <section>
              <h2 className="text-lg font-medium mb-4 text-[#ef4444]">🎬 付费视频</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">API地址</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="如 https://api.example.com/v1/video/create"
                    value={state.config.basic.videoApiUrl}
                    onChange={(e) => handleBasicChange('videoApiUrl', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">API KEY</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="输入API密钥"
                    value={state.config.basic.videoApiKey}
                    onChange={(e) => handleBasicChange('videoApiKey', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">模型名称</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="如 veo3.1-fast, wan-2.1, cogvideo"
                    value={state.config.basic.videoModelName}
                    onChange={(e) => handleBasicChange('videoModelName', e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* ✍️ 提示词模板 */}
            <section>
              <h2 className="text-lg font-medium mb-4 text-[#6366f1]">✍️ 提示词模板</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">正向提示词</label>
                  <textarea
                    className="input-field min-h-[80px]"
                    placeholder="输入默认的正向提示词..."
                    value={state.config.basic.positivePrompt}
                    onChange={(e) => handleBasicChange('positivePrompt', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">负向提示词</label>
                  <textarea
                    className="input-field min-h-[60px]"
                    placeholder="输入不希望出现的元素..."
                    value={state.config.basic.negativePrompt}
                    onChange={(e) => handleBasicChange('negativePrompt', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">风格</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="如 anime, realistic"
                      value={state.config.basic.style}
                      onChange={(e) => handleBasicChange('style', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">尺寸</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="如 1920x1080"
                      value={state.config.basic.size}
                      onChange={(e) => handleBasicChange('size', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </section>
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
