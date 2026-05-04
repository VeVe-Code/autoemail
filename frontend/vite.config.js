import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../public',
    // Always deploy a clean public/ directory.
    emptyOutDir: true,
    // Avoid hashed filenames so cached HTML won't 404.
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // Single JS bundle with stable path.
        inlineDynamicImports: true,
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/app.js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo?.name || 'asset';
          if (name.endsWith('.css')) return 'assets/app.css';
          return `assets/${name}`;
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000'
    }
  },
  preview: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000'
    }
  }
})
