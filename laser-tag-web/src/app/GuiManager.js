/**
 * GuiManager - Creates and manages GUI controls using lil-gui
 */
import GUI from 'lil-gui';

export class GuiManager {
  constructor(app) {
    this.app = app;
    this.gui = null;
    this.folders = {};

    // Color palette from original L.A.S.E.R. TAG (9 colors)
    this.colorPalette = [
      { name: 'White', hex: '#FFFFFF' },
      { name: 'Pink', hex: '#FF0A47' },
      { name: 'Green', hex: '#47FF0A' },
      { name: 'Magenta', hex: '#FF0AC2' },
      { name: 'Cyan', hex: '#0AC2FF' },
      { name: 'Yellow-Green', hex: '#C2FF0A' },
      { name: 'Blue', hex: '#001CFF' },
      { name: 'Orange', hex: '#FF9E15' },
      { name: 'Black', hex: '#000000' }
    ];

    // GUI state (bound to controls)
    this.state = {
      // Brush settings
      brushColor: '#0AC2FF',  // Default cyan
      brushColorIndex: 4,     // Cyan index
      brushWidth: 4,          // Default from original
      brushMode: 'smooth',
      brushIndex: 0,
      glowIntensity: 0.5,

      // Drip settings (inverted from original so higher = more drips)
      dripsEnabled: true,
      dripsFrequency: 30,     // 1-120, higher = more drips
      dripsSpeed: 0.3,        // 0.0-12.0
      dripsDirection: 0,      // 0=south, 1=west, 2=north, 3=east
      dripsWidth: 1,          // 1-25

      // Tracker settings
      hueMin: 35,
      hueMax: 85,
      satMin: 50,
      satMax: 255,
      valMin: 200,
      valMax: 255,
      smoothing: 0.5,

      // Display settings
      showDebug: true,
      backgroundColor: '#000000',
      brightness: 100,
      mirrorCamera: false,

      // Input settings
      useMouseInput: false,

      // Erase zone settings
      eraseZoneEnabled: false,
      eraseZoneX: 0,
      eraseZoneY: 0,
      eraseZoneWidth: 15,
      eraseZoneHeight: 15,

      // Actions
      clear: () => this.app.clearCanvas(),
      undo: () => this.app.undo(),
      calibrate: () => this.toggleCalibration(),
      saveCalibration: () => this.app.saveCalibration(),
      resetCalibration: () => this.app.resetCalibration(),
      fullscreen: () => this.toggleFullscreen(),
      openProjector: () => this.openProjectorWindow()
    };
  }

  /**
   * Initialize the GUI
   * @param {HTMLElement} container - Container element for GUI
   */
  init(container) {
    this.gui = new GUI({ container, width: 300, title: 'L.A.S.E.R. TAG Controls' });

    this.createBrushFolder();
    this.createDripsFolder();
    this.createTrackingFolder();  // async but fire-and-forget for camera list
    this.createCalibrationFolder();
    this.createDisplayFolder();
    this.createActionsFolder();
    this.createEraseZoneFolder();

    // Sync initial state
    this.syncFromApp();

    // Apply initial drip settings to brushes
    this.updateDripParams();
  }

  /**
   * Create brush settings folder
   */
  createBrushFolder() {
    const folder = this.gui.addFolder('Brush');
    this.folders.brush = folder;

    // Brush selection
    const brushOptions = {};
    this.app.getBrushList().forEach(b => {
      brushOptions[b.name] = b.index;
    });

    folder.add(this.state, 'brushIndex', brushOptions)
      .name('Type')
      .onChange(v => this.app.setActiveBrush(v));

    // Color palette selector
    const colorOptions = {};
    this.colorPalette.forEach((c, i) => {
      colorOptions[c.name] = i;
    });
    folder.add(this.state, 'brushColorIndex', colorOptions)
      .name('Color')
      .onChange(v => {
        const color = this.colorPalette[v];
        this.state.brushColor = color.hex;
        this.app.setBrushColor(color.hex);
        // Update the custom color picker to match
        if (this.colorController) {
          this.colorController.updateDisplay();
        }
      });

    // Custom color picker
    this.colorController = folder.addColor(this.state, 'brushColor')
      .name('Custom Color')
      .onChange(v => this.app.setBrushColor(v));

    // Width
    folder.add(this.state, 'brushWidth', 2, 128, 1)
      .name('Width')
      .onChange(v => this.app.setBrushWidth(v));

    // Mode (for vector brush)
    folder.add(this.state, 'brushMode', ['smooth', 'ribbon', 'glow', 'neon'])
      .name('Mode')
      .onChange(v => {
        const brush = this.app.getActiveBrush();
        if (brush.params.mode !== undefined) {
          brush.params.mode = v;
        }
      });

    // Glow intensity
    folder.add(this.state, 'glowIntensity', 0, 1, 0.1)
      .name('Glow')
      .onChange(v => {
        const brush = this.app.getActiveBrush();
        if (brush.params.glowIntensity !== undefined) {
          brush.params.glowIntensity = v;
        }
      });

    folder.open();
  }

