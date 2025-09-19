import {
  Application,
  Assets,
  Container,
  FillGradient,
  Graphics,
  Sprite,
  Text,
  Texture,
  Ticker,
} from 'pixi.js';
import { CoinEmitter } from '../animations/CoinEmitter';
import {
  IconBurstEmitter,
  type IconBurstEmitterConfig,
} from '../animations/IconBurstEmitter';
import { randomFloat } from '../utils/random';

export interface ComplexStageOptions {
  initialWidth?: number;
  initialHeight?: number;
  backgroundColor?: number;
  pixelRatio?: number;
  showDebugOverlay?: boolean;
  targetAmount?: number;
}

interface Bounds {
  width: number;
  height: number;
}

type StagePhase = 'normal' | 'bigwin' | 'superwin' | 'megawin';
type PhaseWithBanner = Exclude<StagePhase, 'normal'>;

const PHASE_ORDER: StagePhase[] = ['normal', 'bigwin', 'superwin', 'megawin'];

type CoreSpriteKey = 'demon' | 'coin';

type BannerSpriteKey =
  | 'bigwinBack'
  | 'bigwinFront'
  | 'superwinBack'
  | 'superwinFront'
  | 'megawinBack'
  | 'megawinFront';

const ICON_KEYS = [
  'iconDrink',
  'iconFries',
  'iconBurger',
  'iconPizza',
  'iconCup',
  'iconShake',
] as const;
type IconKey = (typeof ICON_KEYS)[number];
type ManifestKey = CoreSpriteKey | BannerSpriteKey | IconKey;

const manifest: Record<ManifestKey, string> = {
  demon: new URL('../assets/demon.png', import.meta.url).href,
  coin: new URL('../assets/金币.png', import.meta.url).href,
  bigwinBack: new URL('../assets/bigwin_back.png', import.meta.url).href,
  bigwinFront: new URL('../assets/bigwin.png', import.meta.url).href,
  superwinBack: new URL('../assets/superwin_back.png', import.meta.url).href,
  superwinFront: new URL('../assets/superwin.png', import.meta.url).href,
  megawinBack: new URL('../assets/megawin_back.png', import.meta.url).href,
  megawinFront: new URL('../assets/megawin.png', import.meta.url).href,
  iconDrink: new URL('../assets/item_02.png', import.meta.url).href,
  iconFries: new URL('../assets/item_03.png', import.meta.url).href,
  iconBurger: new URL('../assets/item_04.png', import.meta.url).href,
  iconPizza: new URL('../assets/item_05.png', import.meta.url).href,
  iconCup: new URL('../assets/item_01.png', import.meta.url).href,
  iconShake: new URL('../assets/item_02.png', import.meta.url).href,
};

const DEFAULT_TARGET_AMOUNT = 150;
const MAX_ACTIVE_COINS = 100;
const ICON_COLORS = [0x57d2ff, 0xff7cd9, 0x6aff8d, 0xffb84f, 0xff6b6b, 0x9f8bff];
const RIPPLE_COLOR = 0xffcf73;
const RIPPLE_ALPHA_START = 0.7;
const RIPPLE_ALPHA_END = 0;

type BannerDisplay = Container & { scale: { set: (value: number) => void } };

interface BannerVisual {
  front: BannerDisplay;
  back?: BannerDisplay | null;
}

interface PhaseSettings {
  key: StagePhase;
  threshold: number;
  labelScale: number;
  amountSpeed: number;
  coinConfig: {
    maxCoins: number;
    spawnRange: [number, number];
  };
  showIcons: boolean;
  bannerKey?: PhaseWithBanner;
  iconConfig?: IconBurstEmitterConfig;
  bannerConfig?: BannerPhaseConfig;
  rippleConfig?: RipplePhaseConfig;
}

interface BannerPhaseConfig {
  backFlipDuration: number;
  backHoldDuration: number;
  frontEnterDuration: number;
  frontSpinSpeed: number;
  frontStartScale: number;
  frontFadeDuration?: number;
  frontFadeScale?: number;
  fadeOutSpinSpeed?: number;
}

interface RipplePhaseConfig {
  intervalRange: [number, number];
  radiusRange: [number, number];
  durationRange: [number, number];
  lineWidthRange: [number, number];
}

