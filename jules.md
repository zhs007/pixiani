# 项目概要: PixiJS 动画库

这是一个使用 Pixi.js 和 TypeScript 开发的、面向移动端竖屏的 Web 游戏动画库。
**项目现在已经重构为一个由 pnpm 和 Turborepo 管理的 monorepo。**

## 重要信息与规则

### 技术栈

- **渲染引擎:** Pixi.js (最新版)
- **渲染模式:** WebGL
- **开发语言:** TypeScript
- **包管理器:** pnpm
- **Monorepo 工具:** Turborepo
- **构建工具:** Vite
- **测试框架:** Vitest

### Monorepo 结构

- `packages/pixiani-core`: 核心动画库。
- `apps/demo`: 用于测试和演示动画的 Vite 应用。
- `apps/editor`: Gemini 动画编辑器。

### 核心设计原则

1.  **模块化:** 功能被划分到不同的 "package" 中。`packages/pixiani-core/src/core` 包含核心逻辑, `packages/pixiani-core/src/animations` 包含具体的动画实现。
2.  **类型安全:** 所有模块都必须有完整的 TypeScript 类型定义。核心类型定义在 `packages/pixiani-core/src/core/types.ts`。
3.  **高可测试性:** 核心逻辑模块必须有单元测试，目标覆盖率 > 90%。
4.  **详细注释:** 所有公开的类、方法和复杂逻辑都需要有 JSDoc 注释。
5.  **关注相对变换:** 动画应该只修改 Sprite 的相对属性（如相对于其初始状态的缩放、位置偏移），而不是其在世界坐标系中的绝对位置。

### 核心模块

- **`AnimationManager`**: 全局单例，用于注册、创建和管理所有动画实例的生命周期，包括全局暂停、恢复和变速。
- **`BaseObject`**: 一个可以附加动画组件的容器。游戏中的对象可以通过组合 `BaseObject` 来获得动画能力。
- **`BaseAnimate`**: 所有具体动画的基类，定义了动画的基本接口 (`play`, `pause`, `update` 等)。

### Sprite 插槽机制

- 动画不直接创建 `Sprite`，而是通过外部传入一组 `Sprite`（即插槽）来工作。
- 每个动画类必须实现一个方法，用于声明它需要多少个 `Sprite` 插槽。
- 动画逻辑负责决定如何使用这些传入的 `Sprite`。

### 渲染顺序

- 动画库本身不直接修改 `PIXI.Sprite` 的 `zIndex` 或渲染顺序。
- 如果动画需要改变渲染顺序（例如，一个角色转身，需要将后发切换为前发），它会通过一个回调函数通知外部使用者，由外部逻辑来调整 `Sprite` 在 Pixi 容器中的层级。

### 开发流程

1.  **定义类型:** 在 `packages/pixiani-core/src/core/types.ts` 中添加新的接口或类型。
2.  **实现核心逻辑:** 在 `packages/pixiani-core/src/core` 中实现或修改核心类。
3.  **编写动画:** 在 `packages/pixiani-core/src/animations` 目录下创建新的动画文件，继承 `BaseAnimate`。
4.  **编写测试:** 在 `packages/pixiani-core/tests` 目录下为新功能编写单元测试。
5.  **演示验证:** 在 `demo` 应用中添加新的测试用例，直观地验证动画效果。
6.  **构建与提交:** 运行 `pnpm build` 和 `pnpm test`，确保一切正常后提交。

### 命令

- `pnpm install`: 安装所有依赖。
- `pnpm dev`: 启动所有应用的开发服务器。
- `pnpm dev --filter=demo`: 启动 `demo` 应用的开发服务器。
- `pnpm dev --filter=editor`: 启动 `editor` 应用的开发服务器。
- `pnpm build`: 构建所有包和应用。
- `pnpm test`: 运行所有测试。
- `pnpm lint`: 对整个项目进行代码风格检查。

## 开发进度

- [x] **任务 1: 项目初始化与结构搭建** - 完成
- [x] **任务 2: 核心模块设计与实现** - 完成
- [x] **任务 3: 实现第一个动画** - 完成
- [x] **任务 4: 单元测试** - 完成
- [x] **任务 5: 演示页面开发** - 完成
- [x] **任务 6: 构建与整合** - 完成
- [x] **任务 7: 最终审查与提交** - 完成
- [x] **任务 8: Gemini 动画编辑器** - 新增一个基于 Web 的子项目，允许用户通过自然语言描述生成、预览和下载新的动画。
- [x] **任务 9: Gemini TDD 流程** - 为 Gemini Agent 实现一个完整的测试驱动开发（TDD）工作流，使其能够编写代码、编写测试、运行测试并根据结果进行调试。
- [x] **任务 10: Monorepo 重构** - 使用 pnpm 和 Turborepo 将项目重构为 monorepo 结构。

## Gemini 动画编辑器

### 如何运行

1.  在项目根目录创建一个 `.env` 文件。
2.  在 `.env` 文件中添加您的 Gemini API 密钥: `GEMINI_API_KEY=your_api_key_here`
3.  (可选) 您也可以指定要使用的模型: `GEMINI_MODEL=gemini-1.5-pro` (默认为 `gemini-1.5-flash`)
4.  运行编辑器的开发服务器: `pnpm dev:editor`
5.  在浏览器中打开 `http://localhost:3000`。

### 环境变量配置

编辑器的行为可以通过根目录下的`.env`文件进行配置。除了必须的`GEMINI_API_KEY`，还支持以下环境变量：

