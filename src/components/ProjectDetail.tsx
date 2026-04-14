import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Shot, Character, Scene, Item, Voice, CharacterTimbre, generateId } from '../types';
import StoryOverview from './StoryOverview';

const IMAGE_GEN_TIMEOUT = 10 * 60 * 1000; // 10分钟超时

// SRT时间格式转换：秒 -> HH:MM:SS,mmm
function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`;
}

export default function ProjectDetail() {
  const {
    state, dispatch, getCurrentProject, getSelectedShot,
    showToast, callChatAPI, callAnalyzeAPI, callPaidImageAPI,
    callPaidVideoAPI, queryPaidVideoStatus, callComfyUITTS,
    getImageGenStatus, clearImageGenStatus
  } = useApp();

  const project = getCurrentProject();
  const selectedShot = getSelectedShot();
  const [isProcessing, setIsProcessing] = useState(false);
  const [rewrittenText, setRewrittenText] = useState('');
  const [imageGenMessage, setImageGenMessage] = useState<string>('');
  // 配音/生图/视频来源
  const [voiceSource, setVoiceSource] = useState<'comfyui' | 'paid'>('comfyui');
  const [imageSource, setImageSource] = useState<'comfyui' | 'paid'>('paid');
  const [videoSource, setVideoSource] = useState<'comfyui' | 'paid'>('paid');
  const timeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // 组件卸载时清理所有定时器
  useEffect(() => {
    return () => {
      Object.values(timeoutRef.current).forEach(t => clearTimeout(t));
    };
  }, []);

  // 获取当前分镜的生图状态
  const getShotGenStatus = (shotId: string) => {
    return getImageGenStatus(shotId);
  };

  // 取消生图任务
  const handleCancelImageGen = () => {
    if (!selectedShot) return;
    const status = getShotGenStatus(selectedShot.id);
    if (status && (status.status === 'processing' || status.status === 'queued')) {
      // 清理超时定时器
      if (timeoutRef.current[selectedShot.id]) {
        clearTimeout(timeoutRef.current[selectedShot.id]);
        delete timeoutRef.current[selectedShot.id];
      }
      // 清除任务状态
      clearImageGenStatus(selectedShot.id);
      setImageGenMessage('');
      setIsProcessing(false);
      showToast('已取消任务', 'success');
    }
  };

  if (!project) {
    return <div className="p-6">项目不存在</div>;
  }

  const handleTabChange = (tab: 'overview' | 'rewritten' | 'voice' | 'storyboard' | 'images' | 'videos' | 'export') => {
    dispatch({ type: 'SET_PROJECT_TAB', payload: tab });
    if (tab === 'rewritten') {
      setRewrittenText(project.rewrittenText || project.originalText);
    }
  };

  const handleSelectShot = (shotId: string) => {
    dispatch({ type: 'SET_SELECTED_SHOT', payload: shotId });
  };


  const getShotContext = (shotIndex: number, range: number = 10) => {
    const shots = project.shots;
    const start = Math.max(0, shotIndex - range);
    const end = Math.min(shots.length, shotIndex + range);
    return {
      before: shots.slice(start, shotIndex).map(s => s.content).join('\n'),
      after: shots.slice(shotIndex + 1, end).map(s => s.content).join('\n'),
      total: shots.length
    };
  };

  const buildContextPrompt = (shotContent: string, shotIndex: number) => {
    const context = getShotContext(shotIndex, 10);
    return `【全剧概要】\n${project.synopsis || '(未填写概要)'}\n\n【前${Math.min(shotIndex, 10)}个分镜内容】\n${context.before || '(无)'}\n\n【当前分镜】\n${shotContent}\n\n【后${Math.min(project.shots.length - shotIndex - 1, 10)}个分镜内容】\n${context.after || '(无)'}`;
  };

  const handleRewriteTextInBatches = async () => {
    if (!project.originalText) {
      showToast('请先输入原文', 'error');
      return;
    }
    if (!state.config.basic.analyzeApiKey) {
      showToast('请先在设置中配置分析模型API', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      const text = project.originalText;
      const maxChars = 5000;
      const batches: string[] = [];
      const paragraphs = text.split(/\n+/);
      let currentBatch = '';
      for (const paragraph of paragraphs) {
        if (currentBatch.length + paragraph.length > maxChars) {
          if (currentBatch) batches.push(currentBatch.trim());
          currentBatch = paragraph;
        } else {
          currentBatch += '\n' + paragraph;
        }
      }
      if (currentBatch.trim()) batches.push(currentBatch.trim());

      const rewrittenParagraphs: string[] = [];
      for (let i = 0; i < batches.length; i++) {
        const batchPrompt = `${state.config.prompts.textPrompt}\n\n请改写以下内容：\n\n${batches[i]}`;
        try {
          const result = await callAnalyzeAPI(batchPrompt);
          rewrittenParagraphs.push(result.trim());
        } catch {
          rewrittenParagraphs.push(batches[i]);
        }
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      const fullRewrittenText = rewrittenParagraphs.join('\n\n');
      setRewrittenText(fullRewrittenText);
      showToast(`改文完成（共${batches.length}批次）`, 'success');
    } catch (error: any) {
      showToast(error.message || '改文失败', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

const handleSaveRewritten = () => {
    // 解析格式：每一行都是"分镜内容&&人物&&场景&&物品"
    // 例如：
    // 我本以为大道宗能安稳，没想到血厉大帝竟然带着滔天杀意降临了。&&陆玄,夜楚年&&青玄峰&&红色宝剑
    // 第二段内容。&&人物B&&场景B&&物品B
    // 第三段内容。&&&&  （人物场景物品可为空）

    const lines = rewrittenText.split('\n').filter(line => line.trim());
    const shots: Shot[] = [];
    let totalChars = 0, totalScenes = 0, totalItems = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      const parts = trimmedLine.split('&&');
      const content = parts[0]?.trim() || '';
      const charPart = parts[1]?.trim() || '';
      const scenePart = parts[2]?.trim() || '';
      const itemPart = parts[3]?.trim() || '';

      if (!content) continue;

      // 解析并创建人物
      const charNames = charPart.split(/[,，]/).filter(n => n.trim());
      const charIds: string[] = [];
      for (const name of charNames) {
        const trimmedName = name.trim();
        if (!trimmedName) continue;
        const existing = (project.characters || []).find(c => c.name === trimmedName);
        if (existing) {
          charIds.push(existing.id);
        } else {
          const newChar: Character = { id: generateId(), name: trimmedName, description: '' };
          dispatch({ type: 'ADD_CHARACTER', payload: { projectId: project.id, character: newChar } });
          charIds.push(newChar.id);
          totalChars++;
        }
      }

      // 解析并创建场景
      const sceneNames = scenePart.split(/[,，]/).filter(n => n.trim());
      const sceneIds: string[] = [];
      for (const name of sceneNames) {
        const trimmedName = name.trim();
        if (!trimmedName) continue;
        const existing = (project.scenes || []).find(s => s.name === trimmedName);
        if (existing) {
          sceneIds.push(existing.id);
        } else {
          const newScene: Scene = { id: generateId(), name: trimmedName, description: '' };
          dispatch({ type: 'ADD_SCENE', payload: { projectId: project.id, scene: newScene } });
          sceneIds.push(newScene.id);
          totalScenes++;
        }
      }

      // 解析并创建物品
      const itemNames = itemPart.split(/[,，]/).filter(n => n.trim());
      const itemIds: string[] = [];
      for (const name of itemNames) {
        const trimmedName = name.trim();
        if (!trimmedName) continue;
        const existing = (project.items || []).find(i => i.name === trimmedName);
        if (existing) {
          itemIds.push(existing.id);
        } else {
          const newItem: Item = { id: generateId(), name: trimmedName, description: '' };
          dispatch({ type: 'ADD_ITEM', payload: { projectId: project.id, item: newItem } });
          itemIds.push(newItem.id);
          totalItems++;
        }
      }

      shots.push({
        id: generateId(),
        index: shots.length + 1,
        content,
        imagePrompt: '',
        videoPrompt: '',
        characterIds: charIds,
        sceneIds: sceneIds,
        itemIds: itemIds,
      });
    }

    dispatch({
      type: 'UPDATE_PROJECT',
      payload: { ...project, rewrittenText: rewrittenText, shots, updatedAt: new Date().toISOString() }
    });
    if (shots.length > 0) {
      dispatch({ type: 'SET_SELECTED_SHOT', payload: shots[0].id });
    }
    showToast(`已保存并生成 ${shots.length} 个分镜，同步创建了 ${totalChars} 个人物、${totalScenes} 个场景、${totalItems} 个物品`, 'success');
  };

  const handleMergeUp = () => {
    if (!selectedShot || selectedShot.index <= 1) {
      showToast('无法向上合并', 'error');
      return;
    }
    const prevShot = project.shots.find(s => s.index === selectedShot.index - 1);
    if (!prevShot) return;
    const mergedContent = `${prevShot.content}\n${selectedShot.content}`;
    const updatedShot = { ...selectedShot, content: mergedContent };
    dispatch({ type: 'DELETE_SHOT', payload: { projectId: project.id, shotId: prevShot.id } });
    const remainingShots = project.shots.filter(s => s.id !== prevShot.id).map((s, i) => ({ ...s, index: i + 1 }));
    dispatch({ type: 'SET_SHOTS', payload: { projectId: project.id, shots: remainingShots } });
    dispatch({ type: 'UPDATE_SHOT', payload: { projectId: project.id, shot: updatedShot } });
    showToast('已向上合并', 'success');
  };

  const handleMergeDown = () => {
    if (!selectedShot || selectedShot.index >= project.shots.length) {
      showToast('无法向下合并', 'error');
      return;
    }
    const nextShot = project.shots.find(s => s.index === selectedShot.index + 1);
    if (!nextShot) return;
    const mergedContent = `${selectedShot.content}\n${nextShot.content}`;
    const updatedShot = { ...selectedShot, content: mergedContent };
    dispatch({ type: 'DELETE_SHOT', payload: { projectId: project.id, shotId: nextShot.id } });
    const remainingShots = project.shots.filter(s => s.id !== nextShot.id).map((s, i) => ({ ...s, index: i + 1 }));
    dispatch({ type: 'SET_SHOTS', payload: { projectId: project.id, shots: remainingShots } });
    dispatch({ type: 'UPDATE_SHOT', payload: { projectId: project.id, shot: updatedShot } });
    showToast('已向下合并', 'success');
  };

  const splitByPunctuation = (text: string): string[] => {
    const parts = text.split(/(?<=[。！？\n])/);
    return parts.filter(p => p.trim()).map(p => p.trim());
  };

  const handleSplitUp = () => {
    if (!selectedShot || selectedShot.index <= 1) {
      showToast('无法向上拆分', 'error');
      return;
    }
    const prevShot = project.shots.find(s => s.index === selectedShot.index - 1);
    if (!prevShot) return;
    const parts = splitByPunctuation(prevShot.content);
    if (parts.length <= 1) {
      showToast('上一个分镜无法继续拆分', 'error');
      return;
    }
    const newShots: Shot[] = parts.map((content, i) => ({
      id: generateId(),
      index: prevShot.index + i,
      content,
      imagePrompt: '',
      videoPrompt: '',
      characterIds: [],
      sceneIds: [],
      itemIds: [],
    }));
    const beforeShots = project.shots.filter(s => s.index < prevShot.index);
    const afterShots = project.shots.filter(s => s.index > prevShot.index);
    const updatedAfterShots = afterShots.map((s, i) => ({ ...s, index: beforeShots.length + newShots.length + i + 1 }));
    const allShots = [...beforeShots, ...newShots, ...updatedAfterShots];
    dispatch({ type: 'SET_SHOTS', payload: { projectId: project.id, shots: allShots } });
    showToast(`已拆分为 ${newShots.length} 个分镜`, 'success');
  };

  const handleSplitDown = () => {
    if (!selectedShot) {
      showToast('请先选择分镜', 'error');
      return;
    }
    const parts = splitByPunctuation(selectedShot.content);
    if (parts.length <= 1) {
      showToast('当前分镜无法继续拆分', 'error');
      return;
    }
    const newShots: Shot[] = parts.map((content, i) => ({
      id: generateId(),
      index: selectedShot.index + i,
      content,
      imagePrompt: '',
      videoPrompt: '',
      characterIds: [],
      sceneIds: [],
      itemIds: [],
    }));
    const beforeShots = project.shots.filter(s => s.index < selectedShot.index);
    const afterShots = project.shots.filter(s => s.index > selectedShot.index);
    const updatedAfterShots = afterShots.map((s, i) => ({ ...s, index: beforeShots.length + newShots.length + i }));
    const allShots = [...beforeShots, ...newShots, ...updatedAfterShots];
    dispatch({ type: 'SET_SHOTS', payload: { projectId: project.id, shots: allShots } });
    showToast(`已拆分为 ${newShots.length} 个分镜`, 'success');
  };

  const handleAnalyzeSingleImagePrompt = async (shot: Shot) => {
    if (!shot.content) {
      showToast('当前分镜内容为空', 'error');
      return;
    }
    if (!state.config.basic.analyzeApiKey) {
      showToast('请先在设置中配置分析模型API', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      // 构建人物场景物品信息（文字描述）
      let charSceneInfo = '';
      for (const charId of (shot.characterIds || [])) {
        const charInfo = (project.characters || []).find(c => c.id === charId);
        if (charInfo) {
          charSceneInfo += `\n【人物】${charInfo.name}：${charInfo.description}`;
        }
      }
      for (const sceneId of (shot.sceneIds || [])) {
        const sceneInfo = (project.scenes || []).find(s => s.id === sceneId);
        if (sceneInfo) {
          charSceneInfo += `\n【场景】${sceneInfo.name}：${sceneInfo.description}`;
        }
      }
      for (const itemId of (shot.itemIds || [])) {
        const itemInfo = (project.items || []).find(i => i.id === itemId);
        if (itemInfo) {
          charSceneInfo += `\n【物品】${itemInfo.name}：${itemInfo.description || ''}`;
        }
      }

      const contextPrompt = buildContextPrompt(shot.content, shot.index - 1);
      const fullPrompt = `${state.config.prompts.imagePrompt}\n\n# 分镜内容\n${contextPrompt}${charSceneInfo}\n\n请根据以上信息，生成适合的图片描述。`;
      const result = await callAnalyzeAPI(fullPrompt);
      const updatedShot = { ...shot, imagePrompt: result.trim() };
      dispatch({ type: 'UPDATE_SHOT', payload: { projectId: project.id, shot: updatedShot } });
      showToast(`分镜 #${shot.index} 图片提示词已生成`, 'success');
    } catch (error: any) {
      showToast(error.message || '生成失败', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyzeSingleVideoPrompt = async (shot: Shot) => {
    if (!shot.content) {
      showToast('当前分镜内容为空', 'error');
      return;
    }
    if (!state.config.basic.analyzeApiKey) {
      showToast('请先在设置中配置分析模型API', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      // 构建人物场景物品信息（文字描述）
      let charSceneItemInfo = '';
      for (const charId of (shot.characterIds || [])) {
        const charInfo = (project.characters || []).find(c => c.id === charId);
        if (charInfo) {
          charSceneItemInfo += `\n【人物】${charInfo.name}：${charInfo.description}`;
        }
      }
      for (const sceneId of (shot.sceneIds || [])) {
        const sceneInfo = (project.scenes || []).find(s => s.id === sceneId);
        if (sceneInfo) {
          charSceneItemInfo += `\n【场景】${sceneInfo.name}：${sceneInfo.description}`;
        }
      }
      for (const itemId of (shot.itemIds || [])) {
        const itemInfo = (project.items || []).find(i => i.id === itemId);
        if (itemInfo) {
          charSceneItemInfo += `\n【物品】${itemInfo.name}：${itemInfo.description || ''}`;
        }
      }

      const contextPrompt = buildContextPrompt(shot.content, shot.index - 1);
      const fullPrompt = `${state.config.prompts.animePrompt}\n\n# 分镜内容\n${contextPrompt}${charSceneItemInfo}\n\n请根据以上信息，生成适合AI视频生成的描述。`;
      const result = await callAnalyzeAPI(fullPrompt);
      const updatedShot = { ...shot, videoPrompt: result.trim() };
      dispatch({ type: 'UPDATE_SHOT', payload: { projectId: project.id, shot: updatedShot } });
      showToast(`分镜 #${shot.index} 视频提示词已生成`, 'success');
    } catch (error: any) {
      showToast(error.message || '生成失败', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyzeAllImagePrompts = async () => {
    if (project.shots.length === 0) {
      showToast('暂无分镜', 'error');
      return;
    }
    if (!state.config.basic.analyzeApiKey) {
      showToast('请先在设置中配置分析模型API', 'error');
      return;
    }
    setIsProcessing(true);
    let successCount = 0;
    try {
      for (const shot of project.shots) {
        if (!shot.content) continue;
        try {
          const contextPrompt = buildContextPrompt(shot.content, shot.index - 1);
          const fullPrompt = `${state.config.prompts.imagePrompt}\n\n${contextPrompt}`;
          const result = await callAnalyzeAPI(fullPrompt);
          const updatedShot = { ...shot, imagePrompt: result.trim() };
          dispatch({ type: 'UPDATE_SHOT', payload: { projectId: project.id, shot: updatedShot } });
          successCount++;
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch { /* skip */ }
      }
      showToast(`完成 ${successCount}/${project.shots.length}`, 'success');
    } catch (error: any) {
      showToast(error.message || '生成失败', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyzeAllVideoPrompts = async () => {
    if (project.shots.length === 0) {
      showToast('暂无分镜', 'error');
      return;
    }
    if (!state.config.basic.analyzeApiKey) {
      showToast('请先在设置中配置分析模型API', 'error');
      return;
    }
    setIsProcessing(true);
    let successCount = 0;
    try {
      for (const shot of project.shots) {
        if (!shot.content) continue;
        try {
          const contextPrompt = buildContextPrompt(shot.content, shot.index - 1);
          const fullPrompt = `${state.config.prompts.animePrompt}\n\n${contextPrompt}`;
          const result = await callAnalyzeAPI(fullPrompt);
          const updatedShot = { ...shot, videoPrompt: result.trim() };
          dispatch({ type: 'UPDATE_SHOT', payload: { projectId: project.id, shot: updatedShot } });
          successCount++;
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch { /* skip */ }
      }
      showToast(`完成 ${successCount}/${project.shots.length}`, 'success');
    } catch (error: any) {
      showToast(error.message || '生成失败', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!selectedShot) {
      showToast('请先选择一个分镜', 'error');
      return;
    }
    if (!selectedShot.imagePrompt) {
      showToast('请先生成图片提示词', 'error');
      return;
    }

    // 检查是否已有任务在进行中（防止重复提交）
    const currentStatus = getShotGenStatus(selectedShot.id);
    if (currentStatus && (currentStatus.status === 'processing' || currentStatus.status === 'queued')) {
      showToast('当前任务正在进行中，请勿重复提交', 'error');
      return;
    }

    // 设置任务状态为处理中
    dispatch({
      type: 'SET_IMAGE_GEN_STATUS',
      payload: { shotId: selectedShot.id, status: 'processing' }
    });
    setImageGenMessage('生图中...');
    setIsProcessing(true);

    // 设置10分钟超时
    const timeout = setTimeout(() => {
      dispatch({
        type: 'SET_IMAGE_GEN_STATUS',
        payload: { shotId: selectedShot.id, status: 'timeout', error: '任务超时（10分钟）' }
      });
      setImageGenMessage('任务超时，已取消');
      setIsProcessing(false);
    }, IMAGE_GEN_TIMEOUT);
    timeoutRef.current[selectedShot.id] = timeout;

    try {
      if (imageSource === 'paid' && !state.config.basic.imageApiKey) {
        showToast('请先在设置中配置付费生图API', 'error');
        dispatch({ type: 'SET_IMAGE_GEN_STATUS', payload: { shotId: selectedShot.id, status: 'failed', error: '未配置API' } });
        setImageGenMessage('');
        clearTimeout(timeoutRef.current[selectedShot.id]);
        setIsProcessing(false);
        return;
      }

      // 构建参考图列表
      const referenceImages: { url: string; label: string }[] = [];
      // 人物参考图
      for (const charId of (selectedShot.characterIds || [])) {
        const charInfo = (project.characters || []).find(c => c.id === charId);
        if (charInfo?.referenceImage) referenceImages.push({ url: charInfo.referenceImage, label: `人物：${charInfo.name}` });
        if (charInfo?.imageFile) referenceImages.push({ url: charInfo.imageFile, label: `人物：${charInfo.name}` });
      }
      // 场景参考图
      for (const sceneId of (selectedShot.sceneIds || [])) {
        const sceneInfo = (project.scenes || []).find(s => s.id === sceneId);
        if (sceneInfo?.referenceImage) referenceImages.push({ url: sceneInfo.referenceImage, label: `场景：${sceneInfo.name}` });
        if (sceneInfo?.imageFile) referenceImages.push({ url: sceneInfo.imageFile, label: `场景：${sceneInfo.name}` });
      }
      // 物品参考图
      for (const itemId of (selectedShot.itemIds || [])) {
        const itemInfo = (project.items || []).find(i => i.id === itemId);
        if (itemInfo?.referenceImage) referenceImages.push({ url: itemInfo.referenceImage, label: `物品：${itemInfo.name}` });
        if (itemInfo?.imageFile) referenceImages.push({ url: itemInfo.imageFile, label: `物品：${itemInfo.name}` });
      }

      let result;
      if (imageSource === 'paid') {
        result = await callPaidImageAPI(selectedShot.imagePrompt, referenceImages);
      } else {
        result = { imageUrl: '' }; // ComfyUI暂未实现
        showToast('ComfyUI生图功能待实现', 'error');
        return;
      }

      // 清理超时定时器
      if (timeoutRef.current[selectedShot.id]) {
        clearTimeout(timeoutRef.current[selectedShot.id]);
        delete timeoutRef.current[selectedShot.id];
      }

      if (result.imageUrl) {
        // 保存base64数据URL到imageFile字段（方便显示）
        dispatch({
          type: 'UPDATE_SHOT_IMAGE',
          payload: { projectId: project.id, shotId: selectedShot.id, imageFile: result.imageUrl }
        });
        dispatch({
          type: 'SET_IMAGE_GEN_STATUS',
          payload: { shotId: selectedShot.id, status: 'completed' }
        });
        setImageGenMessage('生成成功！');
        showToast('图片已生成', 'success');

        // 3秒后清除状态
        setTimeout(() => {
          clearImageGenStatus(selectedShot.id);
          setImageGenMessage('');
        }, 3000);
      }
    } catch (error: any) {
      // 清理超时定时器
      if (timeoutRef.current[selectedShot.id]) {
        clearTimeout(timeoutRef.current[selectedShot.id]);
        delete timeoutRef.current[selectedShot.id];
      }

      let errorMsg = error.message || '生图失败';

      // 检查是否是204或其他队列状态
      if (error.message && error.message.includes('204')) {
        errorMsg = '任务排队中，请稍后重试';
        dispatch({
          type: 'SET_IMAGE_GEN_STATUS',
          payload: { shotId: selectedShot.id, status: 'queued', error: errorMsg }
        });
        setImageGenMessage('排队中...');
      } else {
        dispatch({
          type: 'SET_IMAGE_GEN_STATUS',
          payload: { shotId: selectedShot.id, status: 'failed', error: errorMsg }
        });
        setImageGenMessage('');
        showToast(errorMsg, 'error');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!selectedShot) {
      showToast('请先选择一个分镜', 'error');
      return;
    }
    if (!selectedShot.videoPrompt) {
      showToast('请先生成视频提示词', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      if (videoSource === 'paid' && !state.config.basic.videoApiKey) {
        showToast('请先在设置中配置付费视频API', 'error');
        return;
      }

      // 构建参考图列表
      const referenceImages: { url: string; label: string }[] = [];
      // 人物参考图
      for (const charId of (selectedShot.characterIds || [])) {
        const charInfo = (project.characters || []).find(c => c.id === charId);
        if (charInfo?.referenceImage) referenceImages.push({ url: charInfo.referenceImage, label: `人物：${charInfo.name}` });
        if (charInfo?.imageFile) referenceImages.push({ url: charInfo.imageFile, label: `人物：${charInfo.name}` });
      }
      // 场景参考图
      for (const sceneId of (selectedShot.sceneIds || [])) {
        const sceneInfo = (project.scenes || []).find(s => s.id === sceneId);
        if (sceneInfo?.referenceImage) referenceImages.push({ url: sceneInfo.referenceImage, label: `场景：${sceneInfo.name}` });
        if (sceneInfo?.imageFile) referenceImages.push({ url: sceneInfo.imageFile, label: `场景：${sceneInfo.name}` });
      }
      // 物品参考图
      for (const itemId of (selectedShot.itemIds || [])) {
        const itemInfo = (project.items || []).find(i => i.id === itemId);
        if (itemInfo?.referenceImage) referenceImages.push({ url: itemInfo.referenceImage, label: `物品：${itemInfo.name}` });
        if (itemInfo?.imageFile) referenceImages.push({ url: itemInfo.imageFile, label: `物品：${itemInfo.name}` });
      }

      // 如果有生成的图片，用图片；否则用参考图
      const imageUrl = selectedShot.imageFile?.startsWith('data:') ? selectedShot.imageFile : undefined;

      let result;
      if (videoSource === 'paid') {
        result = await callPaidVideoAPI(selectedShot.videoPrompt, imageUrl);
      } else {
        showToast('ComfyUI视频功能待实现', 'error');
        return;
      }
      const fileName = `shot_${selectedShot.index}_${Date.now()}.mp4`;
      dispatch({
        type: 'UPDATE_SHOT_VIDEO',
        payload: { projectId: project.id, shotId: selectedShot.id, videoFile: fileName, videoTaskId: result.taskId }
      });
      showToast('视频任务已提交', 'success');
    } catch (error: any) {
      showToast(error.message || '视频生成失败', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShotContentChange = (shotId: string, content: string) => {
    const shot = project.shots.find(s => s.id === shotId);
    if (shot) {
      dispatch({ type: 'UPDATE_SHOT', payload: { projectId: project.id, shot: { ...shot, content } } });
    }
  };

  const handleShotPromptChange = (field: 'imagePrompt' | 'videoPrompt', value: string) => {
    if (selectedShot) {
      dispatch({
        type: 'UPDATE_SHOT',
        payload: { projectId: project.id, shot: { ...selectedShot, [field]: value } }
      });
    }
  };

  const handleDeleteShot = (shotId: string) => {
    if (confirm('确定删除此分镜？')) {
      dispatch({ type: 'DELETE_SHOT', payload: { projectId: project.id, shotId } });
      if (selectedShot?.id === shotId) {
        dispatch({ type: 'SET_SELECTED_SHOT', payload: null });
      }
    }
  };

  const handleAddShot = () => {
    const newShot: Shot = {
      id: generateId(),
      index: project.shots.length + 1,
      content: '',
      imagePrompt: '',
      videoPrompt: '',
      characterIds: [],
      sceneIds: [],
      itemIds: [],
    };
    dispatch({ type: 'ADD_SHOT', payload: { projectId: project.id, shot: newShot } });
    dispatch({ type: 'SET_SELECTED_SHOT', payload: newShot.id });
  };

  const handleBatchGenerateImages = async () => {
    const shotsWithPrompts = project.shots.filter(s => s.imagePrompt);
    if (shotsWithPrompts.length === 0) {
      showToast('没有可生图的分镜', 'error');
      return;
    }
    if (imageSource === 'paid' && !state.config.basic.imageApiKey) {
      showToast('请先在设置中配置付费生图API', 'error');
      return;
    }
    setIsProcessing(true);
    let successCount = 0;
    const concurrency = state.batchConcurrency;
    for (let i = 0; i < shotsWithPrompts.length; i += concurrency) {
      const batch = shotsWithPrompts.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (shot) => {
          try {
            // 构建参考图列表
            const referenceImages: { url: string; label: string }[] = [];
            for (const charId of (shot.characterIds || [])) {
              const charInfo = (project.characters || []).find(c => c.id === charId);
              if (charInfo?.referenceImage) referenceImages.push({ url: charInfo.referenceImage, label: `人物：${charInfo.name}` });
              if (charInfo?.imageFile) referenceImages.push({ url: charInfo.imageFile, label: `人物：${charInfo.name}` });
            }
            for (const sceneId of (shot.sceneIds || [])) {
              const sceneInfo = (project.scenes || []).find(s => s.id === sceneId);
              if (sceneInfo?.referenceImage) referenceImages.push({ url: sceneInfo.referenceImage, label: `场景：${sceneInfo.name}` });
              if (sceneInfo?.imageFile) referenceImages.push({ url: sceneInfo.imageFile, label: `场景：${sceneInfo.name}` });
            }
            for (const itemId of (shot.itemIds || [])) {
              const itemInfo = (project.items || []).find(i => i.id === itemId);
              if (itemInfo?.referenceImage) referenceImages.push({ url: itemInfo.referenceImage, label: `物品：${itemInfo.name}` });
              if (itemInfo?.imageFile) referenceImages.push({ url: itemInfo.imageFile, label: `物品：${itemInfo.name}` });
            }
            let result;
            if (imageSource === 'paid') {
              result = await callPaidImageAPI(shot.imagePrompt, referenceImages);
            } else {
              return; // ComfyUI暂未实现
            }
            if (result.imageUrl) {
              dispatch({
                type: 'UPDATE_SHOT_IMAGE',
                payload: { projectId: project.id, shotId: shot.id, imageFile: result.imageUrl }
              });
              successCount++;
            }
          } catch { /* skip */ }
        })
      );
    }
    setIsProcessing(false);
    showToast(`完成 ${successCount}/${shotsWithPrompts.length}`, 'success');
  };

  const handleBatchGenerateVideos = async () => {
    const shotsWithPrompts = project.shots.filter(s => s.videoPrompt);
    if (shotsWithPrompts.length === 0) {
      showToast('没有可生成视频的分镜', 'error');
      return;
    }
    if (videoSource === 'paid' && !state.config.basic.videoApiKey) {
      showToast('请先在设置中配置付费视频API', 'error');
      return;
    }
    setIsProcessing(true);
    let successCount = 0;
    const concurrency = state.batchConcurrency;
    for (let i = 0; i < shotsWithPrompts.length; i += concurrency) {
      const batch = shotsWithPrompts.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (shot) => {
          try {
            let result;
            if (videoSource === 'paid') {
              result = await callPaidVideoAPI(shot.videoPrompt);
            } else {
              return; // ComfyUI暂未实现
            }
            const fileName = `shot_${shot.index}_${Date.now()}.mp4`;
            dispatch({
              type: 'UPDATE_SHOT_VIDEO',
              payload: { projectId: project.id, shotId: shot.id, videoFile: fileName, videoTaskId: result.taskId }
            });
            successCount++;
          } catch { /* skip */ }
        })
      );
    }
    setIsProcessing(false);
    showToast(`完成 ${successCount}/${shotsWithPrompts.length} 任务已提交`, 'success');
  };

  const handlePollVideoStatus = async () => {
    const shotsWithTasks = project.shots.filter(s => s.videoTaskId && !s.videoFile?.includes('http'));
    if (shotsWithTasks.length === 0) {
      showToast('没有待查询的视频任务', 'error');
      return;
    }
    if (videoSource === 'paid' && !state.config.basic.videoApiKey) {
      showToast('请先在设置中配置付费视频API', 'error');
      return;
    }
    setIsProcessing(true);
    let updatedCount = 0;
    for (const shot of shotsWithTasks) {
      try {
        let result;
        if (videoSource === 'paid') {
          result = await queryPaidVideoStatus(shot.videoTaskId!);
        } else {
          continue; // ComfyUI暂未实现
        }
        if (result.status === 'completed' && result.videoUrl) {
          dispatch({
            type: 'UPDATE_SHOT_VIDEO',
            payload: { projectId: project.id, shotId: shot.id, videoFile: result.videoUrl }
          });
          updatedCount++;
        }
      } catch { /* skip */ }
    }
    setIsProcessing(false);
    showToast(`更新完成 ${updatedCount}/${shotsWithTasks.length}`, 'success');
  };

  const handleBack = () => {
    dispatch({ type: 'SET_VIEW', payload: 'projectList' });
  };

  const getContextPreview = () => {
    if (!selectedShot) return { before: [], after: [] };
    const context = getShotContext(selectedShot.index - 1, 10);
    return {
      before: context.before.split('\n').filter(l => l.trim()).slice(-10),
      after: context.after.split('\n').filter(l => l.trim()).slice(0, 10)
    };
  };

  const contextPreview = getContextPreview();

  return (
    <div className="h-full flex flex-col">
      <div className="min-h-[50px] bg-[#1a1a1a] border-b border-[#3a3a3a] flex items-center px-4 gap-4 flex-wrap">
        <button onClick={handleBack} className="text-[#a0a0a0] hover:text-white">← 返回</button>
        <span className="text-white font-medium">{project.name}</span>

        {/* 分析模型显示 */}
        <div className="flex items-center gap-1 text-sm">
          <span className="text-[#666]">🔍</span>
          <span className="text-[#10b981]">{state.config.basic.analyzeModelName || '未配置'}</span>
        </div>

        {/* 配音来源 */}
        <select
          className="input-field w-28 text-sm relative z-10"
          value={voiceSource}
          onChange={(e) => setVoiceSource(e.target.value as 'comfyui' | 'paid')}
        >
          <option value="comfyui">🎤 ComfyUI</option>
          <option value="paid">💰 付费配音</option>
        </select>

        {/* 生图来源 */}
        <select
          className="input-field w-28 text-sm relative z-10"
          value={imageSource}
          onChange={(e) => setImageSource(e.target.value as 'comfyui' | 'paid')}
        >
          <option value="comfyui">🖼️ ComfyUI</option>
          <option value="paid">💰 付费生图</option>
        </select>

        {/* 视频来源 */}
        <select
          className="input-field w-28 text-sm relative z-10"
          value={videoSource}
          onChange={(e) => setVideoSource(e.target.value as 'comfyui' | 'paid')}
        >
          <option value="comfyui">🎬 ComfyUI</option>
          <option value="paid">💰 付费视频</option>
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[#a0a0a0] text-sm">并发数:</span>
          <input
            type="number"
            min="1"
            max="100"
            className="input-field w-20 text-center"
            value={state.batchConcurrency}
            onChange={(e) => dispatch({ type: 'SET_BATCH_CONCURRENCY', payload: Math.max(1, Math.min(100, parseInt(e.target.value) || 1)) })}
          />
        </div>
      </div>

      <div className="flex border-b border-[#3a3a3a]">
        <button onClick={() => handleTabChange('overview')} className={`tab-button ${state.currentProjectTab === 'overview' ? 'active' : ''}`}>全剧概要</button>
        <button onClick={() => handleTabChange('rewritten')} className={`tab-button ${state.currentProjectTab === 'rewritten' ? 'active' : ''}`}>改文</button>
        <button onClick={() => handleTabChange('storyboard')} className={`tab-button ${state.currentProjectTab === 'storyboard' ? 'active' : ''}`}>分镜</button>
        <button onClick={() => handleTabChange('voice')} className={`tab-button ${state.currentProjectTab === 'voice' ? 'active' : ''}`}>配音 ({project.voiceDubbings?.length || 0})</button>
        <button onClick={() => handleTabChange('images')} className={`tab-button ${state.currentProjectTab === 'images' ? 'active' : ''}`}>图片 ({project.shots.filter(s => s.imageFile).length})</button>
        <button onClick={() => handleTabChange('videos')} className={`tab-button ${state.currentProjectTab === 'videos' ? 'active' : ''}`}>视频 ({project.shots.filter(s => s.videoFile).length})</button>
        <button onClick={() => handleTabChange('export')} className={`tab-button ${state.currentProjectTab === 'export' ? 'active' : ''}`}>导出</button>
      </div>

      {state.currentProjectTab === 'overview' && (
        <StoryOverview />
      )}

      {state.currentProjectTab === 'storyboard' && (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-[300px] border-r border-[#3a3a3a] flex flex-col">
            <div className="p-3 border-b border-[#3a3a3a] space-y-2">
              <button onClick={handleAnalyzeAllImagePrompts} disabled={isProcessing || project.shots.length === 0} className="btn btn-primary text-sm w-full">🖼️ 一键出图片提示词</button>
              <button onClick={handleAnalyzeAllVideoPrompts} disabled={isProcessing || project.shots.length === 0} className="btn btn-primary text-sm w-full">🎬 一键出视频提示词</button>
              <button onClick={handleAddShot} className="btn btn-secondary text-sm w-full">+ 添加分镜</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {project.shots.length === 0 ? (
                <div className="text-center text-[#666666] py-8 text-sm">请先在"改文"中保存内容<br />系统将自动生成多个分镜</div>
              ) : (
                project.shots.map((shot) => (
                  <div key={shot.id} onClick={() => handleSelectShot(shot.id)} className={`p-3 rounded-lg cursor-pointer transition-all ${selectedShot?.id === shot.id ? 'bg-[#3b82f6]/20 border border-[#3b82f6]' : 'bg-[#252525] hover:bg-[#2a2a2a] border border-transparent'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[#3b82f6] font-medium text-sm">#{shot.index}</span>
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleAnalyzeSingleImagePrompt(shot); }} disabled={isProcessing || !shot.content} className="text-[#666666] hover:text-green-500 text-xs px-1" title="AI生成图片提示词">🖼️</button>
                        <button onClick={(e) => { e.stopPropagation(); handleAnalyzeSingleVideoPrompt(shot); }} disabled={isProcessing || !shot.content} className="text-[#666666] hover:text-blue-500 text-xs px-1" title="AI生成视频提示词">🎬</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteShot(shot.id); }} className="text-[#666666] hover:text-red-500 text-xs px-1">✕</button>
                      </div>
                    </div>
                    <p className="text-white text-sm line-clamp-2">{shot.content || '(空)'}</p>
                    <div className="flex gap-1 mt-1 text-xs">
                      {shot.imagePrompt && <span className="text-green-600">🖼️</span>}
                      {shot.videoPrompt && <span className="text-blue-600">🎬</span>}
                      {shot.imageFile && <span className="text-green-500">✓</span>}
                      {shot.videoFile && <span className="text-blue-500">✓</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-[#3a3a3a] flex gap-2">
              <button onClick={handleBatchGenerateImages} disabled={isProcessing || project.shots.filter(s => s.imagePrompt).length === 0} className="btn btn-secondary text-xs flex-1">批量生图</button>
              <button onClick={handleBatchGenerateVideos} disabled={isProcessing || project.shots.filter(s => s.videoPrompt).length === 0} className="btn btn-secondary text-xs flex-1">批量视频</button>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedShot ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div className="flex gap-4">
                  <div className="w-16 h-16 bg-[#252525] rounded-lg flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-[#3b82f6]">{selectedShot.index}</span>
                  </div>
                  <div className="flex-1">
                    <label className="label">分镜内容</label>
                    <textarea
                      className="input-field min-h-[100px]"
                      placeholder="分镜的画面描述..."
                      value={selectedShot.content}
                      onChange={(e) => handleShotContentChange(selectedShot.id, e.target.value)}
                    />
                  </div>
                </div>

                {/* 人物选择（缩略图多选） */}
                <div>
                  <label className="label">人物（可多选）</label>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {/* 无选项 */}
                    <button
                      onClick={() => {
                        const updatedShot = { ...selectedShot, characterIds: [] };
                        dispatch({ type: 'UPDATE_SHOT', payload: { projectId: project.id, shot: updatedShot } });
                      }}
                      className={`relative rounded overflow-hidden border-2 ${(selectedShot.characterIds || []).length === 0 ? 'border-red-500' : 'border-transparent'}`}
                    >
                      <div className="w-16 h-16 bg-[#1a1a1a] flex items-center justify-center border border-[#333]">
                        <span className="text-sm text-[#666666]">无</span>
                      </div>
                      <span className="absolute bottom-0 left-0 bg-black/60 text-white text-xs px-1 w-full text-center">无</span>
                      {(selectedShot.characterIds || []).length === 0 && <div className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>}
                    </button>
                    {(project.characters || []).map(char => {
                      const isSelected = (selectedShot.characterIds || []).includes(char.id);
                      const hasImage = char.referenceImage || char.imageFile;
                      return (
                        <button
                          key={char.id}
                          onClick={() => {
                            const ids = selectedShot.characterIds || [];
                            const newIds = isSelected ? ids.filter(id => id !== char.id) : [...ids, char.id];
                            const updatedShot = { ...selectedShot, characterIds: newIds };
                            dispatch({ type: 'UPDATE_SHOT', payload: { projectId: project.id, shot: updatedShot } });
                          }}
                          className={`relative rounded overflow-hidden border-2 ${isSelected ? 'border-blue-500' : 'border-transparent'}`}
                        >
                          {hasImage ? (
                            <img src={char.referenceImage || char.imageFile} alt={char.name} className="w-16 h-16 object-cover" />
                          ) : (
                            <div className="w-16 h-16 bg-[#252525] flex items-center justify-center">
                              <span className="text-xs text-[#666666]">{char.name}</span>
                            </div>
                          )}
                          <span className="absolute bottom-0 left-0 bg-black/60 text-white text-xs px-1 w-full text-center truncate">{char.name}</span>
                          {isSelected && <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 场景选择（缩略图多选） */}
                <div>
                  <label className="label">场景（可多选）</label>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {/* 无选项 */}
                    <button
                      onClick={() => {
                        const updatedShot = { ...selectedShot, sceneIds: [] };
                        dispatch({ type: 'UPDATE_SHOT', payload: { projectId: project.id, shot: updatedShot } });
                      }}
                      className={`relative rounded overflow-hidden border-2 ${(selectedShot.sceneIds || []).length === 0 ? 'border-red-500' : 'border-transparent'}`}
                    >
                      <div className="w-16 h-16 bg-[#1a1a1a] flex items-center justify-center border border-[#333]">
                        <span className="text-sm text-[#666666]">无</span>
                      </div>
                      <span className="absolute bottom-0 left-0 bg-black/60 text-white text-xs px-1 w-full text-center">无</span>
                      {(selectedShot.sceneIds || []).length === 0 && <div className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>}
                    </button>
                    {(project.scenes || []).map(scene => {
                      const isSelected = (selectedShot.sceneIds || []).includes(scene.id);
                      const hasImage = scene.referenceImage || scene.imageFile;
                      return (
                        <button
                          key={scene.id}
                          onClick={() => {
                            const ids = selectedShot.sceneIds || [];
                            const newIds = isSelected ? ids.filter(id => id !== scene.id) : [...ids, scene.id];
                            const updatedShot = { ...selectedShot, sceneIds: newIds };
                            dispatch({ type: 'UPDATE_SHOT', payload: { projectId: project.id, shot: updatedShot } });
                          }}
                          className={`relative rounded overflow-hidden border-2 ${isSelected ? 'border-green-500' : 'border-transparent'}`}
                        >
                          {hasImage ? (
                            <img src={scene.referenceImage || scene.imageFile} alt={scene.name} className="w-16 h-16 object-cover" />
                          ) : (
                            <div className="w-16 h-16 bg-[#252525] flex items-center justify-center">
                              <span className="text-xs text-[#666666]">{scene.name}</span>
                            </div>
                          )}
                          <span className="absolute bottom-0 left-0 bg-black/60 text-white text-xs px-1 w-full text-center truncate">{scene.name}</span>
                          {isSelected && <div className="absolute top-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 物品选择（缩略图多选） */}
                <div>
                  <label className="label">物品（可多选）</label>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {/* 无选项 */}
                    <button
                      onClick={() => {
                        const updatedShot = { ...selectedShot, itemIds: [] };
                        dispatch({ type: 'UPDATE_SHOT', payload: { projectId: project.id, shot: updatedShot } });
                      }}
                      className={`relative rounded overflow-hidden border-2 ${(selectedShot.itemIds || []).length === 0 ? 'border-red-500' : 'border-transparent'}`}
                    >
                      <div className="w-16 h-16 bg-[#1a1a1a] flex items-center justify-center border border-[#333]">
                        <span className="text-sm text-[#666666]">无</span>
                      </div>
                      <span className="absolute bottom-0 left-0 bg-black/60 text-white text-xs px-1 w-full text-center">无</span>
                      {(selectedShot.itemIds || []).length === 0 && <div className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>}
                    </button>
                    {(project.items || []).map(item => {
                      const isSelected = (selectedShot.itemIds || []).includes(item.id);
                      const hasImage = item.referenceImage || item.imageFile;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            const ids = selectedShot.itemIds || [];
                            const newIds = isSelected ? ids.filter(id => id !== item.id) : [...ids, item.id];
                            const updatedShot = { ...selectedShot, itemIds: newIds };
                            dispatch({ type: 'UPDATE_SHOT', payload: { projectId: project.id, shot: updatedShot } });
                          }}
                          className={`relative rounded overflow-hidden border-2 ${isSelected ? 'border-purple-500' : 'border-transparent'}`}
                        >
                          {hasImage ? (
                            <img src={item.referenceImage || item.imageFile} alt={item.name} className="w-16 h-16 object-cover" />
                          ) : (
                            <div className="w-16 h-16 bg-[#252525] flex items-center justify-center">
                              <span className="text-xs text-[#666666]">{item.name}</span>
                            </div>
                          )}
                          <span className="absolute bottom-0 left-0 bg-black/60 text-white text-xs px-1 w-full text-center truncate">{item.name}</span>
                          {isSelected && <div className="absolute top-1 right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={handleMergeUp} disabled={selectedShot.index <= 1} className="btn btn-secondary text-sm">↑ 合并上一个</button>
                  <button onClick={handleMergeDown} disabled={selectedShot.index >= project.shots.length} className="btn btn-secondary text-sm">↓ 合并下一个</button>
                  <button onClick={handleSplitUp} disabled={selectedShot.index <= 1} className="btn btn-secondary text-sm">↑ 拆分上一个</button>
                  <button onClick={handleSplitDown} className="btn btn-secondary text-sm">↓ 拆分当前</button>
                </div>

                <div className="panel">
                  <p className="text-sm text-[#a0a0a0] mb-2">上下文预览（概要 + 前后10个分镜）</p>
                  <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
                    <div className="text-[#3b82f6] border-l-2 border-[#3b82f6] pl-2 mb-2 font-medium">【概要】{project.synopsis || '(未填写)'}</div>
                    {contextPreview.before.length > 0 && (
                      <div className="text-[#666666] space-y-1">
                        {contextPreview.before.map((line, i) => <div key={i}>{line}</div>)}
                      </div>
                    )}
                    <div className="text-[#3b82f6] border-l-2 border-[#3b82f6] pl-2 my-1 bg-[#3b82f6]/10 rounded-r">{selectedShot.content}</div>
                    {contextPreview.after.length > 0 && (
                      <div className="text-[#666666] space-y-1">
                        {contextPreview.after.map((line, i) => <div key={i}>{line}</div>)}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="label mb-0">出图提示词</label>
                    <button onClick={() => handleAnalyzeSingleImagePrompt(selectedShot)} disabled={isProcessing || !selectedShot.content} className="btn btn-secondary text-sm">🖼️ AI生成</button>
                  </div>
                  <textarea
                    className="input-field min-h-[80px]"
                    placeholder="图片生成提示词..."
                    value={selectedShot.imagePrompt}
                    onChange={(e) => handleShotPromptChange('imagePrompt', e.target.value)}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={handleGenerateImage} disabled={isProcessing || !selectedShot.imagePrompt || (getShotGenStatus(selectedShot.id)?.status === 'processing' || getShotGenStatus(selectedShot.id)?.status === 'queued')} className="btn btn-primary text-sm bg-green-600 hover:bg-green-700">
                      {getShotGenStatus(selectedShot.id)?.status === 'processing' ? '⏳ 生成中...' :
                       getShotGenStatus(selectedShot.id)?.status === 'queued' ? '⏳ 排队中...' :
                       getShotGenStatus(selectedShot.id)?.status === 'timeout' ? '⏱️ 超时' :
                       '🎨 生图'}
                    </button>
                    {getShotGenStatus(selectedShot.id)?.status && (getShotGenStatus(selectedShot.id)?.status === 'processing' || getShotGenStatus(selectedShot.id)?.status === 'queued') && (
                      <button onClick={handleCancelImageGen} className="btn btn-secondary text-sm bg-red-600 hover:bg-red-700">
                        ❌ 取消
                      </button>
                    )}
                  </div>
                  {imageGenMessage && selectedShot && (
                    <span className={`text-xs mt-1 ${getShotGenStatus(selectedShot.id)?.status === 'failed' ? 'text-red-500' : 'text-yellow-500'}`}>
                      {imageGenMessage}
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="label mb-0">视频提示词</label>
                    <button onClick={() => handleAnalyzeSingleVideoPrompt(selectedShot)} disabled={isProcessing || !selectedShot.content} className="btn btn-secondary text-sm">🎬 AI生成</button>
                  </div>
                  <textarea
                    className="input-field min-h-[80px]"
                    placeholder="视频生成提示词..."
                    value={selectedShot.videoPrompt}
                    onChange={(e) => handleShotPromptChange('videoPrompt', e.target.value)}
                  />
                  <button onClick={handleGenerateVideo} disabled={isProcessing || !selectedShot.videoPrompt} className="btn btn-primary text-sm mt-2 bg-blue-600 hover:bg-blue-700">🎬 生成视频</button>
                </div>

                <div className="flex gap-4">
                  {selectedShot.imageFile && (
                    <div className="panel flex-1">
                      <p className="text-sm text-[#a0a0a0] mb-1">🖼️ 已生成图片</p>
                      {selectedShot.imageFile.startsWith('data:') ? (
                        <img src={selectedShot.imageFile} alt="Generated" className="max-w-full max-h-32 rounded" />
                      ) : (
                        <p className="text-white text-sm truncate">{selectedShot.imageFile}</p>
                      )}
                    </div>
                  )}
                  {selectedShot.videoFile && (
                    <div className="panel flex-1">
                      <p className="text-sm text-[#a0a0a0] mb-1">🎬 已生成视频</p>
                      <p className="text-white text-sm truncate">{selectedShot.videoFile.includes('http') ? '已完成' : selectedShot.videoFile}</p>
                    </div>
                  )}
                  {selectedShot.videoTaskId && !selectedShot.videoFile?.includes('http') && (
                    <div className="panel flex-1">
                      <p className="text-sm text-[#a0a0a0] mb-1">⏳ 等待查询</p>
                      <button onClick={handlePollVideoStatus} className="text-[#3b82f6] text-sm hover:underline">刷新状态</button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[#666666]">选择一个分镜查看详情</div>
            )}
          </div>
        </div>
      )}

      {state.currentProjectTab === 'rewritten' && (
        <div className="flex-1 flex flex-col overflow-hidden p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">改文内容（每批最多5000汉字，自动分批次改写）</h3>
            <div className="flex gap-2">
              <button onClick={handleRewriteTextInBatches} disabled={isProcessing} className="btn btn-secondary">{isProcessing ? '改写中...' : 'AI改文'}</button>
              <button onClick={handleSaveRewritten} className="btn btn-primary" disabled={!rewrittenText.trim()}>保存并生成全部分镜</button>
            </div>
          </div>
          <textarea
            className="input-field flex-1"
            placeholder={"在此输入或粘贴改文内容...\n格式：改编文本内容（每行一段）\n&&\n人物名称（逗号分隔，可留空）\n&&\n场景名称（逗号分隔，可留空）\n&&\n物品名称（逗号分隔，可留空）"}
            value={rewrittenText}
            onChange={(e) => setRewrittenText(e.target.value)}
          />
        </div>
      )}

      {state.currentProjectTab === 'voice' && (
        <div className="flex-1 overflow-y-auto p-6">
          {/* 人物音色管理 */}
          <div className="panel mb-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-md font-medium">🎭 人物音色</h4>
              <button
                onClick={() => {
                  const newTimbre: CharacterTimbre = {
                    id: generateId(),
                    name: `音色 ${(project.voiceTimbres?.length || 0) + 1}`,
                    description: '',
                  };
                  dispatch({
                    type: 'UPDATE_PROJECT',
                    payload: { ...project, voiceTimbres: [...(project.voiceTimbres || []), newTimbre] }
                  });
                }}
                className="btn btn-secondary text-sm"
              >
                + 添加音色
              </button>
            </div>
            <div className="space-y-2">
              {(project.voiceTimbres || []).map((timbre) => (
                <div key={timbre.id} className="flex items-center gap-3 bg-[#252525] px-3 py-2 rounded">
                  {/* 音色名称 */}
                  <input
                    type="text"
                    className="input-field text-sm w-28 bg-transparent border-0"
                    placeholder="音色名称"
                    value={timbre.name}
                    onChange={(e) => {
                      const updated = project.voiceTimbres.map(t =>
                        t.id === timbre.id ? { ...t, name: e.target.value } : t
                      );
                      dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, voiceTimbres: updated } });
                    }}
                  />
                  {/* 匹配角色 */}
                  <select
                    className="input-field text-xs py-1 bg-[#1a1a1a] border-[#3a3a3a]"
                    value={timbre.characterId || ''}
                    onChange={(e) => {
                      const updated = project.voiceTimbres.map(t =>
                        t.id === timbre.id ? { ...t, characterId: e.target.value || undefined } : t
                      );
                      dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, voiceTimbres: updated } });
                    }}
                  >
                    <option value="">不关联角色</option>
                    {project.characters.map(char => (
                      <option key={char.id} value={char.id}>{char.name}</option>
                    ))}
                  </select>
                  {/* 参考音频上传 */}
                  <input
                    type="file"
                    accept="audio/*"
                    className="text-xs text-[#a0a0a0] file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-[#3a3a3a] file:text-white"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const updated = project.voiceTimbres.map(t =>
                            t.id === timbre.id ? { ...t, referenceAudio: ev.target?.result as string } : t
                          );
                          dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, voiceTimbres: updated } });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {timbre.referenceAudio && (
                    <audio controls className="h-6 w-24">
                      <source src={timbre.referenceAudio} />
                    </audio>
                  )}
                  {/* 删除 */}
                  <button
                    onClick={() => {
                      const updated = project.voiceTimbres.filter(t => t.id !== timbre.id);
                      dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, voiceTimbres: updated } });
                    }}
                    className="text-red-500 hover:text-red-400 text-xs ml-auto"
                  >
                    ✕ 删除
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 配音操作区 */}
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-medium">配音管理</h3>
              <p className="text-xs text-[#666666] mt-1">
                生成配音并导出SRT字幕文件（用于视频时长同步）
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={async () => {
                  // 一键配音：自动从分镜生成配音，自动拆分「」对话
                  if (project.shots.length === 0) {
                    showToast('暂无分镜，请先生成或导入分镜', 'error');
                    return;
                  }

                  // 生成配音列表，自动拆分「」对话
                  const newVoices: Voice[] = [];
                  for (const shot of project.shots) {
                    const script = shot.content;
                    // 检查是否包含「」对话
                    const hasDialogue = script.includes('「') && script.includes('」');

                    if (hasDialogue) {
                      // 拆分：旁白部分 + 对话部分
                      // 使用正则拆分：非「」内容 为旁白，「」内内容 为对话
                      const parts: { type: 'narration' | 'dialogue'; content: string }[] = [];
                      let current = '';
                      let inDialogue = false;
                      let i = 0;

                      while (i < script.length) {
                        if (script[i] === '「') {
                          if (current.trim()) {
                            parts.push({ type: 'narration', content: current.trim() });
                            current = '';
                          }
                          inDialogue = true;
                          i++;
                        } else if (script[i] === '」') {
                          current += script[i];
                          if (current.trim()) {
                            parts.push({ type: 'dialogue', content: current.trim() });
                            current = '';
                          }
                          inDialogue = false;
                          i++;
                        } else {
                          current += script[i];
                          i++;
                        }
                      }
                      if (current.trim()) {
                        parts.push({ type: inDialogue ? 'dialogue' : 'narration', content: current.trim() });
                      }

                      // 为每个部分创建配音
                      let subIndex = 0;
                      for (const part of parts) {
                        if (!part.content) continue;
                        newVoices.push({
                          id: generateId(),
                          shotId: shot.id,
                          name: `分镜 ${shot.index}${part.type === 'dialogue' ? '-对话' + subIndex : ''}`,
                          script: part.content.replace(/「|」/g, ''), // 移除引号
                          emotion: '无',
                          timbre: part.type === 'narration' ? '无' : '无', // 旁白用旁白音色，对话需要单独选择音色
                          status: 'idle' as const,
                          createdAt: new Date().toISOString(),
                        });
                        if (part.type === 'dialogue') subIndex++;
                      }
                    } else {
                      // 没有对话，整体作为旁白
                      newVoices.push({
                        id: generateId(),
                        shotId: shot.id,
                        name: `分镜 ${shot.index} 旁白`,
                        script: script,
                        emotion: '无',
                        timbre: '无',
                        status: 'idle' as const,
                        createdAt: new Date().toISOString(),
                      });
                    }
                  }

                  const updatedProject = {
                    ...project,
                    voiceDubbings: [...(project.voiceDubbings || []), ...newVoices],
                  };
                  dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
                  showToast(`已生成 ${newVoices.length} 条配音，已自动拆分对话`, 'success');
                }}
                className="btn btn-secondary"
              >
                📖 从分镜生成配音
              </button>
              <button
                onClick={async () => {
                  // 一键分析情绪
                  const voices = project.voiceDubbings || [];
                  if (voices.length === 0) {
                    showToast('暂无配音，请先生成配音列表', 'error');
                    return;
                  }

                  const preset = state.config.modelPresets.find(p => p.apiKey);
                  if (!preset) {
                    showToast('请先配置模型预设', 'error');
                    return;
                  }

                  setIsProcessing(true);
                  try {
                    const scriptList = voices.map((v, i) => `${i + 1}. ${v.script}`).join('\n');
                    const emotionPrompt = `你是一个配音分析师。请分析以下配音文本，返回每段文本的说话人物和情绪。

分析规则：
- 判断文本是旁白还是角色对话
- 如果是旁白（描述性文字、内心独白等），speaker 填"旁白"
- 如果是角色对话（有具体人物说话），speaker 填人物名称
- 情绪从以下选择：无、喜悦、悲伤、愤怒、恐惧、惊讶、平静、激动

返回格式：JSON数组
- speaker: 说话人物（旁白或具体人物名）
- emotion: 情绪

配音文本：
${scriptList}

请直接返回JSON数组，格式：
[{"speaker":"旁白","emotion":"无"},{"speaker":"钟奚晨","emotion":"喜悦"},{"speaker":"旁白","emotion":"悲伤"}]`;

                    const result = await callChatAPI(emotionPrompt, preset);
                    // 尝试解析JSON
                    let emotions;
                    try {
                      const jsonMatch = result.match(/\[[\s\S]*\]/);
                      if (jsonMatch) {
                        emotions = JSON.parse(jsonMatch[0]);
                      }
                    } catch (e) {
                      console.error('解析情感失败', e);
                    }

                    if (emotions && Array.isArray(emotions)) {
                      const updatedVoices = voices.map((v, i) => ({
                        ...v,
                        emotion: emotions[i]?.emotion || '无',
                        // 如果是旁白音色填"无"，否则填说话人物名（后续可从音色列表匹配）
                        timbre: emotions[i]?.speaker === '旁白' ? '无' : (emotions[i]?.speaker || '无'),
                      }));
                      dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, voiceDubbings: updatedVoices } });
                      showToast('情绪分析完成', 'success');
                    } else {
                      showToast('情感分析失败，请重试', 'error');
                    }
                  } catch (e: any) {
                    showToast(e.message || '分析失败', 'error');
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                className="btn btn-secondary"
              >
                😊 一键分析情绪
              </button>
              <button
                onClick={async () => {
                  // 一键生成所有配音
                  const voices = project.voiceDubbings || [];
                  if (voices.length === 0) {
                    showToast('暂无配音，请先生成配音列表', 'error');
                    return;
                  }

                  const comfyuiUrl = state.config.basic.comfyuiVoiceUrl;
                  if (!comfyuiUrl) {
                    showToast('请在设置中配置 ComfyUI 配音地址', 'error');
                    return;
                  }

                  // 获取参考音频
                  const timbre = project.voiceTimbres?.[0];
                  const narratorAudio = timbre?.referenceAudio?.split('/').pop() || '';

                  // 更新所有配音状态为生成中
                  const generatingVoices = voices.map(v => ({ ...v, status: 'generating' as Voice['status'] }));
                  dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, voiceDubbings: generatingVoices } });

                  // 逐个生成配音
                  for (let i = 0; i < voices.length; i++) {
                    const voice = voices[i];
                    try {
                      // 构建结构化文本（IndexTTS2 Pro 格式）
                      const isDialogue = voice.script.includes('「') && voice.script.includes('」');
                      let structuredText = voice.script;
                      if (isDialogue) {
                        // 转换「」格式为 <Character1> 格式
                        structuredText = voice.script
                          .replace(/「/g, '<Character1>')
                          .replace(/」/g, '</Character1>');
                      } else {
                        structuredText = `<Narrator>${voice.script}</Narrator>`;
                      }

                      const result = await callComfyUITTS(
                        structuredText,
                        narratorAudio,
                        narratorAudio,
                        voice.emotion || '无'
                      );

                      const newVoices = generatingVoices.map((v, idx) =>
                        idx === i ? { ...v, status: 'completed' as Voice['status'], duration: result.duration || 5, audioUrl: result.audioUrl } : v
                      );
                      dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, voiceDubbings: newVoices } });
                    } catch (e: any) {
                      const errorMsg = e?.message || String(e) || '未知错误';
                      console.error('[TTS] 错误:', errorMsg);
                      const newVoices = generatingVoices.map((v, idx) =>
                        idx === i ? { ...v, status: 'failed' as Voice['status'], error: errorMsg } : v
                      );
                      dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, voiceDubbings: newVoices } });
                    }
                  }

                  showToast('配音生成完成', 'success');
                }}
                className="btn btn-primary"
                disabled={!state.config.basic.comfyuiVoiceUrl}
              >
                🎙️ 一键生成全部配音
              </button>
              <button
                onClick={() => {
                  // 导出SRT
                  const voices = project.voiceDubbings || [];
                  if (voices.length === 0) {
                    showToast('暂无配音', 'error');
                    return;
                  }

                  // 生成SRT内容
                  let srtContent = '';
                  let index = 1;
                  let currentTime = 0;

                  for (const voice of voices) {
                    if (!voice.script) continue;
                    const duration = voice.duration || 3;
                    const startTime = formatSrtTime(currentTime);
                    const endTime = formatSrtTime(currentTime + duration);
                    srtContent += `${index}\n`;
                    srtContent += `${startTime} --> ${endTime}\n`;
                    srtContent += `${voice.script}\n\n`;
                    index++;
                    currentTime += duration;
                  }

                  // 下载SRT文件
                  const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${project.name}_配音.srt`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast('SRT字幕已导出', 'success');
                }}
                className="btn btn-secondary"
              >
                📥 导出SRT字幕
              </button>
            </div>
          </div>

          {/* 配音列表 */}
          {project.voiceDubbings && project.voiceDubbings.length > 0 ? (
            <div className="space-y-3">
              {project.voiceDubbings.map((voice) => {
                const shot = project.shots.find(s => s.id === voice.shotId);
                const timbreOptions = project.voiceTimbres || [{ id: 'default', name: '无' }];
                return (
                  <div key={voice.id} className="panel">
                    <div className="flex items-start gap-3">
                      {/* 序号 */}
                      <div className="w-10 h-10 bg-[#252525] rounded flex items-center justify-center text-lg font-bold flex-shrink-0">
                        {shot ? shot.index : '?'}
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                          <input
                            type="text"
                            className="input-field text-sm font-medium flex-1 min-w-[150px]"
                            value={voice.name}
                            onChange={(e) => {
                              const updated = project.voiceDubbings.map(v =>
                                v.id === voice.id ? { ...v, name: e.target.value } : v
                              );
                              dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, voiceDubbings: updated } });
                            }}
                          />
                          <span className={`text-xs px-2 py-1 rounded ${
                            voice.status === 'completed' ? 'bg-green-600/20 text-green-400' :
                            voice.status === 'generating' ? 'bg-yellow-600/20 text-yellow-400' :
                            voice.status === 'failed' ? 'bg-red-600/20 text-red-400' :
                            'bg-gray-600/20 text-gray-400'
                          }`}>
                            {voice.status === 'idle' ? '待生成' :
                             voice.status === 'generating' ? '生成中...' :
                             voice.status === 'completed' ? '✅ 完成' :
                             voice.status === 'failed' ? '❌ 失败' : voice.status}
                          </span>
                        </div>
                        <textarea
                          className="input-field text-sm min-h-[50px] mb-2"
                          placeholder="配音文案..."
                          value={voice.script}
                          onChange={(e) => {
                            const updated = project.voiceDubbings.map(v =>
                              v.id === voice.id ? { ...v, script: e.target.value } : v
                            );
                            dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, voiceDubbings: updated } });
                          }}
                        />
                        {/* 情绪和音色选择 */}
                        <div className="flex gap-2 flex-wrap">
                          <select
                            className="input-field text-xs py-1"
                            value={voice.emotion || '无'}
                            onChange={(e) => {
                              const updated = project.voiceDubbings.map(v =>
                                v.id === voice.id ? { ...v, emotion: e.target.value } : v
                              );
                              dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, voiceDubbings: updated } });
                            }}
                          >
                            <option value="">选择情绪</option>
                            <option value="无">无</option>
                            <option value="喜悦">喜悦</option>
                            <option value="悲伤">悲伤</option>
                            <option value="愤怒">愤怒</option>
                            <option value="恐惧">恐惧</option>
                            <option value="惊讶">惊讶</option>
                            <option value="平静">平静</option>
                            <option value="激动">激动</option>
                          </select>
                          <select
                            className="input-field text-xs py-1"
                            value={voice.timbre || '无'}
                            onChange={(e) => {
                              const updated = project.voiceDubbings.map(v =>
                                v.id === voice.id ? { ...v, timbre: e.target.value } : v
                              );
                              dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, voiceDubbings: updated } });
                            }}
                          >
                            <option value="">选择音色</option>
                            <option value="无">无（默认）</option>
                            {timbreOptions.map(t => (
                              <option key={t.id} value={t.name}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={async () => {
                            // 单独生成此配音
                            if (!voice.script) {
                              showToast('请先输入配音文案', 'error');
                              return;
                            }
                            const comfyuiUrl = state.config.basic.comfyuiVoiceUrl;
                            if (!comfyuiUrl) {
                              showToast('请在设置中配置 ComfyUI 配音地址', 'error');
                              return;
                            }

                            // 更新状态
                            const updatedVoices = project.voiceDubbings.map(v =>
                              v.id === voice.id ? { ...v, status: 'generating' as Voice['status'] } : v
                            );
                            dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, voiceDubbings: updatedVoices } });

                            try {
                              // 查找音色对应的参考音频
                              const timbre = project.voiceTimbres?.find(t => t.name === voice.timbre);
                              const audioFileName = timbre?.referenceAudio?.split('/').pop() || '';

                              // 构建结构化文本（IndexTTS2 Pro 格式）
                              const isDialogue = voice.script.includes('「') && voice.script.includes('」');
                              let structuredText = voice.script;
                              if (isDialogue) {
                                structuredText = voice.script
                                  .replace(/「/g, '<Character1>')
                                  .replace(/」/g, '</Character1>');
                              } else {
                                structuredText = `<Narrator>${voice.script}</Narrator>`;
                              }

                              // 调用 ComfyUI IndexTTS2
                              const result = await callComfyUITTS(
                                structuredText,
                                audioFileName,
                                audioFileName,
                                voice.emotion || '无'
                              );

                              // 更新状态为完成
                              const finalVoices = project.voiceDubbings.map(v =>
                                v.id === voice.id ? { ...v, status: 'completed' as Voice['status'], duration: result.duration || 5, audioUrl: result.audioUrl } : v
                              );
                              dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, voiceDubbings: finalVoices } });
                              showToast('配音生成完成', 'success');
                            } catch (e: any) {
                              const errorMsg = e?.message || String(e) || '未知错误';
                              console.error('[TTS] 错误:', errorMsg);
                              const failedVoices = project.voiceDubbings.map(v =>
                                v.id === voice.id ? { ...v, status: 'failed' as Voice['status'], error: errorMsg } : v
                              );
                              dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, voiceDubbings: failedVoices } });
                              showToast('生成失败: ' + errorMsg.substring(0, 100), 'error');
                            }
                          }}
                          className="btn btn-secondary text-xs px-2 py-1"
                          title="生成配音"
                        >
                          🎙️
                        </button>
                        <button
                          onClick={() => {
                            if (voice.script) {
                              navigator.clipboard.writeText(voice.script);
                              showToast('已复制', 'success');
                            }
                          }}
                          className="btn btn-secondary text-xs px-2 py-1"
                          title="复制文案"
                        >
                          📋
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('确定删除此配音？')) {
                              const updated = project.voiceDubbings.filter(v => v.id !== voice.id);
                              dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, voiceDubbings: updated } });
                            }
                          }}
                          className="text-red-500 hover:text-red-400 text-xs px-2 py-1"
                          title="删除"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-[#666666] py-16 border-2 border-dashed border-[#3a3a3a] rounded-lg">
              <p className="text-4xl mb-4">🎙️</p>
              <p>暂无配音</p>
              <p className="text-sm mt-2">点击上方"从分镜生成配音"按钮</p>
            </div>
          )}
        </div>
      )}

      {state.currentProjectTab === 'images' && (
        <div className="flex-1 overflow-y-auto p-6">
          {project.shots.filter(s => s.imageFile).length === 0 ? (
            <div className="text-center text-[#666666] py-16">
              <p className="text-4xl mb-4">🖼️</p>
              <p>暂无生成的图片</p>
              <p className="text-sm mt-2">在分镜中选择分镜后点击"生图"</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {project.shots.filter(s => s.imageFile).map((shot) => (
                <div key={shot.id} className="panel">
                  <div className="aspect-square bg-[#1a1a1a] rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                    {shot.imageFile?.startsWith('data:') ? (
                      <img src={shot.imageFile} alt={`分镜 ${shot.index}`} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <span className="text-4xl">🖼️</span>
                    )}
                  </div>
                  <p className="text-sm text-white">分镜 {shot.index}</p>
                  <p className="text-xs text-[#666666] truncate">{shot.imageFile}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {state.currentProjectTab === 'videos' && (
        <div className="flex-1 overflow-y-auto p-6">
          {project.shots.filter(s => s.videoFile).length === 0 ? (
            <div className="text-center text-[#666666] py-16">
              <p className="text-4xl mb-4">🎬</p>
              <p>暂无生成的视频</p>
              <p className="text-sm mt-2">在分镜中选择分镜后点击"生成视频"</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {project.shots.filter(s => s.videoFile).map((shot) => (
                <div key={shot.id} className="panel">
                  <div className="aspect-video bg-[#1a1a1a] rounded-lg mb-3 flex items-center justify-center">
                    <span className="text-4xl">🎬</span>
                  </div>
                  <p className="text-sm text-white">分镜 {shot.index}</p>
                  <p className="text-xs text-[#666666] truncate">{shot.videoFile}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {state.currentProjectTab === 'export' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="panel mb-6">
            <h3 className="text-lg font-medium mb-4">📁 导出到剪映</h3>
            <p className="text-sm text-[#a0a0a0] mb-4">
              将分镜的图片、视频、配音、SRT字幕导出到剪映草稿箱
            </p>
            <button
              onClick={() => showToast('请先在设置中配置导出目录', 'error')}
              className="btn btn-primary"
            >
              🎬 导出到剪映草稿箱
            </button>
          </div>

          <div className="panel">
            <h3 className="text-lg font-medium mb-4">📊 导出分镜表</h3>
            <p className="text-sm text-[#a0a0a0] mb-4">
              导出为CSV格式，可用Excel打开
            </p>
            <button
              onClick={() => {
                const headers = ['镜号', '解说文案', '首帧图片提示词', '视频提示词', '人物', '场景'];
                const rows = project.shots.map(shot => [
                  shot.index,
                  shot.content,
                  shot.imagePrompt,
                  shot.videoPrompt,
                  (project.characters || []).filter(c => (shot.characterIds || []).includes(c.id)).map(c => c.name).join(', '),
                  (project.scenes || []).filter(s => (shot.sceneIds || []).includes(s.id)).map(s => s.name).join(', '),
                ]);
                const csvContent = [headers, ...rows].map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
                const BOM = '\uFEFF';
                const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${project.name}_分镜表.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                showToast('导出成功', 'success');
              }}
              className="btn btn-primary"
            >
              📥 导出CSV
            </button>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#252525] px-6 py-4 rounded-lg flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
            <span>处理中...</span>
          </div>
        </div>
      )}
    </div>
  );
}
