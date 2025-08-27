import React from 'react';
import { AnimateClass } from 'pixi-animation-library';

type PreviewPanelProps = {
  pixiContainerRef: React.RefObject<HTMLDivElement>;
  animations: AnimateClass[];
  selectedAnimation: string;
  onAnimationChange: (name: string) => void;
  onPlay: () => void;
  onDownload: () => void;
  loop: boolean;
  onLoopChange: (value: boolean) => void;
  speed: number;
  onSpeedChange: (value: number) => void;
};

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  pixiContainerRef,
  animations,
  selectedAnimation,
  onAnimationChange,
  onPlay,
  onDownload,
  loop,
  onLoopChange,
  speed,
  onSpeedChange
}) => (
    <div style={{width:'60%', padding:'20px', display:'flex', flexDirection:'column', gap:'20px'}}>
        <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
            <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                <select value={selectedAnimation} onChange={e => onAnimationChange(e.target.value)} style={{flexGrow:1, padding:'8px'}}>
                    {animations.map(anim => <option key={anim.animationName} value={anim.animationName}>{anim.animationName}</option>)}
                </select>
                <button onClick={onPlay} style={{padding:'10px 15px', cursor:'pointer'}}>Play</button>
                <button onClick={onDownload} style={{padding:'10px 15px', cursor:'pointer'}}>Download .ts</button>
            </div>
            <div style={{display:'flex', gap:'20px', alignItems:'center'}}>
                <label style={{display:'flex', alignItems:'center', gap:'5px', cursor:'pointer'}}>
                    <input
                        type="checkbox"
                        checked={loop}
                        onChange={e => onLoopChange(e.target.checked)}
                    />
                    Loop
                </label>
                <label style={{display:'flex', alignItems:'center', gap:'5px'}}>
                    Speed:
                    <input
                        type="number"
                        value={speed}
                        onChange={e => onSpeedChange(parseFloat(e.target.value))}
                        min="0.1"
                        step="0.1"
                        style={{width:'80px', padding:'4px'}}
                    />
                </label>
            </div>
        </div>
        <div ref={pixiContainerRef} style={{flexGrow:1, border:'2px solid #333', borderRadius:'8px', backgroundColor:'#ffffff'}}></div>
    </div>
);
