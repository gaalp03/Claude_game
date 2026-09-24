import { defineConfig } from 'vite';

// Relatív base: a CrazyGames build bármilyen almappából (iframe) működjön.
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // A Phaser külön chunkba kerül, így a játék kódja kicsi és jól cache-elhető.
        manualChunks: { phaser: ['phaser'] }
      }
    }
  },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node'
  }
});
