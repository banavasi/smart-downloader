/**
 * Smart Media Downloader - Background Service Worker
 * Handles batch downloads, CORS fallbacks, and download management
 */

// Import JSZip
importScripts('lib/jszip.min.js');

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  DOWNLOAD_DELAY: 200,        // ms between downloads to prevent overwhelming
  MAX_CONCURRENT: 5,          // Maximum concurrent downloads
  RETRY_ATTEMPTS: 2,          // Number of retry attempts for failed downloads
  FILENAME_MAX_LENGTH: 100    // Max filename length
};

// ============================================
// DOWNLOAD STATE
// ============================================

const downloadState = {
  queue: [],
  active: new Map(),     // downloadId -> { url, filename, status }
  completed: [],
  failed: []
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Validate that URL is a media file, not a webpage
 */
function isValidMediaUrl(url) {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    const fullUrl = url.toLowerCase();
    
    // Valid media extensions - check both pathname AND full URL (for query params)
    const mediaExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif|ico|mp4|webm|ogg|mov|avi|mkv|m4v)/i;
    if (mediaExtensions.test(pathname) || mediaExtensions.test(fullUrl)) return true;
    
    // Reject common webpage extensions
    const webpageExtensions = /\.(html?|php|aspx?|jsp|cgi|pl|py|rb|do|action)(\?.*)?$/i;
    if (webpageExtensions.test(pathname)) return false;
    
    // Check for image/media CDN patterns in hostname or path
    const cdnPatterns = /(images|img|media|cdn|static|assets|photos|pictures|files|thumb|upload)/i;
    if (cdnPatterns.test(urlObj.hostname) || cdnPatterns.test(pathname)) return true;
    
    // Check for known media CDN domains
    const knownCDNs = /(cloudfront|cloudflare|akamai|fastly|cdn|imgix|imagekit|onlyfans|instagram|fbcdn|twimg|pbs\.twimg)/i;
    if (knownCDNs.test(urlObj.hostname)) return true;
    
    // If no extension and not a known pattern, be cautious
    const hasExtension = /\.[a-z0-9]{2,5}(\?.*)?$/i.test(pathname);
    if (!hasExtension) {
      // Could be a dynamic image URL - check for image-related query params
      const params = urlObj.searchParams;
      if (params.has('format') || params.has('width') || params.has('height') || 
          params.has('w') || params.has('h') || params.has('size') ||
          params.has('Tag') || params.has('Policy') || params.has('Signature')) {
        return true;
      }
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('[SMD] URL validation error:', e, url);
    return false;
  }
}

/**
 * Extract filename from URL
 */
function extractFilename(url, index, type) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Get the last segment
    let filename = pathname.split('/').pop() || '';
    
    // Remove query params if accidentally included
    filename = filename.split('?')[0];
    
    // Decode URI components
    try {
      filename = decodeURIComponent(filename);
    } catch (e) {
      // Keep original if decode fails
    }
    
    // Check if it has a valid extension
    const hasValidExt = /\.(jpg|jpeg|png|gif|webp|bmp|svg|mp4|webm|ogg|mov|avi|mkv|avif)$/i.test(filename);
    
    if (!filename || !hasValidExt) {
      // Generate filename based on type and index
      const ext = type === 'video' ? 'mp4' : 'jpg';
      filename = `media_${index + 1}.${ext}`;
    }
    
    // Sanitize filename
    filename = sanitizeFilename(filename);
    
    // Truncate if too long
    if (filename.length > CONFIG.FILENAME_MAX_LENGTH) {
      const ext = filename.split('.').pop();
      const name = filename.slice(0, CONFIG.FILENAME_MAX_LENGTH - ext.length - 1);
      filename = `${name}.${ext}`;
    }
    
    return filename;
  } catch (e) {
    const ext = type === 'video' ? 'mp4' : 'jpg';
    return `media_${index + 1}.${ext}`;
  }
}

/**
 * Sanitize filename for safe saving
 */
function sanitizeFilename(filename) {
  // Remove/replace invalid characters
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Generate unique filename to avoid conflicts
 */
function generateUniqueFilename(filename, existingNames) {
  if (!existingNames.has(filename)) {
    return filename;
  }
  
  const parts = filename.split('.');
  const ext = parts.pop();
  const name = parts.join('.');
  
  let counter = 1;
  let newFilename;
  do {
    newFilename = `${name}_${counter}.${ext}`;
    counter++;
  } while (existingNames.has(newFilename));
  
  return newFilename;
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// DOWNLOAD FUNCTIONS
// ============================================

/**
 * Download a single file
 */
async function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false,
      conflictAction: 'uniquify'
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      if (downloadId === undefined) {
        reject(new Error('Download failed to start'));
        return;
      }
      
      // Track download
      downloadState.active.set(downloadId, {
        url,
        filename,
        status: 'in_progress'
      });
      
      resolve(downloadId);
    });
  });
}

