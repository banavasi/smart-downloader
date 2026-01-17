import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { copyFileSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'move-html-files',
      closeBundle() {
        // Move popup.html from dist/src/popup/ to dist/
        const popupSrcPath = resolve(__dirname, 'dist/src/popup/popup.html');
        const popupDestPath = resolve(__dirname, 'dist/popup.html');

        if (existsSync(popupSrcPath)) {
          let html = readFileSync(popupSrcPath, 'utf-8');
          html = html.replace(/src="\.\.\/\.\.\/assets\//g, 'src="./assets/');
          html = html.replace(/href="\.\.\/\.\.\/assets\//g, 'href="./assets/');
          writeFileSync(popupDestPath, html);
        }

        // Move options.html from dist/src/options/ to dist/
        const optionsSrcPath = resolve(__dirname, 'dist/src/options/options.html');
        const optionsDestPath = resolve(__dirname, 'dist/options.html');

        if (existsSync(optionsSrcPath)) {
          let html = readFileSync(optionsSrcPath, 'utf-8');
          html = html.replace(/src="\.\.\/\.\.\/assets\//g, 'src="./assets/');
          html = html.replace(/href="\.\.\/\.\.\/assets\//g, 'href="./assets/');
          writeFileSync(optionsDestPath, html);
        }

        // Remove the src directory if it's empty
        try {
          rmSync(resolve(__dirname, 'dist/src'), { recursive: true, force: true });
        } catch (e) {
          // Ignore errors
        }
      },
    },
  ],
  base: './', // Use relative paths for Chrome extension
  server: {
    port: 5173,
    open: '/src/popup/dev.html',
    fs: {
      strict: false
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        dev: resolve(__dirname, 'src/popup/dev.html'), // Dev preview page
        options: resolve(__dirname, 'src/options/options.html'), // Options page
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    emptyOutDir: false, // Don't empty so we can copy files
    copyPublicDir: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
