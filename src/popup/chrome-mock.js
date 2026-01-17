/**
 * Mock Chrome Extension APIs for development/testing
 * This allows the Vue app to run in a browser without Chrome extension context
 */

// Only create mocks if chrome APIs don't exist (i.e., not in Chrome extension context)
if (typeof chrome === 'undefined' || !chrome.tabs) {
  window.chrome = {
    tabs: {
      query: (queryInfo) => {
        return Promise.resolve([{
          id: 1,
          url: 'https://example.com',
          title: 'Example Page'
        }]);
      },
      sendMessage: (tabId, message) => {
        console.log('[Mock] chrome.tabs.sendMessage:', message);
        // Simulate state response
        if (message.action === 'getState') {
          return Promise.resolve({
            isSelectionMode: false,
            selectedMedia: [],
            detectedCount: 0
          });
        }
        if (message.action === 'startSelection' || message.action === 'stopSelection') {
          return Promise.resolve({ success: true });
        }
        if (message.action === 'rescan') {
          return Promise.resolve({
            isSelectionMode: false,
            selectedMedia: [],
            detectedCount: 5
          });
        }
        if (message.action === 'clearSelection') {
          return Promise.resolve({ success: true });
        }
        if (message.action === 'removeItem') {
          return Promise.resolve({ success: true });
        }
        if (message.action === 'fetchMediaAsBlobs') {
          return Promise.resolve({
            success: true,
            blobs: ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='],
            filenames: ['test.jpg']
          });
        }
        return Promise.resolve({ success: true });
      }
    },
    runtime: {
      sendMessage: (message) => {
        console.log('[Mock] chrome.runtime.sendMessage:', message);
        if (message.action === 'downloadIndividual') {
          return Promise.resolve({
            success: true,
            count: message.urls.length,
            failed: 0
          });
        }
        if (message.action === 'createZipFromBlobs') {
          return Promise.resolve({
            success: true,
            count: message.blobs.length,
            filename: 'test.zip'
          });
        }
        return Promise.resolve({ success: true });
      },
      onMessage: {
        addListener: (callback) => {
          console.log('[Mock] Message listener added');
          // Simulate state updates
          setTimeout(() => {
            callback({
              action: 'stateUpdate',
              state: {
                isSelectionMode: false,
                selectedMedia: [
                  {
                    id: 'media-1',
                    url: 'https://example.com/image1.jpg',
                    type: 'image',
                    thumbnail: 'https://via.placeholder.com/150'
                  },
                  {
                    id: 'media-2',
                    url: 'https://example.com/video1.mp4',
                    type: 'video',
                    thumbnail: 'https://via.placeholder.com/150'
                  }
                ],
                detectedCount: 5
              }
            }, { tab: { id: 1 } }, () => {});
          }, 2000);
        },
        removeListener: () => {
          console.log('[Mock] Message listener removed');
        }
      }
    },
    scripting: {
      executeScript: (details) => {
        console.log('[Mock] chrome.scripting.executeScript:', details);
        return Promise.resolve([{ result: true }]);
      },
      insertCSS: (details) => {
        console.log('[Mock] chrome.scripting.insertCSS:', details);
        return Promise.resolve();
      }
    }
  };

  console.log('✅ Chrome Extension APIs mocked for development');
}
