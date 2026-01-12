# MDReader Web - Quick Start Guide

## 🚀 3-Minute Setup

### Step 1: Generate Icons (2 minutes)

1. Open `generate-icons.html` in your browser
2. Choose one option:
   - **Option A**: Load `../assets/icon.svg` and download both sizes
   - **Option B**: Click "Generate MD Icon" for a simple text icon
3. Save the downloaded files as:
   - `icon-192.png`
   - `icon-512.png`

### Step 2: Test Locally (1 minute)

Open `index.html` in Chrome or Edge.

That's it! The app should work immediately.

## 🌐 Deploy to GitHub Pages (5 minutes)

```bash
# From the web folder
git init
git add .
git commit -m "MDReader Web"
git branch -M main

# Create repo on github.com first, then:
git remote add origin https://github.com/YOUR-USERNAME/mdreader-web.git
git push -u origin main

# Enable GitHub Pages
# Go to: Settings → Pages → Source: main branch → Save
```

Your site will be live at: `https://YOUR-USERNAME.github.io/mdreader-web`

## ✅ Checklist

Before deploying:
- [ ] Icons generated (icon-192.png, icon-512.png)
- [ ] Tested locally in Chrome/Edge
- [ ] All files present:
  - [ ] index.html
  - [ ] styles.css
  - [ ] app.js
  - [ ] monaco-loader.js
  - [ ] sw.js
  - [ ] manifest.json
  - [ ] icon-192.png
  - [ ] icon-512.png
  - [ ] README.md

## 🔧 Troubleshooting

**Editor not loading?**
- Check internet connection (first load requires CDN access)
- Check browser console for errors
- Try hard refresh (Ctrl+Shift+R)

**Can't save files?**
- Use Chrome/Edge 86+ for File System Access API
- Other browsers will download files instead

**PWA not installing?**
- Icons must be present
- Must use HTTPS (or localhost)
- Check manifest.json loads correctly

## 📖 Full Documentation

See [README.md](README.md) for complete documentation including:
- All deployment options (Vercel, Netlify, etc.)
- Customization guide
- Browser compatibility
- Keyboard shortcuts
- Development setup

## 💡 Tips

- **First-time users**: Try Ctrl+O to open a file, or just start typing
- **Chrome users**: You can save directly to your file system!
- **Mobile users**: Add to home screen for app-like experience
- **Offline**: Works without internet after first load

## 🎯 Next Steps

1. **Customize**: Edit colors in `styles.css`
2. **Share**: Deploy and share your URL
3. **Install**: Install as PWA from browser menu
4. **Develop**: See README.md for development setup

## ⚡ Alternative: One-Click Deploy

### Vercel
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR-USERNAME/mdreader-web)

### Netlify
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/YOUR-USERNAME/mdreader-web)

(Update URLs after creating your repository)

---

**Need help?** Check [README.md](README.md) or open an issue on GitHub.