const PHASE_SETTINGS: PhaseSettings[] = [
  {
    key: 'normal',
    threshold: 0,
    labelScale: 1,
    amountSpeed: 0.6,
    coinConfig: { maxCoins: 24, spawnRange: [0.5, 0.9] },
    showIcons: false,
  },
  {
    key: 'bigwin',
    threshold: 15,
    labelScale: 1.5,
    amountSpeed: 1.2,
    coinConfig: { maxCoins: 48, spawnRange: [0.25, 0.45] },
    showIcons: true,
    bannerKey: 'bigwin',
    bannerConfig: {
      backFlipDuration: 0.8,
      backHoldDuration: 1,
      frontEnterDuration: 0.8,
      frontSpinSpeed: Math.PI / 6,
      frontStartScale: 0.4,
      frontFadeDuration: 0.8,
      frontFadeScale: 1.45,
      fadeOutSpinSpeed: Math.PI / 2,
    },
    rippleConfig: {
      intervalRange: [1.6, 2.2],
      radiusRange: [140, 200],
      durationRange: [1.8, 2.2],
      lineWidthRange: [10, 6],
    },
    iconConfig: {
      burstCount: 10,
      burstIntervalRange: [1.2, 1.6],
      speedRange: [220, 260],
      startScale: 0.35,
      peakScale: 0.9,
      finalScale: 1.4,
      lifetimeMultiplier: 2,
      spinSpeedRange: [-1.2, 1.2],
    },
  },
  {
    key: 'superwin',
    threshold: 45,
    labelScale: 1.8,
    amountSpeed: 2.4,
    coinConfig: { maxCoins: 72, spawnRange: [0.15, 0.28] },
    showIcons: true,
    bannerKey: 'superwin',
    bannerConfig: {
      backFlipDuration: 0.75,
      backHoldDuration: 0.8,
      frontEnterDuration: 0.7,
      frontSpinSpeed: Math.PI / 5,
      frontStartScale: 0.45,
      frontFadeDuration: 0.85,
      frontFadeScale: 1.6,
      fadeOutSpinSpeed: Math.PI / 1.6,
    },
    rippleConfig: {
      intervalRange: [1.1, 1.6],
      radiusRange: [160, 230],
      durationRange: [1.6, 2],
      lineWidthRange: [9, 5],
    },
    iconConfig: {
      burstCount: 14,
      burstIntervalRange: [0.6, 0.95],
      speedRange: [320, 380],
      startScale: 0.45,
      peakScale: 1.15,
      finalScale: 1.8,
      lifetimeMultiplier: 2.5,
      spinSpeedRange: [-2.1, 2.1],
    },
  },
  {
    key: 'megawin',
    threshold: 100,
    labelScale: 2.2,
    amountSpeed: 4,
    coinConfig: { maxCoins: 96, spawnRange: [0.08, 0.16] },
    showIcons: true,
    bannerKey: 'megawin',
    bannerConfig: {
      backFlipDuration: 0.65,
      backHoldDuration: 0.65,
      frontEnterDuration: 0.55,
      frontSpinSpeed: Math.PI / 4,
      frontStartScale: 0.5,
      frontFadeDuration: 0.9,
      frontFadeScale: 1.75,
      fadeOutSpinSpeed: Math.PI / 1.2,
    },
    rippleConfig: {
      intervalRange: [0.8, 1.2],
      radiusRange: [180, 260],
      durationRange: [1.4, 1.8],
      lineWidthRange: [8, 4],
    },
    iconConfig: {
      burstCount: 22,
      burstIntervalRange: [0.45, 0.7],
      speedRange: [360, 440],
      startScale: 0.5,
      peakScale: 1.3,
      finalScale: 2.1,
      lifetimeMultiplier: 2.8,
      spinSpeedRange: [-2.6, 2.6],
    },
  },
];

type PhaseVisualMap = Record<PhaseWithBanner, BannerVisual>;

export class ComplexStage {
  private readonly options: ComplexStageOptions;
  private readonly app: Application;
  private readonly baseLayer: Container;
  private readonly fxLayer: Container;
  private readonly uiLayer: Container;
  private readonly phaseBackLayer: Container;
  private readonly phaseFrontLayer: Container;
  private bounds: Bounds;
  private debugOverlay: HTMLDivElement | null = null;
  private readonly sprites: Map<CoreSpriteKey, Sprite> = new Map();
  private readonly iconTextures: Texture[] = [];
  private phaseVisuals: PhaseVisualMap | null = null;
  private iconsContainer: Container | null = null;
  private amountLabel: Text | null = null;
  private coinEmitter: CoinEmitter | null = null;
  private iconEmitter: IconBurstEmitter | null = null;
  private bannerAnimator: BannerAnimator | null = null;
  private rippleEmitter: RippleEmitter | null = null;
  private demonSprite: Sprite | null = null;
  private elapsed = 0;
  private currentPhase: StagePhase = 'normal';
  private currentAmount = 0;
  private readonly targetAmount: number;

