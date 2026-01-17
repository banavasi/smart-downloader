# 🎬 Smart Media Downloader

A powerful Chrome extension for intelligently detecting and batch downloading images and videos from any webpage. Perfect for downloading media from slideshows, galleries, and content platforms.

## ✨ Features

- **Smart Detection**: Automatically finds large images and videos on any webpage
- **Custom Selectors**: Configure custom DOM selectors for specific websites (e.g., carousels, galleries)
- **Batch Download**: Download multiple files as a single ZIP or individually
- **Slideshow Support**: Navigate through slides and accumulate selections
- **Keyboard Shortcuts**: Use `Ctrl+D` to quickly download all selected media
- **Visual Feedback**: Clear visual indicators (pins, checkmarks) for selected items
- **Selection Persistence**: Your selections are preserved when rescanning the page
- **CORS Handling**: Built-in mechanisms to handle cross-origin downloads
- **No Auto-Monitoring**: Extension only responds to explicit user actions - no performance impact
- **Configurable Settings**: Adjust minimum image size, DOM watching, and more

## 🚀 Installation

### From Chrome Web Store (Recommended)
Coming soon!

### Manual Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension folder
5. The extension icon should now appear in your browser toolbar

## 📖 Usage Guide

### Basic Workflow

1. **Open the Extension**
   - Click the extension icon in your Chrome toolbar

2. **Start Selection Mode**
   - Click "Start Selecting" button
   - All detected media will appear with blue pin icons

3. **Select Media**
   - Click on images or videos you want to download
   - Selected items show a green checkmark and glow
   - Your selections accumulate in the preview panel

4. **Download**
   - Click "ZIP" to download all selected files as a single ZIP archive
   - Or click "Individual" to download each file separately
   - Alternatively, press `Ctrl+D` to trigger ZIP download

### Configuration & Custom Selectors

1. **Open Settings**
   - Click the settings icon (⚙️) in the popup header
   - Or right-click the extension icon → "Options"

2. **Add Custom Selectors**
   - Click "Add Selector" to create a new configuration
   - Enter a name (e.g., "OnlyFans Gallery")
   - Add CSS selectors (e.g., `.gallery img`, `.carousel-item img`)
   - The extension will prioritize these selectors when detecting media

3. **Use Presets**
   - Apply pre-configured selectors for popular libraries (PhotoSwipe, etc.)
   - Presets are automatically activated when applied

4. **Advanced Settings**
   - Adjust minimum image width/height
   - Enable/disable DOM change watching
   - Configure auto-selection on swipe

5. **Export/Import**
   - Export your configuration to share or backup
   - Import configurations from other users or devices

### Slideshow/Gallery Workflow

This extension is optimized for navigating through slideshows and accumulating selections:

1. **Start Selection Mode** - Click "Start Selecting"
2. **Select Current Media** - Click on the video/image on the current slide
3. **Navigate to Next Slide** - Use the website's next/previous buttons
4. **Rescan** - Click the "Rescan" button in the extension popup
   - New media on the current slide is detected
   - Your previous selections are preserved
5. **Repeat** - Select more media, navigate, rescan as needed
6. **Download** - Click "ZIP" or press `Ctrl+D` when done

**Tip**: The "Rescan" button is crucial for slideshows. It tells the extension to look for new media after you've navigated to a different slide.

### Keyboard Shortcuts

- **`Ctrl+D`** - Download all selected items as ZIP
- **`D`** (in selection mode) - Quick download trigger

## 🎯 How It Works

### Media Detection

The extension scans the page DOM for:
- `<img>` tags with large dimensions (min 1000x1000px)
- `<video>` tags (all sizes accepted)
- Lazy-loaded images from data attributes
- Images in `<picture>` elements with `<source>` tags

### Selection Tracking

- Selections are tracked by **URL**, not DOM elements
- This means if the page refreshes or DOM updates, your selections persist
- When you click "Rescan", the extension matches current media with previously selected URLs

### Download Methods

**ZIP Download** (Recommended):
- Uses the page's authentication/cookies to fetch media
- Creates a ZIP file with all selected media
- Best for authenticated content (e.g., OnlyFans, paid galleries)

**Individual Downloads**:
- Each file is downloaded separately
- Uses Chrome's native download API
- Useful when ZIP creation fails due to CORS

## 🔧 Configuration

The extension includes a full-featured settings page where you can:

- **Add Custom DOM Selectors**: Configure CSS selectors for specific websites
- **Adjust Minimum Media Size**: Set minimum width/height for image detection
- **Enable/Disable Features**: Toggle DOM watching, auto-selection, etc.
- **Export/Import Settings**: Share configurations or backup your settings

