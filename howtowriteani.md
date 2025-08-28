# How to Write a New Animation

This guide explains how to create a new animation class for the pixi-animation-library. We will use the existing `ScaleAnimation` as a reference.

## 1. File Location

All new animations should be placed in their own file inside the `src/animations/` directory. For example, if your animation is named "Glow", you would create a file named `src/animations/GlowAnimation.ts`.

## 2. Basic Structure

Every animation class must extend the `BaseAnimate` abstract class and implement its required methods.

Here is a basic template:

```typescript
import { BaseAnimate } from '../core/BaseAnimate';
import { AnimateClass } from '../core/types'; // Import necessary types

/**
 * @class YourAnimation
 * @extends BaseAnimate
 * @description A brief description of what your animation does.
 */
export class YourAnimation extends BaseAnimate {
  /**
   * The unique name for this animation class. This name is used by the
   * AnimationManager to register and create instances of your animation.
   * It should be unique among all animations.
   * @static
   * @type {string}
   */
  public static readonly animationName: string = 'YourAnimationName';

  /**
   * Specifies how many sprites this animation requires to function.
   * The BaseAnimate constructor will throw an error if the wrong number
   * of sprites is provided when creating the animation.
   * @static
   * @returns {number}
   */
  public static getRequiredSpriteCount(): number {
    // Return the number of sprites your animation needs (e.g., 1, 2, etc.)
    return 1;
  }

  // Private properties for managing state (e.g., duration, elapsed time)
  private readonly DURATION: number = 2.0; // seconds
  private elapsedTime: number = 0;

  /**
   * The core logic of your animation. This method is called by the
   * AnimationManager on every frame.
   * @param {number} deltaTime - The time elapsed since the last frame, in seconds.
   */
  public update(deltaTime: number): void {
    if (!this.isPlaying) {
      return;
    }

    this.elapsedTime += deltaTime;

    // Handle looping if the animation repeats
    if (this.elapsedTime >= this.DURATION) {
      this.elapsedTime %= this.DURATION; // Reset for next loop
    }

    // Access your sprites from the `this.sprites` array
    const sprite = this.sprites[0];

    // --- Your animation logic goes here ---
    // Modify sprite properties like scale, alpha, position, etc.
    // For example, to change opacity (alpha):
    // const progress = this.elapsedTime / this.DURATION;
    // sprite.alpha = progress; // Fades in
  }

  /**
   * Overrides the BaseAnimate stop() method to reset the animation's state.
   * This is crucial for ensuring the animation can be replayed correctly.
   * Always call super.stop() to set isPlaying to false.
   */
  public stop(): void {
    super.stop(); // This is important!
    this.elapsedTime = 0;

    // Reset any modified sprite properties to their initial state.
    // For example, if you changed the scale, reset it to 1.
    if (this.sprites && this.sprites[0]) {
      this.sprites[0].scale.set(1.0);
      this.sprites[0].alpha = 1.0;
    }
  }
}
```

## 3. Registering the Animation

To make the animation usable by the application, you need to:

### a. Export it from the Library

Add an export line in `src/index.ts`:

```typescript
export { YourAnimation } from './animations/YourAnimation';
```

### b. Register it in the Application

In the application's entry point (e.g., `demo/main.ts`), import your new animation and register it with the `AnimationManager` instance.

```typescript
import { AnimationManager, YourAnimation } from 'pixi-animation-library';

// ...

const manager = new AnimationManager();

// In your initialization logic:
[YourAnimation].forEach((animClass) => {
  manager.register(animClass);
  // ... any UI code to add it to a selector
});
```

## 4. Writing Tests

All new animations must have corresponding unit tests.

- Create a test file in `tests/animations/` that mirrors the path of your animation file (e.g., `tests/animations/YourAnimation.test.ts`).
- Write tests to verify:
  - The initial state of the sprite(s).
  - The state of the sprite(s) at various points in the animation (e.g., halfway through).
  - The state of the sprite(s) after the animation completes a cycle.
  - The `stop()` method correctly resets all modified properties.

By following these steps, you can integrate new, custom animations into the library in a clean and testable way.
