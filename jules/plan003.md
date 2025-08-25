# 任务 3: 实现第一个动画

- **目标:** 创建一个具体的动画实例，以验证核心模块的有效性。
- **具体任务:**
  - 在 `src/` 目录下创建 `animations` 子目录。
  - 创建 `src/animations/ScaleAnimation.ts` 文件。
  - `ScaleAnimation` 类需要继承自 `BaseAnimate`。
  - 实现构造函数，调用父类构造函数。
  - 实现获取 Sprite 数量的方法，返回 1。
  - 在 `update(deltaTime: number)` 方法中实现核心逻辑：
    - 记录动画已播放时间。
    - 根据当前时间，计算 Sprite 的缩放值。
    - 动画总时长为 2 秒。
    - 前 1 秒，`scale` 从 1.0 线性插值到 0.5。
    - 后 1 秒，`scale` 从 0.5 线性插值到 1.0。
    - 动画结束后，调用 `onComplete` 回调，并重置动画状态以实现循环播放。
  - 在 `AnimationManager` 中注册 `ScaleAnimation`。
