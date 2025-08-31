# Plan to Refine Logging in `dev:editor`

## 原始需求理解

用户反馈 `npm run dev:editor` 的日志输出过于冗杂，希望能对日志进行分级管理，精简输出，特别是突出显示与 Gemini API 的交互过程。同时，希望日志级别是可配置的。

## 目标

1.  创建一个可配置的、支持多级日志的日志系统。
2.  重构 `editor/server.ts`，使用新的日志系统，替换当前的 `Fastify`默认 logger 和 `console.log`。
3.  为与 Gemini API 的交互创建一个专门的日志级别或分类。
4.  更新 `package.json` 中的 `dev:editor` 脚本，使其可以接受日志级别配置。
5.  完成任务后，创建 `plan014-report.md` 报告，并更新 `jules.md`。

## 任务分解

1.  **创建日志模块**:
    *   在 `editor/` 目录下创建一个新文件 `logger.ts`。
    *   使用 `pino` (Fastify 的内置 logger) 来创建一个可定制的 logger 实例。
    *   定义日志级别，例如：`fatal`, `error`, `warn`, `info`, `debug`, `trace`，并添加一个自定义级别 `gemini`。
    *   通过环境变量 `LOG_LEVEL` (默认为 `info`) 来控制日志输出级别。
    *   通过环境变量 `LOG_PRETTY` (默认为 `true` in dev) 来控制是否格式化输出。

2.  **重构 `editor/server.ts`**:
    *   在 `server.ts` 中导入新的 logger。
    *   在创建 Fastify 实例时，禁用其默认 logger，并将自定义 logger 传递给它。
    *   将 `server.ts` 中所有的 `console.log`, `console.warn`, `console.error` 调用替换为对新 logger 实例的调用（例如 `logger.info()`, `logger.warn()`, `logger.error()`）。
    *   所有与 Gemini API 相关的日志（例如，发送请求、接收响应、函数调用）都使用 `logger.gemini()`。

3.  **更新 `package.json`**:
    *   修改 `dev:editor` 脚本，允许通过命令行参数或环境变量设置 `LOG_LEVEL`。例如，可以添加一个 `dev:editor:debug` 脚本，或者指导用户如何使用 `LOG_LEVEL=debug npm run dev:editor`。

4.  **测试**:
    *   启动 `npm run dev:editor` 并将 `LOG_LEVEL` 设置为不同的值（`info`, `debug`, `gemini`），验证日志输出是否符合预期。
    *   确保在 `info` 级别下，日志是精简的。
    *   确保在 `debug` 级别下，可以看到更详细的调试信息。
    *   确保在 `gemini` 级别下，可以清晰地看到与 API 的交互。

5.  **文档和报告**:
    *   创建 `jules/plan014-report.md`，记录整个开发过程、遇到的问题和解决方案。
    *   更新根目录下的 `jules.md` 文件，添加本次任务的记录。
    *   根据需要更新 `agents.md`，如果日志配置的说明对未来的 agent 有帮助。
