# Pixi.js Animation Library

A lightweight, extensible animation library built on top of Pixi.js for web game development.

## Features

- 🎯 **Extensible Architecture**: Easy to add new animation types
- ⚡ **Performance Optimized**: Built on Pixi.js for smooth animations
- 🧩 **Modular Design**: Clean separation between core components and animations
- 📦 **TypeScript Support**: Full type definitions included
- 🧪 **Test Coverage**: Comprehensive test suite with Vitest

## Installation

```bash
npm install pixi-animation-library
```

## Quick Start

```typescript
import { AnimationManager, BaseObject, ScaleAnimation } from 'pixi-animation-library';
import * as PIXI from 'pixi.js';

// Initialize Pixi.js application
const app = new PIXI.Application();
document.body.appendChild(app.view);

// Create animation manager
const animationManager = new AnimationManager();

// Register available animations
animationManager.register(ScaleAnimation);

// Create a game object
const gameObject = new BaseObject();
app.stage.addChild(gameObject);

// Add sprites to the game object
const sprite = PIXI.Sprite.from('sprite.png');
gameObject.addChild(sprite);

// Create and play a scale animation
const scaleAnim = animationManager.create('scale', gameObject, [sprite]);
if (scaleAnim) {
    scaleAnim.play();
}

// Update animations in the game loop
app.ticker.add((delta) => {
    animationManager.update(delta / 60); // Convert frames to seconds
});
```

## Core Concepts

### BaseObject

A `BaseObject` is a container that can host animations. It extends `PIXI.Container` and serves as the foundation for animated game objects.

### AnimationManager

The `AnimationManager` is responsible for:
- Registering animation classes
- Creating animation instances
- Managing global animation state
- Updating all active animations

### Animation Classes

Animation classes implement the `IAnimate` interface and provide specific animation behaviors. Current built-in animations:

- **ScaleAnimation**: Scales sprites with configurable parameters

## Creating Custom Animations

To create a custom animation, implement the `IAnimate` interface:

```typescript
import { AnimateClass, IAnimate, IBaseObject } from 'pixi-animation-library';
import * as PIXI from 'pixi.js';

export class MyCustomAnimation implements IAnimate {
    static readonly animationName = 'my-custom';
    
    static getRequiredSpriteCount(): number {
        return 1; // Number of sprites this animation requires
    }
    
    readonly name = MyCustomAnimation.animationName;
    readonly object: IBaseObject;
    readonly isPlaying: boolean = false;
    
    onComplete?: () => void;
    onRenderOrderChange?: RenderOrderCallback;
    
    constructor(object: IBaseObject, sprites: PIXI.Sprite[]) {
        this.object = object;
        // Initialize your animation state
    }
    
    play(): void {
        this.isPlaying = true;
        // Start animation logic
    }
    
    pause(): void {
        this.isPlaying = false;
        // Pause animation logic
    }
    
    stop(): void {
        this.isPlaying = false;
        // Reset animation state
    }
    
    update(deltaTime: number): void {
        if (!this.isPlaying) return;
        // Update animation state
    }
}

// Register your custom animation
animationManager.register(MyCustomAnimation);
```

## API Reference

### AnimationManager

- `register(animateClass: AnimateClass)`: Register an animation class
- `create(name: string, object: IBaseObject, sprites: PIXI.Sprite[])`: Create animation instance
- `pauseAll()`: Pause all active animations
- `resumeAll()`: Resume all paused animations
- `setSpeed(speed: number)`: Set global animation speed
- `update(deltaTime: number)`: Update all animations

### BaseObject

Extends `PIXI.Container` with animation hosting capabilities.

### IAnimate Interface

- `name`: Unique animation identifier
- `object`: Associated BaseObject
- `isPlaying`: Animation state
- `play()`: Start/resume animation
- `pause()`: Pause animation
- `stop()`: Stop and reset animation
- `update(deltaTime: number)`: Update animation state

## Development

### Building

```bash
npm run build        # Build both library and demo
npm run build:lib    # Build library only
npm run build:demo   # Build demo only
```

### Testing

```bash
npm test          # Run tests
npm run coverage  # Run tests with coverage
```

### Development Server

```bash
npm run dev  # Start development server for demo
```

## Demo

The project includes a demo in the `demo/` directory that showcases the animation library in action.

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## Dependencies

- [Pixi.js](https://pixijs.com/) - Graphics rendering engine
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Vite](https://vitejs.dev/) - Build tooling
- [Vitest](https://vitest.dev/) - Testing framework