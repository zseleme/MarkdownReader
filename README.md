# MDReader Web - Markdown Editor

A modern, web-based Markdown editor with live preview, syntax highlighting, and tabs support. This is the browser version of MDReader, featuring the same functionality as the Electron app but running entirely in your browser.

## ✨ Features

- **📝 Monaco Editor** - Powered by VS Code's editor
- **👁️ Live Preview** - Real-time Markdown rendering with Prism.js syntax highlighting
- **📑 Multi-tab Support** - Work on multiple documents simultaneously
- **💾 File System Access** - Save and open files directly (Chrome/Edge)
- **🎨 Dark/Light Theme** - Toggle between themes
- **📱 Responsive Design** - Works on desktop, tablet, and mobile
- **⚡ PWA Support** - Install as a standalone app
- **🔄 Sync Scroll** - Synchronized scrolling between editor and preview
- **📤 Export to HTML** - Export your Markdown as HTML
- **💫 Offline Support** - Works without internet after first load
- **🔒 Privacy First** - All data stays in your browser

## 🚀 Live Demo

### Quick Start (No Installation)

Just open the files in your browser:

1. Make sure all files are in the same directory
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari)
3. Start editing!

**Note**: For best experience (File System Access API), use Chrome or Edge 86+.

## 📦 Deployment Options

### Option 1: GitHub Pages (Recommended)

**Free hosting with custom domain support**

1. Create a new repository on GitHub
2. Upload all files from the `web` folder to the repository
3. Go to Settings → Pages
4. Select "Deploy from a branch" → Choose `main` branch
5. Your site will be live at `https://yourusername.github.io/repository-name`

**Quick Commands:**
```bash
cd web
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/mdreader-web.git
git push -u origin main
```

### Option 2: Vercel

**Zero-config deployment with automatic SSL**

1. Install Vercel CLI: `npm install -g vercel`
2. Run from the `web` folder:
```bash
cd web
vercel
```
3. Follow the prompts
4. Your site will be live at `https://your-project.vercel.app`

Or use Vercel's web interface:
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Deploy!

### Option 3: Netlify

**Drag-and-drop deployment**

