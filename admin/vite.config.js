import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const api = process.env.API_URL || 'http://localhost:4000';

// The admin panel is served under /admin (by the API server in production, by Vite in dev).
export default defineConfig({
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  server: { port: 5174, proxy: { '/api': api, '/art': api, '/uploads': api } },
  build: { rollupOptions: { output: { manualChunks(id) { if (id.includes('leaflet')) return 'leaflet'; if (id.includes('node_modules/react') || id.includes('react-router')) return 'react'; } } } },
});
