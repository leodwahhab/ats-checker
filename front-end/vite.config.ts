import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // A API roda em 127.0.0.1:8080; o proxy evita CORS no desenvolvimento.
  server: { proxy: { '/api': 'http://127.0.0.1:8080' } },
});
