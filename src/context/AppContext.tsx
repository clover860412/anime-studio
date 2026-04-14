import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppConfig, Project, Shot, Character, Scene, Item, ViewType, ModelPreset, defaultConfig, DEFAULT_API_BASE, ProjectTab } from '../types';

const CONFIG_KEY = 'anime-studio-config';
const PROJECTS_KEY = 'anime-studio-projects';

// State
interface AppState {
  config: AppConfig;
  projects: Project[];
  currentView: ViewType;
  currentProjectId: string | null;
  currentProjectTab: ProjectTab;
  selectedShotId: string | null;
  toast: { message: string; type: 'success' | 'error' } | null;
  isLoading: boolean;
  batchConcurrency: number;  // 批量并发数
  // 图片生成任务状态（用于防止重复提交和显示状态）
  imageGenTasks: Record<string, {
    status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | 'timeout';
    startTime: number;
    error?: string;
  }>;
}

// Actions
type Action =
  | { type: 'SET_CONFIG'; payload: AppConfig }
  | { type: 'UPDATE_BASIC'; payload: Partial<AppConfig['basic']> }
  | { type: 'UPDATE_PROMPTS'; payload: Partial<AppConfig['prompts']> }
  | { type: 'ADD_MODEL_PRESET'; payload: ModelPreset }
  | { type: 'UPDATE_MODEL_PRESET'; payload: ModelPreset }
  | { type: 'DELETE_MODEL_PRESET'; payload: string }
  | { type: 'RESET_CONFIG' }
  | { type: 'SET_VIEW'; payload: ViewType }
  | { type: 'SET_CURRENT_PROJECT'; payload: string | null }
  | { type: 'SET_PROJECT_TAB'; payload: ProjectTab }
  | { type: 'SET_SELECTED_SHOT'; payload: string | null }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Project }
  | { type: 'DELETE_PROJECT'; payload: string }
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'ADD_SHOT'; payload: { projectId: string; shot: Shot } }
  | { type: 'UPDATE_SHOT'; payload: { projectId: string; shot: Shot } }
  | { type: 'DELETE_SHOT'; payload: { projectId: string; shotId: string } }
  | { type: 'SET_SHOTS'; payload: { projectId: string; shots: Shot[] } }
  | { type: 'UPDATE_SHOT_IMAGE'; payload: { projectId: string; shotId: string; imageFile: string } }
  | { type: 'UPDATE_SHOT_VIDEO'; payload: { projectId: string; shotId: string; videoFile: string; videoTaskId?: string } }
  | { type: 'UPDATE_PROJECT_SYNOPSIS'; payload: { projectId: string; synopsis: string } }
  | { type: 'SET_CHARACTERS'; payload: { projectId: string; characters: Character[] } }
  | { type: 'ADD_CHARACTER'; payload: { projectId: string; character: Character } }
  | { type: 'UPDATE_CHARACTER'; payload: { projectId: string; character: Character } }
  | { type: 'DELETE_CHARACTER'; payload: { projectId: string; characterId: string } }
  | { type: 'UPDATE_CHARACTER_IMAGE'; payload: { projectId: string; characterId: string; imageFile: string } }
  | { type: 'UPDATE_CHARACTER_REFERENCE'; payload: { projectId: string; characterId: string; referenceImage: string } }
  | { type: 'SET_SCENES'; payload: { projectId: string; scenes: Scene[] } }
  | { type: 'ADD_SCENE'; payload: { projectId: string; scene: Scene } }
  | { type: 'UPDATE_SCENE'; payload: { projectId: string; scene: Scene } }
  | { type: 'DELETE_SCENE'; payload: { projectId: string; sceneId: string } }
  | { type: 'UPDATE_SCENE_IMAGE'; payload: { projectId: string; sceneId: string; imageFile: string } }
  | { type: 'UPDATE_SCENE_REFERENCE'; payload: { projectId: string; sceneId: string; referenceImage: string } }
  | { type: 'SET_ITEMS'; payload: { projectId: string; items: Item[] } }
  | { type: 'ADD_ITEM'; payload: { projectId: string; item: Item } }
  | { type: 'UPDATE_ITEM'; payload: { projectId: string; item: Item } }
  | { type: 'DELETE_ITEM'; payload: { projectId: string; itemId: string } }
  | { type: 'UPDATE_ITEM_IMAGE'; payload: { projectId: string; itemId: string; imageFile: string } }
  | { type: 'UPDATE_ITEM_REFERENCE'; payload: { projectId: string; itemId: string; referenceImage: string } }
  | { type: 'SET_IMAGE_GEN_STATUS'; payload: { shotId: string; status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | 'timeout'; error?: string } }
  | { type: 'CLEAR_IMAGE_GEN_STATUS'; payload: string }
  | { type: 'SHOW_TOAST'; payload: { message: string; type: 'success' | 'error' } }
  | { type: 'HIDE_TOAST' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_BATCH_CONCURRENCY'; payload: number };

// Reducer
function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_CONFIG':
      return { ...state, config: action.payload };
    case 'UPDATE_BASIC':
      return { ...state, config: { ...state.config, basic: { ...state.config.basic, ...action.payload } } };
    case 'UPDATE_PROMPTS':
      return { ...state, config: { ...state.config, prompts: { ...state.config.prompts, ...action.payload } } };
    case 'ADD_MODEL_PRESET':
      return { ...state, config: { ...state.config, modelPresets: [...state.config.modelPresets, action.payload] } };
    case 'UPDATE_MODEL_PRESET':
      return {
        ...state,
        config: {
          ...state.config,
          modelPresets: state.config.modelPresets.map(p => p.id === action.payload.id ? action.payload : p)
        }
      };
    case 'DELETE_MODEL_PRESET':
      return {
        ...state,
        config: { ...state.config, modelPresets: state.config.modelPresets.filter(p => p.id !== action.payload) }
      };
    case 'RESET_CONFIG':
      return { ...state, config: defaultConfig };
    case 'SET_VIEW':
      return { ...state, currentView: action.payload };
    case 'SET_CURRENT_PROJECT':
      return { ...state, currentProjectId: action.payload, selectedShotId: null };
    case 'SET_PROJECT_TAB':
      return { ...state, currentProjectTab: action.payload };
    case 'SET_SELECTED_SHOT':
      return { ...state, selectedShotId: action.payload };
    case 'ADD_PROJECT':
      return { ...state, projects: [action.payload, ...state.projects] };
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(p => p.id === action.payload.id ? action.payload : p)
      };
    case 'DELETE_PROJECT':
      return { ...state, projects: state.projects.filter(p => p.id !== action.payload) };
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };
    case 'ADD_SHOT':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, shots: [...p.shots, action.payload.shot] }
            : p
        )
      };
    case 'UPDATE_SHOT':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, shots: p.shots.map(s => s.id === action.payload.shot.id ? action.payload.shot : s) }
            : p
        )
      };
    case 'DELETE_SHOT':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, shots: p.shots.filter(s => s.id !== action.payload.shotId) }
            : p
        )
      };
    case 'SET_SHOTS':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, shots: action.payload.shots }
            : p
        )
      };
    case 'UPDATE_SHOT_IMAGE':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? {
                ...p,
                shots: p.shots.map(s =>
                  s.id === action.payload.shotId ? { ...s, imageFile: action.payload.imageFile } : s
                )
              }
            : p
        )
      };
    case 'UPDATE_SHOT_VIDEO':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? {
                ...p,
                shots: p.shots.map(s =>
                  s.id === action.payload.shotId ? { ...s, videoFile: action.payload.videoFile, videoTaskId: action.payload.videoTaskId } : s
                )
              }
            : p
        )
      };
    case 'UPDATE_PROJECT_SYNOPSIS':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, synopsis: action.payload.synopsis }
            : p
        )
      };
    case 'SET_CHARACTERS':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, characters: action.payload.characters }
            : p
        )
      };
    case 'ADD_CHARACTER':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, characters: [...p.characters, action.payload.character] }
            : p
        )
      };
    case 'UPDATE_CHARACTER':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, characters: p.characters.map(c => c.id === action.payload.character.id ? action.payload.character : c) }
            : p
        )
      };
    case 'DELETE_CHARACTER':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, characters: p.characters.filter(c => c.id !== action.payload.characterId) }
            : p
        )
      };
    case 'UPDATE_CHARACTER_IMAGE':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, characters: p.characters.map(c => c.id === action.payload.characterId ? { ...c, imageFile: action.payload.imageFile } : c) }
            : p
        )
      };
    case 'UPDATE_CHARACTER_REFERENCE':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, characters: p.characters.map(c => c.id === action.payload.characterId ? { ...c, referenceImage: action.payload.referenceImage } : c) }
            : p
        )
      };
    case 'SET_SCENES':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, scenes: action.payload.scenes }
            : p
        )
      };
    case 'ADD_SCENE':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, scenes: [...p.scenes, action.payload.scene] }
            : p
        )
      };
    case 'UPDATE_SCENE':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, scenes: p.scenes.map(s => s.id === action.payload.scene.id ? action.payload.scene : s) }
            : p
        )
      };
    case 'DELETE_SCENE':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, scenes: p.scenes.filter(s => s.id !== action.payload.sceneId) }
            : p
        )
      };
    case 'UPDATE_SCENE_IMAGE':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, scenes: p.scenes.map(s => s.id === action.payload.sceneId ? { ...s, imageFile: action.payload.imageFile } : s) }
            : p
        )
      };
    case 'UPDATE_SCENE_REFERENCE':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, scenes: p.scenes.map(s => s.id === action.payload.sceneId ? { ...s, referenceImage: action.payload.referenceImage } : s) }
            : p
        )
      };
    case 'SET_ITEMS':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, items: action.payload.items }
            : p
        )
      };
    case 'ADD_ITEM':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, items: [...(p.items || []), action.payload.item] }
            : p
        )
      };
    case 'UPDATE_ITEM':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, items: (p.items || []).map(i => i.id === action.payload.item.id ? action.payload.item : i) }
            : p
        )
      };
    case 'DELETE_ITEM':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, items: (p.items || []).filter(i => i.id !== action.payload.itemId) }
            : p
        )
      };
    case 'UPDATE_ITEM_IMAGE':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, items: (p.items || []).map(i => i.id === action.payload.itemId ? { ...i, imageFile: action.payload.imageFile } : i) }
            : p
        )
      };
    case 'UPDATE_ITEM_REFERENCE':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, items: (p.items || []).map(i => i.id === action.payload.itemId ? { ...i, referenceImage: action.payload.referenceImage } : i) }
            : p
        )
      };
    case 'SET_IMAGE_GEN_STATUS':
      return {
        ...state,
        imageGenTasks: {
          ...state.imageGenTasks,
          [action.payload.shotId]: {
            status: action.payload.status,
            startTime: state.imageGenTasks[action.payload.shotId]?.startTime || Date.now(),
            error: action.payload.error,
          }
        }
      };
    case 'CLEAR_IMAGE_GEN_STATUS':
      const newTasks = { ...state.imageGenTasks };
      delete newTasks[action.payload];
      return { ...state, imageGenTasks: newTasks };
    case 'SHOW_TOAST':
      return { ...state, toast: action.payload };
    case 'HIDE_TOAST':
      return { ...state, toast: null };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_BATCH_CONCURRENCY':
      return { ...state, batchConcurrency: action.payload };
    default:
      return state;
  }
}

