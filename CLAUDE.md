# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MDReader is a modern web-based Markdown editor with live preview, syntax highlighting, and multi-tab support. It runs entirely in the browser as a Progressive Web App (PWA) with offline support, powered by Monaco Editor (VS Code's editor), Marked.js for parsing, and Prism.js for syntax highlighting.

## Development Commands

### Local Development Server

Start a local server to test the app (required for service worker and PWA features):

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js
npx serve

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

### Testing

There are no automated tests. Manual testing workflow:
1. Start local server
2. Test in Chrome/Edge (File System Access API support)
3. Test in Firefox/Safari (fallback behavior)
4. Test PWA installation
5. Test offline mode (disable network in DevTools)

## Architecture

### Core Application Structure

**Single-Page Application (SPA)** with three main JavaScript files:
- `monaco-loader.js`: Loads Monaco Editor from CDN and initializes AMD loader
- `app.js`: Main application logic (~1265 lines, all functionality in one file)
- `sw.js`: Service Worker for offline support and caching

**No build system, no bundler** - runs directly in browser with CDN dependencies.

### State Management

All state lives in `app.js` as module-level variables:
- `tabs[]`: Array of tab objects with `{id, fileName, content, fileHandle, isModified, sharedId, sharedUrl}`
- `activeTabId`: Currently selected tab ID
- `editor`: Monaco editor instance (global)
- `isDarkTheme`, `viewMode`, `isSyncScrollEnabled`, `autoSaveEnabled`: UI preferences

**Persistence:** localStorage for tabs, preferences, and content (when File System Access API unavailable).

### File Operations

**Dual-mode file handling:**
1. **File System Access API** (Chrome/Edge 86+): Direct read/write to user's filesystem
   - Uses `window.showOpenFilePicker()` and `window.showSaveFilePicker()`
   - File handles stored in tab objects (`tab.fileHandle`)

2. **Fallback mode** (Firefox/Safari): Upload/download pattern
   - Open: `<input type="file">` element
   - Save: Creates blob and triggers download

Detect support with: `const hasFileSystemAccess = 'showOpenFilePicker' in window;`

### Tab System

**Multi-document tabs** similar to VS Code:
- Each tab maintains its own content, file handle, and modified state
- Tabs persist to localStorage on every change
- Double-click tab title to rename (auto-adds `.md` extension)
- Close tab prompts if unsaved changes exist
- Switching tabs saves current editor content to tab object

**Important:** `isApplyingEditorContent` flag prevents infinite loops when programmatically setting editor value.

### Monaco Editor Integration

Monaco loads via AMD loader from CDN (jsdelivr). Custom worker configuration in `monaco-loader.js` uses data URI to avoid CORS issues.

**Key configuration:**
- Language: `markdown`
- Theme: `vs-dark` or `vs` (toggleable)
- `automaticLayout: true` - handles resize automatically
- Custom clipboard commands override Monaco defaults

**Event handlers:**
- `onDidChangeModelContent`: Updates preview and tab modified state
- `onDidChangeCursorPosition`: Updates status bar
- `onDidScrollChange`: Syncs preview scroll when enabled

### Preview Rendering Pipeline

1. Get content from Monaco editor: `editor.getValue()`
2. Parse with Marked.js: `marked.parse(content)`
3. Inject into preview div: `preview.innerHTML = html`
4. Apply Prism.js syntax highlighting: `Prism.highlightElement(block)`
5. Add link handlers (warn on relative links in web version)

### Online Sharing Feature

**Two-part system:**

**Frontend (`app.js` lines 1063-1164):**
- `shareDocument()`: POST to `api/save.php`, copies URL to clipboard
- `loadSharedDocument(docId)`: GET from `api/load.php?id={docId}`
- `checkForSharedDocument()`: Auto-loads on page load if `?doc=` param present

**Backend (PHP APIs):**
- `api/save.php`: Generates 8-char alphanumeric ID, creates slug from title, saves to `documents/{id}.md` and `documents/{id}.json`
- `api/load.php`: Extracts ID from param (handles both `id` and `slug-id` formats), validates against directory traversal, returns content + metadata

**URL format:**
- With title: `?doc=my-document-a3b5c7d9`
- Without title: `?doc=a3b5c7d9`

**Security notes:**
- No authentication - anyone with link can view
- ID validation: `/^[a-z0-9]{8}$/` prevents traversal attacks
- 5MB size limit per document
- `.htaccess` blocks direct file access

### Service Worker & PWA

**Caching strategy:**
- Static assets (HTML/CSS/JS): Cache-first with background update
- CDN resources: Network-first with cache fallback
- Monaco Editor: Special handling to cache all modules