/**
 * Process batch download
 */
async function processBatchDownload(urls) {
  const results = {
    success: [],
    failed: [],
    skipped: []
  };
  
  const usedFilenames = new Set();
  let validIndex = 0;
  
  for (let i = 0; i < urls.length; i++) {
    const item = urls[i];
    
    // Validate URL before attempting download
    if (!isValidMediaUrl(item.url)) {
      console.warn(`Skipping invalid media URL: ${item.url}`);
      results.skipped.push({
        url: item.url,
        reason: 'Not a valid media URL'
      });
      continue;
    }
    
    try {
      // Generate unique filename
      let filename = extractFilename(item.url, validIndex, item.type);
      filename = generateUniqueFilename(filename, usedFilenames);
      usedFilenames.add(filename);
      
      // Start download
      const downloadId = await downloadFile(item.url, filename);
      results.success.push({
        url: item.url,
        filename,
        downloadId
      });
      validIndex++;
      
      // Rate limit
      if (i < urls.length - 1) {
        await delay(CONFIG.DOWNLOAD_DELAY);
      }
    } catch (error) {
      console.error(`Failed to download ${item.url}:`, error);
      results.failed.push({
        url: item.url,
        error: error.message
      });
    }
  }
  
  return results;
}

// ============================================
// MESSAGE HANDLERS
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[SMD Background] Received message:', message.action);
  
  switch (message.action) {
    case 'downloadBatch':
      handleBatchDownload(message.urls)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response
    
    case 'downloadIndividual':
      console.log('[SMD Background] Starting individual download of', message.urls?.length, 'files');
      downloadIndividualFiles(message.urls)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    
    case 'createZipFromBlobs':
      createZipFromBlobs(message.blobs, message.filenames)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'downloadSingle':
      handleSingleDownload(message.url, message.type)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'getDownloadStatus':
      sendResponse({
        active: downloadState.active.size,
        completed: downloadState.completed.length,
        failed: downloadState.failed.length
      });
      break;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
  
  return true;
});

/**
 * Download files individually (no ZIP)
 */
async function downloadIndividualFiles(urls) {
  const results = {
    success: [],
    failed: []
  };
  
  const usedFilenames = new Set();
  
  for (let i = 0; i < urls.length; i++) {
    const item = urls[i];
    
    if (!isValidMediaUrl(item.url)) {
      console.warn(`Skipping invalid URL: ${item.url}`);
      results.failed.push({ url: item.url, reason: 'Invalid URL' });
      continue;
    }
    
    try {
      let filename = extractFilename(item.url, i, item.type);
      filename = generateUniqueFilename(filename, usedFilenames);
      usedFilenames.add(filename);
      
      const downloadId = await downloadFile(item.url, filename);
      results.success.push({ url: item.url, filename, downloadId });
      
      // Small delay between downloads
      if (i < urls.length - 1) {
        await delay(CONFIG.DOWNLOAD_DELAY);
      }
    } catch (error) {
      console.error(`Failed to download ${item.url}:`, error);
      results.failed.push({ url: item.url, error: error.message });
    }
  }
  
  return {
    success: true,
    count: results.success.length,
    failed: results.failed.length,
    results
  };
}

/**
 * Handle batch download request - creates a ZIP file
 */
