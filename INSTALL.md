# How to Install in Chrome

## Step-by-Step Instructions

### 1. Build the Extension

First, make sure you've built the extension:

```bash
npm install
npm run build
```

This creates a `dist/` folder with all the files needed for the extension.

### 2. Load in Chrome

1. **Open Chrome Extensions Page**
   - Open Google Chrome
   - Go to `chrome://extensions/`
   - Or: Click the three dots menu (⋮) → More tools → Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner
   - It should turn blue/on

3. **Load the Extension**
   - Click the "Load unpacked" button (appears after enabling Developer mode)
   - Navigate to your project folder
   - Select the `dist` folder (NOT the `src` folder)
   - Click "Select Folder"

4. **Verify Installation**
   - The extension should appear in your extensions list
   - You should see "Smart Media Downloader" with version 1.0.0
   - The extension icon should appear in your Chrome toolbar

### 3. Use the Extension

1. **Open the Popup**
   - Click the extension icon in your Chrome toolbar
   - The popup window should open

2. **Test on a Webpage**
   - Navigate to any webpage with images/videos
   - Click the extension icon
   - Click "Start Selecting"
   - Click on images/videos to select them
   - Click "ZIP" or "Individual" to download

### 4. Reload After Changes

If you make changes to the code:

1. **Rebuild:**
   ```bash
   npm run build
   ```

2. **Reload in Chrome:**
   - Go to `chrome://extensions/`
   - Find "Smart Media Downloader"
   - Click the refresh/reload icon (🔄) on the extension card

### Troubleshooting

**Extension doesn't appear:**
- Make sure you selected the `dist/` folder, not `src/` or the root folder
- Check that `npm run build` completed successfully
- Verify the `dist/` folder contains `popup.html`, `manifest.json`, etc.

**Popup doesn't open:**
- Check the browser console for errors (right-click extension icon → Inspect popup)
- Make sure you're on a regular webpage (not `chrome://` pages)
- Try reloading the extension

**Errors in console:**
- Open DevTools: Right-click extension icon → "Inspect popup"
- Check for any error messages
- Make sure all files in `dist/` are present

**Can't communicate with page:**
- Refresh the webpage you're trying to use the extension on
- Make sure the content script is injected (check console on the webpage)

### Quick Reference

- **Build:** `npm run build`
- **Load:** `chrome://extensions/` → Developer mode → Load unpacked → Select `dist/` folder
- **Reload:** Click refresh icon on extension card in `chrome://extensions/`
- **Debug Popup:** Right-click extension icon → Inspect popup
- **Debug Content Script:** Open DevTools on the webpage
