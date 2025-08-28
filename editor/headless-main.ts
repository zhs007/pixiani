import * as PIXI from 'pixi.js';
import { BaseAnimate } from '../src/core/BaseAnimate';
import { IAnimate } from '../src/core/types';
import { SpySprite } from './SpySprite';

// Extend the window object for communication with Puppeteer
declare global {
  interface Window {
    runAnimation: (jsCode: string, className: string) => void;
    __animation_finished: boolean;
    __animation_errors: string[];
  }
}

window.__animation_finished = false;
window.__animation_errors = [];

// This function will be called by Puppeteer
window.runAnimation = async (jsCode: string, className: string) => {
  try {
    // 1. Setup Pixi App
    const app = new PIXI.Application();
    // Appending to body is not strictly necessary for headless property checks,
    // but it's good practice and useful for debugging with headless: false.
    document.body.appendChild(app.view as HTMLCanvasElement);

    // 2. Load the AI-generated animation class from the JS code
    const dataUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(jsCode)}`;
    // @ts-ignore - Vite will not see this dynamic import, which is fine.
    const module = await import(/* @vite-ignore */ dataUrl);
    const AnimationClass = module[className];

    if (!AnimationClass || typeof AnimationClass.getRequiredSpriteCount !== 'function') {
      throw new Error(`Animation class "${className}" not found or is invalid in the provided code.`);
    }

    // 3. Create placeholder sprites
    const spriteCount = AnimationClass.getRequiredSpriteCount();
    const sprites: PIXI.Sprite[] = [];
    if (spriteCount > 0) {
      for (let i = 0; i < spriteCount; i++) {
        // Use the SpySprite to capture property changes
        const sprite = new SpySprite(PIXI.Texture.WHITE);
        sprite.anchor.set(0.5);
        app.stage.addChild(sprite);
        sprites.push(sprite);
      }
    }

    // 4. Instantiate the animation
    const animation: IAnimate = new AnimationClass(null, sprites);

    // 5. Setup completion handlers
    const completeAnimation = (reason: string) => {
      if (window.__animation_finished) return; // Prevent double completion
      console.log(`[Headless] Animation completed: ${reason}`);
      app.ticker.stop();
      animation.stop();
      window.__animation_finished = true;
    };

    // Set a timeout to prevent infinite loops
    setTimeout(() => completeAnimation('Timeout reached'), 5000); // 5-second max duration

    // The animation can call onComplete to signal it's done
    animation.onComplete = () => completeAnimation('onComplete called');

    // 6. Run the animation via the ticker
    app.ticker.add((ticker) => {
      // The ticker is stopped in completeAnimation
      const deltaTime = ticker.deltaMS / 1000;
      animation.update(deltaTime);
    });

    animation.play();
    console.log(`[Headless] Animation "${className}" has started.`);

  } catch (error: any) {
    console.error('[Headless] Error during animation setup or execution:', error);
    window.__animation_errors.push(error.message);
    window.__animation_finished = true; // Signal completion on error
  }
};
