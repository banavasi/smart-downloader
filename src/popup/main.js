import { createApp } from 'vue';
import App from './App.vue';
import './popup.css';

// Import Chrome API mocks for development (only if not in Chrome extension context)
if (typeof chrome === 'undefined' || !chrome.tabs) {
  import('./chrome-mock.js').then(() => {
    initApp();
  });
} else {
  initApp();
}

function initApp() {
  createApp(App).mount('#app');
}
