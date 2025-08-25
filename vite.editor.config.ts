import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
    // Set the root to the editor's web directory.
    root: 'editor/web',

    // The server block is needed for the Fastify dev server integration.
    server: {
        middlewareMode: true,
        fs: {
            // Allow serving files from the project root.
            // This is necessary to allow Vite to access the generated animation
            // files in `editor/sessions`.
            allow: [searchForWorkspaceRoot(process.cwd())],
        },
    },

    // Make the project's root `assets` directory available.
    publicDir: '../../assets',

    // Configure path aliases.
    resolve: {
        alias: {
            'pixi-animation-library': resolve(__dirname, 'src/index.ts'),
        }
    },

    // Add the React plugin.
    plugins: [react()],

    // Configure the build process.
    build: {
        outDir: '../../dist/editor',
        emptyOutDir: true,
    },
});
