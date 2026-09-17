import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vercelApiPlugin } from './e2e/vercel-api-plugin.js';

// Used only by the end-to-end suite. It is the normal dev config plus an
// emulator that serves api/ the way Vercel functions do, so the tests
// exercise the real handlers against a real database.
export default defineConfig({
  plugins: [react(), vercelApiPlugin()],
  server: {
    port: Number(process.env.E2E_PORT) || 3210,
    strictPort: true,
  },
});