  /**
   * Create drips settings folder
   */
  createDripsFolder() {
    const folder = this.gui.addFolder('Drips');
    this.folders.drips = folder;

    // Enable drips
    folder.add(this.state, 'dripsEnabled')
      .name('Enabled')
      .onChange(v => this.updateDripParams());

    // Frequency (1-120, higher = more drips)
    folder.add(this.state, 'dripsFrequency', 1, 120, 1)
      .name('Frequency')
      .onChange(v => this.updateDripParams());

    // Speed
    folder.add(this.state, 'dripsSpeed', 0.1, 12, 0.1)
      .name('Speed')
      .onChange(v => this.updateDripParams());

    // Direction
    const directions = { 'South': 0, 'West': 1, 'North': 2, 'East': 3 };
    folder.add(this.state, 'dripsDirection', directions)
      .name('Direction')
      .onChange(v => this.updateDripParams());

    // Width (separate from brush width)
    folder.add(this.state, 'dripsWidth', 1, 25, 1)
      .name('Width')
      .onChange(v => this.updateDripParams());

    folder.close();
  }

  /**
   * Update drip parameters on all brushes
   */
  updateDripParams() {
    for (const brush of this.app.brushes) {
      if (brush.params.dripsEnabled !== undefined) {
        brush.params.dripsEnabled = this.state.dripsEnabled;
        brush.params.dripsFrequency = this.state.dripsFrequency;
        brush.params.dripsSpeed = this.state.dripsSpeed;
        brush.params.dripsDirection = this.state.dripsDirection;
        brush.params.dripsWidth = this.state.dripsWidth;
      }
    }
  }

  /**
   * Create tracking settings folder
   */
  async createTrackingFolder() {
    const folder = this.gui.addFolder('Laser Detection');
    this.folders.tracking = folder;

    // Camera selection dropdown
    try {
      const cameras = await this.app.camera.constructor.getAvailableCameras();
      if (cameras.length > 0) {
        const cameraOptions = {};
        cameras.forEach((cam, i) => {
          const label = cam.label || `Camera ${i + 1}`;
          cameraOptions[label] = cam.deviceId;
        });

        // Try to get the current camera's deviceId from the active stream
        let currentDeviceId = cameras[0].deviceId;
        if (this.app.camera.stream) {
          const videoTrack = this.app.camera.stream.getVideoTracks()[0];
          if (videoTrack) {
            const settings = videoTrack.getSettings();
            if (settings.deviceId) {
              currentDeviceId = settings.deviceId;
            }
          }
        }

        this.state.selectedCamera = currentDeviceId;
        folder.add(this.state, 'selectedCamera', cameraOptions)
          .name('Camera')
          .onChange(async (deviceId) => {
            try {
              await this.app.camera.switchCamera(deviceId);
              // Update debug canvas size after camera switch
              this.app.debugCanvas.width = this.app.camera.width;
              this.app.debugCanvas.height = this.app.camera.height;
              this.app.captureCanvas.width = this.app.camera.width;
              this.app.captureCanvas.height = this.app.camera.height;
              console.log('Switched to camera:', deviceId, `${this.app.camera.width}x${this.app.camera.height}`);
            } catch (e) {
              console.error('Failed to switch camera:', e);
            }
          });
      }
    } catch (e) {
      console.warn('Could not enumerate cameras:', e);
    }

    // HSV range controls
    folder.add(this.state, 'hueMin', 0, 180, 1)
      .name('Hue Min')
      .onChange(() => this.updateTrackerParams());

    folder.add(this.state, 'hueMax', 0, 180, 1)
      .name('Hue Max')
      .onChange(() => this.updateTrackerParams());

    folder.add(this.state, 'satMin', 0, 255, 1)
      .name('Sat Min')
      .onChange(() => this.updateTrackerParams());

    folder.add(this.state, 'satMax', 0, 255, 1)
      .name('Sat Max')
      .onChange(() => this.updateTrackerParams());

    folder.add(this.state, 'valMin', 0, 255, 1)
      .name('Val Min')
      .onChange(() => this.updateTrackerParams());

    folder.add(this.state, 'valMax', 0, 255, 1)
      .name('Val Max')
      .onChange(() => this.updateTrackerParams());

    folder.add(this.state, 'smoothing', 0, 1, 0.05)
      .name('Smoothing')
      .onChange(() => this.updateTrackerParams());

    // Preset colors
    const presets = {
      'Green Laser': () => this.applyTrackerPreset(35, 85, 50, 255, 200, 255),
      'Red Laser': () => this.applyTrackerPreset(0, 15, 100, 255, 200, 255),
      'Blue Laser': () => this.applyTrackerPreset(100, 130, 100, 255, 200, 255),
      'White/Bright': () => this.applyTrackerPreset(0, 180, 0, 50, 240, 255)
    };

    const presetObj = { preset: 'Green Laser' };
    folder.add(presetObj, 'preset', Object.keys(presets))
      .name('Preset')
      .onChange(v => presets[v]());

    folder.close();
  }

