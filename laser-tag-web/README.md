# L.A.S.E.R. TAG - Browser Edition

A modern JavaScript port of the classic L.A.S.E.R. TAG interactive graffiti system by Graffiti Research Lab.

## Overview

L.A.S.E.R. TAG allows you to create digital graffiti using a laser pointer tracked by a webcam. Point your laser at a surface, and the software tracks its position to create brush strokes that can be projected back onto that surface.

## Live Demo

**[Try it online](https://laser-tag.localheist.com)** (requires camera access)

## Features

- **Advanced laser tracking** with Kalman filter, optical flow, and CAMShift
- **Real-time HSV color detection** using OpenCV.js (bundled locally)
- **8 brush modes** with customizable colors and shadows
- **Drip effects** with physics-based animation
- **WebGL bloom/glow** post-processing
- **Dual color palettes** - 9 preset colors for brush and shadow
- **Perspective calibration** for projection mapping
- **Floating Tweakpane UI** - minimal, collapsible panels
- **Projector popup window** for dual-display setups
- **Combined input modes** - mouse and tracking can work together
- **Stroke baking system** - completed strokes become immutable background
- **Works offline** - all dependencies bundled locally

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000 and click START. Press `M` to use mouse input for testing without a laser.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `C` | Clear canvas |
| `Ctrl+Z` | Undo last stroke |
| `Space` | Toggle calibration mode |
| `Ctrl+S` | Save calibration |
| `F` | Toggle fullscreen |
| `D` | Toggle camera view |
| `M` | Toggle mouse input (for testing) |
| `E` | Erase zone mode |
| `P` | Open projector popup |
| `1-4` | Switch brush type |
| `Arrow Up/Down` | Adjust brush size |

## Brush Modes

### Standard Modes
| Mode | Description |
|------|-------------|
| **Smooth** | Variable-width strokes - faster movement = thinner lines |
| **Ribbon** | Consistent-width line strokes |
| **Glow** | Multi-layer transparency for soft glow effect |
| **Neon** | White center core with colored outer glow |

### C++ Ports (from original vectorBrush.cpp)
| Mode | Description |
|------|-------------|
| **Basic** | Simple stroke with diagonal drop shadow |
| **Dope** | Ribbon following stroke direction with perpendicular shadow |
| **Arrow** | Dope style with triangular arrow head at stroke end |
| **Fat** | Arrow with bold shadow (default magenta, customizable) |

The C++ modes use the original perpendicular calculation pattern `(nrmY, -nrmX)` for accurate ribbon geometry that follows stroke direction.

## Drip System

Drips simulate paint dripping from strokes:

- **Frequency** (1-120) - Higher = more drips spawn
- **Speed** (0.1-12) - Movement velocity
- **Direction** - South, West, North, or East
- **Width** (1-25) - Drip line thickness

Drips use physics-based animation with deceleration as they approach their target distance. Each drip is associated with its parent stroke for proper layering.

## Advanced Tracking

The tracker uses multiple algorithms for robust detection:

### Kalman Filter
Smooths position data and predicts movement using a 4-state model (x, vx, y, vy). Reduces jitter and provides velocity estimation for motion prediction during detection dropouts.

### Optical Flow (Lucas-Kanade)
Tracks feature points between frames to predict motion when the laser temporarily disappears. Uses pyramidal LK for multi-scale tracking.

### CAMShift (Optional)
Continuously Adaptive Mean Shift algorithm that adapts to changing object size. Useful for tracking larger colored objects rather than laser points.

### Detection Presets

| Preset | Use Case | Val Min |
|--------|----------|---------|
| **Green Laser** | Green laser pointer | 200 |
| **Red Laser** | Red laser pointer | 200 |
| **Blue Laser** | Blue laser pointer | 200 |
| **White Laser** | White/multicolor laser | 240 |
| **Red Object** | Red colored objects | 80 |
| **Green Object** | Green colored objects | 80 |
| **Blue Object** | Blue colored objects | 80 |

Laser presets use high brightness thresholds (200+) for precise detection. Object presets use lower thresholds (80) for tracking colored objects like balls or markers.

## Stroke Layering System

The brush uses a **baking system** for proper layer management:

1. **Active stroke** - Currently being drawn, fully editable
2. **Completed strokes** - Marked complete when you lift the input
3. **Baked background** - When starting a new stroke, all previous content (strokes + drips) is composited into an immutable background layer

This ensures:
- Newer strokes always appear above older content
- Drips from old strokes don't overlap new strokes
- Memory-efficient - only active stroke needs redrawing

## WebGL Post-Processing

The bloom effect uses multi-pass Gaussian blur:

1. **Threshold extraction** - Isolate bright pixels
2. **Horizontal blur** - Spread horizontally
3. **Vertical blur** - Spread vertically
4. **Composite** - Blend with original

Parameters:
- **Bloom Intensity** (0-2) - Strength of glow
- **Bloom Threshold** (0-1) - Brightness cutoff

## Calibration

4-point perspective correction maps camera coordinates to projector output:

1. Press `Space` to enter calibration mode
2. Drag corner handles on the camera view to match your projection surface
3. Press `Ctrl+S` to save (persists in localStorage)

The transformation uses homography matrix calculation for accurate perspective warping.

## Architecture

```
src/
├── main.js                 # Entry point, keyboard handlers
├── app/
│   ├── AppController.js    # Main orchestrator, render loop
│   └── TweakpaneGui.js     # Floating UI with color/mode mosaics
├── tracking/
│   ├── Camera.js           # WebRTC camera, device selection
│   ├── LaserTracker.js     # OpenCV.js HSV + Kalman + OpticalFlow
│   └── CoordWarping.js     # Perspective transform matrix
├── brushes/
│   ├── BaseBrush.js        # Abstract brush interface
│   ├── VectorBrush.js      # Main brush: 8 modes, drips, baking
│   └── PngBrush.js         # Stamp brush with PNG patterns
└── effects/
    └── PostProcessor.js    # WebGL bloom shader pipeline
```

## Building for Production

```bash
npm run build      # Output to dist/
npm run preview    # Preview production build
```

## Deployment

GitHub Pages deployment is configured via `.github/workflows/deploy.yml`. Push to `master` or `main` to auto-deploy.

Manual deployment:
```bash
GITHUB_PAGES=true npm run build
# Upload dist/ contents to any static host
```

## Technologies

| Tech | Purpose |
|------|---------|
| **Vite** | Build tool, dev server, HMR |
| **OpenCV.js** | Computer vision (HSV tracking, contours) |
| **Tweakpane** | Floating GUI controls |
| **WebGL** | Post-processing shaders |
| **gl-matrix** | Matrix math for perspective |
| **WebRTC** | Camera access |
| **kalman-filter** | State estimation for smooth tracking |

## Credits

**Original L.A.S.E.R. TAG by Graffiti Research Lab:**
- **Evan Roth & James Powderly** - Concept and direction
- **Theodore Watson** - PNG brush, vector brush implementation
- **Zachary Lieberman** - Graff letter brush, gesture machine

**Browser port:**
- **Leon Fedotov** - JavaScript modernization and new features
- **Claude (Anthropic)** - AI pair programming assistant

## License

MIT License - See LICENSE file for details.

## Links

- [Original L.A.S.E.R. TAG](http://graffitiresearchlab.com/blog/projects/laser-tag/)
- [Graffiti Research Lab](http://graffitiresearchlab.com/)
- [OpenFrameworks](https://openframeworks.cc/) (original C++ framework)
