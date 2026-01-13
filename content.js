/**
 * Smart Media Downloader - Content Script
 * Handles media detection, selection state, and visual feedback
 * SIMPLIFIED: Only responds to explicit user actions, no automatic DOM monitoring
 */

(function() {
  'use strict';

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  const state = {
    isSelectionMode: false,
    selectedMedia: new Map(), // url -> {id, url, type, element, thumbnail}
    detectedMedia: new Map(), // id -> {id, url, type, element}
    mediaIdCounter: 0
  };

  // ============================================
  // CONFIGURATION
  // ============================================

  const CONFIG = {
    MIN_WIDTH: 1000,
    MIN_HEIGHT: 1000,
    LAZY_LOAD_ATTRS: [
      'data-src', 'data-lazy-src', 'data-original', 'data-lazy',
      'data-srcset', 'data-bg', 'data-background', 'data-image',
      'data-full-src', 'data-hi-res', 'data-zoom-image', 'data-large'
    ],
    IMAGE_EXTENSIONS: /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico|avif)(\?.*)?$/i,
    VIDEO_EXTENSIONS: /\.(mp4|webm|ogg|mov|avi|mkv|m4v)(\?.*)?$/i,
    EXCLUDED_PATTERNS: [
      /tracking/i, /analytics/i, /pixel/i, /beacon/i,
      /1x1/, /spacer/, /blank/, /transparent/,
      /avatar/i, /profile/i, /icon/i, /logo/i, /emoji/i,
      /badge/i, /button/i, /spinner/i, /loader/i
    ]
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function generateMediaId() {
    return `media-${++state.mediaIdCounter}-${Date.now()}`;
  }

  function toAbsoluteUrl(url) {
    if (!url || typeof url !== 'string') return null;
    url = url.trim();
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
      return url.startsWith('data:') && url.length > 100 ? url : null;
    }
    try {
      return new URL(url, window.location.href).href;
    } catch {
      return null;
    }
  }

  function extractBgImageUrl(bgValue) {
    if (!bgValue || bgValue === 'none') return null;
    const match = bgValue.match(/url\(['"]?([^'")\s]+)['"]?\)/i);
    return match ? toAbsoluteUrl(match[1]) : null;
  }

  function getMediaType(url) {
    if (!url) return null;
    if (CONFIG.VIDEO_EXTENSIONS.test(url)) return 'video';
    if (CONFIG.IMAGE_EXTENSIONS.test(url)) return 'image';
    return null;
  }

  function isValidMediaUrl(url) {
    if (!url) return false;
    const webpagePatterns = /\.(html?|php|aspx?|jsp|cgi|pl|py)(\?.*)?$/i;
    if (webpagePatterns.test(url)) return false;
    if (url.match(/\/[^.\/]+\/?(\?.*)?$/)) {
      if (!url.match(/[?&](image|img|photo|pic|thumb)/i)) {
        return false;
      }
    }
    return true;
  }

  function shouldExcludeUrl(url) {
    if (!url) return true;
    return CONFIG.EXCLUDED_PATTERNS.some(pattern => pattern.test(url));
  }

  function meetsMinSize(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();

    if (element.tagName === 'VIDEO') {
      const videoWidth = element.videoWidth || rect.width || 0;
      const videoHeight = element.videoHeight || rect.height || 0;
      if (videoWidth >= 500 && videoHeight >= 500) {
        return true;
      }
      return true; // Be lenient with videos
    }

    if (element.tagName === 'IMG') {
      const natWidth = element.naturalWidth || 0;
      const natHeight = element.naturalHeight || 0;
      const dispWidth = rect.width || element.width || 0;
      const dispHeight = rect.height || element.height || 0;
      const attrWidth = parseInt(element.getAttribute('width')) || 0;
      const attrHeight = parseInt(element.getAttribute('height')) || 0;

      const width = Math.max(natWidth, dispWidth, attrWidth);
      const height = Math.max(natHeight, dispHeight, attrHeight);

      if (width >= CONFIG.MIN_WIDTH && height >= CONFIG.MIN_HEIGHT) {
        return true;
      }

      const src = element.src || '';
      if (src.includes('cdn') || src.includes('media') || src.includes('images')) {
        return true;
      }

      return false;
    }

    return rect.width >= CONFIG.MIN_WIDTH && rect.height >= CONFIG.MIN_HEIGHT;
  }

  function getBestSrcsetUrl(srcset) {
    if (!srcset) return null;
    const sources = srcset.split(',').map(s => {
      const parts = s.trim().split(/\s+/);
      const url = parts[0];
      const descriptor = parts[1] || '1x';
      let size = 1;
      if (descriptor.endsWith('w')) {
        size = parseInt(descriptor);
      } else if (descriptor.endsWith('x')) {
        size = parseFloat(descriptor) * 1000;
      }
      return { url: toAbsoluteUrl(url), size };
    }).filter(s => s.url);

    sources.sort((a, b) => b.size - a.size);
    return sources[0]?.url || null;
  }

  // ============================================
  // MEDIA DETECTION ENGINE
  // ============================================

  function detectAllMedia() {
    const mediaUrls = new Set();
    const results = [];

    // 1. Standard <img> elements
    document.querySelectorAll('img').forEach(img => {
      let url = toAbsoluteUrl(img.src);
      if (url && !shouldExcludeUrl(url) && !mediaUrls.has(url)) {
        if (meetsMinSize(img)) {
          mediaUrls.add(url);
          results.push({ url, type: 'image', element: img });
        }
      }

      const srcsetUrl = getBestSrcsetUrl(img.srcset);
      if (srcsetUrl && !shouldExcludeUrl(srcsetUrl) && !mediaUrls.has(srcsetUrl)) {
        mediaUrls.add(srcsetUrl);
        results.push({ url: srcsetUrl, type: 'image', element: img });
      }

      CONFIG.LAZY_LOAD_ATTRS.forEach(attr => {
        const lazyUrl = toAbsoluteUrl(img.getAttribute(attr));
        if (lazyUrl && !shouldExcludeUrl(lazyUrl) && !mediaUrls.has(lazyUrl)) {
          mediaUrls.add(lazyUrl);
          results.push({ url: lazyUrl, type: 'image', element: img });
        }
      });
    });

    // 2. <picture> elements with <source>
    document.querySelectorAll('picture').forEach(picture => {
      picture.querySelectorAll('source').forEach(source => {
        const srcsetUrl = getBestSrcsetUrl(source.srcset);
        if (srcsetUrl && !shouldExcludeUrl(srcsetUrl) && !mediaUrls.has(srcsetUrl)) {
          mediaUrls.add(srcsetUrl);
          results.push({ url: srcsetUrl, type: 'image', element: picture });
        }
      });
    });

    // 3. <video> elements
    document.querySelectorAll('video').forEach(video => {
      let hasVideoSource = false;

      let url = toAbsoluteUrl(video.src);
      if (url && !shouldExcludeUrl(url) && !mediaUrls.has(url)) {
        mediaUrls.add(url);
        results.push({ url, type: 'video', element: video });
        hasVideoSource = true;
      }

      video.querySelectorAll('source').forEach(source => {
        const srcUrl = toAbsoluteUrl(source.src);
        if (srcUrl && !shouldExcludeUrl(srcUrl) && !mediaUrls.has(srcUrl)) {
          mediaUrls.add(srcUrl);
          results.push({ url: srcUrl, type: 'video', element: video });
          hasVideoSource = true;
        }
      });

      if (!hasVideoSource) {
        const posterUrl = toAbsoluteUrl(video.poster);
        if (posterUrl && !shouldExcludeUrl(posterUrl) && !mediaUrls.has(posterUrl)) {
          mediaUrls.add(posterUrl);
          results.push({ url: posterUrl, type: 'image', element: video });
        }
      }
    });

    // Assign IDs and store
    state.detectedMedia.clear();
    results.forEach(media => {
      const id = generateMediaId();
      media.id = id;
      media.element.dataset.smartMediaId = id;
      state.detectedMedia.set(id, media);
    });

    return results;
  }

  // ============================================
  // VISUAL FEEDBACK
  // ============================================

  function createPinOverlay(media) {
    const pin = document.createElement('div');
    pin.className = 'smd-pin';
    pin.dataset.mediaId = media.id;
    pin.title = 'Click to select/deselect this media';

    pin.innerHTML = `
      <svg class="smd-pin-icon smd-pin-add" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
      </svg>
      <svg class="smd-pin-icon smd-pin-check" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display:none;">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    `;

    pin.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      toggleSelection(media.id);
      updatePinState(pin, state.selectedMedia.has(media.url));
    }, true);

    positionPin(pin, media.element);
    document.body.appendChild(pin);
    return pin;
  }

  function positionPin(pin, element) {
    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    pin.style.position = 'absolute';
    pin.style.top = `${rect.top + scrollY + 8}px`;
    pin.style.left = `${rect.right + scrollX - 36}px`;
    pin.style.zIndex = '2147483647';
  }

  function updatePinState(pin, isSelected) {
    const addIcon = pin.querySelector('.smd-pin-add');
    const checkIcon = pin.querySelector('.smd-pin-check');

    if (isSelected) {
      pin.classList.add('smd-pin-selected');
      addIcon.style.display = 'none';
      checkIcon.style.display = 'block';
    } else {
      pin.classList.remove('smd-pin-selected');
      addIcon.style.display = 'block';
      checkIcon.style.display = 'none';
    }
  }

  function highlightDetectedMedia() {
    state.detectedMedia.forEach(media => {
      if (media.element) {
        media.element.classList.add('smd-highlightable');
        const pin = createPinOverlay(media);
        media.pin = pin;
      }
    });

    window.addEventListener('scroll', updateAllPinPositions, true);
    window.addEventListener('resize', updateAllPinPositions);
  }

  function updateAllPinPositions() {
    state.detectedMedia.forEach(media => {
      if (media.pin && media.element) {
        positionPin(media.pin, media.element);
      }
    });
  }

  function removeAllHighlights() {
    document.querySelectorAll('.smd-highlightable, .smd-selected').forEach(el => {
      el.classList.remove('smd-highlightable', 'smd-selected', 'smd-hover');
    });

    document.querySelectorAll('.smd-pin').forEach(pin => pin.remove());

    window.removeEventListener('scroll', updateAllPinPositions, true);
    window.removeEventListener('resize', updateAllPinPositions);
  }

  function updateSelectionVisual(element, isSelected) {
    if (!element) return;
    if (isSelected) {
      element.classList.add('smd-selected');
    } else {
      element.classList.remove('smd-selected');
    }

    const media = Array.from(state.detectedMedia.values()).find(m => m.element === element);
    if (media && media.pin) {
      updatePinState(media.pin, isSelected);
    }
  }

  // ============================================
  // SELECTION HANDLING
  // ============================================

  function toggleSelection(mediaId) {
    const media = state.detectedMedia.get(mediaId);
    if (!media) return false;

    if (state.selectedMedia.has(media.url)) {
      state.selectedMedia.delete(media.url);
      updateSelectionVisual(media.element, false);
    } else {
      const thumbnail = media.type === 'image' ? media.url :
        (media.element.poster || media.url);
      state.selectedMedia.set(media.url, {
        ...media,
        thumbnail
      });
      updateSelectionVisual(media.element, true);
    }

    notifyPopup();
    return true;
  }

  function clearSelections() {
    state.selectedMedia.forEach((media, url) => {
      updateSelectionVisual(media.element, false);
    });
    state.selectedMedia.clear();
    notifyPopup();
  }

  function handleMediaClick(event) {
    if (!state.isSelectionMode) return;

    let mediaId = event.target.dataset.smartMediaId;

    if (!mediaId) {
      const mediaElement = event.target.closest('img[data-smart-media-id], video[data-smart-media-id]');
      if (mediaElement) {
        mediaId = mediaElement.dataset.smartMediaId;
      } else {
        const parent = event.target.closest('[data-smart-media-id]');
        if (parent) {
          mediaId = parent.dataset.smartMediaId;
        }
      }
    }

    if (mediaId && state.detectedMedia.has(mediaId)) {
      event.preventDefault();
      event.stopPropagation();
      toggleSelection(mediaId);
    }
  }

  function handleMediaHover(event) {
    if (!state.isSelectionMode) return;

    const target = event.target.closest('[data-smart-media-id]');
    if (target) {
      if (event.type === 'mouseover') {
        target.classList.add('smd-hover');
      } else {
        target.classList.remove('smd-hover');
      }
    }
  }

  // ============================================
  // MODE MANAGEMENT
  // ============================================

  function startSelectionMode() {
    if (state.isSelectionMode) return;

    state.isSelectionMode = true;
    detectAllMedia();
    highlightDetectedMedia();

    document.addEventListener('click', handleMediaClick, true);
    document.addEventListener('mouseover', handleMediaHover, true);
    document.addEventListener('mouseout', handleMediaHover, true);

    document.body.classList.add('smd-selection-mode');
    notifyPopup();
  }

  function stopSelectionMode() {
    if (!state.isSelectionMode) return;

    state.isSelectionMode = false;
    removeAllHighlights();

    document.removeEventListener('click', handleMediaClick, true);
    document.removeEventListener('mouseover', handleMediaHover, true);
    document.removeEventListener('mouseout', handleMediaHover, true);

    document.body.classList.remove('smd-selection-mode');
    notifyPopup();
  }

  function rescanMedia() {
    const wasInSelectionMode = state.isSelectionMode;
    if (wasInSelectionMode) {
      removeAllHighlights();
    }

    detectAllMedia();

    if (wasInSelectionMode) {
      highlightDetectedMedia();
      // Re-apply selected state based on URL
      state.detectedMedia.forEach((detectedMedia, id) => {
        if (state.selectedMedia.has(detectedMedia.url)) {
          const selected = state.selectedMedia.get(detectedMedia.url);
          selected.element = detectedMedia.element;
          selected.id = detectedMedia.id;
          detectedMedia.element.classList.add('smd-selected');
          if (detectedMedia.pin) {
            updatePinState(detectedMedia.pin, true);
          }
        }
      });
    }

    notifyPopup();
  }

  // ============================================
  // MESSAGING
  // ============================================

  function getState() {
    return {
      isSelectionMode: state.isSelectionMode,
      selectedCount: state.selectedMedia.size,
      detectedCount: state.detectedMedia.size,
      selectedMedia: Array.from(state.selectedMedia.values()).map(m => ({
        id: m.id,
        url: m.url,
        type: m.type,
        thumbnail: m.thumbnail
      }))
    };
  }

  function notifyPopup() {
    chrome.runtime.sendMessage({
      action: 'stateUpdate',
      state: getState()
    }).catch(() => {});
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'ping':
        sendResponse({ pong: true });
        break;

      case 'getState':
        sendResponse(getState());
        break;

      case 'startSelection':
        startSelectionMode();
        sendResponse({ success: true });
        break;

      case 'stopSelection':
        stopSelectionMode();
        sendResponse({ success: true });
        break;

      case 'clearSelection':
        clearSelections();
        sendResponse({ success: true });
        break;

      case 'rescan':
        rescanMedia();
        sendResponse(getState());
        break;

      case 'removeItem':
        let found = false;
        for (const [url, media] of state.selectedMedia) {
          if (media.id === message.id) {
            state.selectedMedia.delete(url);
            updateSelectionVisual(media.element, false);
            found = true;
            break;
          }
        }
        if (found) {
          notifyPopup();
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false });
        }
        break;

      case 'getDownloadUrls':
        const urls = Array.from(state.selectedMedia.values()).map(m => ({
          url: m.url,
          type: m.type
        }));
        sendResponse({ urls });
        break;

      case 'fetchMediaAsBlobs':
        fetchSelectedMediaAsBlobs()
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      default:
        sendResponse({ error: 'Unknown action' });
    }
    return true;
  });

  async function fetchSelectedMediaAsBlobs() {
    const blobs = [];
    const filenames = [];
    const usedFilenames = new Set();
    let index = 0;

    console.log(`[SMD] Starting to fetch ${state.selectedMedia.size} media files...`);

    for (const [url, media] of state.selectedMedia) {
      try {
        console.log(`[SMD] Processing ${media.type}: ${media.url.substring(0, 80)}...`);

        let blob;

        if (media.type === 'image' && media.element && media.element.tagName === 'IMG') {
          try {
            const img = media.element;
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            blob = await new Promise((resolve, reject) => {
              canvas.toBlob(resolve, 'image/jpeg', 0.95);
            });

            if (blob) {
              console.log(`[SMD] Got image blob from canvas: ${blob.size} bytes`);
            }
          } catch (canvasError) {
            console.warn(`[SMD] Canvas method failed:`, canvasError);
          }
        }

        if (!blob) {
          blob = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', media.url, true);
            xhr.responseType = 'blob';
            xhr.withCredentials = true;

            xhr.onload = function() {
              if (xhr.status === 200) {
                console.log(`[SMD] XHR Success: ${xhr.response.size} bytes`);
                resolve(xhr.response);
              } else {
                console.error(`[SMD] XHR HTTP ${xhr.status}`);
                reject(new Error(`HTTP ${xhr.status}`));
              }
            };

            xhr.onerror = function() {
              console.error(`[SMD] XHR Network error`);
              reject(new Error('Network error'));
            };

            xhr.send();
          });
        }

        if (!blob || blob.size === 0) {
          console.error(`[SMD] Empty or invalid blob`);
          continue;
        }

        console.log(`[SMD] Blob ready: ${blob.size} bytes, type: ${blob.type}`);

        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
        });
        reader.readAsDataURL(blob);
        const base64 = await base64Promise;

        const ext = media.type === 'video' ? 'mp4' : 'jpg';
        let filename = extractFilenameFromUrl(media.url) || `media_${index + 1}.${ext}`;

        let uniqueFilename = filename;
        let counter = 1;
        while (usedFilenames.has(uniqueFilename)) {
          const parts = filename.split('.');
          const extension = parts.pop();
          const name = parts.join('.');
          uniqueFilename = `${name}_${counter}.${extension}`;
          counter++;
        }
        usedFilenames.add(uniqueFilename);

        blobs.push(base64);
        filenames.push(uniqueFilename);
        index++;

        console.log(`[SMD] Fetched ${index}/${state.selectedMedia.size}: ${uniqueFilename}`);
      } catch (error) {
        console.error(`[SMD] Failed to fetch ${media.url}:`, error);
      }
    }

    if (blobs.length === 0) {
      throw new Error('Failed to fetch any media files');
    }

    return {
      success: true,
      blobs,
      filenames
    };
  }

  function extractFilenameFromUrl(url) {
    try {
      const urlObj = new URL(url);
      let filename = urlObj.pathname.split('/').pop();
      filename = filename.split('?')[0];
      filename = decodeURIComponent(filename);
      filename = filename.replace(/[<>:"/\\|?*]/g, '_');
      return filename;
    } catch {
      return null;
    }
  }

  // ============================================
  // INITIALIZATION & KEYBOARD SHORTCUTS
  // ============================================

  // Don't auto-detect - wait for user to activate selection mode
  console.log('[Smart Media Downloader] Content script loaded');

  // Keyboard shortcut: Ctrl+D to download, D to download current
  document.addEventListener('keydown', (e) => {
    // Ctrl+D: Download all selected
    if (e.key.toLowerCase() === 'd' && e.ctrlKey) {
      e.preventDefault();
      chrome.runtime.sendMessage({
        action: 'triggerDownload',
        type: 'zip'
      }).catch(() => {});
    }
    // D: Quick download (in case user presses D alone)
    else if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.metaKey && !e.altKey && state.isSelectionMode) {
      e.preventDefault();
      chrome.runtime.sendMessage({
        action: 'triggerDownload',
        type: 'zip'
      }).catch(() => {});
    }
  });

})();