  constructor(options: ComplexStageOptions = {}) {
    this.options = options;
    this.app = new Application();
    this.baseLayer = new Container();
    this.baseLayer.sortableChildren = true;
    this.fxLayer = new Container();
    this.fxLayer.sortableChildren = true;
    this.uiLayer = new Container();
    this.phaseBackLayer = new Container();
    this.phaseBackLayer.sortableChildren = true;
    this.phaseFrontLayer = new Container();
    this.phaseFrontLayer.sortableChildren = true;
    this.bounds = {
      width: options.initialWidth ?? Math.min(window.innerWidth, 1280),
      height: options.initialHeight ?? Math.min(window.innerHeight, 720),
    };
    this.targetAmount = options.targetAmount ?? DEFAULT_TARGET_AMOUNT;
  }

  async init(): Promise<void> {
    await this.app.init({
      background: this.options.backgroundColor ?? 0x060f24,
      width: this.bounds.width,
      height: this.bounds.height,
      antialias: true,
      autoDensity: true,
      resolution: this.options.pixelRatio ?? Math.min(window.devicePixelRatio, 2),
    });

    this.app.stage.sortableChildren = true;
    this.app.stage.addChild(this.baseLayer, this.fxLayer, this.uiLayer);

    await this.loadAssets();
    this.composeScene();
    this.applyPhase(this.currentPhase);
  }

  mount(host: HTMLElement): void {
    host.appendChild(this.app.canvas);

    if (this.options.showDebugOverlay !== false) {
      const overlay = document.createElement('div');
      overlay.className = 'debug-overlay';
      overlay.textContent = 'phase: normal';
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
    this.rippleEmitter?.destroy();
    this.rippleEmitter = null;
  }

  private async loadAssets(): Promise<void> {
    const textures = Object.fromEntries(
      await Promise.all(
        Object.entries(manifest).map(async ([alias, src]) => {
          const texture = await Assets.load(src);
          return [alias, texture] as const;
        }),
      ),
    ) as Record<ManifestKey, Texture>;

    const createSprite = (key: ManifestKey): Sprite => {
      const sprite = new Sprite(textures[key]);
      sprite.anchor.set(0.5);
      (sprite as Sprite & { label?: string }).label = key;
      return sprite;
    };

    this.sprites.set('demon', createSprite('demon'));
    this.sprites.set('coin', createSprite('coin'));

    const createBannerFront = (label: string, radius: number, repetitions: number): Container => {
      const container = new Container();

      const innerGlow = new Graphics();
      innerGlow.circle(0, 0, radius * 0.62);
      innerGlow.stroke({ width: 6, color: 0xffd873, alpha: 0.35 });
      container.addChild(innerGlow);

      const repeatedLabel = Array.from({ length: repetitions }, () => label.toUpperCase()).join(
        ' ',
      );
      const tokens = repeatedLabel.split('');
      const total = tokens.length;
      const letters: Text[] = [];
      tokens.forEach((char, index) => {
        const gradient = new FillGradient(0, -radius, 0, radius);
        gradient.addColorStop(0, 0xfff9c7);
        gradient.addColorStop(0.65, 0xffd27a);
        gradient.addColorStop(1, 0xffa51f);

        const text = new Text({
          text: char,
          style: {
            fontFamily: 'Lilita One, system-ui',
            fontSize: 72,
            fontWeight: '700',
            fill: gradient,
            stroke: { color: 0x5f2300, width: 8, join: 'round' },
            dropShadow: { color: 0x2e0f00, blur: 4, distance: 0, alpha: 0.6 },
            letterSpacing: 2,
          },
        });
        text.anchor.set(0.5);
        const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
        text.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius);
        text.rotation = angle + Math.PI / 2;
        container.addChild(text);
        letters.push(text);
      });

      container.cursor = 'pointer';
      (container as unknown as { letters?: Text[] }).letters = letters;

      return container;
    };

    const phaseVisuals: PhaseVisualMap = {
      bigwin: {
        back: createSprite('bigwinBack'),
        front: createBannerFront('BIG WIN! YUMMI!', 382, 3),
      },
      superwin: {
        back: createSprite('superwinBack'),
        front: createBannerFront('SUPER WIN! TASTY!', 405, 3),
      },
      megawin: {
        back: createSprite('megawinBack'),
        front: createBannerFront('MEGA WIN! DELICIOUS!', 428, 3),
      },
    };

    Object.values(phaseVisuals).forEach(({ back, front }) => {
      if (back) {
        back.alpha = 0.9;
        back.visible = false;
        back.scale.x = 0;
        back.scale.y = 1;
      }
      front.alpha = 0;
      front.visible = false;
    });

    this.phaseVisuals = phaseVisuals;

    ICON_KEYS.forEach((iconKey) => {
      this.iconTextures.push(textures[iconKey]);
    });
  }