  /**
   * Create calibration folder
   */
  createCalibrationFolder() {
    const folder = this.gui.addFolder('Calibration');
    this.folders.calibration = folder;

    folder.add(this.state, 'calibrate').name('Toggle Calibration');
    folder.add(this.state, 'saveCalibration').name('Save');
    folder.add(this.state, 'resetCalibration').name('Reset');

    // Instructions
    const instructions = {
      text: 'Drag corner points on the debug view to match your projection area.'
    };
    folder.add(instructions, 'text').name('Instructions').disable();

    folder.close();
  }

  /**
   * Create display settings folder
   */
  createDisplayFolder() {
    const folder = this.gui.addFolder('Display');
    this.folders.display = folder;

    folder.add(this.state, 'showDebug')
      .name('Show Debug')
      .onChange(v => {
        this.app.settings.showDebug = v;
        const debugCanvas = document.getElementById('debug-canvas');
        if (debugCanvas) {
          debugCanvas.style.display = v ? 'block' : 'none';
        }
      });

    folder.addColor(this.state, 'backgroundColor')
      .name('Background')
      .onChange(v => {
        this.app.settings.backgroundColor = v;
      });

    folder.add(this.state, 'fullscreen').name('Fullscreen');

    folder.add(this.state, 'useMouseInput')
      .name('Mouse Input (M)')
      .onChange(v => {
        this.app.useMouseInput = v;
      });

    folder.add(this.state, 'mirrorCamera')
      .name('Mirror Camera')
      .onChange(v => {
        this.app.camera.setMirror(v);
      });

    folder.close();
  }

  /**
   * Create actions folder
   */
  createActionsFolder() {
    const folder = this.gui.addFolder('Actions');
    this.folders.actions = folder;

    folder.add(this.state, 'clear').name('Clear Canvas');
    folder.add(this.state, 'undo').name('Undo');
    folder.add(this.state, 'openProjector').name('Open Projector Window');

    folder.open();
  }

  /**
   * Create erase zone folder
   */
  createEraseZoneFolder() {
    const folder = this.gui.addFolder('Erase Zone');
    this.folders.eraseZone = folder;

    folder.add(this.state, 'eraseZoneEnabled')
      .name('Enabled')
      .onChange(v => {
        this.app.settings.eraseZoneEnabled = v;
      });

    folder.add(this.state, 'eraseZoneX', 0, 100, 1)
      .name('X Position (%)')
      .onChange(v => {
        this.app.settings.eraseZoneX = v / 100;
      });

    folder.add(this.state, 'eraseZoneY', 0, 100, 1)
      .name('Y Position (%)')
      .onChange(v => {
        this.app.settings.eraseZoneY = v / 100;
      });

    folder.add(this.state, 'eraseZoneWidth', 5, 50, 1)
      .name('Width (%)')
      .onChange(v => {
        this.app.settings.eraseZoneWidth = v / 100;
      });

    folder.add(this.state, 'eraseZoneHeight', 5, 50, 1)
      .name('Height (%)')
      .onChange(v => {
        this.app.settings.eraseZoneHeight = v / 100;
      });

    folder.close();
  }

