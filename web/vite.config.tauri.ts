/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Config específica para el build de Tauri (Mac desktop app)
// Diferencias vs vite.config.ts:
//   - base: '/'  (Tauri sirve desde raíz, no desde /app/)
//   - outDir: '../app-tauri'  (directorio separado, no sobreescribe el web build)
export default defineConfig({
  plugins: [react()],
  base: '/',
  define: {
    // Inyectado en tiempo de build — 100% fiable para detectar entorno Tauri
    'import.meta.env.VITE_TAURI': '"true"',
  },
  build: {
    outDir: '../app-tauri',
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'outliner': [
            './src/components/outliner/Outliner.tsx',
            './src/components/outliner/OutlinerNode.tsx',
            './src/components/outliner/InlineRenderer.tsx',
            './src/components/outliner/SlashMenu.tsx',
            './src/components/outliner/FormatToolbar.tsx',
            './src/components/outliner/NodeContextMenu.tsx',
          ],
          'panels': [
            './src/components/panels/DiaryRightPanel.tsx',
            './src/components/panels/CalendarSidePanel.tsx',
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://from-server-production.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
