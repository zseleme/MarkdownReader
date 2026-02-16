# 📖 MDReader Web

> **Modern, Fast, and Privacy-First Markdown Editor**
>
> A beautiful, web-based Markdown editor featuring live preview, multi-tab support, and native file system integration. Built for writers, developers, and everyone in between.

[![PWA Status](https://img.shields.io/badge/PWA-Ready-success?style=for-the-badge&logo=pwa)](./manifest.json)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](./LICENSE)
[![Built with](https://img.shields.io/badge/Built_with-Monaco_Editor-blueviolet?style=for-the-badge)](https://microsoft.github.io/monaco-editor/)

---

## ✨ Main Features

-   **📝 Monaco Editor** – The same powerful engine that drives VS Code, with full markdown syntax support.
-   **👁️ Instant Live Preview** – Real-time rendering with **Prism.js** for stunning code blocks and **Marked.js** for fast parsing.
-   **📑 Multi-tab Workspace** – Work on several documents at once with a sleek, native-feeling tab system.
-   **💾 File System Access API** – Save and open files directly from your computer (supported in Chrome, Edge, and Opera).
-   **🎨 Dynamic Themes** – Gorgeous Light and Dark modes with **OKLCH** color palettes for maximum visual comfort.
-   **📱 Fully Responsive & PWA** – Works perfectly on mobile, tablet, and desktop. Install it for a full offline experience.
-   **🔄 Sync Scroll** – Synchronized scrolling keeps your editor and preview in perfect alignment.
-   **📤 Export & Share** – Export your work to clean HTML or share your documents with others instantly.

## 🚀 Quick Start

No installation or build process is required. Since this is a pure web application, you can run it anywhere.

### 1. Locally
Simply open the `index.html` file in any modern browser. For the best experience (File System Access), serve it using a local server:

```bash
# Using Node.js
npx serve .

# Using Python
python -m http.server 8000
```

### 2. Online
Open the live version at [Insert your deployment URL here].

---

## 🛠️ Tech Stack

-   **Runtime**: Vanilla JavaScript (ES6+)
-   **Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/)
-   **Markdown**: [Marked.js](https://marked.js.org/)
-   **Highlighting**: [Prism.js](https://prismjs.com/)
-   **Security**: [DOMPurify](https://github.com/cure53/dompurify)
-   **Icons**: FontAwesome 6

---

## 📂 Project Structure

```text
.
├── api/                # Integration/Backend helpers
├── documents/          # Sample markdown files
├── app.js              # Core application logic
├── styles.css          # Modern UI with OKLCH variables
├── index.html          # Main application entry
├── monaco-loader.js    # Monaco initialization script
├── sw.js               # Service Worker for offline/PWA
├── manifest.json       # PWA configuration
└── README.md           # You are here
```

---

## 📱 Progressive Web App (PWA)

MDReader is built as a PWA, meaning you can:
-   **Install** it on your desktop or mobile home screen as a standalone app.
-   **Work Offline**: Everything is cached via Service Workers after the first visit.
-   **Fast Loading**: Near-instant startup times.

## 💡 Tips & Shortcuts

### Keyboard Shortcuts
-   `Ctrl + S` – Save file
-   `Ctrl + Shift + S` – Save As
-   `Ctrl + O` – Open file
-   `Ctrl + T` – New tab
-   `Ctrl + W` – Close tab
-   `Ctrl + Tab` – Next tab
-   `Ctrl + Shift + Tab` – Previous tab

### Performance Tips
-   Keep the number of open tabs reasonable (<10) for the best performance.
-   Turn off Sync Scroll if you are working on very large documents and experience lag.
-   Use Chrome or Edge for the best experience with the File System Access API.

---

## 🔒 Privacy First

We value your privacy. **MDReader does not upload your files to any server.** 
-   Your documents stay on your machine.
-   Settings and open tabs are stored in your browser's `localStorage`.
-   No tracking, no analytics, no cookies.

---

## 🤝 Contributing

Contributions are the lifeblood of the open-source community. If you have an idea or found a bug:
1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 🌍 Português (Resumo)

Este é o **MDReader Web**, um editor de Markdown moderno e focado em privacidade que roda diretamente no seu navegador.

**Principais funcionalidades:**
- Edição com Monaco Editor (mesmo do VS Code).
- Visualização em tempo real (Live Preview).
- Suporte a múltiplas abas.
- Edição direta de arquivos locais (API File System).
- Funciona Offline (PWA).

**Como usar:**
Basta abrir o arquivo `index.html` em um navegador moderno ou rodar um servidor local com `npx serve`.

---

**Made with ❤️ by [Your Name/Github]**
