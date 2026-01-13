/**
 * Smart Media Downloader - Popup Script
 * Handles UI state, user interactions, and communication with content/background scripts
 */

(function() {
  'use strict';

  // ============================================
  // DOM ELEMENTS
  // ============================================

  const elements = {
    detectedCount: document.getElementById('detected-count'),
    selectedCount: document.getElementById('selected-count'),
    imageCount: document.getElementById('image-count'),
    videoCount: document.getElementById('video-count'),
    toggleSelection: document.getElementById('toggle-selection'),
    rescan: document.getElementById('rescan'),
    downloadZip: document.getElementById('download-zip'),
    downloadIndividual: document.getElementById('download-individual'),
    clearSelection: document.getElementById('clear-selection'),
    previewGrid: document.getElementById('preview-grid'),
    previewCount: document.getElementById('preview-count'),
    emptyState: document.getElementById('empty-state'),
    statusBar: document.getElementById('status-bar'),
    statusText: document.getElementById('status-text')
  };

  // ============================================
  // STATE
  // ============================================

  let state = {
    isSelectionMode: false,
    selectedMedia: [],
    detectedCount: 0,
    currentTabId: null
  };

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
      state.currentTabId = tab.id;

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
    }
  }

  // ============================================
  // UI UPDATES
  // ============================================

  function updateUIFromState(newState) {
    state.isSelectionMode = newState.isSelectionMode;
    state.selectedMedia = newState.selectedMedia || [];
    state.detectedCount = newState.detectedCount || 0;

    // Update stats
    elements.detectedCount.textContent = state.detectedCount;
    elements.selectedCount.textContent = state.selectedMedia.length;

    // Count by type
    const imageCount = state.selectedMedia.filter(m => m.type === 'image').length;
    const videoCount = state.selectedMedia.filter(m => m.type === 'video').length;
    elements.imageCount.textContent = imageCount;
    elements.videoCount.textContent = videoCount;

    // Update toggle button
    updateToggleButton();

    // Update action buttons
    const hasSelection = state.selectedMedia.length > 0;
    elements.downloadZip.disabled = !hasSelection;
    elements.downloadIndividual.disabled = !hasSelection;
    elements.clearSelection.disabled = !hasSelection;

    // Update preview grid
    updatePreviewGrid();

    // Update preview count
    elements.previewCount.textContent = `${state.selectedMedia.length} item${state.selectedMedia.length !== 1 ? 's' : ''}`;

    // Update status
    if (state.isSelectionMode) {
      updateStatus('👆 Click to select videos/images. Press Ctrl+D to download.', 'active');
    } else if (hasSelection) {
      updateStatus(`✓ ${state.selectedMedia.length} item(s) ready to download`, 'ready');
    } else {
      updateStatus('Click "Start Selecting" or Rescan to find media', 'ready');
    }
  }

  function updateToggleButton() {
    const btn = elements.toggleSelection;
    const btnText = btn.querySelector('.btn-text');
    const iconStart = btn.querySelector('.icon-start');
    const iconStop = btn.querySelector('.icon-stop');

    if (state.isSelectionMode) {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-warning');
      btnText.textContent = 'Stop Selecting';
      iconStart.style.display = 'none';
      iconStop.style.display = 'inline';
    } else {
      btn.classList.remove('btn-warning');
      btn.classList.add('btn-primary');
      btnText.textContent = 'Start Selecting';
      iconStart.style.display = 'inline';
      iconStop.style.display = 'none';
    }
  }

  function updatePreviewGrid() {
    const existingItems = elements.previewGrid.querySelectorAll('.preview-item');
    existingItems.forEach(item => item.remove());

    if (state.selectedMedia.length === 0) {
      elements.emptyState.style.display = 'flex';
      return;
    }
    elements.emptyState.style.display = 'none';

    state.selectedMedia.forEach((media, index) => {
      const item = createPreviewItem(media, index);
      elements.previewGrid.appendChild(item);
    });
  }

  function createPreviewItem(media, index) {
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.dataset.id = media.id;

    const thumb = document.createElement('div');
    thumb.className = 'preview-thumb';

    if (media.type === 'video') {
      thumb.classList.add('video-thumb');
      thumb.innerHTML = `
        <svg class="video-icon" width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M8 5v14l11-7z"/>
        </svg>
      `;
      if (media.thumbnail && !media.thumbnail.includes('.mp4')) {
        thumb.style.backgroundImage = `url(${media.thumbnail})`;
      }
    } else {
      thumb.style.backgroundImage = `url(${media.thumbnail || media.url})`;
    }

    const typeBadge = document.createElement('span');
    typeBadge.className = `type-badge ${media.type}`;
    typeBadge.textContent = media.type.toUpperCase();

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.title = 'Remove from selection';
    removeBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      </svg>
    `;
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeItem(media.id);
    });

    const indexBadge = document.createElement('span');
    indexBadge.className = 'index-badge';
    indexBadge.textContent = index + 1;

    item.appendChild(thumb);
    item.appendChild(typeBadge);
    item.appendChild(removeBtn);
    item.appendChild(indexBadge);

    return item;
  }

  function updateStatus(message, type = 'ready') {
    elements.statusText.textContent = message;
    elements.statusBar.className = `status-bar status-${type}`;
  }

  // ============================================
  // ACTIONS
  // ============================================

  async function toggleSelectionMode() {
    const action = state.isSelectionMode ? 'stopSelection' : 'startSelection';
    const response = await sendToContent({ action });
    if (response?.success) {
      await fetchState();
    }
  }

  async function rescanPage() {
    updateStatus('📍 Scanning page for media...', 'active');
    elements.rescan.disabled = true;

    const response = await sendToContent({ action: 'rescan' });
    if (response) {
      updateUIFromState(response);
      updateStatus(`✓ Found ${response.detectedCount} media items`, 'ready');
    }

    elements.rescan.disabled = false;
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
    if (state.selectedMedia.length === 0) return;

    updateStatus(`📦 Fetching ${state.selectedMedia.length} files...`, 'active');
    elements.downloadZip.disabled = true;

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
        updateStatus(`✓ ZIP downloaded! (${zipResponse.count} files)`, 'ready');
        setTimeout(() => {
          elements.downloadZip.disabled = false;
        }, 3000);
      } else {
        throw new Error(zipResponse?.error || 'ZIP creation failed');
      }
    } catch (error) {
      console.error('ZIP download error:', error);
      updateStatus(`❌ ${error.message}`, 'error');
      elements.downloadZip.disabled = false;
    }
  }

  async function downloadIndividual() {
    if (state.selectedMedia.length === 0) return;

    updateStatus(`📥 Downloading ${state.selectedMedia.length} files...`, 'active');
    elements.downloadIndividual.disabled = true;

    try {
      const urls = state.selectedMedia.map(m => ({
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
          elements.downloadIndividual.disabled = false;
        }, 3000);
      } else {
        throw new Error(response?.error || 'Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      updateStatus(`❌ Error: ${error.message}`, 'error');
      elements.downloadIndividual.disabled = false;
    }
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  elements.toggleSelection.addEventListener('click', toggleSelectionMode);
  elements.rescan.addEventListener('click', rescanPage);
  elements.downloadZip.addEventListener('click', downloadAsZip);
  elements.downloadIndividual.addEventListener('click', downloadIndividual);
  elements.clearSelection.addEventListener('click', clearSelection);

  // Listen for state updates from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'stateUpdate' && sender.tab?.id === state.currentTabId) {
      updateUIFromState(message.state);
    }
    sendResponse({ received: true });
    return true;
  });

  // ============================================
  // INITIALIZATION
  // ============================================

  async function init() {
    try {
      const tab = await getCurrentTab();

      if (!tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        updateStatus('Cannot run on this page', 'error');
        elements.toggleSelection.disabled = true;
        elements.rescan.disabled = true;
        return;
      }

      state.currentTabId = tab.id;
      await fetchState();
    } catch (error) {
      console.error('Init error:', error);
      updateStatus('Failed to initialize', 'error');
    }
  }

  init();
})();
