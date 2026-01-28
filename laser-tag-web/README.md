# L.A.S.E.R. TAG - Browser Edition

A modern JavaScript port of the classic L.A.S.E.R. TAG interactive graffiti system by Graffiti Research Lab.

## Overview

L.A.S.E.R. TAG allows you to create digital graffiti using a laser pointer tracked by a webcam. Point your laser at a surface, and the software tracks its position to create brush strokes that can be projected back onto that surface.

## Live Demo

**[Try it online](https://laser-tag.localheist.com)** (requires camera access)

## Features

- **Advanced laser tracking** with Kalman filter, optical flow, and CAMShift
- **Real-time HSV color detection** using OpenCV.js (bundled locally)
- **6 brush modes** with customizable colors and shadows
- **Drip effects** with physics-based animation
- **WebGL bloom/glow** post-processing
- **Dual color palettes** - 9 preset colors for brush and shadow
- **Settings persistence** - autosave on change + named presets
- **Perspective calibration** for projection mapping
- **Floating Tweakpane UI** - minimal, collapsible panels
- **Dual-display support** - split preview with projector popup window
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
| `Space` | Toggle camera calibration mode |
| `P` | Toggle projector calibration mode |
| `D` | Toggle camera debug view |
| `M` | Toggle mouse input (for testing) |
| `E` | Toggle erase zone mode |
| `1-4` | Switch brush type |
| `Arrow Up/Down` | Adjust brush size |

## Brush Modes

| Mode | Description |
|------|-------------|
| **Smooth** | Variable-width strokes - faster movement = thinner lines |
| **Glow** | Multi-layer transparency for soft glow effect |
| **Basic** | 45° diagonal ribbon with shadow (original C++ port) |
| **Dope** | Perpendicular ribbon following stroke direction with black shadow |
| **Arrow** | Dope style with triangular arrow head at stroke end |
| **Fat** | Arrow with bold magenta shadow (customizable color) |

The C++ ports (Basic, Dope, Arrow, Fat) use the original rendering patterns from `vectorBrush.cpp`. Basic uses diagonal offsets `(±halfBrush, ±halfBrush)` while Dope/Arrow/Fat use perpendicular calculation `(nrmY, -nrmX)` for ribbon geometry.

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

Two separate calibration systems map camera input to projector output:

### Camera Calibration (Input)
1. Press `Space` to enter camera calibration mode
2. Drag corner handles on the camera view to define the tracking area
3. Only laser detections inside this area are tracked
4. Changes autosave to localStorage

### Projector Calibration (Output)
1. Press `P` to enter projector calibration mode
2. Drag corner handles to warp the output to match your projection surface
3. Enable checkerboard pattern for alignment
4. Changes autosave to localStorage

Both use homography matrix calculation for accurate perspective warping.

### Camera Settings
Adjust camera rotation (0°, 90°, 180°, 270°) and flip (horizontal/vertical) in the Camera Settings panel to match your physical camera orientation.

## Dual Display Setup

The interface features a split preview:

- **Projection Output** - Shows exactly what will be displayed on the projector (including calibration warping)
- **Control** - Interactive canvas for mouse input and testing

To use with a projector:

1. Click the **Projection Window** button to open a separate window
2. Drag the window to your projector/secondary display
3. Use your operating system's fullscreen (not keyboard shortcut) for the popup
4. The popup automatically reconnects if you refresh the main window

## Architecture

```
src/
├── main.js                    # Entry point, keyboard handlers
├── app/
│   ├── AppController.js       # Main orchestrator, render loop
│   ├── AppGuiAdapter.js       # Facade decoupling GUI from app internals
│   ├── TweakpaneGui.js        # Floating UI with color/mode mosaics
│   └── SettingsManager.js     # localStorage persistence, presets
├── tracking/
│   ├── Camera.js              # WebRTC camera, rotation, flip
│   ├── LaserTracker.js        # OpenCV.js HSV + Kalman + OpticalFlow
│   └── CoordWarping.js        # Perspective transform matrix
├── calibration/
│   ├── CameraCalibrationManager.js    # Input calibration (tracking area)
│   └── ProjectorCalibrationManager.js # Output calibration (projection warp)
├── brushes/
│   ├── BaseBrush.js           # Abstract brush interface
│   ├── BrushManager.js        # Brush lifecycle and compositing
│   ├── VectorBrush.js         # Main brush with drips and baking
│   ├── DripManager.js         # Physics-based drip simulation
│   ├── PngBrush.js            # Stamp brush with PNG patterns
│   └── modes/                 # Strategy pattern for brush rendering
│       ├── SmoothModeStrategy.js
│       ├── GlowModeStrategy.js
│       ├── BasicModeStrategy.js
│       └── RibbonModeStrategy.js
├── rendering/
│   └── RenderingPipeline.js   # Canvas rendering, popup sync
└── effects/
    └── PostProcessor.js       # WebGL bloom shader pipeline
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