  private composeScene(): void {
    if (!this.phaseVisuals) {
      throw new Error('Phase visuals not initialised');
    }

    const demon = this.getSprite('demon');
    demon.y = -18;
    demon.zIndex = 25;
    this.demonSprite = demon;

    this.phaseBackLayer.zIndex = 1;
    this.phaseFrontLayer.zIndex = 20;

    Object.values(this.phaseVisuals).forEach(({ back, front }) => {
      if (back) {
        back.visible = false;
        back.zIndex = 1;
        this.phaseBackLayer.addChild(back);
      }
      front.visible = false;
      front.zIndex = 30;
      this.phaseFrontLayer.addChild(front);
    });

    this.baseLayer.addChild(this.phaseBackLayer);
    this.baseLayer.addChild(demon);
    this.baseLayer.addChild(this.phaseFrontLayer);

    const iconsContainer = new Container();
    iconsContainer.visible = false;
    iconsContainer.zIndex = 24;
    iconsContainer.sortableChildren = true;
    this.baseLayer.addChild(iconsContainer);
    this.iconsContainer = iconsContainer;

    this.iconEmitter = new IconBurstEmitter({
      container: iconsContainer,
      textures: this.iconTextures,
      colorPalette: ICON_COLORS,
    });

    const rippleContainer = new Container();
    rippleContainer.zIndex = 26;
    rippleContainer.sortableChildren = true;
    this.fxLayer.addChild(rippleContainer);

    const coinsContainer = new Container();
    coinsContainer.sortableChildren = true;
    coinsContainer.zIndex = 28;
    this.fxLayer.addChild(coinsContainer);

    this.coinEmitter = new CoinEmitter({
      container: coinsContainer,
      coinTexture: this.getSprite('coin').texture,
      demonSprite: demon,
      maxCoins: MAX_ACTIVE_COINS,
      bounds: this.bounds,
    });

    this.rippleEmitter = new RippleEmitter({
      container: rippleContainer,
      color: RIPPLE_COLOR,
    });
    this.rippleEmitter.setBounds(this.bounds);

    const amount = new Text({
      text: '0.00',
      style: {
        fontFamily: 'Lilita One, system-ui',
        fontSize: 110,
        fill: 0xfff4a8,
        stroke: { color: 0x671b00, width: 14, join: 'round' },
        dropShadow: {
          color: 0xffa94c,
          blur: 8,
          distance: 0,
        },
      },
    });
    amount.anchor.set(0.5);
    amount.zIndex = 40;
    this.uiLayer.addChild(amount);
    this.amountLabel = amount;

    if (this.phaseVisuals) {
      const bannerConfigs: Partial<Record<PhaseWithBanner, BannerPhaseConfig>> = {};
      PHASE_SETTINGS.forEach((setting) => {
        if (setting.bannerKey && setting.bannerConfig) {
          bannerConfigs[setting.bannerKey] = setting.bannerConfig;
        }
      });

      this.bannerAnimator = new BannerAnimator({
        visuals: this.phaseVisuals,
        configs: bannerConfigs,
      });
      this.bannerAnimator.setPhase(this.currentPhase);
    }

    this.positionComponents();
  }

  private positionComponents(): void {
    const centerX = this.bounds.width / 2;
    const centerY = this.bounds.height / 2;

    this.baseLayer.position.set(centerX, centerY);
    this.fxLayer.position.set(centerX, centerY);
    this.uiLayer.position.set(centerX, centerY);

    if (this.amountLabel) {
      const demon = this.demonSprite;
      if (demon) {
        const labelHeight = this.amountLabel.height;
        const footY = demon.y + demon.height * 0.5 + labelHeight * 0.3;
        this.amountLabel.position.set(0, footY);
      } else {
        this.amountLabel.position.set(0, this.bounds.height * -0.04);
      }
    }

    this.coinEmitter?.setBounds(this.bounds);
    this.iconEmitter?.setRadius(this.getIconRadius());
    this.rippleEmitter?.setBounds(this.bounds);
  }

  private handleTick(ticker: Ticker): void {
    const deltaSeconds = ticker.deltaMS / 1000;
    this.elapsed += deltaSeconds;

    this.updateAmount(deltaSeconds);

    if (this.debugOverlay) {
      this.debugOverlay.textContent = `phase: ${this.currentPhase}\namount: ${this.currentAmount.toFixed(
        2,
      )}\nfps: ${this.app.ticker.FPS.toFixed(1)}`;
    }

    this.bannerAnimator?.update(deltaSeconds);
    this.iconEmitter?.update(deltaSeconds);
    this.rippleEmitter?.update(deltaSeconds);
    this.coinEmitter?.update(deltaSeconds);
  }

