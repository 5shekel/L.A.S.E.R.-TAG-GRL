# L.A.S.E.R. TAG - Browser Edition

A modern JavaScript port of the classic L.A.S.E.R. TAG interactive graffiti system by Graffiti Research Lab.

## Overview

L.A.S.E.R. TAG allows you to create digital graffiti using a laser pointer tracked by a webcam. Point your laser at a surface, and the software tracks its position to create brush strokes that can be projected back onto that surface.

## Features

- **Real-time laser tracking** using OpenCV.js (bundled locally for offline use)
- **Multiple brush modes**:
  - Smooth, Ribbon, Glow, Neon (standard modes)
  - Basic, Dope, Arrow, Arrow Fat (C++ ports with customizable shadows)
- **Drip effects** with configurable frequency, speed, direction, and width
- **WebGL bloom/glow** post-processing effects
- **Color palette** with 9 preset colors + custom picker
- **Shadow color palette** for C++ brush modes (default magenta)
- **Perspective calibration** for accurate projection mapping
- **Floating Tweakpane UI** with collapsible panels
- **Projector popup window** for dual-display setups
- **Erase zone** for clearing specific areas

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Then open http://localhost:3000 in your browser and click START.

## Requirements

- Modern web browser (Chrome, Firefox, Edge, Safari)
- Webcam
- Laser pointer (green lasers work best)
- Optional: Projector for full installation

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `C` | Clear canvas |
| `Ctrl+Z` | Undo last stroke |
| `Space` | Toggle calibration mode |
| `Ctrl+S` | Save calibration |
| `F` | Toggle fullscreen |
| `D` | Toggle camera view |
| `M` | Toggle mouse input |
| `1-4` | Switch brush |
| `Arrow Up/Down` | Increase/decrease brush size |

## GUI Panels

- **Colors** - Brush color and shadow color palettes with custom pickers
- **Styles** - Brush type, width, mode selection (8 modes), glow/shadow settings
- **Effects** - Drips (frequency, speed, direction) and WebGL bloom
- **Laser Detection** - Camera selection, HSV presets, manual tuning
- **Calibration** - 4-point perspective correction
- **Display** - Camera view toggle, background color, mirror, fullscreen
- **Actions** - Clear canvas, undo, projector window
- **Erase Zone** - Configurable clear area

## Brush Modes

### Standard Modes
- **Smooth** - Variable-width strokes based on velocity
- **Ribbon** - Simple line strokes
- **Glow** - Multi-layer glow effect
- **Neon** - Hard center with soft glow

### C++ Ports (with shadow)
- **Basic** - Simple stroke with diagonal shadow
- **Dope** - Ribbon stroke following direction with shadow
- **Arrow** - Dope style with arrow head at end
- **Fat** - Arrow style with customizable shadow color

## Architecture

```
src/
├── main.js                 # Entry point
├── app/
│   ├── AppController.js    # Main orchestrator
│   └── TweakpaneGui.js     # Tweakpane UI controls
├── tracking/
│   ├── Camera.js           # WebRTC camera access
│   ├── LaserTracker.js     # OpenCV.js tracking
│   └── CoordWarping.js     # Perspective transform
├── brushes/
│   ├── BaseBrush.js        # Abstract brush class
│   ├── VectorBrush.js      # Line/stroke brush with C++ modes
│   └── PngBrush.js         # Stamp brush
└── effects/
    └── PostProcessor.js    # WebGL bloom effect
```

## Technologies

- **Vite** - Build tool and dev server
- **OpenCV.js** - Computer vision (laser detection, bundled locally)
- **Tweakpane** - Modern floating GUI controls
- **WebGL** - Post-processing effects (bloom)
- **gl-matrix** - Vector/matrix math
- **WebRTC** - Camera access

## Credits

Original L.A.S.E.R. TAG by:
- **Graffiti Research Lab** - Concept and direction
- **Theodore Watson** - PNG brush, vector brush
- **Zachary Lieberman** - Graff letter brush, gesture machine

Browser port: 2024-2025

## License

MIT License - See LICENSE file for details.

## Links

- [Original L.A.S.E.R. TAG](http://graffitiresearchlab.com/blog/projects/laser-tag/)
- [Graffiti Research Lab](http://graffitiresearchlab.com/)