**Two caches:**
- `mdreader-v1.0.0`: App files
- `mdreader-cdn-v1.0.0`: External dependencies

**PWA manifest** (`manifest.json`): Enables "Add to Home Screen" on mobile and install prompt on desktop.

### Theme System

**CSS custom properties** in `:root` and `.dark-theme` classes. Toggle applies/removes `dark-theme` class on `<body>`.

**Flash prevention:** `dark-theme-preload` class applied in inline script before page render (reads localStorage synchronously).

Monaco theme changes via: `monaco.editor.setTheme(isDarkTheme ? 'vs-dark' : 'vs')`

### Autosave System

**Interval-based** (30 seconds default):
- Only saves if `tab.isModified === true` and `autoSaveEnabled === true`
- For File System Access API: Writes directly to file handle
- For fallback: Only updates localStorage (no download spam)
- Visual indicator in header shows: ready/modified/saving/saved states

**Important:** Always call `saveFile(true)` for autosave to distinguish from manual saves.

## Common Patterns

### Adding a New Toolbar Button

1. Add button HTML to `index.html` in `.toolbar` div
2. Add click listener in `setupEventListeners()`
3. Implement handler function
4. Update status or show toast for user feedback

### Adding a New Keyboard Shortcut

Add to `setupKeyboardShortcuts()` in `app.js`:
```javascript
if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
    e.preventDefault();
    yourFunction();
}
```

Use `e.ctrlKey || e.metaKey` for cross-platform (Windows/Mac) support.

### Modifying Tab Behavior

Tab state lives in `tabs` array. Always:
1. Update the tab object
2. Call `updateTabUI(tab)` to refresh UI
3. Call `saveTabsToLocalStorage()` to persist
4. Use `isApplyingEditorContent` flag when setting editor value programmatically

### Working with Monaco Editor

Get/set content:
```javascript
const content = editor.getValue();

isApplyingEditorContent = true;
editor.setValue(newContent);
isApplyingEditorContent = false;
```

The flag prevents triggering change listeners that would mark content as modified.

### API Changes

Both PHP APIs follow same pattern:
- Enable CORS with wildcard (`Access-Control-Allow-Origin: *`)
- Handle OPTIONS preflight
- Return JSON: `{success: true/false, ...data/error}`
- Validate input thoroughly (IDs must match `/^[a-z0-9]{8}$/`)

## Important Constraints

1. **No dependencies/build system** - All code runs directly in browser
2. **Backward compatibility** - Must work in browsers without File System Access API
3. **localStorage limits** - Tab content can hit 5-10MB quota, handle gracefully
4. **Service Worker HTTPS requirement** - PWA features only work on HTTPS or localhost
5. **No server-side sessions** - Each page load is independent, no auth system

## File Organization

```
MDReader/
├── index.html           # Main HTML, includes all CDN dependencies
├── app.js               # All application logic (tabs, editor, file ops, sharing)
├── monaco-loader.js     # Monaco Editor initialization
├── sw.js                # Service Worker for offline support
├── styles.css           # All styles (light/dark themes via CSS variables)
├── manifest.json        # PWA manifest
├── api/
│   ├── save.php         # Save document API (POST)
│   └── load.php         # Load document API (GET)
└── documents/           # Server-stored shared documents
    ├── {id}.md          # Document content
    ├── {id}.json        # Document metadata
    └── .htaccess        # Blocks direct file access
```

## Browser Compatibility Notes

- **Chrome/Edge 86+**: Full feature support including File System Access API
- **Firefox**: Works with fallback (upload/download instead of native file access)
- **Safari 14+**: Works with fallback, PWA install supported on iOS 11.3+
- **Monaco Editor**: Works in all modern browsers via CDN

## Common Debugging Steps

1. **Editor not loading**: Check browser console for Monaco CDN errors
2. **File save failing**: Check File System Access API support in browser
3. **Preview not updating**: Check `isApplyingEditorContent` flag state
4. **Tabs not persisting**: Check localStorage quota (5-10MB limit)
5. **Share feature failing**: Check PHP error logs, verify `documents/` has write permissions (755)
6. **Service Worker issues**: Must use HTTPS or localhost, check DevTools > Application > Service Workers

## Performance Considerations

- Tab count: Keep under 10 tabs for optimal performance (each tab stores full content in memory)
- Preview rendering: Uses `innerHTML` which is fast for Markdown but blocks on large documents
- Sync scroll: Disabled by default (performance impact on large documents)
- Monaco Editor: Uses virtualized rendering, handles large files well
- localStorage: Synchronous API, minimize writes (currently writes on every change)