  private updateAmount(deltaSeconds: number): void {
    const phaseBeforeUpdate = this.resolvePhase(this.currentAmount);
    if (phaseBeforeUpdate !== this.currentPhase) {
      this.applyPhase(phaseBeforeUpdate);
    }

    const settings = this.getPhaseSettings(this.currentPhase);

    if (this.currentAmount < this.targetAmount) {
      this.currentAmount = Math.min(
        this.targetAmount,
        this.currentAmount + settings.amountSpeed * deltaSeconds,
      );
    }

    const phaseAfterUpdate = this.resolvePhase(this.currentAmount);
    if (phaseAfterUpdate !== this.currentPhase) {
      this.applyPhase(phaseAfterUpdate);
    }

    if (this.amountLabel) {
      this.amountLabel.text = this.currentAmount.toFixed(2);
    }
  }

  private resolvePhase(amount: number): StagePhase {
    let resolved: StagePhase = 'normal';
    for (const phase of PHASE_SETTINGS) {
      if (amount >= phase.threshold) {
        resolved = phase.key;
      } else {
        break;
      }
    }
    return resolved;
  }

  private getPhaseSettings(phase: StagePhase): PhaseSettings {
    const settings = PHASE_SETTINGS.find((entry) => entry.key === phase);
    if (!settings) {
      throw new Error(`Unable to resolve settings for phase "${phase}"`);
    }
    return settings;
  }

  private applyPhase(phase: StagePhase): void {
    this.currentPhase = phase;
    const settings = this.getPhaseSettings(phase);

    if (this.amountLabel) {
      this.amountLabel.scale.set(settings.labelScale);
    }

    const iconConfig = settings.iconConfig;
    const enableIcons = Boolean(iconConfig) && settings.showIcons;

    if (this.iconsContainer) {
      this.iconsContainer.visible = enableIcons;
    }

    this.bannerAnimator?.setPhase(phase);

    this.coinEmitter?.configure({
      maxCoins: settings.coinConfig.maxCoins,
      spawnIntervalRange: settings.coinConfig.spawnRange,
    });

    if (iconConfig && this.iconEmitter) {
      this.iconEmitter.activate({
        ...iconConfig,
        radius: this.getIconRadius(),
      });
    } else {
      this.iconEmitter?.deactivate();
    }

    if (settings.rippleConfig && this.rippleEmitter) {
      this.rippleEmitter.activate(settings.rippleConfig);
    } else {
      this.rippleEmitter?.deactivate();
    }

    this.positionComponents();
  }

  private getIconRadius(): number {
    return Math.min(this.bounds.width, this.bounds.height) * 0.35;
  }

  private getSprite(key: CoreSpriteKey): Sprite {
    const sprite = this.sprites.get(key);
    if (!sprite) {
      throw new Error(`Sprite with key "${key}" was not loaded.`);
    }
    return sprite;
  }
}

interface BannerAnimatorOptions {
  visuals: PhaseVisualMap;
  configs: Partial<Record<PhaseWithBanner, BannerPhaseConfig>>;
}

type BannerBackStage =
  | 'inactive'
  | 'toPositive'
  | 'holdPositive'
  | 'toZeroPositive'
  | 'toNegative'
  | 'toZeroNegative';
type BannerFrontStage = 'inactive' | 'enter' | 'spin' | 'fade';

interface RequiredBannerConfig {
  backFlipDuration: number;
  backHoldDuration: number;
  frontEnterDuration: number;
  frontSpinSpeed: number;
  frontStartScale: number;
  frontFadeDuration: number;
  frontFadeScale: number;
  fadeOutSpinSpeed: number;
}

interface BannerState {
  visual: BannerVisual;
  config: RequiredBannerConfig;
  active: boolean;
  backStage: BannerBackStage;
  backTimer: number;
  backScale: number;
  frontStage: BannerFrontStage;
  frontTimer: number;
  frontScale: number;
  fadeStartScale: number;
  pulseTimer: number;
  pulseIndex: number;
  pulseLetters: Text[];
}

class BannerAnimator {
  private readonly visuals: PhaseVisualMap;

  private readonly configs: Partial<Record<PhaseWithBanner, BannerPhaseConfig>>;

  private readonly states: Partial<Record<PhaseWithBanner, BannerState>>;

  private readonly orderLookup: Record<StagePhase, number>;

  private currentPhase: StagePhase = 'normal';

  private static readonly DEFAULT_CONFIG: RequiredBannerConfig = {
    backFlipDuration: 0.8,
    backHoldDuration: 1,
    frontEnterDuration: 0.8,
    frontSpinSpeed: Math.PI / 6,
    frontStartScale: 0.4,
    frontFadeDuration: 0.8,
    frontFadeScale: 1.4,
    fadeOutSpinSpeed: Math.PI / 2,
  };

