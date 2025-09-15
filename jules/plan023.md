# PixiAni.9 任务计划：编辑器断线判断策略调整

## 1. 原始需求理解

当前 `editor/server.ts` 中的断线判断机制过于简单，它在发起一个异步请求后设置一个固定的超时时间。如果 Gemini API 的响应（包括其内部的 "thinking" 阶段）超过这个时间，连接就会被错误地判断为断开。

新的需求是实现一个更智能的、基于**数据流**的断线判断策略。具体来说：

1.  **采用流式协议（SSE）**：客户端与服务端的通信应当是流式的。
2.  **实现空闲超时（Idle Timeout）**：只有在**一段时间内（由 `AGENT_CONTINUE_TIMEOUT_MS` 配置）完全没有数据流**的情况下，才应判定为连接超时。只要有数据（哪怕是 "thinking" 状态的信令或部分数据块），超时计时器就应该被重置。
3.  **兼容 Gemini "Thinking" 阶段**：新的策略必须能够处理 Gemini 在生成完整回答前可能存在的较长的 "thinking" 时间，通过监听流中的早期数据来维持连接。

## 2. 目标

1.  **升级 Gemini SDK**：根据最新的官方文档，将项目依赖从已废弃的 `@google/generative-ai` 迁移到新的 `@google/genai`。
2.  **重构服务器逻辑**：修改 `editor/server.ts`，使用新版 SDK 的 API，特别是将一次性的请求/响应模式（`chat.sendMessage`）改造为流式请求模式（`...Stream`）。
3.  **实现动态超时机制**：替换掉现有的 `promiseWithTimeout` 静态超时逻辑，实现一个在接收到任何数据流时都能自动重置的空闲超时计时器。
4.  **确保功能完整性**：在修改后，确保整个 Agent 的 TDD 工作流（创建文件、测试、发布等）依然能够正常工作。
5.  **文档更新**：
    *   创建任务报告 `jules/plan023-report.md`。
    *   更新核心开发文档 `jules.md`，记录本次架构升级的设计决策和实现细节。
    *   （可选）如果适用，更新 `agents.md`。

## 3. 任务分解

### 步骤 1：环境设置与依赖更新

1.  **修改 `package.json`**：
    *   移除 `"@google/generative-ai": "*"`。
    *   添加 `"@google/genai": "*"` (或最新稳定版)。
2.  **安装新依赖**：运行 `npm install` 来下载新的 SDK 并移除旧的。

### 步骤 2：重构 `editor/server.ts` 以适应新版 SDK

1.  **更新 Imports**：将 `import { GoogleGenerativeAI, ... } from "@google/generative-ai";` 修改为 `import { GoogleGenAI, ... } from "@google/genai";`。
2.  **初始化 Client**：
    *   将 `const genAI = new GoogleGenerativeAI(API_KEY);`
    *   替换为 `const genAI = new GoogleGenAI(API_KEY);` (根据新文档，构造函数类似，但返回的对象不同)。
3.  **重构 Chat 初始化**：
    *   找到 `const chat = model.startChat(...)`。
    *   根据新版 SDK 的 `chat` 或 `generativeModel` 的流式API进行改造。从迁移文档看，`chat.sendMessage` 已经不是流式的，需要找到对应的流式方法，可能是 `model.generateContentStream` 或 `chat.sendMessageStream`。
4.  **重构核心 Agent 循环**：
    *   定位到 `run()` 函数内的 `for` 循环。
    *   将 `result = await chat.sendMessage(...)` 和 `result = await sendWithTimeoutAndRetry(...)` 这两块核心逻辑，替换为对流的迭代处理。

### 步骤 3：实现基于数据流的空闲超时逻辑

1.  **移除旧的超时函数**：删除 `promiseWithTimeout` 和 `sendWithTimeoutAndRetry` 这两个函数，它们的设计思想与新策略不符。
2.  **设计新的超时管理器**：
    *   在 `/api/chat` 的 `run` 函数作用域内，初始化一个超时计时器 `let idleTimeout: NodeJS.Timeout;`。
    *   创建一个 `resetIdleTimeout` 函数，该函数会：
        *   清除当前的 `idleTimeout`。
        *   设置一个新的 `setTimeout`，延迟时间为 `CONTINUE_TIMEOUT_MS`。当这个新的 timeout 触发时，它将抛出一个错误（例如 `new Error('Timeout: No data received...')`）并终止 SSE 连接。
3.  **在流处理中集成超时重置**：
    *   在开始监听 Gemini 的数据流之前，调用一次 `resetIdleTimeout()` 启动初始计时。
    *   在使用 `for await (const chunk of stream)` 循环处理数据时，在每次循环的开始或结束时，立即调用 `resetIdleTimeout()`。这样，每接收到一个数据块，超时就被推迟。
4.  **包裹流处理逻辑**：将整个流处理循环放在一个 `try...catch...finally` 块中。
    *   `try` 块中包含 `for await` 循环。
    *   `catch` 块捕获可能由 `idleTimeout` 抛出的错误或流本身的其他错误，并向客户端发送一个 `error` 事件。
    *   `finally` 块中确保清除所有定时器并关闭 SSE 连接 (`reply.raw.end()`)。

### 步骤 4：测试与验证

1.  **启动开发服务器**：运行 `npm run dev:editor`。
2.  **手动测试**：
    *   打开编辑器前端页面。
    *   提交一个简单的动画生成请求，观察控制台和网络请求，确认 SSE 连接建立，并且 `heartbeat` 或其他事件能够正常接收。
    *   提交一个复杂的、耗时较长的请求，验证在 Gemini "thinking" 期间连接不会因为超时而断开。
    *   （如果可能）模拟网络中断，验证空闲超时机制是否能在指定时间后正确关闭连接。
3.  **回归测试**：确保 Agent 的完整 TDD 流程（代码生成、测试、发布）可以成功完成。

### 步骤 5：文档与报告

1.  **撰写任务报告**：在 `jules/plan023-report.md` 中详细记录开发过程、遇到的问题及解决方案。
2.  **更新 `jules.md`**：将本次关于超时机制的重构背景、设计思路和最终实现方案，整合到 `jules.md` 的相关章节中，供未来参考。
3.  **审查 `agents.md`**：检查 `agents.md`，判断此次底层的改动是否需要对 Agent 的行为或指令作出调整。如果不需要，则跳过此步。
