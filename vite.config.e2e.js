import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vercelApiPlugin } from './e2e/vercel-api-plugin.js';

// Real OCR is slow and its output varies, so the suite swaps tesseract.js
// for a stub whose result the test chooses. E2E_REAL_OCR=1 keeps the real
// library, which is how the integration itself gets checked.
const stubOcr = process.env.E2E_REAL_OCR !== '1';

// Used only by the end-to-end suite. It is the normal dev config plus an
// emulator that serves api/ the way Vercel functions do, so the tests
// exercise the real handlers against a real database.
export default defineConfig({
  plugins: [react(), vercelApiPlugin()],
  resolve: {
    alias: stubOcr
      ? { 'tesseract.js': fileURLToPath(new URL('./e2e/stubs/tesseract.js', import.meta.url)) }
      : {},
  },
  server: {
    port: Number(process.env.E2E_PORT) || 3210,
    strictPort: true,
  },
});