  constructor({ visuals, configs }: BannerAnimatorOptions) {
    this.visuals = visuals;
    this.configs = configs;
    this.orderLookup = PHASE_ORDER.reduce<Record<StagePhase, number>>(
      (lookup, phase, index) => {
        lookup[phase] = index;
        return lookup;
      },
      {} as Record<StagePhase, number>,
    );

    this.states = {} as Partial<Record<PhaseWithBanner, BannerState>>;

    (Object.keys(this.visuals) as PhaseWithBanner[]).forEach((phaseKey) => {
      const config = this.resolveConfig(phaseKey);
      const state: BannerState = {
        visual: this.visuals[phaseKey],
        config,
        active: false,
        backStage: 'inactive',
        backTimer: 0,
        backScale: 0,
        frontStage: 'inactive',
        frontTimer: 0,
        frontScale: config.frontStartScale,
        fadeStartScale: config.frontStartScale,
        pulseTimer: 0,
        pulseIndex: 0,
        pulseLetters: this.extractLetters(this.visuals[phaseKey].front),
      };

      this.states[phaseKey] = state;
      this.resetState(state);
    });
  }

  private extractLetters(display: BannerDisplay): Text[] {
    if ('letters' in display && Array.isArray((display as { letters?: unknown }).letters)) {
      return ((display as { letters?: Text[] }).letters ?? []).map((text) => text);
    }
    const letters: Text[] = [];
    if (display instanceof Container) {
      display.children.forEach((child) => {
        if (child instanceof Text) {
          letters.push(child);
        } else if (child instanceof Container) {
          letters.push(...this.extractLetters(child as BannerDisplay));
        }
      });
    }
    return letters;
  }

  setPhase(phase: StagePhase): void {
    const newOrder = this.orderLookup[phase];

    (Object.entries(this.states) as [PhaseWithBanner, BannerState][]).forEach(([key, state]) => {
      if (!state) {
        return;
      }

      const stateOrder = this.orderLookup[key];

      if (phase === key) {
        if (state.frontStage === 'enter' || state.frontStage === 'spin') {
          state.active = true;
          return;
        }
        this.activateState(state);
        return;
      }

      if (state.frontStage === 'fade') {
        return;
      }

      if (state.frontStage === 'enter' || state.frontStage === 'spin' || state.active) {
        if (newOrder > stateOrder) {
          this.startFadeOut(state);
        } else {
          this.resetState(state);
        }
      } else if (state.frontStage !== 'inactive') {
        this.resetState(state);
      }
    });

    this.currentPhase = phase;
  }

  update(dt: number): void {
    (Object.values(this.states) as BannerState[]).forEach((state) => {
      if (!state) {
        return;
      }
      this.updateBack(state, dt);
      this.updateFront(state, dt);
    });

    (Object.values(this.states) as BannerState[]).forEach((state) => {
      if (!state) {
        return;
      }
      this.updatePulse(state, dt);
    });
  }

  private resolveConfig(phase: PhaseWithBanner): RequiredBannerConfig {
    const overrides = (this.configs[phase] ?? {}) as Partial<BannerPhaseConfig>;
    return {
      ...BannerAnimator.DEFAULT_CONFIG,
      ...overrides,
      frontFadeDuration:
        overrides.frontFadeDuration ?? BannerAnimator.DEFAULT_CONFIG.frontFadeDuration,
      frontFadeScale: overrides.frontFadeScale ?? BannerAnimator.DEFAULT_CONFIG.frontFadeScale,
      fadeOutSpinSpeed:
        overrides.fadeOutSpinSpeed ?? BannerAnimator.DEFAULT_CONFIG.fadeOutSpinSpeed,
    };
  }

  private activateState(state: BannerState): void {
    this.resetState(state);
    state.active = true;
    const { visual, config } = state;

    state.frontStage = 'enter';
    state.frontTimer = 0;
    state.frontScale = config.frontStartScale;
    state.fadeStartScale = config.frontStartScale;

    visual.front.visible = true;
    visual.front.alpha = 1;
    visual.front.rotation = 0;
    visual.front.scale.set(state.frontScale);

    if (visual.back) {
      visual.back.visible = true;
      visual.back.alpha = 1;
      visual.back.scale.x = 0;
      visual.back.scale.y = 1;
      state.backScale = 0;
      state.backStage = 'toPositive';
      state.backTimer = 0;
    } else {
      state.backStage = 'inactive';
    }
  }

  private resetState(state: BannerState): void {
    const { visual, config } = state;
    state.active = false;
    state.backStage = 'inactive';
    state.backTimer = 0;
    state.backScale = 0;
    if (visual.back) {
      visual.back.visible = false;
      visual.back.alpha = 0.9;
      visual.back.scale.x = 0;
      visual.back.scale.y = 1;
    }

    state.frontStage = 'inactive';
    state.frontTimer = 0;
    state.frontScale = config.frontStartScale;
    state.fadeStartScale = config.frontStartScale;
    state.pulseTimer = 0;
    state.pulseIndex = 0;
    visual.front.visible = false;
    visual.front.alpha = 0;
    visual.front.rotation = 0;
    visual.front.scale.set(config.frontStartScale);
    state.pulseLetters.forEach((letter) => letter.scale.set(1));
  }