**Access Settings:**
- Click the settings icon (⚙️) in the popup header
- Or right-click the extension icon → "Options"

**Example Custom Selectors:**
- `.gallery-item img` - For gallery websites
- `.carousel img` - For carousel/slideshow sites
- `[data-media-id] img` - For sites using data attributes

## 📂 File Structure

```
smart-downloader/
├── src/
│   ├── popup/
│   │   ├── popup.html    # Popup entry point
│   │   ├── main.js       # Vue app initialization
│   │   ├── App.vue       # Main Vue component (Composition API)
│   │   ├── popup.css     # Popup styles
│   │   └── chrome-mock.js # Chrome API mocks for dev
│   └── options/
│       ├── options.html  # Options page entry point
│       ├── main.js       # Options Vue app initialization
│       ├── App.vue       # Options page component
│       └── options.css   # Options page styles
├── manifest.json         # Extension manifest (v3)
├── background.js         # Service worker for download management
├── content.js            # Content script for media detection
├── content.css           # Visual feedback styles
├── lib/
│   └── jszip.min.js      # ZIP creation library
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── vite.config.js        # Vite build configuration
├── build.js              # Post-build script to copy files
├── package.json          # npm dependencies and scripts
├── README.md             # This file
└── LICENSE               # MIT License
```

## 🛠️ Development

### Building from Source

This extension uses Vue 3 with Composition API and Vite for building.

**Prerequisites:**
- Node.js 16+ and npm

**Setup:**
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

**Development:**
1. Build the extension:
   ```bash
   npm run build
   ```
   This will:
   - Build the Vue 3 popup component
   - Copy all extension files (manifest.json, background.js, content.js, etc.) to the `dist/` folder

2. Load the `dist/` folder as an unpacked extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

**Watch Mode (for development):**
```bash
npm run dev
```
This will watch for changes and rebuild automatically. You'll still need to reload the extension in Chrome after changes.

**Preview UI in Browser (without Chrome extension):**
```bash
npm run serve
# or
npm run preview
```
This starts a dev server at `http://localhost:5173` where you can preview the popup UI. Chrome Extension APIs are automatically mocked, so you can test the UI without loading it in Chrome. The preview page will be opened automatically in your browser.

### Chrome Developer Tools

To debug the extension:

**Content Script**:
- Open DevTools on the page where the extension is running
- Check console for `[Smart Media Downloader]` prefixed logs
- Check the Content Script debugger in `chrome://extensions/`

**Popup**:
- Right-click the extension popup → "Inspect popup"
- Debug popup UI and logic

**Background Service Worker**:
- Go to `chrome://extensions/`
- Click "service worker" link for this extension
- View console logs for download management

### Common Issues

**"Cannot communicate with page"**
- Refresh the webpage
- Reload the extension

**Downloads fail with CORS errors**
- Try "Individual" download instead of ZIP
- Some sites block programmatic access to media

**Media not detected**
- Check minimum size settings in content.js
- Ensure the image/video is actually in the DOM (not hidden via CSS)
- Click "Rescan" after page finishes loading

## 📝 Changelog

### Version 2.1.0

- **Added Configuration Page** - Full-featured settings page for custom selectors
- **Custom DOM Selectors** - Users can add CSS selectors for specific websites
- **Preset Configurations** - Quick setup for popular libraries (PhotoSwipe, etc.)
- **Export/Import Settings** - Share and backup configurations
- **Advanced Settings** - Adjust minimum size, DOM watching, and more
- **Settings Button** - Quick access to settings from popup

### Version 2.0.0

- **Migrated to Vue 3 Composition API** - Modern, reactive UI framework
- Improved code organization and maintainability
- Better developer experience with Vite build system

### Version 1.0.0

- Initial release
- Media detection for images and videos
- Batch ZIP download
- Individual download support
- Selection mode with visual feedback
- Keyboard shortcuts
- Selection persistence across page updates
- Optimized for slideshows and galleries

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes with conventional commit messages
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

Example: `feat: add auto-rescan on keyboard navigation`

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## ⚠️ Disclaimer

This extension is for educational and personal use. Please respect copyright and terms of service of websites you use this with. The authors are not responsible for misuse of this tool.

## 🐛 Bug Reports & Feature Requests

Please open an issue on GitHub for:
- Bug reports (include steps to reproduce)
- Feature requests
- Questions or documentation improvements

## 🙏 Acknowledgments

- [JSZip](https://stuk.github.io/jszip/) - ZIP file creation
- Chrome Extension documentation and community

---

Made with ❤️ for easy media downloading
