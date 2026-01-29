# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LaserTag2020 is an interactive art installation built with **openFrameworks** (C++). It uses computer vision to track laser pointers in real-time, allowing users to "paint" on projected surfaces using lasers as brushes.

## Build Commands

```bash
# Build (default/debug)
make

# Build release
make Release

# Clean build artifacts
make clean

# Alternative: Open in Xcode
open LaserTag2020.xcodeproj
```

## Build Status

**✅ Builds successfully** with patched ofxGuiExtended addon. Patches applied to fix:
- C++ template two-phase lookup (added `this->` prefix for dependent name lookup)
- OF 0.12 API changes (`ofPath.setFillColor()` now requires `ofFloatColor`)
- Missing `std::` prefix on `noskipws`
- Project code: made `baseBrush::getTexture()` pure virtual

## First-Time Setup

openFrameworks and third-party addons are not in git. Install them:

```bash
# 1. Download openFrameworks (nightly or 0.12.1)
mkdir -p lib && cd lib
curl -LO https://github.com/openframeworks/openFrameworks/releases/download/nightly/of_v<DATE>_osx_release.tar.gz
tar -xzf of_v<DATE>_osx_release.tar.gz && rm of_v<DATE>_osx_release.tar.gz

# 2. Install third-party addons
cd of_v<DATE>_osx_release/addons
git clone https://github.com/frauzufall/ofxGuiExtended.git
git clone https://github.com/kylemcdonald/ofxCv.git
```

**OF path**: Configured in `config.make` via `OF_ROOT`.

## Running

```bash
./bin/LaserTag2020.app/Contents/MacOS/LaserTag2020
```

The app creates two windows:
- **Main window** (1280x800): GUI controls and camera preview
- **Projector window** (1280x720): Output for projection

## Architecture

```
Camera Input → HSV Color Tracking → Blob Detection → Coordinate Warping → Brush Rendering → Projection Output
                                                                              ↓
                                                                    Network Stream (UDP/TCP)
```

### Source Structure

- **`src/app/`** - Main controller (`appController`) orchestrates all components
- **`src/dataIn/`** - Input processing: laser tracking via OpenCV blob detection, coordinate warping
- **`src/dataOut/`** - Output rendering: projection, drip effects, brush implementations
- **`src/dataOut/brushes/`** - Four brush types inheriting from `baseBrush`:
  - `vectorBrush` - OpenGL-based drawing modes
  - `pngBrush` - Custom PNG letter stamps
  - `graffLetter` - 3D bubble letters
  - `gestureBrush` - Gesture-based painting
- **`src/utils/`** - Color management utilities

### Key Classes

- `appController` - Central orchestrator, owns all subsystems
- `laserTracking` - HSV-based laser detection using OpenCV
- `imageProjection` - Projection output with quadrilateral warping
- `drips` - Paint drip effect with gravity simulation

## Configuration

Settings persist to XML files in `bin/data/settings/`:
- `settings.xml` - Main app settings (tracking params, brush config, network)
- `quad.xml` / `quadProj.xml` - Warping calibration points
- `colors.xml` - Color palette definitions

## openFrameworks Addons

Listed in `addons.make`:
- ofxOpenCv, ofxCv - Computer vision
- ofxGuiExtended - GUI controls
- ofxOsc - Network streaming
- ofxXmlSettings - Configuration persistence

## Code Conventions

- **Naming**: camelCase files (`appController.cpp`), PascalCase classes
- **Booleans**: `b` prefix (`bSetupCamera`, `bInverted`)
- **Constants**: `UPPER_CASE` (`NUM_BRUSHES`, `STATUS_SHOW_TIME`)
- **Pattern**: One class per .cpp/.h pair

## Testing

No automated test suite. Test using:
- Live camera input
- Test videos from `bin/data/videos/`
