1.  **Cleanup:** Remove the `editor/package.json` file as it is no longer needed.
2.  **Install Dependencies:** Add all required dependencies for the editor to the root `package.json`. This includes `fastify`, `@fastify/vite`, `@fastify/static`, `@google/generative-ai`, `react`, `react-dom`, `tsx`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `uuid`, `@types/uuid`, and `dotenv`.
3.  **Create Editor File Structure:** Create the server entry point at `editor/server.ts` and the frontend structure: `editor/web/index.html` and `editor/web/main.tsx`.
4.  **Create Vite Config:** Create a `vite.editor.config.ts` file to configure Vite for the React frontend, setting `editor/web` as the root.
5.  **Implement Backend Server:** Create a basic Fastify server in `editor/server.ts`. It will be configured to use `@fastify/vite` to serve the frontend in development.
6.  **Add Dev Script:** Add the `dev:editor` script to the root `package.json` to run the Fastify server using `tsx`.
7.  **Build Frontend UI:** Implement the two-column layout (Chat UI, Animation Preview) using React components in `editor/web/main.tsx`.
8.  **Implement Gemini Backend:** Create the API endpoint on the Fastify server that takes a user prompt, communicates with the Gemini API, and uses function calling to save the generated TypeScript animation to a file.
9.  **Implement Dynamic Animation Loading:** On the frontend, create a mechanism to fetch a list of generated animations from the backend and dynamically `import()` them to be used by the AnimationManager.
10. **Finalize Features:** Add the "New Task" and "Download" functionalities.
11. **Documentation & Verification:** Update all project documentation (`jules.md`, etc.) and run all required checks from `AGENTS.md` before submitting.
