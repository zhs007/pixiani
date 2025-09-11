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
  BlackHoleSpiralAnimation,
  ParticleSpinAnimation,
  CoinV2Animation,
  AnimateClass,
  StairBounceAnimation,
  ArcBounce3sAnimation,
  ScaleRotateScale,
} from 'pixi-animation-library';
import { v4 as uuidv4 } from 'uuid';

import { ChatPanel } from './ChatPanel';
import { PreviewPanel } from './PreviewPanel';
import { AssetSelectionModal } from './AssetSelectionModal';

// --- Constants & Initial Setup ---
const standardAnimations: AnimateClass[] = [
  ScaleAnimation,
  FadeAnimation,
  ComplexPopAnimation,
  FlagWaveAnimation,
  VortexAnimation,
  BlackHoleSpiralAnimation,
  ParticleSpinAnimation,
  CoinV2Animation,
  StairBounceAnimation,
  ArcBounce3sAnimation,
  ScaleRotateScale,
];

// --- Main App Component ---
export const App = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ type: 'user' | 'gemini'; text: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const [animationManager] = useState(() => new AnimationManager());
  const [availableAnimations, setAvailableAnimations] =
    useState<AnimateClass[]>(standardAnimations);
  const [selectedAnimationName, setSelectedAnimationName] = useState<string>(
    standardAnimations[0].animationName,
  );
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
        list.map((item) => import(/* @vite-ignore */ `/@fs/${item.fsPath}`)),
      );

      const customAnimClasses = customAnimModules
        .map((mod) => mod[Object.keys(mod)[0]] as AnimateClass)
        .filter(Boolean);

      const allAnims = [...standardAnimations, ...customAnimClasses];
      allAnims.forEach((anim) => animationManager.register(anim));
      setAvailableAnimations(allAnims);

      // Detect newly added custom animations to show a toast
      const currentNames = new Set(list.map((i) => i.name));
      if (hasLoadedCustomOnceRef.current) {
        let newCount = 0;
        currentNames.forEach((n) => {
          if (!lastCustomNamesRef.current.has(n)) newCount++;
        });
        if (newCount > 0) {
          setToast(`已加载 ${newCount} 个新动画`);
          if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
          toastTimerRef.current = window.setTimeout(() => setToast(null), 2500);
        }
      }
      lastCustomNamesRef.current = currentNames;
      hasLoadedCustomOnceRef.current = true;
    } catch (error) {
      console.error('Failed to load custom animations:', error);
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
    try {
      localStorage.setItem(key, selectedAnimationName);
    } catch {}
  }, [selectedAnimationName, sessionId]);

  // --- Pixi.js Setup ---
  useEffect(() => {
    const container = pixiContainerRef.current;
    if (!container || pixiAppRef.current) return;

    let disposed = false;
    const app = new PIXI.Application();
    let ro: ResizeObserver | null = null;
    const prevPosition = container.style.position;
    let changedPosition = false;

    (async () => {
      const w = Math.max(1, container.clientWidth || 600);
      const h = Math.max(1, container.clientHeight || 400);
      await app.init({
        width: w,
        height: h,
        backgroundColor: 0xffffff,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });
      if (disposed) {
        try {
          app.destroy(true, true);
        } catch {}
        return;
      }

      // Make canvas not affect layout height; fill container
      app.canvas.style.position = 'absolute';
      app.canvas.style.inset = '0';
      app.canvas.style.width = '100%';
      app.canvas.style.height = '100%';

      // Ensure container can host absolutely-positioned canvas
      if (!prevPosition || prevPosition === 'static') {
        container.style.position = 'relative';
        changedPosition = true;
      }

      container.appendChild(app.canvas);
      pixiAppRef.current = app;

      ro = new ResizeObserver(() => {
        const nw = Math.max(1, container.clientWidth || w);
        const nh = Math.max(1, container.clientHeight || h);
        app.renderer.resize(nw, nh);
        if (currentObjectRef.current) {
          currentObjectRef.current.x = nw / 2;
          currentObjectRef.current.y = nh / 2;
        }
      });
      ro.observe(container);

      app.ticker.add(() => {
        animationManager.update(app.ticker.deltaMS / 1000);
      });

      // Initial sizing pass
      const nw = Math.max(1, container.clientWidth || w);
      const nh = Math.max(1, container.clientHeight || h);
      app.renderer.resize(nw, nh);
    })();

    // Cleanup for effect scope
    return () => {
      disposed = true;
      if (ro) {
        try {
          ro.disconnect();
        } catch {}
        ro = null;
      }
      if (pixiAppRef.current === app) {
        pixiAppRef.current = null;
      }
      try {
        app.destroy(true, true);
      } catch {}
      // Remove canvas and restore container position
      try {
        if (app.canvas && app.canvas.parentElement === container) {
          container.removeChild(app.canvas);
        }
      } catch {}
      if (changedPosition) {
        container.style.position = prevPosition || '';
      }
    };
  }, [animationManager]);

  // --- Event Handlers ---
  const handleSendMessage = () => {
    if (!inputText.trim() || isThinking) return;

    const currentPrompt = inputText;
    setMessages((prev) => [...prev, { type: 'user', text: currentPrompt }]);
    setInputText('');
    setIsThinking(true);

    const url = `/api/chat?prompt=${encodeURIComponent(currentPrompt)}&sessionId=${sessionId || ''}`;
    const eventSource = new EventSource(url);

    let geminiResponse = '';

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'session_id':
            const newSid = data.sessionId;
            setSessionId(newSid);
            localStorage.setItem('sessionId', newSid);
            break;

          case 'tool_call':
            setMessages((prev) => [
              ...prev,
              { type: 'gemini', text: `*调用工具: \`${data.name}\`...*` },
            ]);
            break;

          case 'tool_response':
            // Optional: log tool response for debugging or richer UI
            // For now, we keep the UI clean and don't show this.
            break;

          case 'final_response':
            geminiResponse = data.text;
            // Don't add to messages yet, wait for the stream to close
            break;

          case 'workflow_complete':
            loadCustomAnimations().then(() => {
              setSelectedAnimationName(data.className);
              setToast(`动画 "${data.className}" 创建成功!`);
              if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
              toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
            });
            break;

          case 'error':
            setMessages((prev) => [
              ...prev,
              { type: 'gemini', text: `**错误:** ${data.message}` },
            ]);
            break;
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
        // This might be the final closing signal which is not JSON
      }
    };

    eventSource.onerror = () => {
      // This is also called when the connection is closed by the server
      if (geminiResponse) {
        setMessages((prev) => [...prev, { type: 'gemini', text: geminiResponse }]);
      }
      setIsThinking(false);
      eventSource.close();
    };
  };

  const handleNewTask = async () => {
    if (!sessionId) return;
    await fetch('/api/clear_session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    setMessages([]);
    try {
      localStorage.removeItem(`chat:${sessionId}`);
    } catch {}
    try {
      localStorage.removeItem(`selectedAnim:${sessionId}`);
    } catch {}
    setAvailableAnimations(standardAnimations);
    setSelectedAnimationName(standardAnimations[0].animationName);
    lastCustomNamesRef.current = new Set();
    hasLoadedCustomOnceRef.current = false;
  };

  const handleOpenPlayModal = () => {
    const animClass = availableAnimations.find((a) => a.animationName === selectedAnimationName);
    if (!animClass) return;

    const spriteCount = animClass.getRequiredSpriteCount();
    if (spriteCount === 0) {
      console.warn('Animation requires 0 sprites, nothing to display.');
      return;
    }
    setRequiredSpriteCount(spriteCount);
    setIsAssetModalOpen(true);
  };

  const handlePlayAnimation = async (spriteUrls: string[]) => {
    const app = pixiAppRef.current;
    if (!app || spriteUrls.length === 0) return;
    // Ensure stage exists (avoid using a disposed Application)
    if (!(app as any).stage) {
      setToast('渲染器尚未就绪，请稍后重试');
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 2000);
      return;
    }

    if (currentObjectRef.current) {
      const prev = currentObjectRef.current;
      // Safely remove from stage before destroy
      try {
        if (prev.parent) prev.parent.removeChild(prev);
      } catch {}
      try {
        prev.destroy({ children: true });
      } catch {
        try {
          prev.destroy();
        } catch {}
      }
      currentObjectRef.current = null;
    }

    const animClass = availableAnimations.find((a) => a.animationName === selectedAnimationName);
    if (!animClass) return;

    const textures = await Promise.all(spriteUrls.map((url) => PIXI.Assets.load(url)));
    const sprites = textures.map((texture) => new PIXI.Sprite(texture));

    const obj = new BaseObject();
    sprites.forEach((s) => {
      s.anchor.set(0.5);
      obj.addChild(s);
    });
    // Position at the center of the canvas
    obj.x = app.renderer.width / 2;
    obj.y = app.renderer.height / 2;
    if (app.stage) {
      app.stage.addChild(obj);
    } else {
      console.warn('PIXI Application stage is missing. Skipping addChild.');
      return;
    }
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
    const isStandard = standardAnimations.some((a) => a.animationName === selectedAnimationName);
    if (isStandard) {
      alert('Cannot download standard, built-in animations.');
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
      console.error('Download failed:', error);
      alert('Failed to download animation file.');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            right: 16,
            top: 16,
            background: '#333',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            zIndex: 1000,
          }}
        >
          {toast}
        </div>
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
