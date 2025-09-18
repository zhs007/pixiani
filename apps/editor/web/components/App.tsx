import React, { useState, useEffect, useRef, useCallback } from 'react';
/**
 * Streaming SSE Event Types Documentation (frontend)
 * The server may now emit these event objects (JSON via EventSource):
 *  - { type: 'delta', text } incremental partial model text if ENABLE_STREAM_DELTA=1.
 *  - { type: 'heartbeat', phase, responsePreview? } periodic keep-alive; when phase==='model_continue_end'
 *    includes responsePreview (whole accumulated text) for legacy preview typing.
 *  - { type: 'warning', message } size cap or truncation related warnings.
 *  - { type: 'final_response', text, truncated?, sizeCapped? } final model answer for the turn. If truncated
 *    or sizeCapped is true the server might auto-issue a continuation internally.
 *  - { type: 'tool_call', name, arguments } model invoked a tool.
 *  - { type: 'tool_response', name, response } tool produced output.
 *  - { type: 'workflow_complete', className, filePath } animation + test successfully published.
 *  - { type: 'error', message } fatal error handling the request.
 *  - { type: 'session_id', sessionId } assigned or reused session ID.
 * The UI merges both delta and heartbeat(preview) paths into a single typewriter effect.
 */
import * as PIXI from 'pixi.js';
import { AnimationManager, BaseObject } from '@pixi-animation-library/pixiani-engine';
import { registerAllAnimations } from '@pixi-animation-library/pixiani-anis';
import type { AnimateClass } from '@pixi-animation-library/pixiani-engine';
import { v4 as uuidv4 } from 'uuid';

import { ChatPanel } from './ChatPanel';
import { PreviewPanel } from './PreviewPanel';
import { AssetSelectionModal } from './AssetSelectionModal';

