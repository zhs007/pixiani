# 任务 4: 单元测试

- **目标:** 确保核心逻辑的正确性和稳定性。
- **具体任务:**
  - 配置 `vitest` 测试环境。
  - 在 `tests/` 目录下创建 `core` 子目录。
  - 编写 `tests/core/BaseObject.test.ts`，测试 `BaseObject` 的动画添加、移除和更新逻辑。
  - 编写 `tests/core/AnimationManager.test.ts`，测试动画的注册、创建、全局控制和速度设置。
  - 在 `tests/` 目录下创建 `animations` 子目录。
  - 编写 `tests/animations/ScaleAnimation.test.ts`，测试：
    - 在动画进行到 0.5s 时，Sprite 的 `scale` 是否为 0.75。
    - 在动画进行到 1s 时，Sprite 的 `scale` 是否为 0.5。
    - 在动画进行到 2s 时，Sprite 的 `scale` 是否为 1.0。
    - 动画结束后 `onComplete` 回调是否被调用。
  - 运行所有测试，并检查测试覆盖率报告，确保达到 90% 以上。
