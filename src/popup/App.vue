<template>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <div class="logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Smart Media Downloader</span>
      </div>
      <button
        @click="openSettings"
        class="settings-btn"
        title="Open Settings"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" stroke-width="2"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="2"/>
        </svg>
      </button>
    </header>

    <!-- Stats Bar -->
    <div class="stats-bar">
      <div class="stat">
        <span class="stat-label">Detected</span>
        <span class="stat-value">{{ detectedCount }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Selected</span>
        <span class="stat-value selected">{{ selectedMedia.length }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Images</span>
        <span class="stat-value">{{ imageCount }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Videos</span>
        <span class="stat-value">{{ videoCount }}</span>
      </div>
    </div>

    <!-- Main Controls -->
    <div class="controls">
      <button
        @click="toggleSelectionMode"
        :class="['btn', isSelectionMode ? 'btn-warning' : 'btn-primary']"
      >
        <svg v-if="!isSelectionMode" class="icon icon-start" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M15 3H21V9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M9 21H3V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 3L14 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3 21L10 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg v-else class="icon icon-stop" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="6" y="6" width="12" height="12" rx="1" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span class="btn-text">{{ isSelectionMode ? 'Stop Selecting' : 'Start Selecting' }}</span>
      </button>

      <button
        @click="toggleCarouselMode"
        :class="['btn', isCarouselMode ? 'btn-warning' : 'btn-secondary']"
        title="Pick a carousel element to watch"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
          <path d="M9 9h6M9 15h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>{{ isCarouselMode ? 'Stop Picker' : 'Carousel Mode' }}</span>
      </button>

      <button
        @click="rescanPage"
        class="btn btn-secondary"
        title="Rescan page after navigating slides"
        :disabled="isRescanning"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M23 4V10H17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M1 20V14H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3.51 9C4.01717 7.56678 4.87913 6.2854 6.01547 5.27542C7.1518 4.26545 8.52547 3.55976 10.0083 3.22426C11.4911 2.88875 13.0348 2.93434 14.4952 3.35677C15.9556 3.77921 17.2853 4.56471 18.36 5.64L23 10M1 14L5.64 18.36C6.71475 19.4353 8.04437 20.2208 9.50481 20.6432C10.9652 21.0657 12.5089 21.1112 13.9917 20.7757C15.4745 20.4402 16.8482 19.7346 17.9845 18.7246C19.1209 17.7146 19.9828 16.4332 20.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Rescan</span>
      </button>
    </div>

    <!-- Carousel Selector Info -->
    <div v-if="carouselSelector" class="carousel-info">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
      </svg>
      <span>Watching: <code>{{ carouselSelector }}</code></span>
      <button @click="clearCarouselSelector" class="btn-clear-selector" title="Clear selector">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- Action Buttons -->
    <div class="actions">
      <button
        @click="downloadAsZip"
        class="btn btn-success"
        :disabled="selectedMedia.length === 0 || isDownloading"
        title="Download all as ZIP (Ctrl+D)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>ZIP</span>
      </button>

      <button
        @click="downloadIndividual"
        class="btn btn-secondary"
        :disabled="selectedMedia.length === 0 || isDownloading"
        title="Download individually"
      >
        <span>Individual</span>
      </button>

      <button
        @click="clearSelection"
        class="btn btn-danger"
        :disabled="selectedMedia.length === 0"
        title="Clear all selections"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Clear</span>
      </button>
    </div>

    <!-- Selected Items Preview -->
    <div class="preview-section">
      <div class="preview-header">
        <span>Selected Media</span>
        <span class="preview-count">{{ selectedMedia.length }} item{{ selectedMedia.length !== 1 ? 's' : '' }}</span>
      </div>
      <div class="preview-grid">
        <div v-if="selectedMedia.length === 0" class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" opacity="0.3">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
            <path d="M21 15L16 10L5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p>No media selected</p>
          <p class="hint">Click "Start Selecting" then click videos/images on the page</p>
        </div>
        <div
          v-for="(media, index) in selectedMedia"
          :key="media.id"
          class="preview-item"
          :data-id="media.id"
        >
          <div
            class="preview-thumb"
            :class="{ 'video-thumb': media.type === 'video' }"
            :style="{ backgroundImage: getThumbnailStyle(media) }"
          >
            <svg v-if="media.type === 'video'" class="video-icon" width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
          <span :class="['type-badge', media.type]">{{ media.type.toUpperCase() }}</span>
          <div class="preview-actions">
            <button
              @click.stop="downloadSingleItem(media)"
              class="download-btn"
              title="Download this item"
              :disabled="isDownloading"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button
              @click.stop="removeItem(media.id)"
              class="remove-btn"
              title="Remove from selection"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <span class="index-badge">{{ index + 1 }}</span>
        </div>
      </div>
    </div>

    <!-- Status Bar -->
    <div :class="['status-bar', `status-${statusType}`]">
      <span class="status-text">{{ statusText }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

// ============================================
// STATE
// ============================================

const isSelectionMode = ref(false);
const isCarouselMode = ref(false);
const carouselSelector = ref('');
const selectedMedia = ref([]);
const detectedCount = ref(0);
const currentTabId = ref(null);
const statusText = ref('Ready');
const statusType = ref('ready');
const isRescanning = ref(false);
const isDownloading = ref(false);

// ============================================
// COMPUTED
// ============================================

const imageCount = computed(() => {
  return selectedMedia.value.filter(m => m.type === 'image').length;
});

const videoCount = computed(() => {
  return selectedMedia.value.filter(m => m.type === 'video').length;
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getThumbnailStyle(media) {
  if (media.type === 'video') {
    if (media.thumbnail && !media.thumbnail.includes('.mp4')) {
      return `url(${media.thumbnail})`;
    }
    return 'none';
  }
  return `url(${media.thumbnail || media.url})`;
}

// ============================================
// TAB COMMUNICATION
// ============================================

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContentScriptInjected(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return true;
  } catch (error) {
    console.log('Content script not found, injecting...');
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['content.css']
      });
      await new Promise(resolve => setTimeout(resolve, 100));
      return true;
    } catch (injectError) {
      console.error('Failed to inject content script:', injectError);
      return false;
    }
  }
}

async function sendToContent(message) {
  try {
    const tab = await getCurrentTab();
    if (!tab?.id) {
      throw new Error('No active tab');
    }
    currentTabId.value = tab.id;

    const injected = await ensureContentScriptInjected(tab.id);
    if (!injected) {
      throw new Error('Cannot inject content script');
    }

    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    console.error('Failed to send message:', error);
    updateStatus('Error: Cannot communicate with page. Try refreshing.', 'error');
    return null;
  }
}

async function fetchState() {
  const response = await sendToContent({ action: 'getState' });
  if (response) {
    updateUIFromState(response);
    // Also check for carousel selector
    if (response.carouselSelector) {
      carouselSelector.value = response.carouselSelector;
    }
  }
}

// ============================================
// UI UPDATES
// ============================================

function updateUIFromState(newState) {
  isSelectionMode.value = newState.isSelectionMode;
  selectedMedia.value = newState.selectedMedia || [];
  detectedCount.value = newState.detectedCount || 0;

  // Update status
  if (isSelectionMode.value) {
    updateStatus('👆 Click to select videos/images. Press Ctrl+D to download.', 'active');
  } else if (selectedMedia.value.length > 0) {
    updateStatus(`✓ ${selectedMedia.value.length} item(s) ready to download`, 'ready');
  } else {
    updateStatus('Click "Start Selecting" or Rescan to find media', 'ready');
  }
}

function updateStatus(message, type = 'ready') {
  statusText.value = message;
  statusType.value = type;
}

// ============================================
// ACTIONS
// ============================================

async function toggleSelectionMode() {
  const action = isSelectionMode.value ? 'stopSelection' : 'startSelection';
  const response = await sendToContent({ action });
  if (response?.success) {
    await fetchState();
  }
}

async function rescanPage() {
  updateStatus('📍 Scanning page for media...', 'active');
  isRescanning.value = true;

  const response = await sendToContent({ action: 'rescan' });
  if (response) {
    updateUIFromState(response);
    updateStatus(`✓ Found ${response.detectedCount} media items`, 'ready');
  }

  isRescanning.value = false;
}

async function removeItem(id) {
  const response = await sendToContent({ action: 'removeItem', id });
  if (response?.success) {
    await fetchState();
  }
}

async function clearSelection() {
  const response = await sendToContent({ action: 'clearSelection' });
  if (response?.success) {
    await fetchState();
  }
}

async function downloadAsZip() {
  if (selectedMedia.value.length === 0) return;

  updateStatus(`📦 Fetching ${selectedMedia.value.length} files...`, 'active');
  isDownloading.value = true;

  try {
    const tab = await getCurrentTab();

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'fetchMediaAsBlobs'
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to fetch media files. Try "Individual" download instead.');
    }

    updateStatus(`📦 Creating ZIP with ${response.blobs.length} files...`, 'active');

    const zipResponse = await chrome.runtime.sendMessage({
      action: 'createZipFromBlobs',
      blobs: response.blobs,
      filenames: response.filenames
    });

    if (zipResponse?.success) {
      const successMsg = response.errors && response.errors.length > 0
        ? `✓ ZIP downloaded! (${zipResponse.count} files, ${response.errors.length} failed)`
        : `✓ ZIP downloaded! (${zipResponse.count} files)`;
      updateStatus(successMsg, 'ready');
      setTimeout(() => {
        isDownloading.value = false;
      }, 3000);
    } else {
      throw new Error(zipResponse?.error || 'ZIP creation failed');
    }
  } catch (error) {
    console.error('ZIP download error:', error);
    updateStatus(`❌ ${error.message}`, 'error');
    isDownloading.value = false;
  }
}

async function downloadIndividual() {
  if (selectedMedia.value.length === 0) return;

  updateStatus(`📥 Downloading ${selectedMedia.value.length} files...`, 'active');
  isDownloading.value = true;

  try {
    const urls = selectedMedia.value.map(m => ({
      url: m.url,
      type: m.type
    }));

    const response = await chrome.runtime.sendMessage({
      action: 'downloadIndividual',
      urls: urls
    });

    if (response?.success) {
      updateStatus(`✓ Downloaded ${response.count} files (${response.failed || 0} failed)`, 'ready');
      setTimeout(() => {
        isDownloading.value = false;
      }, 3000);
    } else {
      throw new Error(response?.error || 'Download failed');
    }
  } catch (error) {
    console.error('Download error:', error);
    updateStatus(`❌ Error: ${error.message}`, 'error');
    isDownloading.value = false;
  }
}

// ============================================
// MESSAGE LISTENER
// ============================================

function handleMessage(message, sender, sendResponse) {
  if (message.action === 'elementPicked') {
    if (message.selector) {
      carouselSelector.value = message.selector;
      updateStatus(`✓ Now watching: ${message.selector}`, 'ready');
      isCarouselMode.value = false;
    }
    sendResponse({ received: true });
    return true;
  } else if (message.action === 'stateUpdate' && sender.tab?.id === currentTabId.value) {
    updateUIFromState(message.state || message);
    sendResponse({ received: true });
    return true;
  }
  return false;
}

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  try {
    const tab = await getCurrentTab();

    if (!tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      updateStatus('Cannot run on this page', 'error');
      return;
    }

    currentTabId.value = tab.id;
    await fetchState();
  } catch (error) {
    console.error('Init error:', error);
    updateStatus('Failed to initialize', 'error');
  }
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

async function toggleCarouselMode() {
  if (isCarouselMode.value) {
    // Stop picker mode
    const response = await sendToContent({ action: 'stopElementPicker' });
    if (response?.success) {
      isCarouselMode.value = false;
      updateStatus('Element picker stopped', 'ready');
    }
  } else {
    // Start picker mode
    const response = await sendToContent({ action: 'startElementPicker' });
    if (response?.success) {
      isCarouselMode.value = true;
      updateStatus('👆 Click on a carousel element to watch', 'active');
    }
  }
}

async function clearCarouselSelector() {
  const response = await sendToContent({ action: 'clearCarouselSelector' });
  if (response?.success) {
    carouselSelector.value = '';
    updateStatus('Carousel selector cleared', 'ready');
  }
}

async function downloadSingleItem(media) {
  updateStatus(`📥 Downloading ${media.type}...`, 'active');
  isDownloading.value = true;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'downloadFile',
      url: media.url,
      filename: getFilenameFromUrl(media.url, media.type)
    });

    if (response?.success) {
      updateStatus(`✓ Downloaded ${media.type}`, 'ready');
      setTimeout(() => {
        isDownloading.value = false;
      }, 2000);
    } else {
      throw new Error(response?.error || 'Download failed');
    }
  } catch (error) {
    console.error('Single download error:', error);
    updateStatus(`❌ ${error.message}`, 'error');
    isDownloading.value = false;
  }
}

function getFilenameFromUrl(url, type) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'download';
    const ext = filename.includes('.') ? filename.split('.').pop() : (type === 'video' ? 'mp4' : 'jpg');
    return filename.includes('.') ? filename : `${filename}.${ext}`;
  } catch {
    const timestamp = Date.now();
    return type === 'video' ? `video-${timestamp}.mp4` : `image-${timestamp}.jpg`;
  }
}


onMounted(() => {
  chrome.runtime.onMessage.addListener(handleMessage);
  init();
});

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(handleMessage);
});
</script>

<style scoped>
/* Styles are imported from popup.css */
</style>
