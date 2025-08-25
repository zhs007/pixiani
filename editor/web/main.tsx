import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
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

// --- Constants & Initial Setup ---
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;
const standardAnimations: AnimateClass[] = [ScaleAnimation, FadeAnimation, ComplexPopAnimation, FlagWaveAnimation, VortexAnimation];

// --- Main App Component ---
const App = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ type: 'user' | 'gemini'; text: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const [animationManager] = useState(() => new AnimationManager());
  const [availableAnimations, setAvailableAnimations] = useState<AnimateClass[]>(standardAnimations);
  const [selectedAnimationName, setSelectedAnimationName] = useState<string>(standardAnimations[0].animationName);

  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const currentObjectRef = useRef<BaseObject | null>(null);

  // --- Session Management ---
  useEffect(() => {
    let sid = localStorage.getItem('sessionId');
    if (!sid) {
      sid = uuidv4();
      localStorage.setItem('sessionId', sid);
    }
    setSessionId(sid);
  }, []);

  // --- Animation Loading ---
  const loadCustomAnimations = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/animations/${sessionId}`);
      const customAnimNames: string[] = await res.json();

      const customAnimModules = await Promise.all(
        customAnimNames.map(name =>
          import(/* @vite-ignore */ `/editor/sessions/${sessionId}/animations/${name}.ts`)
        )
      );

      const customAnimClasses = customAnimModules.map(mod => mod[Object.keys(mod)[0]] as AnimateClass);

      const allAnims = [...standardAnimations, ...customAnimClasses];
      allAnims.forEach(anim => animationManager.register(anim));
      setAvailableAnimations(allAnims);

    } catch (error) {
      console.error("Failed to load custom animations:", error);
    }
  }, [sessionId, animationManager]);

  useEffect(() => {
    loadCustomAnimations();
  }, [loadCustomAnimations]);

  // --- Pixi.js Setup ---
  useEffect(() => {
    if (pixiContainerRef.current && !pixiAppRef.current) {
      const app = new PIXI.Application();
      app.init({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: 0xffffff,
      }).then(() => {
        pixiContainerRef.current?.appendChild(app.canvas);
        pixiAppRef.current = app;
        app.ticker.add(() => {
          animationManager.update(app.ticker.deltaMS / 1000);
        });
      });
    }
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
    // This could also clear the generated files from the server
    setAvailableAnimations(standardAnimations);
  };

  const handlePlayAnimation = async () => {
    const app = pixiAppRef.current;
    if (!app) return;

    if (currentObjectRef.current) {
        currentObjectRef.current.destroy();
    }

    const animClass = availableAnimations.find(a => a.animationName === selectedAnimationName);
    if (!animClass) return;

    const spriteCount = animClass.getRequiredSpriteCount();
    if (spriteCount === 0) {
        console.log("Animation requires 0 sprites, nothing to display.");
        return;
    }

    const texture = await PIXI.Assets.load('/sprite/sprite1.png');
    const sprites = Array.from({ length: spriteCount }, () => new PIXI.Sprite(texture));

    const obj = new BaseObject();
    sprites.forEach(s => {
        s.anchor.set(0.5);
        obj.addChild(s);
    });
    obj.x = CANVAS_WIDTH / 2;
    obj.y = CANVAS_HEIGHT / 2;
    app.stage.addChild(obj);
    currentObjectRef.current = obj;

    const anim = animationManager.create(selectedAnimationName, obj, sprites);
    if (anim) anim.play();
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
        onPlay={handlePlayAnimation}
        onDownload={handleDownload}
      />
    </div>
  );
};

// --- Child Components ---
const ChatPanel = ({ messages, inputText, isThinking, onInputChange, onSendMessage, onNewTask }) => (
    <div style={{width:'40%', borderRight:'1px solid #ccc', display:'flex', flexDirection:'column', backgroundColor: '#f9f9f9'}}>
        <div style={{padding:'10px', borderBottom:'1px solid #ccc', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h3>Chat with Gemini</h3>
            <button onClick={onNewTask} style={{padding:'8px', cursor:'pointer'}}>New Task</button>
        </div>
        <div style={{flexGrow:1, padding:'10px', overflowY:'auto'}}>
            {messages.map((msg, index) => (
                <div key={index} style={{marginBottom:'10px', padding:'8px', borderRadius:'5px', backgroundColor: msg.type === 'user' ? '#d1e7fd' : '#e2e3e5'}}>
                    {msg.text}
                </div>
            ))}
            {isThinking && <div>...</div>}
        </div>
        <div style={{display:'flex', padding:'10px', borderTop:'1px solid #ccc'}}>
            <textarea
                value={inputText}
                onChange={e => onInputChange(e.target.value)}
                placeholder="Describe an animation..."
                style={{flexGrow:1, marginRight:'10px', padding:'8px'}}
                disabled={isThinking}
            />
            <button onClick={onSendMessage} disabled={isThinking} style={{padding:'10px 15px', cursor:'pointer'}}>Send</button>
        </div>
    </div>
);

const PreviewPanel = ({ pixiContainerRef, animations, selectedAnimation, onAnimationChange, onPlay, onDownload }) => (
    <div style={{width:'60%', padding:'20px', display:'flex', flexDirection:'column', gap:'20px'}}>
        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
            <select value={selectedAnimation} onChange={e => onAnimationChange(e.target.value)} style={{flexGrow:1, padding:'8px'}}>
                {animations.map(anim => <option key={anim.animationName} value={anim.animationName}>{anim.animationName}</option>)}
            </select>
            <button onClick={onPlay} style={{padding:'10px 15px', cursor:'pointer'}}>Play</button>
            <button onClick={onDownload} style={{padding:'10px 15px', cursor:'pointer'}}>Download .ts</button>
        </div>
        <div ref={pixiContainerRef} style={{flexGrow:1, border:'2px solid #333', borderRadius:'8px', backgroundColor:'#ffffff'}}></div>
    </div>
);

// --- Render App ---
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