  /**
   * Open projector window for secondary display
   */
  openProjectorWindow() {
    // Close existing window if open
    if (this.projectorWindow && !this.projectorWindow.closed) {
      this.projectorWindow.focus();
      return;
    }

    // Open new window
    this.projectorWindow = window.open('', 'projector',
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no');

    if (!this.projectorWindow) {
      alert('Popup blocked! Please allow popups for this site.');
      return;
    }

    // Write HTML to the new window
    this.projectorWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>L.A.S.E.R. TAG - Projector</title>
        <style>
          * { margin: 0; padding: 0; }
          body {
            background: #000;
            overflow: hidden;
            cursor: none;
          }
          canvas {
            width: 100vw;
            height: 100vh;
            display: block;
          }
          .instructions {
            position: fixed;
            bottom: 10px;
            left: 10px;
            color: #333;
            font-family: monospace;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <canvas id="projector-canvas"></canvas>
        <div class="instructions">Press F for fullscreen, ESC to exit</div>
      </body>
      </html>
    `);

    // Get the canvas in the new window
    const canvas = this.projectorWindow.document.getElementById('projector-canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas size
    const resize = () => {
      canvas.width = this.projectorWindow.innerWidth;
      canvas.height = this.projectorWindow.innerHeight;
    };
    resize();
    this.projectorWindow.addEventListener('resize', resize);

    // Fullscreen on F key
    this.projectorWindow.addEventListener('keydown', (e) => {
      if (e.key === 'f' || e.key === 'F') {
        canvas.requestFullscreen().catch(() => {});
      }
    });

    // Store reference for rendering
    this.app.projectorPopup = {
      window: this.projectorWindow,
      canvas: canvas,
      ctx: ctx
    };

    console.log('Projector window opened. Press F for fullscreen.');
  }

  /**
   * Sync GUI state from app
   */
  syncFromApp() {
    const trackerParams = this.app.getTrackerParams();

    this.state.hueMin = trackerParams.hueMin;
    this.state.hueMax = trackerParams.hueMax;
    this.state.satMin = trackerParams.satMin;
    this.state.satMax = trackerParams.satMax;
    this.state.valMin = trackerParams.valMin;
    this.state.valMax = trackerParams.valMax;
    this.state.smoothing = trackerParams.smoothing;
    this.state.showDebug = trackerParams.showDebug;

    // Apply initial brush settings to app
    this.app.setBrushColor(this.state.brushColor);
    this.app.setBrushWidth(this.state.brushWidth);

    // Apply brush-specific settings
    const brush = this.app.getActiveBrush();
    if (brush.params.mode !== undefined) {
      brush.params.mode = this.state.brushMode;
    }
    if (brush.params.glowIntensity !== undefined) {
      brush.params.glowIntensity = this.state.glowIntensity;
    }
    if (brush.params.dripsEnabled !== undefined) {
      brush.params.dripsEnabled = this.state.dripsEnabled;
    }

    // Update GUI to reflect state
    this.gui.controllersRecursive().forEach(c => c.updateDisplay());
  }

  /**
   * Update tracker parameters from GUI state
   */
  updateTrackerParams() {
    this.app.setTrackerParams({
      hueMin: this.state.hueMin,
      hueMax: this.state.hueMax,
      satMin: this.state.satMin,
      satMax: this.state.satMax,
      valMin: this.state.valMin,
      valMax: this.state.valMax,
      smoothing: this.state.smoothing
    });
  }

  /**
   * Apply a tracker preset
   */
  applyTrackerPreset(hueMin, hueMax, satMin, satMax, valMin, valMax) {
    this.state.hueMin = hueMin;
    this.state.hueMax = hueMax;
    this.state.satMin = satMin;
    this.state.satMax = satMax;
    this.state.valMin = valMin;
    this.state.valMax = valMax;

    this.updateTrackerParams();
    this.gui.controllersRecursive().forEach(c => c.updateDisplay());
  }

  /**
   * Toggle calibration mode
   */
  toggleCalibration() {
    const isCalibrating = this.app.toggleCalibration();
    console.log('Calibration mode:', isCalibrating ? 'ON' : 'OFF');
  }

  /**
   * Toggle fullscreen
   */
  toggleFullscreen() {
    const projector = this.app.projectorCanvas;

    if (!document.fullscreenElement) {
      projector.requestFullscreen().catch(err => {
        console.error('Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }

  /**
   * Dispose of GUI
   */
  dispose() {
    if (this.gui) {
      this.gui.destroy();
      this.gui = null;
    }
  }
}
