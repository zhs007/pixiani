import { Application, Assets, Container, Sprite, Text, Texture } from 'pixi.js';

export interface ComplexStageOptions {
  initialWidth?: number;
  initialHeight?: number;
  backgroundColor?: number;
  pixelRatio?: number;
  showDebugOverlay?: boolean;
}

interface Bounds {
  width: number;
  height: number;
}

type CoreSpriteKey = 'baseBack' | 'outerGlow' | 'outerRing' | 'rim' | 'demon' | 'coin';

const ICON_KEYS = ['iconDrink', 'iconFries', 'iconBurger', 'iconPizza', 'iconCup', 'iconShake'] as const;
type IconKey = (typeof ICON_KEYS)[number];
type ManifestKey = CoreSpriteKey | IconKey;

const manifest: Record<ManifestKey, string> = {
  baseBack: new URL('../assets/megawin_back.png', import.meta.url).href,
  outerGlow: new URL('../assets/superwin_back.png', import.meta.url).href,
  outerRing: new URL('../assets/megawin.png', import.meta.url).href,
  rim: new URL('../assets/圈.png', import.meta.url).href,
  demon: new URL('../assets/demon.png', import.meta.url).href,
  coin: new URL('../assets/金币.png', import.meta.url).href,
  iconDrink: new URL('../assets/item_02.png', import.meta.url).href,
  iconFries: new URL('../assets/item_03.png', import.meta.url).href,
  iconBurger: new URL('../assets/item_04.png', import.meta.url).href,
  iconPizza: new URL('../assets/item_05.png', import.meta.url).href,
  iconCup: new URL('../assets/item_01.png', import.meta.url).href,
  iconShake: new URL('../assets/item_02.png', import.meta.url).href
};

export class ComplexStage {
  private readonly options: ComplexStageOptions;
  private readonly app: Application;
  private readonly baseLayer: Container;
  private readonly fxLayer: Container;
  private readonly uiLayer: Container;
  private bounds: Bounds;
  private debugOverlay: HTMLDivElement | null = null;
  private readonly sprites: Map<CoreSpriteKey, Sprite> = new Map();
  private readonly iconSprites: Sprite[] = [];
  private amountLabel: Text | null = null;
  private elapsed = 0;

  constructor(options: ComplexStageOptions = {}) {
    this.options = options;
    this.app = new Application();
    this.baseLayer = new Container();
    this.baseLayer.sortableChildren = true;
    this.fxLayer = new Container();
    this.fxLayer.sortableChildren = true;
    this.uiLayer = new Container();
    this.bounds = {
      width: options.initialWidth ?? Math.min(window.innerWidth, 1280),
      height: options.initialHeight ?? Math.min(window.innerHeight, 720)
    };
  }

  async init(): Promise<void> {
    await this.app.init({
      background: this.options.backgroundColor ?? 0x060f24,
      width: this.bounds.width,
      height: this.bounds.height,
      antialias: true,
      autoDensity: true,
      resolution: this.options.pixelRatio ?? Math.min(window.devicePixelRatio, 2)
    });

    this.app.stage.sortableChildren = true;
    this.app.stage.addChild(this.baseLayer, this.fxLayer, this.uiLayer);

    await this.loadAssets();
    this.composeScene();
  }

  mount(host: HTMLElement): void {
    host.appendChild(this.app.canvas);

    if (this.options.showDebugOverlay !== false) {
      const overlay = document.createElement('div');
      overlay.className = 'debug-overlay';
      overlay.textContent = 'ready';
      host.appendChild(overlay);
      this.debugOverlay = overlay;
    }
  }

  start(): void {
    this.app.ticker.add(this.handleTick, this);
    this.app.ticker.start();
  }

  stop(): void {
    this.app.ticker.stop();
  }

  resize(width: number, height: number): void {
    this.bounds = { width, height };
    this.app.renderer.resize(width, height);
    this.app.canvas.width = width;
    this.app.canvas.height = height;
    this.positionComponents();
  }

  destroy(): void {
    this.app.ticker.remove(this.handleTick, this);
    this.app.destroy();
    this.debugOverlay?.remove();
    this.debugOverlay = null;
  }

