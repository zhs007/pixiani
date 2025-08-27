import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import {
    AnimationManager,
    BaseObject,
    ScaleAnimation,
    FadeAnimation,
    ComplexPopAnimation,
    FlagWaveAnimation,
    VortexAnimation,
    AnimateClass,
} from 'pixi-animation-library';
import { v4 as uuidv4 } from 'uuid';

import { ChatPanel } from './ChatPanel';
import { PreviewPanel } from './PreviewPanel';
import { AssetSelectionModal } from './AssetSelectionModal';

// --- Constants & Initial Setup ---
const standardAnimations: AnimateClass[] = [ScaleAnimation, FadeAnimation, ComplexPopAnimation, FlagWaveAnimation, VortexAnimation];

// --- Main App Component ---
export const App = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ type: 'user' | 'gemini'; text: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const [animationManager] = useState(() => new AnimationManager());
  const [availableAnimations, setAvailableAnimations] = useState<AnimateClass[]>(standardAnimations);
  const [selectedAnimationName, setSelectedAnimationName] = useState<string>(standardAnimations[0].animationName);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);
  const hasLoadedCustomOnceRef = React.useRef(false);
  const lastCustomNamesRef = React.useRef<Set<string>>(new Set());

  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const currentObjectRef = useRef<BaseObject | null>(null);

  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [requiredSpriteCount, setRequiredSpriteCount] = useState(0);
  const [loop, setLoop] = useState(true);
  const [speed, setSpeed] = useState(1.0);

  // --- Session Management ---
  useEffect(() => {
    let sid = localStorage.getItem('sessionId');
    if (!sid) {
      sid = uuidv4();
      localStorage.setItem('sessionId', sid);
    }
    setSessionId(sid);
  }, []);

  // Restore chat messages for this session from localStorage
  useEffect(() => {
    if (!sessionId) return;
    try {
      const saved = localStorage.getItem(`chat:${sessionId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch (e) {
      console.warn('Failed to restore chat history:', e);
    }
  }, [sessionId]);

  // Persist chat messages for this session
  useEffect(() => {
    if (!sessionId) return;
    try {
      localStorage.setItem(`chat:${sessionId}`, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to persist chat history:', e);
    }
  }, [messages, sessionId]);

  // --- Animation Loading ---
  const loadCustomAnimations = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/animations/${sessionId}`);
      const list: { name: string; fsPath: string }[] = await res.json();

      const customAnimModules = await Promise.all(
        list.map(item => import(/* @vite-ignore */ `/@fs/${item.fsPath}`))
      );

      const customAnimClasses = customAnimModules
        .map(mod => mod[Object.keys(mod)[0]] as AnimateClass)
        .filter(Boolean);

      const allAnims = [...standardAnimations, ...customAnimClasses];
      allAnims.forEach(anim => animationManager.register(anim));
      setAvailableAnimations(allAnims);

      // Detect newly added custom animations to show a toast
      const currentNames = new Set(list.map(i => i.name));
      if (hasLoadedCustomOnceRef.current) {
        let newCount = 0;
        currentNames.forEach(n => { if (!lastCustomNamesRef.current.has(n)) newCount++; });
        if (newCount > 0) {
          setToast(`已加载 ${newCount} 个新动画`);
          if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
          toastTimerRef.current = window.setTimeout(() => setToast(null), 2500);
        }
      }
      lastCustomNamesRef.current = currentNames;
      hasLoadedCustomOnceRef.current = true;

    } catch (error) {
      console.error("Failed to load custom animations:", error);
    }
  }, [sessionId, animationManager]);

  useEffect(() => {
    loadCustomAnimations();
  }, [loadCustomAnimations]);

  // Restore selected animation for this session
  useEffect(() => {
    if (!sessionId) return;
    const key = `selectedAnim:${sessionId}`;
    const saved = localStorage.getItem(key);
    if (saved) setSelectedAnimationName(saved);
  }, [sessionId]);

  // Persist selected animation for this session
  useEffect(() => {
    if (!sessionId) return;
    const key = `selectedAnim:${sessionId}`;
    try { localStorage.setItem(key, selectedAnimationName); } catch {}
  }, [selectedAnimationName, sessionId]);

  // --- Pixi.js Setup ---
  useEffect(() => {
    const container = pixiContainerRef.current;
    if (!container || pixiAppRef.current) return;

    const app = new PIXI.Application();

    (async () => {
      await app.init({
        resizeTo: container,
        backgroundColor: 0xffffff,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });
      container.appendChild(app.canvas);
      pixiAppRef.current = app;

      // Keep current animation centered when the renderer resizes
      app.renderer.on('resize', () => {
        if (currentObjectRef.current) {
          currentObjectRef.current.x = app.renderer.width / 2;
          currentObjectRef.current.y = app.renderer.height / 2;
        }
      });

      app.ticker.add(() => {
        animationManager.update(app.ticker.deltaMS / 1000);
      });
    })();

    return () => {
      try { app.destroy(true, true); } catch {}
      pixiAppRef.current = null;
    };
  }, [animationManager]);

  // --- Event Handlers ---
  const handleSendMessage = async () => {
    if (!inputText.trim() || isThinking) return;

    setIsThinking(true);
    const currentPrompt = inputText;
    setMessages(prev => [...prev, { type: 'user', text: currentPrompt }]);
    setInputText('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentPrompt, sessionId }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { type: 'gemini', text: data.response }]);
      await loadCustomAnimations();
    } catch (error) {
      console.error("Chat API error:", error);
      setMessages(prev => [...prev, { type: 'gemini', text: 'Sorry, an error occurred.' }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleNewTask = async () => {
    if (!sessionId) return;
    await fetch('/api/clear_session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    setMessages([]);
    try { localStorage.removeItem(`chat:${sessionId}`); } catch {}
    try { localStorage.removeItem(`selectedAnim:${sessionId}`); } catch {}
    setAvailableAnimations(standardAnimations);
    setSelectedAnimationName(standardAnimations[0].animationName);
    lastCustomNamesRef.current = new Set();
    hasLoadedCustomOnceRef.current = false;
  };

  const handleOpenPlayModal = () => {
    const animClass = availableAnimations.find(a => a.animationName === selectedAnimationName);
    if (!animClass) return;

    const spriteCount = animClass.getRequiredSpriteCount();
    if (spriteCount === 0) {
        console.log("Animation requires 0 sprites, nothing to display.");
        return;
    }
    setRequiredSpriteCount(spriteCount);
    setIsAssetModalOpen(true);
  };

  const handlePlayAnimation = async (spriteUrls: string[]) => {
    const app = pixiAppRef.current;
    if (!app || spriteUrls.length === 0) return;

    if (currentObjectRef.current) {
        currentObjectRef.current.destroy();
    }

    const animClass = availableAnimations.find(a => a.animationName === selectedAnimationName);
    if (!animClass) return;

    const textures = await Promise.all(spriteUrls.map(url => PIXI.Assets.load(url)));
    const sprites = textures.map(texture => new PIXI.Sprite(texture));

    const obj = new BaseObject();
    sprites.forEach(s => {
        s.anchor.set(0.5);
        obj.addChild(s);
    });
  // Position at the center of the canvas
  obj.x = app.renderer.width / 2;
  obj.y = app.renderer.height / 2;
  app.stage.addChild(obj);
    currentObjectRef.current = obj;

    const anim = animationManager.create(selectedAnimationName, obj, sprites);
    if (anim) {
      anim.loop = loop;
      anim.speed = speed;
      anim.play();
    }
    setIsAssetModalOpen(false);
  };

  const handleDownload = async () => {
    const isStandard = standardAnimations.some(a => a.animationName === selectedAnimationName);
    if (isStandard) {
        alert("Cannot download standard, built-in animations.");
        return;
    }
    try {
        const res = await fetch(`/api/animation-code/${sessionId}/${selectedAnimationName}`);
        if (!res.ok) throw new Error(`Failed to fetch code: ${res.statusText}`);
        const code = await res.text();

        const blob = new Blob([code], { type: 'text/typescript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedAnimationName}.ts`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Download failed:", error);
        alert("Failed to download animation file.");
    }
  };

  return (
    <div style={{display:'flex', height:'100vh', fontFamily:'sans-serif'}}>
      {toast && (
        <div style={{
          position:'fixed', right:16, top:16, background:'#333', color:'#fff', padding:'10px 14px', borderRadius:6,
          boxShadow:'0 2px 8px rgba(0,0,0,0.2)', zIndex:1000
        }}>{toast}</div>
      )}
      <ChatPanel
        messages={messages}
        inputText={inputText}
        isThinking={isThinking}
        onInputChange={setInputText}
        onSendMessage={handleSendMessage}
        onNewTask={handleNewTask}
      />
      <PreviewPanel
        pixiContainerRef={pixiContainerRef}
        animations={availableAnimations}
        selectedAnimation={selectedAnimationName}
        onAnimationChange={setSelectedAnimationName}
        onPlay={handleOpenPlayModal}
        onDownload={handleDownload}
        loop={loop}
        onLoopChange={setLoop}
        speed={speed}
        onSpeedChange={setSpeed}
      />
      <AssetSelectionModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        onSelect={handlePlayAnimation}
        requiredCount={requiredSpriteCount}
      />
    </div>
  );
};