  private startFadeOut(state: BannerState): void {
    if (state.frontStage === 'fade') {
      return;
    }

    const { visual } = state;
    state.active = false;
    state.backStage = 'inactive';
    state.backTimer = 0;
    state.backScale = 0;
    if (visual.back) {
      visual.back.visible = false;
      visual.back.scale.x = 0;
      visual.back.scale.y = 1;
    }

    state.frontStage = 'fade';
    state.frontTimer = 0;
    state.fadeStartScale = visual.front.scale.x;
    state.pulseTimer = 0;
    visual.front.visible = true;
    if (visual.front.alpha <= 0) {
      visual.front.alpha = 1;
    }
    state.pulseLetters.forEach((letter) => letter.scale.set(1));
  }

  private updateBack(state: BannerState, dt: number): void {
    const { visual, config } = state;
    const back = visual.back;
    if (!back) {
      return;
    }

    if (state.backStage === 'inactive') {
      back.visible = false;
      return;
    }

    back.visible = true;
    back.alpha = 1;

    state.backTimer += dt;

    const duration = config.backFlipDuration;

    switch (state.backStage) {
      case 'toPositive': {
        const progress = Math.min(state.backTimer / duration, 1);
        state.backScale = progress;
        if (progress >= 1) {
          state.backScale = 1;
          state.backStage = 'holdPositive';
          state.backTimer = 0;
        }
        break;
      }
      case 'holdPositive': {
        state.backScale = 1;
        if (state.backTimer >= config.backHoldDuration) {
          state.backStage = 'toZeroPositive';
          state.backTimer = 0;
        }
        break;
      }
      case 'toZeroPositive': {
        const progress = Math.min(state.backTimer / duration, 1);
        state.backScale = 1 - progress;
        if (progress >= 1) {
          state.backScale = 0;
          state.backStage = 'toNegative';
          state.backTimer = 0;
        }
        break;
      }
      case 'toNegative': {
        const progress = Math.min(state.backTimer / duration, 1);
        state.backScale = -progress;
        if (progress >= 1) {
          state.backScale = -1;
          state.backStage = 'toZeroNegative';
          state.backTimer = 0;
        }
        break;
      }
      case 'toZeroNegative': {
        const progress = Math.min(state.backTimer / duration, 1);
        state.backScale = -1 + progress;
        if (progress >= 1) {
          state.backScale = 0;
          state.backStage = 'toPositive';
          state.backTimer = 0;
        }
        break;
      }
      default:
        break;
    }

    back.scale.x = state.backScale;
    back.scale.y = Math.abs(back.scale.y) || 1;
  }

  private updateFront(state: BannerState, dt: number): void {
    const { visual, config } = state;
    const front = visual.front;

    switch (state.frontStage) {
      case 'enter': {
        state.frontTimer += dt;
        const progress = Math.min(state.frontTimer / config.frontEnterDuration, 1);
        state.frontScale = config.frontStartScale + (1 - config.frontStartScale) * progress;
        front.scale.set(state.frontScale);
        front.visible = true;
        front.alpha = 1;
        if (progress >= 1) {
          state.frontStage = 'spin';
          state.frontTimer = 0;
          state.frontScale = 1;
          front.scale.set(1);
        }
        break;
      }
      case 'spin': {
        front.visible = true;
        front.alpha = 1;
        front.rotation += config.frontSpinSpeed * dt;
        break;
      }
      case 'fade': {
        state.frontTimer += dt;
        const progress = Math.min(state.frontTimer / config.frontFadeDuration, 1);
        const scale =
          state.fadeStartScale + (config.frontFadeScale - state.fadeStartScale) * progress;
        front.scale.set(scale);
        front.rotation += config.fadeOutSpinSpeed * dt;
        front.alpha = Math.max(0, 1 - progress);
        front.visible = front.alpha > 0;
        if (progress >= 1) {
          this.resetState(state);
        }
        break;
      }
      default:
        break;
    }
  }

  private updatePulse(state: BannerState, dt: number): void {
    if (!state.active || state.pulseLetters.length === 0) {
      return;
    }

    const pulseDuration = 0.09;
    const holdDuration = 0.04;
    const cycleDuration = pulseDuration * 2 + holdDuration;

    state.pulseTimer += dt;

    if (state.pulseTimer >= cycleDuration) {
      this.resetLetterScale(state.pulseLetters[state.pulseIndex]);
      state.pulseTimer -= cycleDuration;
      state.pulseIndex = (state.pulseIndex + 1) % state.pulseLetters.length;
    }

    const letter = state.pulseLetters[state.pulseIndex];
    if (!letter) {
      return;
    }

    const localTime = state.pulseTimer;

    if (localTime <= pulseDuration) {
      const t = localTime / pulseDuration;
      const scale = 1 + t * 3;
      letter.scale.set(scale);
    } else if (localTime <= pulseDuration + holdDuration) {
      letter.scale.set(4);
    } else {
      const t = (localTime - pulseDuration - holdDuration) / pulseDuration;
      const scale = 4 - t * 3;
      letter.scale.set(scale);
    }
  }