// Initial state
const initialState: AppState = {
  config: defaultConfig,
  projects: [],
  currentView: 'welcome',
  currentProjectId: null,
  currentProjectTab: 'storyboard',
  selectedShotId: null,
  toast: null,
  isLoading: false,
  batchConcurrency: 5,
  imageGenTasks: {},
};

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  showToast: (message: string, type: 'success' | 'error') => void;
  saveConfig: () => void;
  loadConfig: () => void;
  resetConfig: () => void;
  getCurrentProject: () => Project | null;
  getSelectedShot: () => Shot | null;
  // 分析模型API（用于：全剧概要、人物、场景、物品、改文、提示词分析等）
  callAnalyzeAPI: (prompt: string) => Promise<string>;
  // 付费生图API
  callPaidImageAPI: (prompt: string, referenceImages?: { url: string; label: string }[]) => Promise<{imageUrl: string; imageBase64?: string}>;
  // 付费视频API
  callPaidVideoAPI: (prompt: string, imageUrl?: string) => Promise<{taskId: string; status: string}>;
  queryPaidVideoStatus: (taskId: string) => Promise<{status: string; videoUrl?: string}>;
  // 旧API（兼容现有代码）
  callChatAPI: (prompt: string, preset?: ModelPreset, referenceImages?: { url: string; label: string }[]) => Promise<string>;
  callImageAPI: (prompt: string, preset?: ModelPreset, referenceImages?: { url: string; label: string }[]) => Promise<{imageUrl: string; imageBase64?: string}>;
  callVideoAPI: (prompt: string, preset?: ModelPreset, imageUrl?: string, referenceImages?: { url: string; label: string }[]) => Promise<{taskId: string; status: string}>;
  queryVideoStatus: (taskId: string, preset?: ModelPreset) => Promise<{status: string; videoUrl?: string}>;
  // 图片生成任务状态
  getImageGenStatus: (shotId: string) => AppState['imageGenTasks'][string] | undefined;
  clearImageGenStatus: (shotId: string) => void;
  // ComfyUI TTS配音
  callComfyUITTS: (structuredText: string, narratorAudio?: string, characterAudio?: string, emotion?: string) => Promise<{audioUrl: string; duration: number}>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // 加载配置
  const loadConfig = () => {
    try {
      const savedConfig = localStorage.getItem(CONFIG_KEY);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        dispatch({ type: 'SET_CONFIG', payload: { ...defaultConfig, ...parsed } });
      }
      const savedProjects = localStorage.getItem(PROJECTS_KEY);
      if (savedProjects) {
        dispatch({ type: 'SET_PROJECTS', payload: JSON.parse(savedProjects) });
      }
      const savedConcurrency = localStorage.getItem('anime-studio-concurrency');
      if (savedConcurrency) {
        dispatch({ type: 'SET_BATCH_CONCURRENCY', payload: parseInt(savedConcurrency) });
      }
    } catch (e) {
      console.error('Failed to load:', e);
    }
  };

  // 保存配置
  const saveConfig = () => {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(state.config));
      showToast('配置已保存', 'success');
    } catch (e) {
      showToast('保存失败', 'error');
    }
  };

  // 保存项目
  const saveProjects = () => {
    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(state.projects));
    } catch (e) {
      console.error('Failed to save projects:', e);
    }
  };

  // 重置配置
  const resetConfig = () => {
    dispatch({ type: 'RESET_CONFIG' });
    showToast('已重置', 'success');
  };

  // 显示Toast
  const showToast = (message: string, type: 'success' | 'error') => {
    dispatch({ type: 'SHOW_TOAST', payload: { message, type } });
    setTimeout(() => {
      dispatch({ type: 'HIDE_TOAST' });
    }, 3000);
  };

  // 获取当前项目
  const getCurrentProject = () => {
    if (!state.currentProjectId) return null;
    return state.projects.find(p => p.id === state.currentProjectId) || null;
  };

  // 获取选中的分镜
  const getSelectedShot = () => {
    const project = getCurrentProject();
    if (!project || !state.selectedShotId) return null;
    return project.shots.find(s => s.id === state.selectedShotId) || null;
  };

  // 获取API基础地址
  const getBaseUrl = (preset?: ModelPreset) => {
    const base = preset?.apiAddress || DEFAULT_API_BASE;
    // 移除末尾的斜杠，避免URL中出现双斜杠
    return base.replace(/\/$/, '');
  };

  // 获取API Key
  const getApiKey = (preset?: ModelPreset) => {
    return preset?.apiKey || '';
  };

  // 调用聊天API (改文/分镜/提示词，支持参考图)
  const callChatAPI = async (
    prompt: string,
    preset?: ModelPreset,
    referenceImages?: { url: string; label: string }[]
  ): Promise<string> => {
    const baseUrl = getBaseUrl(preset);
    const apiKey = getApiKey(preset);
    const modelName = preset?.modelName || 'gpt-4o';

    if (!apiKey) {
      throw new Error('请先在设置中配置API KEY');
    }

    // 构建消息内容
    const content: any[] = [{ type: 'text', text: prompt }];

    // 添加参考图片
    if (referenceImages && referenceImages.length > 0) {
      for (const ref of referenceImages) {
        if (ref.url.startsWith('data:')) {
          const matches = ref.url.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            content.push({
              type: 'image_url',
              image_url: {
                url: ref.url,
                detail: 'low'
              }
            });
          }
        } else if (ref.url.startsWith('http')) {
          content.push({
            type: 'image_url',
            image_url: {
              url: ref.url,
              detail: 'low'
            }
          });
        }
      }
    }

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content }],
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API调用失败: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  };

  // 分析模型API（用于：全剧概要、人物、场景、物品、改文、提示词分析等）
  const callAnalyzeAPI = async (prompt: string): Promise<string> => {
    const { analyzeApiUrl, analyzeApiKey, analyzeModelName } = state.config.basic;

    if (!analyzeApiKey) {
      throw new Error('请先在设置中配置分析模型API');
    }

    const baseUrl = analyzeApiUrl.replace(/\/$/, '') || 'https://api.openai.com/v1';
    const modelName = analyzeModelName || 'gpt-4o';

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${analyzeApiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `分析模型API调用失败: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  };

  // 调用图片生成API (Gemini格式，支持参考图)
  const callImageAPI = async (
    prompt: string,
    preset?: ModelPreset,
    referenceImages?: { url: string; label: string }[]
  ): Promise<{imageUrl: string; imageBase64?: string}> => {
    const baseUrl = getBaseUrl(preset);
    const apiKey = getApiKey(preset);
    const modelName = preset?.modelName || 'gemini-2.0-flash-preview-image-generation';

    if (!apiKey) {
      throw new Error('请先在设置中配置API KEY');
    }

    // 构建请求体 parts
    const parts: any[] = [{ text: prompt }];

    // 如果有参考图，添加到 parts 中
    if (referenceImages && referenceImages.length > 0) {
      for (const ref of referenceImages) {
        if (ref.url.startsWith('data:')) {
          // 解析 base64 URL
          const matches = ref.url.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            parts.push({ text: `[参考图片 - ${ref.label}]` });
            parts.push({
              inlineData: {
                mimeType: matches[1],
                data: matches[2]
              }
            });
          }
        }
      }
    }

    const response = await fetch(`${baseUrl}/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
      })
    });

    // 先获取原始文本
    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`图片生成失败: ${response.status} - ${responseText.substring(0, 200)}`);
    }

    // 尝试解析JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('JSON解析失败，返回内容:', responseText.substring(0, 500));
      throw new Error(`返回数据格式错误: ${responseText.substring(0, 100)}`);
    }

    // 解析Gemini返回的图片
    let imageUrl = '';
    let imageBase64 = '';

    if (data.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData) {
          imageBase64 = part.inlineData.data;
          imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!imageUrl && !imageBase64) {
      // 如果没有返回图片，检查是否有其他格式
      if (data.image_url || data.url) {
        imageUrl = data.image_url || data.url;
      } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        // 返回的是文本而不是图片
        throw new Error(`API返回了文本而非图片: ${data.candidates[0].content.parts[0].text.substring(0, 100)}`);
      } else {
        console.log('Image response:', JSON.stringify(data).substring(0, 500));
        throw new Error('未收到图片数据，请检查模型是否支持图片生成');
      }
    }

    return { imageUrl, imageBase64 };
  };

  // 付费生图API
  const callPaidImageAPI = async (
    prompt: string,
    referenceImages?: { url: string; label: string }[]
  ): Promise<{imageUrl: string; imageBase64?: string}> => {
    const { imageApiUrl, imageApiKey, imageModelName } = state.config.basic;

    if (!imageApiKey) {
      throw new Error('请先在设置中配置付费生图API');
    }

    const baseUrl = imageApiUrl.replace(/\/$/, '') || 'https://api.openai.com/v1';
    const modelName = imageModelName || 'dall-e-3';

    // 构建消息内容
    const content: any[] = [{ type: 'text', text: prompt }];

    // 添加参考图片
    if (referenceImages && referenceImages.length > 0) {
      for (const ref of referenceImages) {
        if (ref.url.startsWith('data:')) {
          const matches = ref.url.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            content.push({
              type: 'image_url',
              image_url: {
                url: ref.url,
                detail: 'low'
              }
            });
          }
        } else if (ref.url.startsWith('http')) {
          content.push({
            type: 'image_url',
            image_url: {
              url: ref.url,
              detail: 'low'
            }
          });
        }
      }
    }

    // 根据不同的API调整调用方式
    if (modelName.includes('gemini')) {
      // Gemini格式
      const parts: any[] = [{ text: prompt }];
      if (referenceImages && referenceImages.length > 0) {
        for (const ref of referenceImages) {
          if (ref.url.startsWith('data:')) {
            const matches = ref.url.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              parts.push({
                inlineData: {
                  mimeType: matches[1],
                  data: matches[2]
                }
              });
            }
          }
        }
      }
      const response = await fetch(`${baseUrl}/v1beta/models/${modelName}:generateContent?key=${imageApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
        })
      });
      const responseText = await response.text();
      if (!response.ok) throw new Error(`图片生成失败: ${response.status}`);
      const data = JSON.parse(responseText);
      let imageUrl = '';
      let imageBase64 = '';
      if (data.candidates?.[0]?.content?.parts) {
        for (const part of data.candidates[0].content.parts) {
          if (part.inlineData) {
            imageBase64 = part.inlineData.data;
            imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            break;
          }
        }
      }
      return { imageUrl, imageBase64 };
    } else {
      // OpenAI格式
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${imageApiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content }],
        })
      });
      if (!response.ok) throw new Error(`图片生成失败: ${response.status}`);
      const data = await response.json();
      // 假设返回格式包含 image_url 或 base64
      const imageUrl = data.data?.[0]?.url || data.image_url || '';
      const imageBase64 = data.data?.[0]?.base64 || '';
      return { imageUrl, imageBase64 };
    }
  };

  // 调用视频生成API
  const callVideoAPI = async (
    prompt: string,
    preset?: ModelPreset,
    imageUrl?: string,
    referenceImages?: { url: string; label: string }[]
  ): Promise<{taskId: string; status: string}> => {
    const baseUrl = getBaseUrl(preset);
    const apiKey = getApiKey(preset);
    const modelName = preset?.modelName || 'veo3.1-fast';

    if (!apiKey) {
      throw new Error('请先在设置中配置API KEY');
    }

    // 构建请求体
    const requestBody: any = {
      model: modelName,
      prompt: prompt,
      enhance_prompt: true,
    };

    // 如果有图片URL，使用图片URL
    if (imageUrl) {
      requestBody.image_url = imageUrl;
    } else if (referenceImages && referenceImages.length > 0) {
      // 如果没有图片但有参考图，解析第一个参考图的base64
      for (const ref of referenceImages) {
        if (ref.url.startsWith('data:')) {
          requestBody.image_url = ref.url;
          break;
        }
      }
    }

    const response = await fetch(`${baseUrl}/v1/video/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `视频生成失败: ${response.status}`);
    }

    const data = await response.json();
    return { taskId: data.id, status: data.status };
  };

  // 付费视频API
  const callPaidVideoAPI = async (
    prompt: string,
    imageUrl?: string
  ): Promise<{taskId: string; status: string}> => {
    const { videoApiUrl, videoApiKey, videoModelName } = state.config.basic;

    if (!videoApiKey) {
      throw new Error('请先在设置中配置付费视频API');
    }

    const baseUrl = videoApiUrl.replace(/\/$/, '');
    const modelName = videoModelName || 'veo3.1-fast';

    const requestBody: any = {
      model: modelName,
      prompt: prompt,
      enhance_prompt: true,
    };

    if (imageUrl) {
      requestBody.image_url = imageUrl;
    }

    const response = await fetch(`${baseUrl}/v1/video/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${videoApiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `视频生成失败: ${response.status}`);
    }

    const data = await response.json();
    return { taskId: data.id, status: data.status };
  };

  // 获取图片生成任务状态
  const getImageGenStatus = (shotId: string) => {
    return state.imageGenTasks[shotId];
  };

  // 清除图片生成任务状态
  const clearImageGenStatus = (shotId: string) => {
    dispatch({ type: 'CLEAR_IMAGE_GEN_STATUS', payload: shotId });
  };

  // 查询视频状态
  const queryVideoStatus = async (taskId: string, preset?: ModelPreset): Promise<{status: string; videoUrl?: string}> => {
    const baseUrl = getBaseUrl(preset);
    const apiKey = getApiKey(preset);

    if (!apiKey) {
      throw new Error('请先在设置中配置API KEY');
    }

    const response = await fetch(`${baseUrl}/v1/video/query?id=${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`查询视频状态失败: ${response.status}`);
    }

    const data = await response.json();
    return {
      status: data.status,
      videoUrl: data.video_url || data.detail?.video_url
    };
  };

  // 查询付费视频状态
  const queryPaidVideoStatus = async (taskId: string): Promise<{status: string; videoUrl?: string}> => {
    const { videoApiUrl, videoApiKey } = state.config.basic;

    if (!videoApiKey) {
      throw new Error('请先在设置中配置付费视频API');
    }

    const baseUrl = videoApiUrl.replace(/\/$/, '');

    const response = await fetch(`${baseUrl}/v1/video/query?id=${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${videoApiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`查询视频状态失败: ${response.status}`);
    }

    const data = await response.json();
    return {
      status: data.status,
      videoUrl: data.video_url || data.detail?.video_url
    };
  };

  // 调用 ComfyUI IndexTTS2 Pro 生成配音
  const callComfyUITTS = async (
    structuredText: string,
    narratorAudio?: string,  // 旁白参考音频文件名
    characterAudio?: string,  // 角色参考音频文件名
    emotion?: string
  ): Promise<{ audioUrl: string; duration: number }> => {
    const comfyuiUrl = state.config.basic.comfyuiVoiceUrl?.replace(/\/$/, '') || 'http://127.0.0.1:8188';
    const seed = Math.floor(Math.random() * 9999999999);
    console.log('[TTS] 开始生成配音');
    console.log('[TTS] ComfyUI地址:', comfyuiUrl);
    console.log('[TTS] 文本:', structuredText);
    console.log('[TTS] 旁白音频:', narratorAudio);
    console.log('[TTS] 角色音频:', characterAudio);

    // 构建 IndexTTS2ProNode 的输入
    const ttsNodeInputs: any = {
      structured_text: structuredText,
      mode: "Auto",
      emotion_weight: 0.8,
      do_sample_mode: "on",
      temperature: 0.8,
      top_p: 0.9,
      top_k: 30,
      num_beams: 3,
      repetition_penalty: 10,
      length_penalty: 0,
      max_mel_tokens: 1815,
      max_tokens_per_sentence: 120,
      seed: seed,
    };

    // 如果有情绪描述
    if (emotion && emotion !== '无') {
      ttsNodeInputs.emotion_description = emotion;
    }

    // 构建完整的 workflow
    const workflow: any = {
      "3": {  // LoadAudio for narrator
        "inputs": {
          "audio": narratorAudio || "",
          "audioUI": narratorAudio ? `/api/view?filename=${encodeURIComponent(narratorAudio || '')}&type=input&subfolder=&rand=${Math.random()}` : ""
        },
        "class_type": "LoadAudio"
      },
      "4": {  // LoadAudio for character
        "inputs": {
          "audio": characterAudio || narratorAudio || "",
          "audioUI": (characterAudio || narratorAudio) ? `/api/view?filename=${encodeURIComponent((characterAudio || narratorAudio) || '')}&type=input&subfolder=&rand=${Math.random()}` : ""
        },
        "class_type": "LoadAudio"
      },
      "5": {  // IndexTTS2ProNode
        "inputs": {
          ...ttsNodeInputs,
          "narrator_audio": ["3", 0],
          "character1_audio": ["4", 0]
        },
        "class_type": "IndexTTS2ProNode"
      },
      "6": {  // SaveAudio
        "inputs": {
          "filename_prefix": "anime-studio-tts",
          "audio": ["5", 0]
        },
        "class_type": "SaveAudio"
      }
    };

    console.log('[TTS] 提交workflow到ComfyUI...');

    // 提交到 ComfyUI
    const response = await fetch(`${comfyuiUrl}/api/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow })
    });

    console.log('[TTS] 响应状态:', response.status);
    console.log('[TTS] 响应头:', response.headers.get('content-type'));

    // 检查返回的是否为HTML（可能是404或错误页面）
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[TTS] 非JSON响应:', text.substring(0, 200));
      throw new Error(`ComfyUI返回了非JSON格式: ${response.status}。请检查ComfyUI是否在运行，或地址是否正确。`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TTS] 请求失败:', errorText);
      throw new Error(`ComfyUI 请求失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[TTS] prompt_id:', data.prompt_id);
    const promptId = data.prompt_id;

    // 轮询等待完成
    let attempts = 0;
    const maxAttempts = 120; // 最多等2分钟
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const historyRes = await fetch(`${comfyuiUrl}/api/history/${promptId}`);
      if (historyRes.ok) {
        const history = await historyRes.json();
        console.log(`[TTS] 第${attempts + 1}次查询, history keys:`, Object.keys(history));
        if (history[promptId]) {
          const outputs = history[promptId].outputs;
          console.log('[TTS] outputs:', JSON.stringify(outputs));
          // 找到 SaveAudio 节点的输出
          for (const nodeId in outputs) {
            if (outputs[nodeId].audio && Array.isArray(outputs[nodeId].audio)) {
              const audioInfo = outputs[nodeId].audio[0];
              const filename = audioInfo.filename;
              const subfolder = audioInfo.subfolder || 'audio';
              // 转换为本机可访问的URL
              const audioUrl = `${comfyuiUrl}/api/view?filename=${encodeURIComponent(filename)}&type=output&subfolder=${subfolder}`;
              console.log('[TTS] 生成成功, audioUrl:', audioUrl);
              return { audioUrl, duration: 0 }; // duration 后续计算
            }
          }
        }
      }
      attempts++;
    }

    console.error('[TTS] 生成超时');
    throw new Error('TTS 生成超时');
  };

  // 项目变化时自动保存
  useEffect(() => {
    if (state.projects.length > 0) {
      saveProjects();
    }
  }, [state.projects]);

  // 保存并发数
  useEffect(() => {
    localStorage.setItem('anime-studio-concurrency', state.batchConcurrency.toString());
  }, [state.batchConcurrency]);

  // 初始化加载
  useEffect(() => {
    loadConfig();
  }, []);

  return (
    <AppContext.Provider value={{
      state, dispatch, showToast, saveConfig, loadConfig, resetConfig,
      getCurrentProject, getSelectedShot, callChatAPI, callAnalyzeAPI, callImageAPI, callPaidImageAPI,
      callVideoAPI, callPaidVideoAPI, queryVideoStatus, queryPaidVideoStatus, callComfyUITTS,
      getImageGenStatus, clearImageGenStatus
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
