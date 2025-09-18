import { Application, Container, Ticker } from 'pixi.js';
import { OrbitingSpriteSystem } from '../animations/OrbitingSpriteSystem';
import { TrailField } from '../animations/TrailField';

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

export class ComplexStage {
  private readonly options: ComplexStageOptions;
  private readonly app: Application;
  private readonly sceneLayer: Container;
  private readonly fxLayer: Container;
  private bounds: Bounds;
  private orbitSystem: OrbitingSpriteSystem | null = null;
  private trailField: TrailField | null = null;
  private debugOverlay: HTMLDivElement | null = null;
  private elapsedSeconds = 0;

  constructor(options: ComplexStageOptions = {}) {
    this.options = options;
    this.app = new Application();
    this.sceneLayer = new Container();
    this.fxLayer = new Container();
    this.bounds = {
      width: options.initialWidth ?? Math.min(window.innerWidth, 1280),
      height: options.initialHeight ?? Math.min(window.innerHeight, 720)
    };
  }

  async init(): Promise<void> {
    await this.app.init({
      background: this.options.backgroundColor ?? 0x050913,
      width: this.bounds.width,
      height: this.bounds.height,
      antialias: true,
      autoDensity: true,
      resolution: this.options.pixelRatio ?? Math.min(window.devicePixelRatio, 2)
    });

    this.app.stage.addChild(this.sceneLayer, this.fxLayer);

    this.orbitSystem = new OrbitingSpriteSystem({
      bounds: { ...this.bounds },
      spriteCount: 28
    });
    this.sceneLayer.addChild(this.orbitSystem.view);

    this.trailField = new TrailField({
      bounds: { ...this.bounds },
      trailCount: 20
    });
    this.fxLayer.addChild(this.trailField.view);

    this.app.ticker.add(this.handleTick, this);
  }

  mount(host: HTMLElement): void {
    host.appendChild(this.app.canvas);

    if (this.options.showDebugOverlay !== false) {
      const overlay = document.createElement('div');
      overlay.className = 'debug-overlay';
      overlay.textContent = 'initialising...';
      host.appendChild(overlay);
      this.debugOverlay = overlay;
    }
  }

  start(): void {
    this.app.ticker.start();
  }

  stop(): void {
    this.app.ticker.stop();
  }

  resize(width: number, height: number): void {
    this.bounds = { width, height };
    this.app.renderer.resize({ width, height });
    this.orbitSystem?.resize(width, height);
    this.trailField?.resize(width, height);
  }

  destroy(): void {
    this.app.ticker.remove(this.handleTick, this);
    this.app.destroy();
    this.debugOverlay?.remove();
    this.debugOverlay = null;
  }

  private handleTick(ticker: Ticker): void {
    const deltaSeconds = ticker.deltaMS / 1000;
    this.elapsedSeconds += deltaSeconds;

    this.orbitSystem?.update(this.elapsedSeconds, deltaSeconds);
    this.trailField?.update(this.elapsedSeconds, deltaSeconds);

    if (this.debugOverlay) {
      const fps = ticker.FPS.toFixed(1);
      const orbiting = this.orbitSystem?.count ?? 0;
      const trails = this.trailField?.activeCount ?? 0;
      this.debugOverlay.textContent = `fps: ${fps}\norbiters: ${orbiting}\ntrailed sprites: ${trails}`;
    }
  }
}