1. Go to [netlify.com](https://netlify.com)
2. Drag and drop the `web` folder
3. Your site is live!

Or use Netlify CLI:
```bash
npm install -g netlify-cli
cd web
netlify deploy --prod
```

### Option 4: Cloudflare Pages

**Fast global CDN**

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Connect your GitHub account
3. Select your repository
4. Deploy!

### Option 5: Self-Hosted

**Any web server (Apache, Nginx, etc.)**

Simply copy all files from the `web` folder to your web server's public directory.

**Nginx Example:**
```nginx
server {
    listen 80;
    server_name mdreader.example.com;
    root /var/www/mdreader;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Enable gzip compression
    gzip on;
    gzip_types text/css application/javascript application/json;
}
```

**Apache Example (.htaccess):**
```apache
RewriteEngine On
RewriteBase /
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/css application/javascript
</IfModule>
```

## 🔧 Browser Support

| Feature | Chrome/Edge | Firefox | Safari |
|---------|-------------|---------|--------|
| Basic Editing | ✅ 86+ | ✅ 90+ | ✅ 14+ |
| File System Access | ✅ 86+ | ❌ (fallback) | ❌ (fallback) |
| Service Worker | ✅ | ✅ | ✅ |
| PWA Install | ✅ | ✅ (Android) | ✅ (iOS 11.3+) |
| Monaco Editor | ✅ | ✅ | ✅ |

**Fallback Behavior:**
- Browsers without File System Access API will use download/upload instead of direct file access
- All core features work in all modern browsers

## 📱 Progressive Web App (PWA)

MDReader can be installed as a standalone app:

### Desktop (Chrome/Edge)
1. Click the install icon in the address bar
2. Or: Menu → Install MDReader

### Mobile (Android/iOS)
1. Open in browser
2. Menu → Add to Home Screen
3. The app will open in fullscreen mode

### PWA Features
- Works offline after first load
- Fast startup
- Native-like experience
- Auto-updates

## 🎨 Customization

### Changing Theme Colors

Edit `styles.css` and modify the CSS variables:

```css
:root {
  --accent-primary: oklch(0.55 0.18 280); /* Purple */
  --background: oklch(0.98 0 0); /* Light background */
  /* ... more variables ... */
}
```

### Adding Custom Fonts

Add to `index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Your+Font&display=swap" rel="stylesheet">
```

Then update in `styles.css`:
```css
:root {
  --font-sans: 'Your Font', sans-serif;
}
```

## 🔒 Privacy & Data Storage

- **No server uploads**: All files stay in your browser
- **localStorage**: Tabs and preferences stored locally
- **Service Worker**: Only caches app files for offline use
- **No tracking**: No analytics or telemetry
- **No cookies**: No cookies used

### Clearing Data

To clear all stored data:
```javascript
// Open browser console and run:
localStorage.clear();
navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => registration.unregister());
});
```

## 🐛 Troubleshooting

### Monaco Editor not loading
- Check browser console for errors
- Make sure you have internet connection on first load
- Clear cache and reload

### File System Access not working
- Use Chrome/Edge 86+ for full support
- Check browser permissions
- Fallback (download/upload) works in all browsers

### PWA not installing
- Must be served over HTTPS (localhost is OK for testing)
- Check manifest.json is loading
- Ensure service worker is registered

### Offline mode not working
- Service worker needs HTTPS or localhost
- First load requires internet to cache resources
- Check service worker registration in DevTools

## 📝 Development

### Local Development

1. Start a local server:
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (npx)
npx serve

# PHP
php -S localhost:8000
```

2. Open `http://localhost:8000` in your browser

### File Structure

```
web/
├── index.html          # Main HTML file
├── styles.css          # All styles
├── app.js              # Main application logic
├── monaco-loader.js    # Monaco Editor initialization
├── sw.js               # Service Worker (offline support)
├── manifest.json       # PWA manifest
├── README.md           # This file
└── icon-*.png          # App icons (you need to create these)
```

### Creating Icons

You need to create two icon files:
- `icon-192.png` (192x192px)
- `icon-512.png` (512x512px)

Use any design tool or online icon generator. The icons should be:
- Square (1:1 ratio)
- PNG format
- Transparent or solid background
- Simple, recognizable design

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation

## 📄 License

Same license as the main MDReader project.

## 🔗 Links

- Main Project: [MDReader Electron](../README.md)
- Report Issues: [GitHub Issues](https://github.com/yourusername/mdreader/issues)

## 💡 Tips

### Keyboard Shortcuts
- `Ctrl+S` - Save file
- `Ctrl+Shift+S` - Save As
- `Ctrl+O` - Open file
- `Ctrl+T` - New tab
- `Ctrl+W` - Close tab
- `Ctrl+Tab` - Next tab
- `Ctrl+Shift+Tab` - Previous tab

### Performance Tips
- Keep tabs count reasonable (<10 for best performance)
- Use sync scroll only when needed
- Close unused tabs to free memory

### File System Access API
- On first save, you'll be prompted to grant permission
- Permission persists for the session
- You can revoke permissions in browser settings

## 🎯 Comparison: Web vs Electron

| Feature | Web Version | Electron Version |
|---------|-------------|------------------|
| Size | ~5-10MB cached | ~400MB installed |
| Installation | None (or PWA) | Required |
| Auto-updates | Instant | Manual download |
| File access | Browser API/Download | Native file system |
| Platform | Any with browser | Windows/Mac/Linux |
| Offline | After first load | Always |
| Memory | Lower (~100MB) | Higher (~200MB) |

## 🌟 What's Different from Electron?

### Removed Features
- Window controls (minimize/maximize/close) - Browser handles this
- Native file associations - Use "Open with" in browser
- Direct file path access - Uses File System Access API or downloads

### Added Features
- PWA installation
- Works on mobile devices
- No installation required
- Instant updates
- Smaller footprint

### Modified Features
- File operations use File System Access API (Chrome/Edge) or download/upload (others)
- Autosave to localStorage instead of direct file write (in browsers without API)
- Links in preview show warning for relative paths

---

**Made with ❤️ | Powered by Monaco Editor, Marked.js, and Prism.js**