- `GEMINI_MODEL`: 指定使用的Gemini模型，默认为`gemini-1.5-flash`。
- `SYSTEM_INSTRUCTION_PATH`: 指定代理的系统指令文件的路径。默认为`apps/editor/prompts/system.md`，允许开发者轻松定制代理的行为。
- `AGENT_CONTINUE_TIMEOUT_MS`: 控制代理响应流的空闲超时时间（毫秒）。如果在此时间内没有收到来自Gemini API的新数据，连接将关闭。默认为`30000`。
- `AGENT_CONTINUE_RETRIES`: 连接到Gemini API时的重试次数。默认为`1`。
- `PROXY_URL` (或 `HTTPS_PROXY`): 为Gemini API请求配置HTTP/S代理。

`.env.example`文件提供了所有这些变量的模板。

### TDD 工作流

为了提高 AI 生成代码的质量和可靠性，编辑器后端实现了一个**自主的、自动化的测试驱动开发（TDD）循环**。当用户提交一个动画需求后，Agent 会自动执行完整的工作流，并通过流式响应将进度实时反馈给用户。

#### 用户体验

- **实时反馈**: 用户可以实时看到 Agent 正在执行哪个步骤（例如，“_正在调用工具: create_test_file..._”），而不是面对一个不确定的加载指示器。
- **无缝预览**: Agent 任务成功后，新生成的动画会立即出现在右侧的预览面板中，并被自动选中，用户可以马上播放和测试。
- **自主运行**: 整个工作流是全自动的。用户提交需求后，无需任何进一步干预。

#### 内部工作流程：暂存 -> 测试 -> 发布

为了防止带有语法错误的“半成品”代码被Vite开发服务器加载而导致服务崩溃，Agent的工作流被设计成一个安全的“暂存-测试-发布”模型。

1.  **写入暂存区 (Staging)**: Agent创建或修改的所有文件（动画和测试）都会被写入到一个临时的`staging`子目录中 (`.sessions/<session-id>/staging/`)。这个目录不会被Vite服务监控。

2.  **在暂存区测试**: `run_tests`工具只在`staging`目录中执行测试。
    - **代码编写规则**: 为了确保测试代码的健壮性，Agent被指示遵循严格的导入规则：对于核心库代码（如`BaseObject`），必须使用`@pixi-animation-library/pixiani-core`路径别名；对于它自己正在测试的动画类，必须使用相对路径 (`../../src/animations/...`)。
    - 如果测试因代码错误（无论是编译错误还是断言失败）而失败，Agent会收到错误报告，并在暂存区内继续尝试修复，这个过程不会影响到正在运行的前端服务。
    - 如果测试因无法解决的**环境问题**失败，Agent会识别出`SYSTEM_ERROR`并停止工作流。它返回给Agent的错误信息会包含完整的`stdout`和`stderr`日志，Agent被指示将这些详细信息完整报告给用户，以方便调试。

3.  **发布 (Publish)**: **只有当`run_tests`工具返回成功信息后**，系统才会执行“发布”操作：
    - 将通过测试的动画文件和测试文件从`staging`目录移动到其最终的“已发布”位置 (`.sessions/<session-id>/src/` 和 `.sessions/<session-id>/tests/`)。
    - 这个移动操作是原子性的，确保了Vite只会看到已经通过测试的、完整的代码。

4.  **完成**: 文件发布成功后，服务器会向前端发送`workflow_complete`事件。该事件包含新动画的`className`及其最终的、已发布的`filePath`，允许前端直接、安全地加载新动画。

### 编辑服务器超时与连接管理

为了处理与 Gemini API 的长时间流式通信，特别是当 Agent 处于较长的“思考”阶段时，编辑器后端（`apps/editor/server.ts`）实现了一套基于数据流的**空闲超时（Idle Timeout）**机制。

#### 设计原则

- **拒绝固定超时**：简单的固定时长超时（例如，30秒）不适用于流式响应。因为一个复杂的任务可能需要超过30秒的计算时间，但在此期间，连接本身是活跃的。
- **基于数据流**：超时不应该从请求开始时计算，而应该从**上一次接收到数据**时计算。只要有任何数据块（chunk）从 Gemini API 的流中传来，就意味着连接是健康的，超时计时器就应该被重置。

#### 实现细节

1.  **SDK 升级**: 项目已从废弃的 `@google/generative-ai` SDK 升级至最新的 `@google/genai`，以利用其现代的流式处理 API。
2.  **流式调用**: 后端不使用一次性的 `generateContent` 或 `sendMessage`，而是使用 `chat.sendMessageStream()` 来与 Gemini API 建立一个持久的流式连接。
3.  **空闲超时逻辑**:
    - 当 `/api/chat` 的 SSE 连接建立后，一个 `setTimeout` 计时器会启动，其时长由环境变量 `AGENT_CONTINUE_TIMEOUT_MS` (默认为 30 秒) 控制。
    - 服务器使用 `for await...of` 循环来异步迭代处理从 Gemini 返回的数据流。
    - **关键点**: 每当一个新的 `chunk` 从流中成功到达，计时器就会被**重置**。
    - 如果在 `AGENT_CONTINUE_TIMEOUT_MS` 时间内没有任何新的 `chunk` 到达，计时器就会触发，服务器会主动向客户端发送一个超时错误事件，并安全地关闭连接。

这种设计确保了只要 Gemini API 仍在处理和发送数据，连接就不会中断，同时也能在真正的网络中断或 API 无响应时，及时、可靠地释放服务器资源。
