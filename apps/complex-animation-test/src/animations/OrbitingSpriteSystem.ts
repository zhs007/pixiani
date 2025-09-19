import { Container, Point, Sprite, Texture } from 'pixi.js';
import { randomFloat } from '../utils/random';

interface Bounds {
  width: number;
  height: number;
}

interface OrbitingSpriteProps {
  sprite: Sprite;
  radiusRatio: number;
  verticalScale: number;
  angularVelocity: number;
  phaseOffset: number;
  wobbleFrequency: number;
  driftAmplitude: number;
  driftFrequency: number;
}

export interface OrbitingSpriteSystemOptions {
  bounds: Bounds;
  spriteCount?: number;
}

export class OrbitingSpriteSystem {
  readonly view: Container;
  private readonly sprites: OrbitingSpriteProps[];
  private readonly colors: number[] = [0x4fd1ff, 0x9a6bff, 0xff7ce5, 0x47f4be];
  private readonly baseRadius: number;
  private center: Point;

  constructor(options: OrbitingSpriteSystemOptions) {
    this.view = new Container();
    this.view.sortableChildren = true;
    this.center = new Point(options.bounds.width / 2, options.bounds.height / 2);
    this.baseRadius = Math.min(options.bounds.width, options.bounds.height) * 0.42;
    const spriteCount = options.spriteCount ?? 24;

    this.sprites = Array.from({ length: spriteCount }, (_, index) => {
      const sprite = new Sprite(Texture.WHITE);
      sprite.anchor.set(0.5);
      sprite.width = randomFloat(16, 48);
      sprite.height = sprite.width;
      sprite.alpha = randomFloat(0.55, 0.9);
      sprite.tint = this.colors[index % this.colors.length];
      sprite.blendMode = 'add';

      this.view.addChild(sprite);

      return {
        sprite,
        radiusRatio: randomFloat(0.35, 1),
        verticalScale: randomFloat(0.65, 1.2),
        angularVelocity: randomFloat(0.4, 0.9),
        phaseOffset: randomFloat(0, Math.PI * 2),
        wobbleFrequency: randomFloat(0.2, 1.2),
        driftAmplitude: randomFloat(6, 28),
        driftFrequency: randomFloat(0.6, 1.5),
      } satisfies OrbitingSpriteProps;
    });
  }

  get count(): number {
    return this.sprites.length;
  }

  update(elapsedSeconds: number, _deltaSeconds: number): void {
    const radiusBase = this.currentRadiusBase();

    for (const props of this.sprites) {
      const angle = props.phaseOffset + elapsedSeconds * props.angularVelocity;
      const radius = radiusBase * props.radiusRatio;
      const drift = Math.sin(elapsedSeconds * props.driftFrequency) * props.driftAmplitude;

      props.sprite.x = this.center.x + Math.cos(angle) * radius;
      props.sprite.y = this.center.y + Math.sin(angle) * radius * props.verticalScale + drift;
      props.sprite.rotation = angle + Math.sin(elapsedSeconds * props.wobbleFrequency) * 0.35;
      props.sprite.zIndex = props.sprite.y;
    }
  }

  resize(width: number, height: number): void {
    this.center.set(width / 2, height / 2);
  }

  private currentRadiusBase(): number {
    return Math.min(this.center.x * 2, this.center.y * 2) * 0.84;
  }
}