  private resetLetterScale(letter: Text | undefined): void {
    if (!letter) {
      return;
    }
    letter.scale.set(1);
  }
}

interface RippleEmitterOptions {
  container: Container;
  color: number;
}

interface RippleParticle {
  graphic: Graphics;
  elapsed: number;
  duration: number;
  startRadius: number;
  endRadius: number;
  startLineWidth: number;
  endLineWidth: number;
}

class RippleEmitter {
  private readonly container: Container;

  private readonly color: number;

  private readonly ripples: RippleParticle[] = [];

  private config: RipplePhaseConfig | null = null;

  private timer = 0;

  private nextSpawnIn = 0;

  private active = false;

  private bounds: Bounds = { width: 0, height: 0 };

  constructor({ container, color }: RippleEmitterOptions) {
    this.container = container;
    this.color = color;
  }

  setBounds(bounds: Bounds): void {
    this.bounds = bounds;
  }

  activate(config: RipplePhaseConfig): void {
    this.config = config;
    this.active = true;
    this.timer = 0;
    this.clearRipples();
    this.scheduleNext();
    this.spawnRipple();
    this.scheduleNext();
  }

  deactivate(): void {
    this.active = false;
    this.config = null;
    this.timer = 0;
    this.nextSpawnIn = 0;
    this.clearRipples();
  }

  update(dt: number): void {
    if (this.active && this.config) {
      this.timer += dt;
      while (this.timer >= this.nextSpawnIn) {
        this.timer -= this.nextSpawnIn;
        this.spawnRipple();
        this.scheduleNext();
      }
    }

    for (let index = this.ripples.length - 1; index >= 0; index -= 1) {
      const ripple = this.ripples[index];
      ripple.elapsed += dt;

      const progress = Math.min(ripple.elapsed / ripple.duration, 1);
      const radius = ripple.startRadius + (ripple.endRadius - ripple.startRadius) * progress;
      const lineWidth =
        ripple.startLineWidth + (ripple.endLineWidth - ripple.startLineWidth) * progress;
      const alpha = RIPPLE_ALPHA_START + (RIPPLE_ALPHA_END - RIPPLE_ALPHA_START) * progress;

      ripple.graphic.clear();
      ripple.graphic.circle(0, 0, radius);
      ripple.graphic.stroke({ width: lineWidth, color: this.color, alpha: Math.max(0, alpha) });

      if (progress >= 1) {
        this.removeRippleAt(index);
      }
    }

    this.container.visible = this.active || this.ripples.length > 0;
  }

  destroy(): void {
    this.clearRipples();
    this.container.destroy({ children: true });
  }

  private spawnRipple(): void {
    if (!this.config) {
      return;
    }

    const { radiusRange, durationRange, lineWidthRange } = this.config;

    const stageMaxDimension = Math.max(this.bounds.width, this.bounds.height);
    const minStageRadius = stageMaxDimension * 0.6;
    const endRadius = Math.max(randomFloat(radiusRange[0], radiusRange[1]), minStageRadius);
    const startRadius = endRadius * 0.35;
    const duration = randomFloat(durationRange[0], durationRange[1]);
    const startLineWidth = lineWidthRange[0];
    const endLineWidth = lineWidthRange[1];

    const graphic = new Graphics();
    graphic.position.set(0, 0);
    graphic.circle(0, 0, startRadius);
    graphic.stroke({ width: startLineWidth, color: this.color, alpha: RIPPLE_ALPHA_START });
    this.container.addChild(graphic);

    const ripple: RippleParticle = {
      graphic,
      elapsed: 0,
      duration,
      startRadius,
      endRadius,
      startLineWidth,
      endLineWidth,
    };

    this.ripples.push(ripple);
  }

  private scheduleNext(): void {
    if (!this.config) {
      this.nextSpawnIn = 0;
      return;
    }
    const [minInterval, maxInterval] = this.config.intervalRange;
    this.nextSpawnIn = randomFloat(minInterval, maxInterval);
  }

  private removeRippleAt(index: number): void {
    const [ripple] = this.ripples.splice(index, 1);
    ripple.graphic.destroy();
  }

  private clearRipples(): void {
    this.ripples.forEach((ripple) => ripple.graphic.destroy());
    this.ripples.length = 0;
  }
}
