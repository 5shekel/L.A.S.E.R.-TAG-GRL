# L.A.S.E.R. TAG - Browser Edition

A modern JavaScript port of the classic L.A.S.E.R. TAG interactive graffiti system by Graffiti Research Lab.

## Overview

L.A.S.E.R. TAG allows you to create digital graffiti using a laser pointer tracked by a webcam. Point your laser at a surface, and the software tracks its position to create brush strokes that can be projected back onto that surface.

## Features

- **Real-time laser tracking** using OpenCV.js
- **Multiple brush types**:
  - Vector brush with smooth, ribbon, glow, and neon modes
  - PNG stamp brush with multiple patterns
- **Perspective calibration** for accurate projection mapping
- **Drip effects** for realistic graffiti aesthetics
- **Configurable color detection** with presets for different laser colors
- **Full-screen projection mode**

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
| `D` | Toggle debug view |
| `1-4` | Switch brush |
| `↑/↓` | Increase/decrease brush size |

## Calibration

1. Press `Space` to enter calibration mode
2. Drag the four corner points on the debug view to match your projection area
3. Press `Ctrl+S` to save (persists to localStorage)

## Laser Detection

The default settings work well for green laser pointers. For other colors:

1. Open the "Laser Detection" panel in the GUI
2. Select a preset (Green, Red, Blue, or White)
3. Or manually adjust the HSV ranges

### HSV Ranges for Common Lasers

| Laser | Hue | Saturation | Value |
|-------|-----|------------|-------|
| Green | 35-85 | 50-255 | 200-255 |
| Red | 0-15 | 100-255 | 200-255 |
| Blue | 100-130 | 100-255 | 200-255 |
| White | 0-180 | 0-50 | 240-255 |

## Architecture

```
src/
├── main.js                 # Entry point
├── app/
│   ├── AppController.js    # Main orchestrator
│   └── GuiManager.js       # lil-gui controls
├── tracking/
│   ├── Camera.js           # WebRTC camera access
│   ├── LaserTracker.js     # OpenCV.js tracking
│   └── CoordWarping.js     # Perspective transform
└── brushes/
    ├── BaseBrush.js        # Abstract brush class
    ├── VectorBrush.js      # Line/stroke brush
    └── PngBrush.js         # Stamp brush
```

## Technologies

- **Vite** - Build tool and dev server
- **OpenCV.js** - Computer vision (laser detection)
- **lil-gui** - GUI controls
- **gl-matrix** - Vector/matrix math
- **WebRTC** - Camera access

## Credits

Original L.A.S.E.R. TAG by:
- **Graffiti Research Lab** - Concept and direction
- **Theodore Watson** - PNG brush, vector brush
- **Zachary Lieberman** - Graff letter brush, gesture machine

Browser port modernization: 2024

## License

MIT License - See LICENSE file for details.

## Links

- [Original L.A.S.E.R. TAG](http://graffitiresearchlab.com/blog/projects/laser-tag/)
- [Graffiti Research Lab](http://graffitiresearchlab.com/)
- [OpenCV.js Documentation](https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html)
