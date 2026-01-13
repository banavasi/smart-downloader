# 🎬 Smart Media Downloader

A powerful Chrome extension for intelligently detecting and batch downloading images and videos from any webpage. Perfect for downloading media from slideshows, galleries, and content platforms.

## ✨ Features

- **Smart Detection**: Automatically finds large images and videos on any webpage
- **Batch Download**: Download multiple files as a single ZIP or individually
- **Slideshow Support**: Navigate through slides and accumulate selections
- **Keyboard Shortcuts**: Use `Ctrl+D` to quickly download all selected media
- **Visual Feedback**: Clear visual indicators (pins, checkmarks) for selected items
- **Selection Persistence**: Your selections are preserved when rescanning the page
- **CORS Handling**: Built-in mechanisms to handle cross-origin downloads
- **No Auto-Monitoring**: Extension only responds to explicit user actions - no performance impact

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

The extension uses sensible defaults, but you can customize behavior:

**Minimum Media Size** (in `content.js`):
```javascript
MIN_WIDTH: 1000,    // Minimum width in pixels
MIN_HEIGHT: 1000,   // Minimum height in pixels
```

Reduce these values to detect smaller images, increase for larger content only.

## 📂 File Structure

```
smart-downloader/
├── manifest.json          # Extension manifest (v3)
├── background.js          # Service worker for download management
├── content.js            # Content script for media detection
├── content.css           # Visual feedback styles
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic
├── popup.css             # Popup styles
├── lib/
│   └── jszip.min.js     # ZIP creation library
├── icons/               # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md             # This file
└── LICENSE               # MIT License
```

## 🛠️ Development

### Building from Source

No build process required! This is a vanilla JavaScript extension.

1. Clone the repository
2. Load the extension folder in Chrome (see Installation)
3. Make changes to source files
4. Reload the extension in `chrome://extensions/`

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