// --- Main App Component ---
export const App = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  type ChatMessage = {
    type: 'user' | 'gemini';
    text: string;
    variant?: 'error' | 'suggestion' | 'info';
    suggestions?: string[];
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const hasLoadedCustomOnceRef = React.useRef(false);
  const lastCustomNamesRef = React.useRef<Set<string>>(new Set());
  // Retry support
  const lastPromptRef = useRef<string | null>(null);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const [retryToolAvailable, setRetryToolAvailable] = useState(false);
  const [continueAvailable, setContinueAvailable] = useState(false);

  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const currentObjectRef = useRef<BaseObject | null>(null);
  const lastModelMsgRef = useRef<string | null>(null);
  // Typewriter state for streaming previews
  const typingRef = useRef<{ index: number; text: string } | null>(null);
  const pendingTextRef = useRef<string>('');
  const typingTimerRef = useRef<number | null>(null);
  // Mark when we expect the SSE to close normally so onerror doesn't show a network error
  const expectedCloseRef = useRef(false);

  // Animation manager and UI state
  const animationManager = React.useMemo(() => new AnimationManager(), []);
  const [availableAnimations, setAvailableAnimations] = useState<AnimateClass[]>([]);
  const [selectedAnimationName, setSelectedAnimationName] = useState<string>('');
  // Keep a persistent reference to the built-in animations so we can reset or query later
  const standardAnimationsRef = useRef<AnimateClass[]>([]);

  // Toast helpers
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

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

      // Register all standard animations and get the list
      const standardAnimations = registerAllAnimations(animationManager);
      standardAnimationsRef.current = standardAnimations;
      // Register the custom ones
      customAnimClasses.forEach((anim) => animationManager.register(anim));

      const allAnims = [...standardAnimations, ...customAnimClasses];
      setAvailableAnimations(allAnims);

      // Set initial selection if not already set
      if (!selectedAnimationName && allAnims.length > 0) {
        setSelectedAnimationName(allAnims[0].animationName);
      }

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
  const sendPrompt = (prompt: string) => {
    lastPromptRef.current = prompt;
    setMessages((prev) => [...prev, { type: 'user', text: prompt }]);
    setIsThinking(true);
    setRetryAvailable(false);
    const url = `/api/chat?prompt=${encodeURIComponent(prompt)}&sessionId=${sessionId || ''}`;
    expectedCloseRef.current = false;
    const eventSource = new EventSource(url);

    let geminiResponse = '';

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'model_thought': {
            // Internal reasoning (debug). Shown only as informational message.
            setMessages((prev) => [
              ...prev,
              { type: 'gemini', text: `🤔 ${data.text}`, variant: 'info' },
            ]);
            break;
          }
          case 'model_note': {
            setMessages((prev) => [
              ...prev,
              { type: 'gemini', text: `*${data.note || '模型无直接文本输出'}*`, variant: 'info' },
            ]);
            break;
          }
          case 'delta': {
            // Incremental partial text chunks when ENABLE_STREAM_DELTA is on server-side.
            // We reuse the existing typewriter pipeline by queueing delta text directly.
            const deltaText = data.text || '';
            if (!deltaText) break;
            if (!typingRef.current) {
              setMessages((prev) => {
                const next = [...prev, { type: 'gemini' as const, text: '' }];
                typingRef.current = { index: next.length - 1, text: '' };
                return next;
              });
            }
            pendingTextRef.current += deltaText;
            if (!typingTimerRef.current) {
              typingTimerRef.current = window.setInterval(() => {
                if (!pendingTextRef.current) {
                  if (typingTimerRef.current) {
                    window.clearInterval(typingTimerRef.current);
                    typingTimerRef.current = null;
                  }
                  return;
                }
                const CHARS_PER_TICK = 4;
                const chunk = pendingTextRef.current.slice(0, CHARS_PER_TICK);
                pendingTextRef.current = pendingTextRef.current.slice(CHARS_PER_TICK);
                const newText = (typingRef.current?.text || '') + chunk;
                typingRef.current = typingRef.current
                  ? { ...typingRef.current, text: newText }
                  : { index: 0, text: newText };
                const idx = typingRef.current?.index;
                setMessages((prev) => {
                  if (idx === undefined) return prev;
                  return prev.map((m, i) => (i === idx ? { ...m, text: newText } : m));
                });
              }, 24);
            }
            break;
          }
          case 'heartbeat': {
            // Keep previous logic for model_continue_end preview events; ignore pure streaming heartbeats
            if (data.phase === 'model_continue_end' && typeof data.responsePreview === 'string') {
              const preview = data.responsePreview.trim();
              if (!preview) break;
              const prevFull = lastModelMsgRef.current || '';
              if (preview === prevFull) break;
              const delta = preview.startsWith(prevFull) ? preview.slice(prevFull.length) : preview;
              lastModelMsgRef.current = preview;
              if (!typingRef.current) {
                setMessages((prev) => {
                  const next = [...prev, { type: 'gemini' as const, text: '' }];
                  typingRef.current = { index: next.length - 1, text: '' };
                  return next;
                });
              }
              pendingTextRef.current += delta;
              if (!typingTimerRef.current) {
                typingTimerRef.current = window.setInterval(() => {
                  if (!pendingTextRef.current) {
                    if (typingTimerRef.current) {
                      window.clearInterval(typingTimerRef.current);
                      typingTimerRef.current = null;
                    }
                    return;
                  }
                  const CHARS_PER_TICK = 3;
                  const chunk = pendingTextRef.current.slice(0, CHARS_PER_TICK);
                  pendingTextRef.current = pendingTextRef.current.slice(CHARS_PER_TICK);
                  const newText = (typingRef.current?.text || '') + chunk;
                  typingRef.current = typingRef.current
                    ? { ...typingRef.current, text: newText }
                    : { index: 0, text: newText };
                  const idx = typingRef.current?.index;
                  setMessages((prev) => {
                    if (idx === undefined) return prev;
                    return prev.map((m, i) => (i === idx ? { ...m, text: newText } : m));
                  });
                }, 20);
              }
            }
            break;
          }
          case 'warning': {
            // Surface a toast for warnings (e.g., size cap, truncation risk)
            if (typeof data.message === 'string' && data.message) {
              setToast(data.message);
              if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
              toastTimerRef.current = window.setTimeout(() => setToast(null), 3500);
            }
            break;
          }
          case 'session_id': {
            const newSid = data.sessionId;
            setSessionId(newSid);
            localStorage.setItem('sessionId', newSid);
            break;
          }

          case 'tool_call':
            setMessages((prev) => [
              ...prev,
              { type: 'gemini', text: `正在调用工具：\`${data.name}\`...` },
            ]);
            break;

          case 'tool_response': {
            if (
              data.name === 'get_allowed_files' ||
              data.name === 'read_file' ||
              data.name === 'create_animation_file' ||
              data.name === 'create_test_file' ||
              data.name === 'run_tests'
            )
              break;
            if (data.name !== 'publish_files') break;
            if (typeof data.response === 'string' && data.response.trim()) {
              setMessages((prev) => [
                ...prev,
                { type: 'gemini', text: `工具 \`${data.name}\` 返回: ${data.response}` },
              ]);
            }
            break;
          }

          case 'final_response': {
            geminiResponse = data.text;
            setIsThinking(false);
            setRetryAvailable(false); // success -> disable retry
            setRetryToolAvailable(false);
            setContinueAvailable(false);
            lastModelMsgRef.current = typeof geminiResponse === 'string' ? geminiResponse : '';
            const isTruncated = !!data.truncated || !!data.sizeCapped;
            // If truncated, show a subtle toast so the user knows continuation might occur
            if (isTruncated) {
              setToast('响应被截断，可能正在尝试继续...');
              if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
              toastTimerRef.current = window.setTimeout(() => setToast(null), 2500);
            }
            // Finalize the streaming message to avoid duplication/truncation due to queued deltas.
            try {
              // Stop typewriter if running
              if (typingTimerRef.current) {
                window.clearInterval(typingTimerRef.current);
                typingTimerRef.current = null;
              }
              // Replace the current streaming message text with the final text if it exists,
              // otherwise append a new message.
              if (typingRef.current) {
                const idx = typingRef.current.index;
                setMessages((prev) =>
                  prev.map((m, i) => (i === idx ? { ...m, text: geminiResponse || '' } : m)),
                );
              } else if (geminiResponse) {
                setMessages((prev) => [...prev, { type: 'gemini' as const, text: geminiResponse }]);
              }
              // Clear any pending queued characters and reset typing state
              pendingTextRef.current = '';
              typingRef.current = null;
            } catch {}
            expectedCloseRef.current = true;
            try {
              eventSource.close();
            } catch {}
            break;
          }

          case 'workflow_halt':
            {
              // Server indicates a controlled halt (e.g., max steps). Offer Continue.
              const reason = data.reason || 'halt';
              setMessages((prev) => [
                ...prev,
                {
                  type: 'gemini',
                  text: `⚠️ 流程暂停：${reason === 'max_steps' ? '达到最大步骤数' : reason}`,
                },
              ]);
              setContinueAvailable(true);
              // Halt means model不再思考，启用输入与按钮
              if (typingTimerRef.current) {
                window.clearInterval(typingTimerRef.current);
                typingTimerRef.current = null;
              }
              setIsThinking(false);
              // If marked terminal, we expect the SSE to close; mark expected and close proactively
              if (data.terminal) {
                if (typingTimerRef.current) {
                  window.clearInterval(typingTimerRef.current);
                  typingTimerRef.current = null;
                }
                setIsThinking(false);
                expectedCloseRef.current = true;
                try {
                  eventSource.close();
                } catch {}
              }
              break;
            }
            break;
          case 'workflow_complete': {
            const { className, filePath } = data;
            setIsThinking(false);
            if (className && filePath) {
              import(/* @vite-ignore */ `/@fs/${filePath}`)
                .then((mod) => {
                  const newAnimClass = mod[Object.keys(mod)[0]] as AnimateClass;
                  if (newAnimClass) {
                    animationManager.register(newAnimClass);
                    setAvailableAnimations((prev) => [...prev, newAnimClass]);
                    setSelectedAnimationName(className);
                    setToast(`动画 "${className}" 创建成功!`);
                    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
                    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
                  }
                })
                .catch((err) => {
                  console.error('Failed to dynamically import new animation:', err);
                  setToast(`错误: 无法加载新动画 ${className}`);
                });
            }
            break;
          }

          case 'error':
            setMessages((prev) => [...prev, { type: 'gemini', text: `**错误:** ${data.message}` }]);
            setToast(`请求出错：${data.message}`);
            if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
            toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
            // If server marks this as terminal, treat it as an expected close to avoid onerror toast
            if (data.terminal) {
              if (typingTimerRef.current) {
                window.clearInterval(typingTimerRef.current);
                typingTimerRef.current = null;
              }
              setIsThinking(false);
              expectedCloseRef.current = true;
              try {
                eventSource.close();
              } catch {}
            }
            break;

          case 'tool_retry': {
            // Show transient retry notice
            const attempt = data.attempt || 0;
            const max = data.max || 0;
            setToast(`工具重试中 (${attempt}/${max})...`);
            if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
            toastTimerRef.current = window.setTimeout(() => setToast(null), 2000);
            break;
          }
          case 'tool_error': {
            // Non-transient or exhausted retries - allow tool-level retry
            if (!data.transient) {
              setRetryToolAvailable(true);
              setToast(`工具失败：${data.name}`);
              if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
              toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
            }
            const suggestions: string[] | undefined = data.suggestions;
            setMessages((prev) => [
              ...prev,
              {
                type: 'gemini',
                text: `**工具错误** (${data.name}): ${data.message}`,
                variant: 'error',
                suggestions,
              },
              ...(suggestions
                ? suggestions.map(
                    (s): ChatMessage => ({
                      type: 'gemini',
                      text: `建议: ${s}`,
                      variant: 'suggestion',
                    }),
                  )
                : []),
            ]);
            break;
          }
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = (_ev) => {
      // Network errors or stream closed. Show a user-visible notice if no final response yet.
      if (typingTimerRef.current) {
        window.clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      if (expectedCloseRef.current) {
        setIsThinking(false);
        try {
          eventSource.close();
        } catch {}
        return;
      }
      // If we have a workflow_halt and are offering continue, treat as expected close
      if (continueAvailable) {
        setIsThinking(false);
        try {
          eventSource.close();
        } catch {}
        return;
      }
      // Enable retry if we had a prompt
      if (lastPromptRef.current) setRetryAvailable(true);
      if (geminiResponse && geminiResponse !== lastModelMsgRef.current) {
        setMessages((prev) => [...prev, { type: 'gemini', text: geminiResponse }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { type: 'gemini', text: '**连接中断**：网络错误或服务暂时不可用，请稍后重试。' },
        ]);
      }
      setToast('网络错误：连接已中断');
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
      setIsThinking(false);
      try {
        eventSource.close();
      } catch {}
    };
  };

  const handleSendMessage = () => {
    if (!inputText.trim() || isThinking) return;
    const currentPrompt = inputText;
    setInputText('');
    sendPrompt(currentPrompt);
  };

  const handleRetry = () => {
    if (isThinking) return;
    if (lastPromptRef.current) {
      sendPrompt(lastPromptRef.current);
    }
  };

  const handleContinue = () => {
    if (isThinking) return;
    setContinueAvailable(false);
    sendPrompt('CONTINUE');
  };

  const handleRetryTool = async () => {
    if (isThinking || !sessionId) return;
    setIsThinking(true);
    try {
      const res = await fetch('/api/retry_last_tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const json = await res.json();
      if (!json.success) {
        setToast(`工具重试失败: ${json.error || 'unknown'}`);
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
        setIsThinking(false);
        return;
      }
      setToast('工具重试成功，继续推理...');
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 2000);
      setRetryToolAvailable(false);
      // Trigger a continuation turn (CONTINUE) so model advances
      sendPrompt('CONTINUE');
    } catch (e: any) {
      setToast(`工具重试异常: ${e?.message || e}`);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
      setIsThinking(false);
    }
  };

  const handleNewTask = async () => {
    if (!sessionId) return;
    // Stop any ongoing typing timer and reset typing state
    if (typingTimerRef.current) {
      window.clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    typingRef.current = null;
    pendingTextRef.current = '';
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
    const std = standardAnimationsRef.current;
    if (std && std.length > 0) {
      setAvailableAnimations(std);
      setSelectedAnimationName(std[0].animationName);
    } else {
      setAvailableAnimations([]);
      setSelectedAnimationName('');
    }
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
    if (!(app as any).stage) {
      setToast('渲染器尚未就绪，请稍后重试');
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 2000);
      return;
    }
    if (currentObjectRef.current) {
      const prev = currentObjectRef.current;
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
    obj.x = (app.renderer as any).width / 2;
    obj.y = (app.renderer as any).height / 2;
    if (app.stage) app.stage.addChild(obj);
    else return;
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
    const std = standardAnimationsRef.current;
    const isStandard = std.some((a) => a.animationName === selectedAnimationName);
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
        onRetry={handleRetry}
        retryAvailable={retryAvailable}
        onRetryTool={handleRetryTool}
        retryToolAvailable={retryToolAvailable}
        onContinue={handleContinue}
        continueAvailable={continueAvailable}
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
