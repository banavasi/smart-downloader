/**
 * Smart Media Downloader - Content Script
 * Handles media detection, selection state, and visual feedback
 * Now includes automatic DOM monitoring for carousels and dynamic content
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
    mediaIdCounter: 0,
    mutationObserver: null, // Observer for DOM changes
    periodicCheckInterval: null, // Periodic check for new media
    photoswipeWatcherInterval: null, // Watcher for PhotoSwipe slide changes
    lastPhotoSwipeImageUrl: null // Track last selected PhotoSwipe image
  };

  // ============================================
  // CONFIGURATION
  // ============================================

  let CONFIG = {
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
    ],
    CUSTOM_SELECTORS: [] // Will be loaded from storage
  };

  // Load configuration from storage
  async function loadConfig() {
    try {
      const result = await chrome.storage.sync.get(['customSelectors', 'settings']);

      if (result.settings) {
        CONFIG.MIN_WIDTH = result.settings.minWidth || CONFIG.MIN_WIDTH;
        CONFIG.MIN_HEIGHT = result.settings.minHeight || CONFIG.MIN_HEIGHT;
      }

      if (result.customSelectors && result.customSelectors.length > 0) {
        // Flatten all custom selectors into one array
        CONFIG.CUSTOM_SELECTORS = result.customSelectors
          .flatMap(config => config.selectors)
          .filter(sel => sel && sel.trim() !== '');
        console.log('[SMD] Loaded custom selectors:', CONFIG.CUSTOM_SELECTORS);
      }
    } catch (error) {
      console.error('[SMD] Failed to load config:', error);
    }
  }

  // Load config on initialization
  loadConfig();

  // Listen for config updates
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'updateConfig') {
      if (message.settings) {
        CONFIG.MIN_WIDTH = message.settings.minWidth || CONFIG.MIN_WIDTH;
        CONFIG.MIN_HEIGHT = message.settings.minHeight || CONFIG.MIN_HEIGHT;
      }
      loadConfig(); // Reload custom selectors
    }
    return false;
  });

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

    // 0. Custom selectors (user-defined, highest priority)
    if (CONFIG.CUSTOM_SELECTORS && CONFIG.CUSTOM_SELECTORS.length > 0) {
      CONFIG.CUSTOM_SELECTORS.forEach(selector => {
        try {
          document.querySelectorAll(selector).forEach(element => {
            let url = null;
            let type = 'image';

            // Check if element is an img or contains an img
            if (element.tagName === 'IMG') {
              url = toAbsoluteUrl(element.src);
              type = 'image';
            } else if (element.tagName === 'VIDEO') {
              url = toAbsoluteUrl(element.src);
              type = 'video';
            } else {
              // Try to find img/video inside
              const img = element.querySelector('img');
              const video = element.querySelector('video');

              if (img && img.src) {
                url = toAbsoluteUrl(img.src);
                type = 'image';
              } else if (video && video.src) {
                url = toAbsoluteUrl(video.src);
                type = 'video';
              } else if (element.style && element.style.backgroundImage) {
                url = extractBgImageUrl(element.style.backgroundImage);
                type = 'image';
              }
            }

            if (url && !shouldExcludeUrl(url) && !mediaUrls.has(url)) {
              if (type === 'image' && meetsMinSize(element)) {
                mediaUrls.add(url);
                results.push({ url, type, element });
              } else if (type === 'video') {
                mediaUrls.add(url);
                results.push({ url, type, element });
              }
            }
          });
        } catch (error) {
          console.warn(`[SMD] Invalid selector "${selector}":`, error);
        }
      });
    }

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

    // Assign IDs and store (merge with existing, don't clear)
    const existingUrls = new Set(Array.from(state.detectedMedia.values()).map(m => m.url));

    results.forEach(media => {
      // Skip if already detected
      if (existingUrls.has(media.url)) {
        return;
      }

      const id = generateMediaId();
      media.id = id;
      media.element.dataset.smartMediaId = id;
      state.detectedMedia.set(id, media);

      // If in selection mode, highlight the new media
      if (state.isSelectionMode) {
        const pin = createPinOverlay(media);
        media.pin = pin;
        media.element.classList.add('smd-highlightable');

        // Check if this URL was already selected
        if (state.selectedMedia.has(media.url)) {
          const selected = state.selectedMedia.get(media.url);
          selected.element = media.element;
          selected.id = media.id;
          media.element.classList.add('smd-selected');
          if (pin) {
            updatePinState(pin, true);
          }
        }
      }
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

    // Start watching for DOM changes (carousels, dynamic content)
    startDOMObserver();

    // Start watching PhotoSwipe for auto-selection on swipe
    startPhotoSwipeWatcher();

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

    // Stop watching for DOM changes
    stopDOMObserver();

    // Stop watching PhotoSwipe
    stopPhotoSwipeWatcher();

    document.removeEventListener('click', handleMediaClick, true);
    document.removeEventListener('mouseover', handleMediaHover, true);
    document.removeEventListener('mouseout', handleMediaHover, true);

    document.body.classList.remove('smd-selection-mode');
    notifyPopup();
  }

  // ============================================
  // DOM CHANGE DETECTION (for carousels)
  // ============================================

  function detectNewMediaInElement(element) {
    const newMedia = [];
    const existingUrls = new Set(Array.from(state.detectedMedia.values()).map(m => m.url));

    // Check custom selectors first
    if (CONFIG.CUSTOM_SELECTORS && CONFIG.CUSTOM_SELECTORS.length > 0) {
      CONFIG.CUSTOM_SELECTORS.forEach(selector => {
        try {
          // Check if element matches selector or contains elements that match
          if (element.matches && element.matches(selector)) {
            let url = null;
            let type = 'image';

            if (element.tagName === 'IMG') {
              url = toAbsoluteUrl(element.src);
            } else if (element.tagName === 'VIDEO') {
              url = toAbsoluteUrl(element.src);
              type = 'video';
            } else {
              const img = element.querySelector('img');
              const video = element.querySelector('video');
              if (img && img.src) {
                url = toAbsoluteUrl(img.src);
              } else if (video && video.src) {
                url = toAbsoluteUrl(video.src);
                type = 'video';
              }
            }

            if (url && !shouldExcludeUrl(url) && !existingUrls.has(url)) {
              if (type === 'image' && meetsMinSize(element)) {
                newMedia.push({ url, type, element });
              } else if (type === 'video') {
                newMedia.push({ url, type, element });
              }
            }
          }

          // Also check children that match selector
          element.querySelectorAll(selector).forEach(matchedElement => {
            if (matchedElement === element) return; // Already checked

            let url = null;
            let type = 'image';

            if (matchedElement.tagName === 'IMG') {
              url = toAbsoluteUrl(matchedElement.src);
            } else if (matchedElement.tagName === 'VIDEO') {
              url = toAbsoluteUrl(matchedElement.src);
              type = 'video';
            } else {
              const img = matchedElement.querySelector('img');
              const video = matchedElement.querySelector('video');
              if (img && img.src) {
                url = toAbsoluteUrl(img.src);
              } else if (video && video.src) {
                url = toAbsoluteUrl(video.src);
                type = 'video';
              }
            }

            if (url && !shouldExcludeUrl(url) && !existingUrls.has(url)) {
              if (type === 'image' && meetsMinSize(matchedElement)) {
                newMedia.push({ url, type, element: matchedElement });
              } else if (type === 'video') {
                newMedia.push({ url, type, element: matchedElement });
              }
            }
          });
        } catch (error) {
          // Invalid selector, skip
        }
      });
    }

    // Check for new img elements
    if (element.tagName === 'IMG' || element.querySelectorAll) {
      const imgs = element.tagName === 'IMG' ? [element] : element.querySelectorAll('img');
      imgs.forEach(img => {
        let url = toAbsoluteUrl(img.src);
        if (url && !shouldExcludeUrl(url) && !existingUrls.has(url)) {
          if (meetsMinSize(img)) {
            newMedia.push({ url, type: 'image', element: img });
          }
        }

        // Check srcset
        const srcsetUrl = getBestSrcsetUrl(img.srcset);
        if (srcsetUrl && !shouldExcludeUrl(srcsetUrl) && !existingUrls.has(srcsetUrl)) {
          newMedia.push({ url: srcsetUrl, type: 'image', element: img });
        }

        // Check lazy load attributes
        CONFIG.LAZY_LOAD_ATTRS.forEach(attr => {
          const lazyUrl = toAbsoluteUrl(img.getAttribute(attr));
          if (lazyUrl && !shouldExcludeUrl(lazyUrl) && !existingUrls.has(lazyUrl)) {
            newMedia.push({ url: lazyUrl, type: 'image', element: img });
          }
        });
      });
    }

    // Check for new video elements
    if (element.tagName === 'VIDEO' || element.querySelectorAll) {
      const videos = element.tagName === 'VIDEO' ? [element] : element.querySelectorAll('video');
      videos.forEach(video => {
        let url = toAbsoluteUrl(video.src);
        if (url && !shouldExcludeUrl(url) && !existingUrls.has(url)) {
          newMedia.push({ url, type: 'video', element: video });
        }

        video.querySelectorAll('source').forEach(source => {
          const srcUrl = toAbsoluteUrl(source.src);
          if (srcUrl && !shouldExcludeUrl(srcUrl) && !existingUrls.has(srcUrl)) {
            newMedia.push({ url: srcUrl, type: 'video', element: video });
          }
        });
      });
    }

    // Check for picture elements
    if (element.tagName === 'PICTURE' || element.querySelectorAll) {
      const pictures = element.tagName === 'PICTURE' ? [element] : element.querySelectorAll('picture');
      pictures.forEach(picture => {
        picture.querySelectorAll('source').forEach(source => {
          const srcsetUrl = getBestSrcsetUrl(source.srcset);
          if (srcsetUrl && !shouldExcludeUrl(srcsetUrl) && !existingUrls.has(srcsetUrl)) {
            newMedia.push({ url: srcsetUrl, type: 'image', element: picture });
          }
        });
      });
    }

    return newMedia;
  }

  function startDOMObserver() {
    if (state.mutationObserver) {
      return; // Already observing
    }

    console.log('[SMD] Starting DOM observer for carousel detection...');

    // Function to detect PhotoSwipe images
    function detectPhotoSwipeImages() {
      const photoswipeContainer = document.querySelector('.pswp__container, #pswp__items');
      if (!photoswipeContainer) {
        return [];
      }

      const newMedia = [];
      const existingUrls = new Set(Array.from(state.detectedMedia.values()).map(m => m.url));

      // Find all images in PhotoSwipe items
      const photoswipeItems = photoswipeContainer.querySelectorAll('.pswp__item');
      photoswipeItems.forEach(item => {
        const img = item.querySelector('.pswp__img img, img');
        if (img) {
          const url = toAbsoluteUrl(img.src);
          if (url && !shouldExcludeUrl(url) && !existingUrls.has(url)) {
            // PhotoSwipe images are typically large, so we'll accept them
            newMedia.push({ url, type: 'image', element: img });
          }
        }
      });

      return newMedia;
    }

    state.mutationObserver = new MutationObserver((mutations) => {
      if (!state.isSelectionMode) {
        return; // Only watch when in selection mode
      }

      let hasNewMedia = false;
      const processedElements = new Set();

      // First, check PhotoSwipe container specifically
      const photoswipeMedia = detectPhotoSwipeImages();
      if (photoswipeMedia.length > 0) {
        hasNewMedia = true;
        console.log(`[SMD] Found ${photoswipeMedia.length} new PhotoSwipe image(s)`);

        photoswipeMedia.forEach(media => {
          const id = generateMediaId();
          media.id = id;
          media.element.dataset.smartMediaId = id;
          state.detectedMedia.set(id, media);

          if (state.isSelectionMode) {
            const pin = createPinOverlay(media);
            media.pin = pin;
            media.element.classList.add('smd-highlightable');

            if (state.selectedMedia.has(media.url)) {
              const selected = state.selectedMedia.get(media.url);
              selected.element = media.element;
              selected.id = media.id;
              media.element.classList.add('smd-selected');
              if (pin) {
                updatePinState(pin, true);
              }
            }
          }
        });
      }

      mutations.forEach((mutation) => {
        // Check added nodes
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE && !processedElements.has(node)) {
            processedElements.add(node);

            // Check if it's a PhotoSwipe item or contains one
            if (node.classList && (node.classList.contains('pswp__item') || node.querySelector('.pswp__item'))) {
              const newMedia = detectPhotoSwipeImages();
              if (newMedia.length > 0) {
                hasNewMedia = true;
                console.log(`[SMD] PhotoSwipe item added, found ${newMedia.length} new image(s)`);

                newMedia.forEach(media => {
                  const id = generateMediaId();
                  media.id = id;
                  media.element.dataset.smartMediaId = id;
                  state.detectedMedia.set(id, media);

                  if (state.isSelectionMode) {
                    const pin = createPinOverlay(media);
                    media.pin = pin;
                    media.element.classList.add('smd-highlightable');

                    if (state.selectedMedia.has(media.url)) {
                      const selected = state.selectedMedia.get(media.url);
                      selected.element = media.element;
                      selected.id = media.id;
                      media.element.classList.add('smd-selected');
                      if (pin) {
                        updatePinState(pin, true);
                      }
                    }
                  }
                });
              }
            }

            const newMedia = detectNewMediaInElement(node);
            if (newMedia.length > 0) {
              hasNewMedia = true;
              console.log(`[SMD] Found ${newMedia.length} new media item(s) in added node`);

              // Add new media to detected list
              newMedia.forEach(media => {
                const id = generateMediaId();
                media.id = id;
                media.element.dataset.smartMediaId = id;
                state.detectedMedia.set(id, media);

                // Highlight if in selection mode
                const pin = createPinOverlay(media);
                media.pin = pin;
                media.element.classList.add('smd-highlightable');

                // Check if already selected
                if (state.selectedMedia.has(media.url)) {
                  const selected = state.selectedMedia.get(media.url);
                  selected.element = media.element;
                  selected.id = media.id;
                  media.element.classList.add('smd-selected');
                  if (pin) {
                    updatePinState(pin, true);
                  }
                }
              });
            }

            // Also check for attribute changes (e.g., src changes on existing images)
            if (node.tagName === 'IMG' || node.tagName === 'VIDEO') {
              const url = toAbsoluteUrl(node.src || node.getAttribute('src'));
              if (url && !shouldExcludeUrl(url)) {
                const existingUrls = new Set(Array.from(state.detectedMedia.values()).map(m => m.url));
                if (!existingUrls.has(url) && meetsMinSize(node)) {
                  hasNewMedia = true;
                  console.log(`[SMD] Found new media via attribute: ${url.substring(0, 50)}...`);
                  const media = { url, type: node.tagName === 'VIDEO' ? 'video' : 'image', element: node };
                  const id = generateMediaId();
                  media.id = id;
                  node.dataset.smartMediaId = id;
                  state.detectedMedia.set(id, media);

                  if (state.isSelectionMode) {
                    const pin = createPinOverlay(media);
                    media.pin = pin;
                    node.classList.add('smd-highlightable');
                  }
                }
              }
            }
          }
        });

        // Check for attribute changes (e.g., src changes in PhotoSwipe)
        if (mutation.type === 'attributes' && mutation.target) {
          const target = mutation.target;

          // Check PhotoSwipe images specifically
          if (target.tagName === 'IMG' && target.closest('.pswp__item, .pswp__img')) {
            const url = toAbsoluteUrl(target.src);
            if (url && !shouldExcludeUrl(url)) {
              const existingUrls = new Set(Array.from(state.detectedMedia.values()).map(m => m.url));
              if (!existingUrls.has(url)) {
                hasNewMedia = true;
                console.log(`[SMD] PhotoSwipe image src changed: ${url.substring(0, 50)}...`);
                const media = { url, type: 'image', element: target };
                const id = generateMediaId();
                media.id = id;
                target.dataset.smartMediaId = id;
                state.detectedMedia.set(id, media);

                if (state.isSelectionMode) {
                  const pin = createPinOverlay(media);
                  media.pin = pin;
                  target.classList.add('smd-highlightable');
                }
              }
            }
          }

          if ((target.tagName === 'IMG' || target.tagName === 'VIDEO') &&
              (mutation.attributeName === 'src' || mutation.attributeName === 'srcset' ||
               CONFIG.LAZY_LOAD_ATTRS.includes(mutation.attributeName))) {

            const newMedia = detectNewMediaInElement(target);
            if (newMedia.length > 0) {
              hasNewMedia = true;
              console.log(`[SMD] Found ${newMedia.length} new media via attribute change on ${target.tagName}`);
              newMedia.forEach(media => {
                const id = generateMediaId();
                media.id = id;
                media.element.dataset.smartMediaId = id;
                state.detectedMedia.set(id, media);

                if (state.isSelectionMode) {
                  const pin = createPinOverlay(media);
                  media.pin = pin;
                  media.element.classList.add('smd-highlightable');
                }
              });
            }
          }
        }
      });

      if (hasNewMedia) {
        const totalCount = Array.from(state.detectedMedia.values()).length;
        console.log(`[SMD] Total detected media: ${totalCount}`);
        notifyPopup();
        updateAllPinPositions();
      }
    });

    // Start observing with comprehensive options
    state.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'data-src', 'data-lazy-src', 'data-original', 'data-srcset', 'data-bg', 'data-background']
    });

    console.log('[SMD] DOM observer started - watching for new media in carousels and PhotoSwipe');

    // Also add periodic check as fallback (some carousels swap images in place)
    state.periodicCheckInterval = setInterval(() => {
      if (!state.isSelectionMode) {
        return;
      }

      // Check PhotoSwipe container specifically
      const photoswipeContainer = document.querySelector('.pswp__container, #pswp__items');
      if (photoswipeContainer) {
        const existingUrls = new Set(Array.from(state.detectedMedia.values()).map(m => m.url));
        const photoswipeImgs = photoswipeContainer.querySelectorAll('.pswp__item img, .pswp__img img');
        let foundNew = false;

        photoswipeImgs.forEach(img => {
          const url = toAbsoluteUrl(img.src);
          if (url && !shouldExcludeUrl(url) && !existingUrls.has(url)) {
            foundNew = true;
            console.log(`[SMD] Periodic check found PhotoSwipe image: ${url.substring(0, 50)}...`);
            const media = { url, type: 'image', element: img };
            const id = generateMediaId();
            media.id = id;
            img.dataset.smartMediaId = id;
            state.detectedMedia.set(id, media);

            if (state.isSelectionMode) {
              const pin = createPinOverlay(media);
              media.pin = pin;
              img.classList.add('smd-highlightable');

              if (state.selectedMedia.has(media.url)) {
                const selected = state.selectedMedia.get(media.url);
                selected.element = media.element;
                selected.id = media.id;
                img.classList.add('smd-selected');
                if (pin) {
                  updatePinState(pin, true);
                }
              }
            }
          }
        });

        if (foundNew) {
          console.log(`[SMD] Periodic check found new PhotoSwipe media. Total: ${state.detectedMedia.size}`);
          notifyPopup();
          updateAllPinPositions();
          return;
        }
      }

      // Quick check for new images that might have been missed (general)
      const existingUrls = new Set(Array.from(state.detectedMedia.values()).map(m => m.url));
      const allImgs = document.querySelectorAll('img:not([data-smart-media-id])');
      let foundNew = false;

      allImgs.forEach(img => {
        const url = toAbsoluteUrl(img.src);
        if (url && !shouldExcludeUrl(url) && !existingUrls.has(url) && meetsMinSize(img)) {
          foundNew = true;
          const media = { url, type: 'image', element: img };
          const id = generateMediaId();
          media.id = id;
          img.dataset.smartMediaId = id;
          state.detectedMedia.set(id, media);

          if (state.isSelectionMode) {
            const pin = createPinOverlay(media);
            media.pin = pin;
            img.classList.add('smd-highlightable');

            if (state.selectedMedia.has(media.url)) {
              const selected = state.selectedMedia.get(media.url);
              selected.element = media.element;
              selected.id = media.id;
              img.classList.add('smd-selected');
              if (pin) {
                updatePinState(pin, true);
              }
            }
          }
        }
      });

      if (foundNew) {
        console.log(`[SMD] Periodic check found new media. Total: ${state.detectedMedia.size}`);
        notifyPopup();
        updateAllPinPositions();
      }
    }, 500); // Check every 500ms for PhotoSwipe responsiveness
  }

  function stopDOMObserver() {
    if (state.mutationObserver) {
      state.mutationObserver.disconnect();
      state.mutationObserver = null;
      console.log('[SMD] DOM observer stopped');
    }

    if (state.periodicCheckInterval) {
      clearInterval(state.periodicCheckInterval);
      state.periodicCheckInterval = null;
      console.log('[SMD] Periodic check stopped');
    }
  }

  // ============================================
  // PHOTOSWIPE AUTO-SELECTION ON SWIPE
  // ============================================

  function getActivePhotoSwipeImage() {
    const photoswipeContainer = document.querySelector('.pswp__container, #pswp__items');
    if (!photoswipeContainer) {
      return null;
    }

    // Find the active slide (aria-hidden="false")
    const activeItem = photoswipeContainer.querySelector('.pswp__item[aria-hidden="false"]');
    if (!activeItem) {
      return null;
    }

    // Find the image in the active item
    const img = activeItem.querySelector('.pswp__img img, img');
    if (!img || !img.src) {
      return null;
    }

    const url = toAbsoluteUrl(img.src);
    if (!url || shouldExcludeUrl(url)) {
      return null;
    }

    return { url, element: img };
  }

  function startPhotoSwipeWatcher() {
    if (state.photoswipeWatcherInterval) {
      return; // Already watching
    }

    console.log('[SMD] Starting PhotoSwipe auto-selection watcher...');

    state.photoswipeWatcherInterval = setInterval(() => {
      if (!state.isSelectionMode) {
        return;
      }

      const activeImage = getActivePhotoSwipeImage();
      if (!activeImage) {
        return;
      }

      // Check if this is a new image (different from last one)
      if (activeImage.url === state.lastPhotoSwipeImageUrl) {
        return; // Same image, no change
      }

      // New image detected - auto-select it
      state.lastPhotoSwipeImageUrl = activeImage.url;

      // First, make sure it's detected
      let media = Array.from(state.detectedMedia.values()).find(m => m.url === activeImage.url);

      if (!media) {
        // Not detected yet, add it
        const id = generateMediaId();
        media = {
          id,
          url: activeImage.url,
          type: 'image',
          element: activeImage.element
        };
        activeImage.element.dataset.smartMediaId = id;
        state.detectedMedia.set(id, media);

        // Highlight it
        if (state.isSelectionMode) {
          const pin = createPinOverlay(media);
          media.pin = pin;
          activeImage.element.classList.add('smd-highlightable');
        }
      }

      // Auto-select if not already selected
      if (!state.selectedMedia.has(activeImage.url)) {
        const thumbnail = activeImage.url;
        state.selectedMedia.set(activeImage.url, {
          ...media,
          thumbnail
        });
        updateSelectionVisual(media.element, true);
        console.log(`[SMD] Auto-selected PhotoSwipe image on swipe: ${activeImage.url.substring(0, 50)}...`);
        notifyPopup();
      }
    }, 300); // Check every 300ms for responsive swipe detection
  }

  function stopPhotoSwipeWatcher() {
    if (state.photoswipeWatcherInterval) {
      clearInterval(state.photoswipeWatcherInterval);
      state.photoswipeWatcherInterval = null;
      state.lastPhotoSwipeImageUrl = null;
      console.log('[SMD] PhotoSwipe watcher stopped');
    }
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
      carouselSelector: carouselSelector,
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

  // ============================================
  // ELEMENT PICKER (for carousel mode)
  // ============================================

  let elementPickerActive = false;
  let carouselSelector = '';

  function generateSelector(element) {
    if (!element || element === document.body) return 'body';

    // Try ID first
    if (element.id) {
      return `#${element.id}`;
    }

    // Try class
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) {
        // Use the first meaningful class
        const classSelector = '.' + classes[0];
        // Check if it's unique enough
        if (document.querySelectorAll(classSelector).length <= 5) {
          return classSelector;
        }
      }
    }

    // Try tag name with nth-child
    const tagName = element.tagName.toLowerCase();
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(el => el.tagName === element.tagName);
      const index = siblings.indexOf(element);
      if (siblings.length > 1 && index >= 0) {
        return `${tagName}:nth-child(${index + 1})`;
      }
    }

    return tagName;
  }

  function startElementPicker() {
    if (elementPickerActive) return;

    elementPickerActive = true;
    document.body.style.cursor = 'crosshair';

    const highlight = document.createElement('div');
    highlight.id = 'smd-element-picker-highlight';
    highlight.style.cssText = `
      position: absolute;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.1);
      pointer-events: none;
      z-index: 999999;
      display: none;
    `;
    document.body.appendChild(highlight);

    function updateHighlight(e) {
      const element = e.target;
      if (element === highlight || element.id === 'smd-element-picker-highlight') return;

      const rect = element.getBoundingClientRect();
      highlight.style.display = 'block';
      highlight.style.left = rect.left + window.scrollX + 'px';
      highlight.style.top = rect.top + window.scrollY + 'px';
      highlight.style.width = rect.width + 'px';
      highlight.style.height = rect.height + 'px';
    }

    function handleClick(e) {
      e.preventDefault();
      e.stopPropagation();

      const element = e.target;
      if (element === highlight || element.id === 'smd-element-picker-highlight') return;

      const selector = generateSelector(element);
      carouselSelector = selector;

      // Add to CONFIG.CUSTOM_SELECTORS temporarily
      if (!CONFIG.CUSTOM_SELECTORS.includes(selector)) {
        CONFIG.CUSTOM_SELECTORS.push(selector);
      }

      stopElementPicker();

      // Notify popup
      chrome.runtime.sendMessage({
        action: 'elementPicked',
        selector: selector
      });

      // Trigger rescan with new selector
      setTimeout(() => {
        if (state.isSelectionMode) {
          rescanMedia();
        }
      }, 300);
    }

    document.addEventListener('mousemove', updateHighlight, true);
    document.addEventListener('click', handleClick, true);

    // Store cleanup function
    window.smdElementPickerCleanup = () => {
      document.removeEventListener('mousemove', updateHighlight, true);
      document.removeEventListener('click', handleClick, true);
      highlight.remove();
      document.body.style.cursor = '';
      elementPickerActive = false;
    };
  }

  function stopElementPicker() {
    if (window.smdElementPickerCleanup) {
      window.smdElementPickerCleanup();
      window.smdElementPickerCleanup = null;
    }
  }

  function clearCarouselSelector() {
    carouselSelector = '';
    // Remove from CONFIG.CUSTOM_SELECTORS
    if (carouselSelector && CONFIG.CUSTOM_SELECTORS.includes(carouselSelector)) {
      const index = CONFIG.CUSTOM_SELECTORS.indexOf(carouselSelector);
      CONFIG.CUSTOM_SELECTORS.splice(index, 1);
    }
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

      case 'startElementPicker':
        startElementPicker();
        sendResponse({ success: true });
        break;

      case 'stopElementPicker':
        stopElementPicker();
        sendResponse({ success: true });
        break;

      case 'clearCarouselSelector':
        clearCarouselSelector();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }
    return true;
  });

  async function fetchSelectedMediaAsBlobs() {
    const blobs = [];
    const filenames = [];
    const usedFilenames = new Set();
    const errors = [];
    let index = 0;

    console.log(`[SMD] Starting to fetch ${state.selectedMedia.size} media files...`);

    for (const [url, media] of state.selectedMedia) {
      try {
        console.log(`[SMD] Processing ${media.type}: ${media.url.substring(0, 80)}...`);

        let blob;
        let fetchMethod = 'none';

        // Try canvas method for images first (bypasses CORS)
        // Re-find element if reference is stale
        let imgElement = media.element;
        if (!imgElement || !document.contains(imgElement)) {
          // Try to find the element by data attribute
          imgElement = document.querySelector(`[data-smart-media-id="${media.id}"]`);
        }

        if (media.type === 'image' && imgElement && imgElement.tagName === 'IMG') {
          try {
            const img = imgElement;

            // Check if image is loaded
            if (!img.complete) {
              console.warn(`[SMD] Image not loaded yet, waiting...`);
              await new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 2000); // Timeout after 2s
              });
            }

            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || img.width || 1000;
              canvas.height = img.naturalHeight || img.height || 1000;
              const ctx = canvas.getContext('2d');

              // Handle cross-origin images
              try {
                ctx.drawImage(img, 0, 0);
                blob = await new Promise((resolve, reject) => {
                  canvas.toBlob((blob) => {
                    if (blob && blob.size > 0) {
                      resolve(blob);
                    } else {
                      reject(new Error('Canvas produced empty blob'));
                    }
                  }, 'image/jpeg', 0.95);
                });

                if (blob && blob.size > 0) {
                  fetchMethod = 'canvas';
                  console.log(`[SMD] Got image blob from canvas: ${blob.size} bytes`);
                }
              } catch (canvasError) {
                console.warn(`[SMD] Canvas method failed (CORS?):`, canvasError.message);
              }
            }
          } catch (canvasError) {
            console.warn(`[SMD] Canvas method failed:`, canvasError);
          }
        }

        // Fallback to fetch API (better CORS handling)
        if (!blob) {
          try {
            const response = await fetch(media.url, {
              method: 'GET',
              credentials: 'omit', // Don't send credentials to avoid CORS issues
              mode: 'cors'
            });

            if (response.ok) {
              blob = await response.blob();
              if (blob && blob.size > 0) {
                fetchMethod = 'fetch';
                console.log(`[SMD] Fetch API success: ${blob.size} bytes`);
              } else {
                throw new Error('Empty blob from fetch');
              }
            } else {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
          } catch (fetchError) {
            console.warn(`[SMD] Fetch API failed:`, fetchError.message);

            // Last resort: XHR
            try {
              blob = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', media.url, true);
                xhr.responseType = 'blob';
                xhr.withCredentials = false; // Don't send credentials to avoid CORS issues

                xhr.onload = function() {
                  if (xhr.status === 200 && xhr.response && xhr.response.size > 0) {
                    fetchMethod = 'xhr';
                    console.log(`[SMD] XHR Success: ${xhr.response.size} bytes`);
                    resolve(xhr.response);
                  } else {
                    reject(new Error(`HTTP ${xhr.status} or empty response`));
                  }
                };

                xhr.onerror = function() {
                  reject(new Error('XHR Network error'));
                };

                xhr.ontimeout = function() {
                  reject(new Error('XHR Timeout'));
                };

                xhr.timeout = 30000; // 30 second timeout
                xhr.send();
              });
            } catch (xhrError) {
              console.error(`[SMD] All fetch methods failed for ${media.url}:`, xhrError.message);
              errors.push({ url: media.url, error: xhrError.message });
              continue;
            }
          }
        }

        if (!blob || blob.size === 0) {
          console.error(`[SMD] Empty or invalid blob after all attempts`);
          errors.push({ url: media.url, error: 'Empty blob' });
          continue;
        }

        console.log(`[SMD] Blob ready (${fetchMethod}): ${blob.size} bytes, type: ${blob.type}`);

        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('FileReader error'));
        });
        reader.readAsDataURL(blob);
        const base64 = await base64Promise;

        const ext = media.type === 'video' ? 'mp4' : (media.url.match(/\.(jpg|jpeg|png|gif|webp|svg)/i)?.[1] || 'jpg');
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

        console.log(`[SMD] ✓ Fetched ${index}/${state.selectedMedia.size}: ${uniqueFilename}`);
      } catch (error) {
        console.error(`[SMD] ✗ Failed to fetch ${media.url}:`, error);
        errors.push({ url: media.url, error: error.message });
      }
    }

    if (blobs.length === 0) {
      const errorMsg = errors.length > 0
        ? `Failed to fetch any media files. Errors: ${errors.map(e => e.error).join('; ')}`
        : 'Failed to fetch any media files. This may be due to CORS restrictions. Try "Individual" download instead.';
      throw new Error(errorMsg);
    }

    if (errors.length > 0) {
      console.warn(`[SMD] Successfully fetched ${blobs.length}/${state.selectedMedia.size} files. ${errors.length} failed.`);
    }

    return {
      success: true,
      blobs,
      filenames,
      errors: errors.length > 0 ? errors : undefined
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
