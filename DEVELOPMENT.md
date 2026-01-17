# Development Guide

## Quick Start

### Preview UI Without Chrome Extension

To test the popup UI in a regular browser without loading it as a Chrome extension:

```bash
npm run serve
# or
npm run preview
```

This will:
- Start a dev server at `http://localhost:5173`
- Automatically open the preview page in your browser
- Mock Chrome Extension APIs so the UI works without Chrome extension context
- Enable hot module replacement (HMR) for instant updates

The preview page shows the popup UI in a styled container that matches the Chrome extension popup dimensions.

### Build for Chrome Extension

To build the extension for loading in Chrome:

```bash
npm run build
```

Then load the `dist/` folder in Chrome:
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder

### Watch Mode (Auto-rebuild)

To automatically rebuild when files change:

```bash
npm run dev
```

You'll still need to reload the extension in Chrome after changes.

## File Organization

### Source Files (`src/`)
All development happens in the `src/` directory:
- `src/popup/` - Vue 3 popup component
  - `App.vue` - Main component
  - `main.js` - Entry point
  - `popup.html` - Production HTML
  - `dev.html` - Development preview HTML
  - `chrome-mock.js` - Mock Chrome APIs for dev
  - `popup.css` - Styles

### Hidden Files
The following files are hidden in VS Code (but still exist):
- `dist/` - Build output
- `node_modules/` - Dependencies
- `build.js` - Build script
- `vite.config.js` - Vite config
- `index.html` - Dev server redirect
- Other config/build files

Only relevant project files in `src/` are visible in the file explorer.

## Chrome API Mocking

When running in dev mode (not in Chrome extension context), the app automatically loads `chrome-mock.js` which provides mock implementations of:
- `chrome.tabs` - Tab queries and messaging
- `chrome.runtime` - Runtime messaging
- `chrome.scripting` - Script injection

The mocks return sample data so you can test the UI without a real Chrome extension context.

## Tips

- Use `npm run serve` for rapid UI development
- Use `npm run build` + Chrome extension for testing full functionality
- The dev server supports hot module replacement - changes appear instantly
- Check the browser console for mock API calls (prefixed with `[Mock]`)
