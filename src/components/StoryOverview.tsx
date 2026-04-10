import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Character, Scene, Item, generateId } from '../types';

type TabId = 'overview' | 'characters' | 'scenes' | 'items';

export default function StoryOverview() {
  const { state, dispatch, getCurrentProject, showToast, callImageAPI } = useApp();
  const project = getCurrentProject();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!project) return null;

  // ============ 全剧概要 ============
  const handleSynopsisChange = (value: string) => {
    dispatch({ type: 'UPDATE_PROJECT_SYNOPSIS', payload: { projectId: project.id, synopsis: value } });
  };

  // ============ 人物 ============
  const handleAddCharacter = () => {
    const newChar: Character = { id: generateId(), name: '新人物', description: '' };
    dispatch({ type: 'ADD_CHARACTER', payload: { projectId: project.id, character: newChar } });
  };

  const handleCharacterChange = (charId: string, field: 'name' | 'description', value: string) => {
    const char = project.characters.find(c => c.id === charId);
    if (char) dispatch({ type: 'UPDATE_CHARACTER', payload: { projectId: project.id, character: { ...char, [field]: value } } });
  };

  const handleDeleteCharacter = (charId: string) => {
    if (confirm('确定删除？')) dispatch({ type: 'DELETE_CHARACTER', payload: { projectId: project.id, characterId: charId } });
  };

  const handleUploadCharacterImage = (charId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev: any) => {
        dispatch({ type: 'UPDATE_CHARACTER_REFERENCE', payload: { projectId: project!.id, characterId: charId, referenceImage: ev.target.result } });
        showToast('图片已上传', 'success');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const generateCharacterImage = async (char: Character) => {
    if (!char.description) { showToast('请先填写生成提示词', 'error'); return; }
    setIsGenerating(true);
    try {
      const preset = state.config.modelPresets.find(p => p.apiKey && p.modelName.includes('gemini'));
      if (!preset) { showToast('请选择Gemini模型', 'error'); return; }
      const result = await callImageAPI(char.description, preset);
      if (result.imageUrl) {
        dispatch({ type: 'UPDATE_CHARACTER_IMAGE', payload: { projectId: project.id, characterId: char.id, imageFile: result.imageUrl } });
        showToast('人设图已生成', 'success');
      }
    } catch (error: any) { showToast(error.message || '生成失败', 'error'); }
    finally { setIsGenerating(false); }
  };

  // ============ 场景 ============
  const handleAddScene = () => {
    const newScene: Scene = { id: generateId(), name: '新场景', description: '' };
    dispatch({ type: 'ADD_SCENE', payload: { projectId: project.id, scene: newScene } });
  };

  const handleSceneChange = (sceneId: string, field: 'name' | 'description', value: string) => {
    const scene = project.scenes.find(s => s.id === sceneId);
    if (scene) dispatch({ type: 'UPDATE_SCENE', payload: { projectId: project.id, scene: { ...scene, [field]: value } } });
  };

  const handleDeleteScene = (sceneId: string) => {
    if (confirm('确定删除？')) dispatch({ type: 'DELETE_SCENE', payload: { projectId: project.id, sceneId } });
  };

  const handleUploadSceneImage = (sceneId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev: any) => {
        dispatch({ type: 'UPDATE_SCENE_REFERENCE', payload: { projectId: project!.id, sceneId, referenceImage: ev.target.result } });
        showToast('图片已上传', 'success');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const generateSceneImage = async (scene: Scene) => {
    if (!scene.description) { showToast('请先填写生成提示词', 'error'); return; }
    setIsGenerating(true);
    try {
      const preset = state.config.modelPresets.find(p => p.apiKey && p.modelName.includes('gemini'));
      if (!preset) { showToast('请选择Gemini模型', 'error'); return; }
      const result = await callImageAPI(scene.description, preset);
      if (result.imageUrl) {
        dispatch({ type: 'UPDATE_SCENE_IMAGE', payload: { projectId: project.id, sceneId: scene.id, imageFile: result.imageUrl } });
        showToast('场景图已生成', 'success');
      }
    } catch (error: any) { showToast(error.message || '生成失败', 'error'); }
    finally { setIsGenerating(false); }
  };

  // ============ 物品 ============
  const handleAddItem = () => {
    const newItem: Item = { id: generateId(), name: '新物品', description: '' };
    dispatch({ type: 'ADD_ITEM', payload: { projectId: project.id, item: newItem } });
  };

  const handleItemChange = (itemId: string, field: 'name' | 'description', value: string) => {
    const item = project.items.find(i => i.id === itemId);
    if (item) dispatch({ type: 'UPDATE_ITEM', payload: { projectId: project.id, item: { ...item, [field]: value } } });
  };

  const handleDeleteItem = (itemId: string) => {
    if (confirm('确定删除？')) dispatch({ type: 'DELETE_ITEM', payload: { projectId: project.id, itemId } });
  };

  const handleUploadItemImage = (itemId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev: any) => {
        dispatch({ type: 'UPDATE_ITEM_REFERENCE', payload: { projectId: project!.id, itemId, referenceImage: ev.target.result } });
        showToast('图片已上传', 'success');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const generateItemImage = async (item: Item) => {
    if (!item.description) { showToast('请先填写生成提示词', 'error'); return; }
    setIsGenerating(true);
    try {
      const preset = state.config.modelPresets.find(p => p.apiKey && p.modelName.includes('gemini'));
      if (!preset) { showToast('请选择Gemini模型', 'error'); return; }
      const result = await callImageAPI(item.description, preset);
      if (result.imageUrl) {
        dispatch({ type: 'UPDATE_ITEM_IMAGE', payload: { projectId: project.id, itemId: item.id, imageFile: result.imageUrl } });
        showToast('物品图已生成', 'success');
      }
    } catch (error: any) { showToast(error.message || '生成失败', 'error'); }
    finally { setIsGenerating(false); }
  };

  // ============ 一键生成 ============
  const handleGenerateAll = async () => {
    const textToAnalyze = project.rewrittenText || project.originalText;
    if (!textToAnalyze) { showToast('改文内容为空', 'error'); return; }
    setIsGenerating(true);
    try {
      const preset = state.config.modelPresets.find(p => p.apiKey);
      if (!preset) { showToast('请先配置API KEY', 'error'); return; }

      const lines = textToAnalyze.split('\n').filter(line => line.trim());
      const charNameToId: Record<string, string> = {};
      const sceneNameToId: Record<string, string> = {};
      const itemNameToId: Record<string, string> = {};
      let totalChars = 0, totalScenes = 0, totalItems = 0;

      // 收集所有人物/场景/物品
      const allCharNames = new Set<string>();
      const allSceneNames = new Set<string>();
      const allItemNames = new Set<string>();
      for (const line of lines) {
        const parts = line.split('&&');
        const charPart = parts[1]?.trim() || '';
        const scenePart = parts[2]?.trim() || '';
        const itemPart = parts[3]?.trim() || '';
        charPart.split(/[,，]/).forEach(n => { if (n.trim()) allCharNames.add(n.trim()); });
        scenePart.split(/[,，]/).forEach(n => { if (n.trim()) allSceneNames.add(n.trim()); });
        itemPart.split(/[,，]/).forEach(n => { if (n.trim()) allItemNames.add(n.trim()); });
      }

      // 创建人物
      for (const name of allCharNames) {
        const existing = project.characters.find(c => c.name === name);
        if (existing) charNameToId[name] = existing.id;
        else {
          const id = generateId();
          charNameToId[name] = id;
          dispatch({ type: 'ADD_CHARACTER', payload: { projectId: project.id, character: { id, name, description: '' } } });
          totalChars++;
        }
      }
      // 创建场景
      for (const name of allSceneNames) {
        const existing = project.scenes.find(s => s.name === name);
        if (existing) sceneNameToId[name] = existing.id;
        else {
          const id = generateId();
          sceneNameToId[name] = id;
          dispatch({ type: 'ADD_SCENE', payload: { projectId: project.id, scene: { id, name, description: '' } } });
          totalScenes++;
        }
      }
      // 创建物品
      for (const name of allItemNames) {
        const existing = project.items.find(i => i.name === name);
        if (existing) itemNameToId[name] = existing.id;
        else {
          const id = generateId();
          itemNameToId[name] = id;
          dispatch({ type: 'ADD_ITEM', payload: { projectId: project.id, item: { id, name, description: '' } } });
          totalItems++;
        }
      }

      // 更新分镜关联
      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split('&&');
        const charIds: string[] = parts[1]?.split(/[,，]/).filter(n => n.trim()).map(n => charNameToId[n.trim()]).filter(id => !!id) || [];
        const sceneIds: string[] = parts[2]?.split(/[,，]/).filter(n => n.trim()).map(n => sceneNameToId[n.trim()]).filter(id => !!id) || [];
        const itemIds: string[] = parts[3]?.split(/[,，]/).filter(n => n.trim()).map(n => itemNameToId[n.trim()]).filter(id => !!id) || [];
        const shot = project.shots.find(s => s.index === i + 1);
        if (shot) dispatch({ type: 'UPDATE_SHOT', payload: { projectId: project.id, shot: { ...shot, characterIds: charIds, sceneIds, itemIds } } });
      }

      showToast(`完成：${totalChars}人物、${totalScenes}场景、${totalItems}物品，${lines.length}个分镜已关联`, 'success');
    } catch (error: any) { showToast(error.message || '失败', 'error'); }
    finally { setIsGenerating(false); }
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: '全剧概要' },
    { id: 'characters', label: '人物' },
    { id: 'scenes', label: '场景' },
    { id: 'items', label: '物品' },
  ];

  // 渲染图片卡片（通用）
  const renderImageCard = (
    id: string,
    name: string,
    nameField: 'name' | 'description',
    image: string | undefined,
    onNameChange: (id: string, field: 'name' | 'description', value: string) => void,
    onUpload: (id: string) => void,
    onGenerate: () => void,
    onDelete: () => void,
    typeLabel: string
  ) => (
    <div key={id} className="panel space-y-2">
      {/* 图片区域 */}
      <div className="relative aspect-video bg-[#1a1a1a] rounded-lg overflow-hidden">
        {image ? (
          <img src={image} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[#666666]">
            <span className="text-3xl mb-1">🖼️</span>
            <span className="text-xs">暂无图片</span>
          </div>
        )}
        <button onClick={onDelete} className="absolute top-1 right-1 bg-red-600 text-white text-xs px-2 py-0.5 rounded hover:bg-red-700">删除</button>
      </div>
      {/* 名称 */}
      <input type="text" className="input-field w-full text-sm" placeholder={`${typeLabel}名称`} value={name} onChange={(e) => onNameChange(id, nameField, e.target.value)} />
      {/* 生成提示词 */}
      <textarea className="input-field min-h-[60px] text-xs" placeholder={`生成图片的提示词...`} value={name === nameField ? '' : name} onChange={(e) => onNameChange(id, nameField === 'name' ? 'description' : 'description', e.target.value)} />
      {/* 按钮组 */}
      <div className="flex gap-1">
        <button onClick={() => onUpload(id)} className="btn btn-secondary text-xs flex-1">📤 上传</button>
        <button onClick={onGenerate} disabled={isGenerating} className="btn btn-secondary text-xs flex-1">🎨 生成</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-[#3a3a3a]">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}>
            {tab.label}
          </button>
        ))}
        <button onClick={handleGenerateAll} disabled={isGenerating} className="btn btn-primary text-sm ml-auto mr-2">
          {isGenerating ? '生成中...' : '🎯 一键生成全部'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* 全剧概要 */}
        {activeTab === 'overview' && (
          <textarea className="input-field w-full h-full min-h-[400px]" placeholder="输入或编辑全剧概要..." value={project.synopsis} onChange={(e) => handleSynopsisChange(e.target.value)} />
        )}

        {/* 人物 */}
        {activeTab === 'characters' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">人物列表</h3>
              <button onClick={handleAddCharacter} className="btn btn-secondary text-sm">+ 添加人物</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {(project.characters || []).map(char => {
                const image = char.imageFile || char.referenceImage;
                return renderImageCard(
                  char.id, char.name, 'description', image,
                  handleCharacterChange, handleUploadCharacterImage,
                  () => generateCharacterImage(char), () => handleDeleteCharacter(char.id), '人物'
                );
              })}
            </div>
          </div>
        )}

        {/* 场景 */}
        {activeTab === 'scenes' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">场景列表</h3>
              <button onClick={handleAddScene} className="btn btn-secondary text-sm">+ 添加场景</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {(project.scenes || []).map(scene => {
                const image = scene.imageFile || scene.referenceImage;
                return renderImageCard(
                  scene.id, scene.name, 'description', image,
                  handleSceneChange, handleUploadSceneImage,
                  () => generateSceneImage(scene), () => handleDeleteScene(scene.id), '场景'
                );
              })}
            </div>
          </div>
        )}

        {/* 物品 */}
        {activeTab === 'items' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">物品列表</h3>
              <button onClick={handleAddItem} className="btn btn-secondary text-sm">+ 添加物品</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {(project.items || []).map(item => {
                const image = item.imageFile || item.referenceImage;
                return renderImageCard(
                  item.id, item.name || '', 'description', image,
                  handleItemChange, handleUploadItemImage,
                  () => generateItemImage(item), () => handleDeleteItem(item.id), '物品'
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
