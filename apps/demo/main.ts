import * as PIXI from 'pixi.js';
import {
  AnimationManager,
  BaseObject,
  type AnimateClass,
} from '@pixi-animation-library/pixiani-engine';
import { registerAllAnimations } from '@pixi-animation-library/pixiani-anis';

// --- Configuration ---
const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 640;

// --- DOM Elements ---
const animationSelect = document.getElementById('animation-select') as HTMLSelectElement;
const spriteSlotsContainer = document.getElementById('sprite-slots-container') as HTMLDivElement;
const speedInput = document.getElementById('speed-input') as HTMLInputElement;
const playButton = document.getElementById('play-button') as HTMLButtonElement;
const canvasContainer = document.getElementById('pixi-canvas-container') as HTMLDivElement;

// --- Global State ---
const app = new PIXI.Application();
const manager = new AnimationManager();
let currentObject: BaseObject | null = null;
const registeredAnimations: Map<string, AnimateClass> = new Map();

/**
 * Fetches the list of available sprite assets.
 * Uses Vite's `import.meta.glob` to find all images in the assets directory.
 */
function getAvailableSprites(): Record<string, { default: string }> {
  // The path must be relative to the current file (main.ts) for import.meta.glob.
  // Since the vite root is 'demo', we need to go up one level to find the assets folder.
  return import.meta.glob('../assets/sprite/*.{png,jpg,jpeg,svg}', { eager: true });
}

/**
 * Populates the UI with dropdowns for the required sprite slots.
 */
async function updateSpriteSlots() {
  const animName = animationSelect.value;
  const animClass = registeredAnimations.get(animName);
  if (!animClass) return;

  const requiredSlots = animClass.getRequiredSpriteCount();
  const availableSprites = getAvailableSprites();
  const spritePaths = Object.keys(availableSprites).map((path) => availableSprites[path].default);

  spriteSlotsContainer.innerHTML = ''; // Clear existing slots

  for (let i = 0; i < requiredSlots; i++) {
    const label = document.createElement('label');
    label.textContent = `Sprite Slot ${i + 1}:`;

    const select = document.createElement('select');
    select.id = `sprite-slot-${i}`;

    spritePaths.forEach((path) => {
      const option = document.createElement('option');
      option.value = path;
      option.textContent = path.split('/').pop() || path;
      select.appendChild(option);
    });

    const group = document.createElement('div');
    group.className = 'control-group';
    group.appendChild(label);
    group.appendChild(select);
    spriteSlotsContainer.appendChild(group);
  }
}

/**
 * Handles the 'Play' button click event.
 * Creates and displays the selected animation.
 */
async function playAnimation() {
  // 1. Clean up previous object
  if (currentObject) {
    currentObject.destroy();
    currentObject = null;
  }

  // 2. Get selections from UI
  const animName = animationSelect.value;
  const spriteSlotElements = spriteSlotsContainer.querySelectorAll('select');
  const selectedSpriteUrls = Array.from(spriteSlotElements).map((select) => select.value);

  if (!animName || selectedSpriteUrls.length === 0) {
    console.error('No animation or sprites selected.');
    return;
  }

  // 3. Load assets
  const textures = await Promise.all(selectedSpriteUrls.map((url) => PIXI.Assets.load(url)));
  const sprites = textures.map((texture) => new PIXI.Sprite(texture));

  // 4. Create objects
  currentObject = new BaseObject();
  sprites.forEach((sprite) => {
    sprite.anchor.set(0.5);
    currentObject!.addChild(sprite);
  });
  currentObject.x = CANVAS_WIDTH / 2;
  currentObject.y = CANVAS_HEIGHT / 2;
  app.stage.addChild(currentObject);

  // 5. Create and play animation
  const anim = manager.create(animName, currentObject, sprites);
  if (anim) {
    anim.play();
  }
}

/**
 * Main initialization function.
 */
async function init() {
  // 1. Setup Pixi App
  await app.init({
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: 0xffffff,
  });
  canvasContainer.appendChild(app.canvas);

  // 2. Register animations
  const allAnimationClasses = registerAllAnimations(manager);
  allAnimationClasses.forEach((animClass: any) => {
    registeredAnimations.set(animClass.animationName, animClass);
    const option = document.createElement('option');
    option.value = animClass.animationName;
    option.textContent = animClass.animationName;
    animationSelect.appendChild(option);
  });

  // 3. Setup UI and event listeners
  animationSelect.addEventListener('change', updateSpriteSlots);
  speedInput.addEventListener('input', () => {
    manager.setSpeed(parseFloat(speedInput.value) || 1.0);
  });
  playButton.addEventListener('click', playAnimation);

  // 4. Initial UI population
  await updateSpriteSlots();

  // 5. Start the update loop
  app.ticker.add((ticker) => {
    // ticker.deltaMS is the time elapsed in milliseconds
    // We convert it to seconds for our update function
    manager.update(ticker.deltaMS / 1000);
  });
}

// --- Start the application ---
init();
