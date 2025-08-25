# 任务 3 完成报告: 实现第一个动画

## 完成情况
此任务已成功完成。

## 主要工作
1.  **创建动画目录:** 在 `src/` 下建立了 `animations` 目录，用于存放所有具体的动画实现，保持了项目的模块化和整洁。

2.  **实现 `ScaleAnimation.ts`:**
    -   创建了 `ScaleAnimation` 类，它继承自 `BaseAnimate`。
    -   实现了 `animationName` 和 `getRequiredSpriteCount` 静态属性，符合 `AnimateClass` 类型约定，使其能被 `AnimationManager` 正确注册和创建。
    -   在 `update` 方法中，实现了核心的动画逻辑：在 2 秒的周期内，将 Sprite 的 scale 从 1.0 线性插值到 0.5，再恢复到 1.0。
    -   实现了循环播放的逻辑，并在每个周期结束时可以触发 `onComplete` 回调。
    -   重写了 `stop` 方法，以确保在动画停止时，能将 Sprite 的 scale 重置为初始状态。

## 最终产出
一个功能完整的、可复用的 `ScaleAnimation` 动画。这个过程不仅产出了第一个具体动画，也成功验证了核心模块（`BaseAnimate`, `AnimationManager`）设计的有效性和实用性。
