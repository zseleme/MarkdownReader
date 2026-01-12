# App Icons

You need to create two icon files for the PWA:

## Required Files

1. **icon-192.png** (192x192 pixels)
   - Used for Android home screen
   - Used in browser app list
   - Format: PNG with transparency or solid background

2. **icon-512.png** (512x512 pixels)
   - Used for splash screen
   - Used for better quality on high-DPI displays
   - Format: PNG with transparency or solid background

## Creating Icons

### Option 1: Use Existing Asset

If you have the MDReader logo/icon from the Electron version:
```bash
# From the main project
convert assets/icon.png -resize 192x192 web/icon-192.png
convert assets/icon.png -resize 512x512 web/icon-512.png
```

### Option 2: Online Tools

Use free online icon generators:
- [RealFaviconGenerator](https://realfavicongenerator.net/) - Comprehensive PWA icon generator
- [PWA Asset Generator](https://progressier.com/pwa-icons-generator) - Specialized for PWA
- [Favicon.io](https://favicon.io/) - Simple icon generator

### Option 3: Design Your Own

Use any image editor (Photoshop, GIMP, Figma, etc.):

**Design Guidelines:**
- Keep it simple and recognizable at small sizes
- Use high contrast
- Avoid fine details
- Test at different sizes
- Consider both light and dark backgrounds

**Color Suggestions:**
- Primary: Purple/violet (#8b5cf6)
- Background: Dark (#1a1a1a) or White (#ffffff)
- Accent: Blue (#3b82f6)

## Quick Generate Script

If you have ImageMagick installed:

```bash
# Create a simple icon with text
convert -size 512x512 xc:#1a1a1a \
  -gravity center \
  -pointsize 200 \
  -fill "#8b5cf6" \
  -annotate +0+0 "MD" \
  icon-512.png

convert icon-512.png -resize 192x192 icon-192.png
```

## Temporary Placeholder

Until you create proper icons, you can use a simple colored square:

```bash
# Purple square
convert -size 192x192 xc:#8b5cf6 icon-192.png
convert -size 512x512 xc:#8b5cf6 icon-512.png
```

Or use the MDReader logo if available in the main project.

## Testing Icons

After creating icons:
1. Open DevTools → Application → Manifest
2. Check if icons load correctly
3. Try installing the PWA
4. Check home screen appearance (mobile)
5. Check taskbar/dock appearance (desktop)

## Note

The app will work without icons, but they greatly improve the PWA experience and make it look more professional when installed.
