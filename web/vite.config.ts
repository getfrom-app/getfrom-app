/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/app/',
  test: {
    globals: false,
    include: ['src/__tests__/**/*.test.ts'],
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  build: {
    outDir: '../app',
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React + router: ~140KB
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Outliner editor (denso, ~80KB)
          'outliner': [
            './src/components/outliner/Outliner.tsx',
            './src/components/outliner/OutlinerNode.tsx',
            './src/components/outliner/InlineRenderer.tsx',
            './src/components/outliner/SlashMenu.tsx',
            './src/components/outliner/FormatToolbar.tsx',
            './src/components/outliner/NodeContextMenu.tsx',
          ],
          // Modales y panels grandes
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
