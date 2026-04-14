// 应用配置
export interface AppConfig {
  basic: {
    positivePrompt: string;    // 正向提示词
    negativePrompt: string;   // 负向提示词
    style: string;           // 风格（可填写）
    size: string;            // 尺寸（可填写）
    projectDir: string;      // 项目目录（创建项目时自动在此目录下创建）
    capcutDir: string;      // 导出剪映目录
    comfyuiVoiceUrl: string;  // ComfyUI 配音地址
    comfyuiPath: string;  // ComfyUI 本地安装路径（如 D:\\ComfyUI-aki-v3\\ComfyUI）
    comfyuiVideoUrl: string;  // ComfyUI 视频地址
    // ComfyUI 生图地址
    comfyuiImageUrl: string;
    // 分析模型配置（用于：全剧概要、人物、场景、物品、改文、提示词分析等）
    analyzeApiUrl: string;
    analyzeApiKey: string;
    analyzeModelName: string;
    // 付费配音配置
    voiceApiUrl: string;
    voiceApiKey: string;
    voiceModelName: string;
    // 付费生图配置
    imageApiUrl: string;
    imageApiKey: string;
    imageModelName: string;
    // 付费视频配置
    videoApiUrl: string;
    videoApiKey: string;
    videoModelName: string;
  };
  prompts: {
    storyboardPrompt: string; // 分镜咒语
    textPrompt: string;       // 改文咒语
    imagePrompt: string;      // 图片咒语
    animePrompt: string;      // 动漫/视频咒语
    characterPrompt: string;  // 人物分析咒语
    scenePrompt: string;     // 场景分析咒语
  };
  modelPresets: ModelPreset[]; // 模型预设列表
}

// 模型预设
export interface ModelPreset {
  id: string;
  name: string;
  apiAddress: string;       // 可为空，继承默认 https://api.jxincm.cn
  apiKey: string;           // API KEY（必填）
  modelName: string;        // 模型名称
}

// 人物
export interface Character {
  id: string;
  name: string;             // 人物名称
  description: string;       // 人物描述
  imageFile?: string;        // 人设图（AI生成或上传）
  referenceImage?: string;    // 参考图（上传的原始参考）
}

// 场景
export interface Scene {
  id: string;
  name: string;             // 场景名称
  description: string;       // 场景描述
  imageFile?: string;        // 场景图（AI生成或上传）
  referenceImage?: string;    // 参考图（上传的原始参考）
}

// 物品
export interface Item {
  id: string;
  name: string;             // 物品名称
  description?: string;       // 物品描述
  imageFile?: string;        // 物品图
  referenceImage?: string;    // 参考图
}

// 配音
export interface Voice {
  id: string;
  shotId?: string;          // 关联的分镜ID（可选）
  name: string;             // 配音名称
  script: string;           // 配音文案
  emotion?: string;         // 情绪：旁白、喜悦、悲伤、愤怒、恐惧、惊讶等
  timbre?: string;          // 音色：默认旁白、或指定人物音色
  audioUrl?: string;        // 生成的音频文件路径
  audioLocalPath?: string;  // 本地保存路径
  duration?: number;        // 音频时长（秒）
  status?: 'idle' | 'generating' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
}

// 人物音色
export interface CharacterTimbre {
  id: string;
  characterId?: string;     // 关联的人物ID（可选）
  name: string;             // 音色名称
  description?: string;     // 音色描述
  referenceAudio?: string;   // 参考音频（文件名或base64）
  emotionAudio?: string;   // 情绪参考音频（文件名或base64）
}

// 分镜
export interface Shot {
  id: string;
  index: number;            // 序号
  content: string;          // 分镜文案
  imagePrompt: string;      // 出图提示词
  videoPrompt: string;       // 视频提示词
  characterIds: string[];  // 人物ID列表（多选）
  sceneIds: string[];       // 场景ID列表（多选）
  itemIds: string[];        // 物品ID列表（多选）
  imageFile?: string;       // 生成的图片文件名
  videoFile?: string;       // 生成的视频文件名
  videoTaskId?: string;     // 视频任务ID（用于查询状态）
  videoLocalPath?: string;  // 本地保存路径
  voiceIds?: string[];      // 配音ID列表（关联配音）
}

// 项目
export interface Project {
  id: string;
  name: string;
  description: string;
  originalText: string;      // 原始原文
  rewrittenText: string;     // 改文后的内容
  synopsis: string;         // 全剧概要
  characters: Character[];   // 人物列表
  scenes: Scene[];           // 场景列表
  items: Item[];            // 物品列表
  voiceDubbings: Voice[];    // 配音列表
  voiceTimbres: CharacterTimbre[];  // 人物音色列表
  shots: Shot[];             // 分镜列表
  createdAt: string;
  updatedAt: string;
}

// Tab类型
export type SettingsTab = 'basic' | 'presets' | 'prompts';
export type ProjectTab = 'overview' | 'rewritten' | 'voice' | 'storyboard' | 'images' | 'videos' | 'export';
export type ViewType = 'welcome' | 'settings' | 'projectList' | 'projectDetail' | 'newProject';

// 默认配置
export const defaultConfig: AppConfig = {
  basic: {
    positivePrompt: '',
    negativePrompt: '',
    style: '',
    size: '1920x1080',
    projectDir: '',
    capcutDir: '',
    comfyuiVoiceUrl: '',
    comfyuiPath: 'D:\\ComfyUI-aki-v3\\ComfyUI',
    comfyuiVideoUrl: '',
    comfyuiImageUrl: '',
    // 分析模型
    analyzeApiUrl: '',
    analyzeApiKey: '',
    analyzeModelName: '',
    // 付费配音
    voiceApiUrl: '',
    voiceApiKey: '',
    voiceModelName: '',
    // 付费生图
    imageApiUrl: '',
    imageApiKey: '',
    imageModelName: '',
    // 付费视频
    videoApiUrl: '',
    videoApiKey: '',
    videoModelName: '',
  },
  prompts: {
    storyboardPrompt: '你是一个专业的分镜师。请将下面的故事内容拆分成若干分镜，每个分镜用一段简洁的文字描述画面和动作。用JSON数组格式返回，每个分镜包含content字段。',
    textPrompt: '你是一个专业的文本改写师。请将下面的文本改写成更适合视频制作的版本，保持原意但使描述更画面感。返回改写后的完整文本。',
    imagePrompt: '请为以下内容生成一张图片描述，使用英语，返回简洁的图片生成提示词：',
    animePrompt: '请为以下分镜内容生成视频描述，使用英语，返回适合AI视频生成的提示词：',
    characterPrompt: '你是一个专业的小说分析师。请分析以下故事，提取所有主要人物，每个人的信息包括：名称、外貌特征、性格特点、服装打扮。用JSON数组格式返回，每个元素包含name、description字段。',
    scenePrompt: '你是一个专业的小说分析师。请分析以下故事，提取所有主要场景，每个场景的信息包括：场景名称、地理位置、环境特点、时间氛围。用JSON数组格式返回，每个元素包含name、description字段。',
  },
  modelPresets: [],
};

// 生成唯一ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 默认API地址
export const DEFAULT_API_BASE = 'https://api.jxincm.cn';
