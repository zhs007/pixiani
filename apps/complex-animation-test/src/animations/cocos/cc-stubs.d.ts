declare module 'cc' {
  export class Node {
    position: Vec3;
    parent: Node | null;
    eulerAngles: Vec3;
    active: boolean;
    getPosition(): Vec3;
    setPosition(position: Vec3): void;
    setPosition(x: number, y?: number, z?: number): void;
    setScale(x: number, y?: number, z?: number): void;
    setRotationFromEuler(x: number, y: number, z: number): void;
    getComponent<T>(type: new () => T): T | null;
    addComponent<T>(type: new () => T): T;
    destroy(): void;
  }

  export class Prefab {}

  export function instantiate<T = Node>(prefab: Prefab): T;

  export class UIOpacity {
    opacity: number;
  }

  export class UITransform {
    width: number;
    height: number;
  }

  export class Vec3 {
    static ZERO: Vec3;
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
  }

  export class Color {
    constructor(r?: number, g?: number, b?: number, a?: number);
    r: number;
    g: number;
    b: number;
    a: number;
    fromHEX(hex: number): Color;
  }

  export class Sprite {
    color: Color;
  }
}