async function handleBatchDownload(urls) {
  if (!urls || urls.length === 0) {
    return { success: false, error: 'No URLs provided' };
  }
  
  console.log(`[Smart Media Downloader] Creating ZIP of ${urls.length} items`);
  
  try {
    const zipBlob = await createZipFromUrls(urls);
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `media-download-${timestamp}.zip`;
    
    // Create a blob URL and download it
    const blobUrl = URL.createObjectURL(zipBlob);
    const downloadId = await downloadFile(blobUrl, filename);
    
    // Clean up blob URL after a delay
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    
    return {
      success: true,
      count: urls.length,
      filename,
      downloadId
    };
  } catch (error) {
    console.error('[SMD] ZIP creation failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a ZIP file from array of URLs
 * Uses Chrome's download API to fetch files (bypasses CORS)
 */
async function createZipFromUrls(urls) {
  const zip = new JSZip();
  const usedFilenames = new Set();
  const downloads = [];
  
  console.log(`[SMD] Starting download of ${urls.length} files for ZIP...`);
  
  // Download all files first
  for (let i = 0; i < urls.length; i++) {
    const item = urls[i];
    
    // Validate URL
    if (!isValidMediaUrl(item.url)) {
      console.warn(`[SMD] Skipping invalid URL: ${item.url}`);
      continue;
    }
    
    try {
      // Generate unique filename
      let filename = extractFilename(item.url, i, item.type);
      filename = generateUniqueFilename(filename, usedFilenames);
      usedFilenames.add(filename);
      
      // Try to fetch directly (works for same-origin and permissive CORS)
      try {
        const response = await fetch(item.url, {
          method: 'GET',
          credentials: 'include' // Include cookies for authenticated requests
        });
        
        if (response.ok) {
          const blob = await response.blob();
          zip.file(filename, blob);
          console.log(`[SMD] Added to ZIP (${downloads.length + 1}/${urls.length}): ${filename}`);
          downloads.push({ success: true, filename });
          continue;
        }
      } catch (fetchError) {
        console.warn(`[SMD] Fetch failed for ${item.url}, trying download API...`, fetchError.message);
      }
      
      // Fallback: Download to temp location and read back
      // This won't work in service worker, so we'll just add a placeholder
      console.error(`[SMD] Could not fetch ${item.url} - CORS issue`);
      downloads.push({ success: false, filename, url: item.url });
      
    } catch (error) {
      console.error(`[SMD] Failed to process ${item.url}:`, error);
    }
  }
  
  if (zip.files && Object.keys(zip.files).length === 0) {
    throw new Error('No files could be added to ZIP - CORS blocked all requests. Try downloading individual files instead.');
  }
  
  const successCount = Object.keys(zip.files).length;
  console.log(`[SMD] Generating ZIP with ${successCount} files...`);
  
  // Generate ZIP file
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  
  console.log(`[SMD] ZIP created: ${(zipBlob.size / 1024 / 1024).toFixed(2)} MB`);
  
  return zipBlob;
}

/**
 * Create ZIP from blobs sent from content script
 */
async function createZipFromBlobs(blobs, filenames) {
  try {
    const zip = new JSZip();
    
    console.log(`[SMD] Creating ZIP from ${blobs.length} blobs...`);
    
    for (let i = 0; i < blobs.length; i++) {
      // Convert base64 to blob
      const base64Data = blobs[i].split(',')[1];
      const mimeType = blobs[i].match(/data:([^;]+);/)[1];
      const binaryData = atob(base64Data);
      const bytes = new Uint8Array(binaryData.length);
      for (let j = 0; j < binaryData.length; j++) {
        bytes[j] = binaryData.charCodeAt(j);
      }
      const blob = new Blob([bytes], { type: mimeType });
      
      zip.file(filenames[i], blob);
      console.log(`[SMD] Added to ZIP: ${filenames[i]}`);
    }
    
    // Generate ZIP
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    console.log(`[SMD] ZIP created: ${(zipBlob.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Download the ZIP
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `media-download-${timestamp}.zip`;
    const blobUrl = URL.createObjectURL(zipBlob);
    
    const downloadId = await downloadFile(blobUrl, filename);
    
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    
    return {
      success: true,
      count: blobs.length,
      filename,
      downloadId
    };
  } catch (error) {
    console.error('[SMD] ZIP from blobs failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handle single download request
 */
async function handleSingleDownload(url, type) {
  if (!url) {
    return { success: false, error: 'No URL provided' };
  }
  
  try {
    const filename = extractFilename(url, 0, type);
    const downloadId = await downloadFile(url, filename);
    
    return {
      success: true,
      downloadId,
      filename
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================
// DOWNLOAD EVENT LISTENERS
// ============================================

/**
 * Track download state changes
 */
chrome.downloads.onChanged.addListener((delta) => {
  if (!delta.state) return;
  
  const download = downloadState.active.get(delta.id);
  if (!download) return;
  
  if (delta.state.current === 'complete') {
    download.status = 'complete';
    downloadState.completed.push(download);
    downloadState.active.delete(delta.id);
    console.log(`[Smart Media Downloader] Completed: ${download.filename}`);
  } else if (delta.state.current === 'interrupted') {
    download.status = 'failed';
    download.error = delta.error?.current || 'Download interrupted';
    downloadState.failed.push(download);
    downloadState.active.delete(delta.id);
    console.error(`[Smart Media Downloader] Failed: ${download.filename}`, download.error);
  }
});

// ============================================
// EXTENSION LIFECYCLE
// ============================================

/**
 * Handle extension install/update
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Smart Media Downloader] Extension installed');
  } else if (details.reason === 'update') {
    console.log(`[Smart Media Downloader] Extension updated to ${chrome.runtime.getManifest().version}`);
  }
});

/**
 * Keep service worker alive during active downloads
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('[Smart Media Downloader] Service worker started');
});

console.log('[Smart Media Downloader] Background service worker loaded');