  private async loadAssets(): Promise<void> {
    const textures = Object.fromEntries(
      await Promise.all(
        Object.entries(manifest).map(async ([alias, src]) => {
          const texture = await Assets.load(src);
          return [alias, texture] as const;
        })
      )
    ) as Record<ManifestKey, Sprite['texture']>;

    const createSprite = (key: ManifestKey): Sprite => {
      const sprite = new Sprite(textures[key]);
      sprite.anchor.set(0.5);
      sprite.label = key;
      return sprite;
    };

    this.sprites.set('baseBack', createSprite('baseBack'));

    const glow = createSprite('outerGlow');
    glow.scale.set(1.12);
    glow.alpha = 0.35;
    glow.blendMode = 'add';
    this.sprites.set('outerGlow', glow);

    const outerRing = createSprite('outerRing');
    outerRing.scale.set(1.02);
    this.sprites.set('outerRing', outerRing);

    const rim = createSprite('rim');
    rim.scale.set(0.82);
    rim.alpha = 0.65;
    rim.blendMode = 'add';
    rim.tint = 0xffd363;
    this.sprites.set('rim', rim);

    const demon = createSprite('demon');
    demon.scale.set(0.78);
    demon.y = -18;
    this.sprites.set('demon', demon);

    const coin = createSprite('coin');
    coin.scale.set(1.05);
    this.sprites.set('coin', coin);

    const iconPalette = [0x57d2ff, 0xff7cd9, 0x6aff8d, 0xffb84f, 0xff6b6b, 0x9f8bff];

    ICON_KEYS.forEach((iconKey, index) => {
      const icon = createSprite(iconKey);
      icon.scale.set(0.9);
      icon.alpha = 0.9;
      icon.blendMode = 'add';
      icon.tint = iconPalette[index % iconPalette.length];
      icon.label = iconKey;
      this.iconSprites.push(icon);
    });
  }

  private composeScene(): void {
    const baseBack = this.getSprite('baseBack');
    const outerGlow = this.getSprite('outerGlow');
    const outerRing = this.getSprite('outerRing');
    const rim = this.getSprite('rim');
    const demon = this.getSprite('demon');

    outerGlow.zIndex = 0;
    baseBack.zIndex = 1;
    outerRing.zIndex = 5;
    rim.zIndex = 6;
    demon.zIndex = 10;

    this.baseLayer.addChild(outerGlow, baseBack, outerRing, rim, demon);

    const iconsContainer = new Container();
    iconsContainer.zIndex = 8;
    this.iconSprites.forEach((icon) => iconsContainer.addChild(icon));
    this.baseLayer.addChild(iconsContainer);

    const coins = new Container();
    coins.sortableChildren = true;
    coins.zIndex = 20;

    for (let i = 0; i < 10; i += 1) {
      const coinClone = new Sprite(this.getSprite('coin').texture);
      coinClone.anchor.set(0.5);
      coinClone.scale.set(0.7 + i * 0.06);
      coinClone.y = -baseBack.height * 0.22 - i * 28;
      coinClone.x = (i % 2 === 0 ? -1 : 1) * 22;
      coinClone.rotation = 0.2 * (i % 2 === 0 ? 1 : -1);
      coinClone.alpha = 0.85;
      coinClone.blendMode = 'add';
      coins.addChild(coinClone);
    }

    this.fxLayer.addChild(coins);

    const amount = new Text({
      text: '1050.00',
      style: {
        fontFamily: 'Lilita One, system-ui',
        fontSize: 110,
        fill: 0xfff4a8,
        stroke: { color: 0x671b00, width: 14, join: 'round' },
        dropShadow: {
          color: 0xffa94c,
          blur: 8,
          distance: 0
        }
      }
    });
    amount.anchor.set(0.5);
    amount.zIndex = 30;
    this.uiLayer.addChild(amount);
    this.amountLabel = amount;

    this.positionComponents();
  }

  private positionComponents(): void {
    const centerX = this.bounds.width / 2;
    const centerY = this.bounds.height / 2;

    this.baseLayer.position.set(centerX, centerY);
    this.fxLayer.position.set(centerX, centerY);
    this.uiLayer.position.set(centerX, centerY);

    if (this.amountLabel) {
      this.amountLabel.position.set(0, this.getSprite('baseBack').height * 0.05);
    }

    const rim = this.getSprite('rim');
    const radius = rim.width * 0.52;

    this.iconSprites.forEach((icon, index) => {
      const angle = (index / this.iconSprites.length) * Math.PI * 2 - Math.PI / 2;
      icon.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius);
      icon.rotation = angle + Math.PI / 2;
    });
  }

  private handleTick(delta: number): void {
    this.elapsed += delta / 60;

    if (this.debugOverlay) {
      this.debugOverlay.textContent = `fps: ${this.app.ticker.FPS.toFixed(1)}\nassets: ${
        this.sprites.size + this.iconSprites.length
      }`;
    }

    if (this.amountLabel) {
      this.amountLabel.text = `${(1050 + Math.sin(this.elapsed * 1.6) * 25).toFixed(2)}`;
    }
  }

  private getSprite(key: CoreSpriteKey): Sprite {
    const sprite = this.sprites.get(key);
    if (!sprite) {
      throw new Error(`Sprite with key "${key}" was not loaded.`);
    }
    return sprite;
  }
}
