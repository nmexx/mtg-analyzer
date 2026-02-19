import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

// Replaces %APP_VERSION% in index.html with the version from package.json
const htmlVersionPlugin = () => ({
  name: 'html-version-inject',
  transformIndexHtml: (html) => html.replace(/%APP_VERSION%/g, pkg.version),
})

export default defineConfig({
  plugins: [react(), htmlVersionPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
  },
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React runtime in its own chunk — cached across every deploy
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          // Recharts + its deps (d3 etc.) — heavy but rarely changes
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3') ||
              id.includes('node_modules/victory') || id.includes('node_modules/internmap') ||
              id.includes('node_modules/robust-predicates') || id.includes('node_modules/delaunator')) {
            return 'vendor-charts';
          }
          // html2canvas — only used for PNG export
          if (id.includes('node_modules/html2canvas')) {
            return 'vendor-html2canvas';
          }
        },
      },
    },
  }
})
