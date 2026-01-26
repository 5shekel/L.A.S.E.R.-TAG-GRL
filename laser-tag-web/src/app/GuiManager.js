/**
 * GuiManager - Creates and manages GUI controls using lil-gui
 */
import GUI from 'lil-gui';

export class GuiManager {
  constructor(app) {
    this.app = app;
    this.gui = null;
    this.folders = {};

    // GUI state (bound to controls)
    this.state = {
      // Brush settings
      brushColor: '#00ffff',
      brushWidth: 15,
      brushMode: 'smooth',
      brushIndex: 0,
      dripsEnabled: false,
      glowIntensity: 0.5,

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

      // Actions
      clear: () => this.app.clearCanvas(),
      undo: () => this.app.undo(),
      calibrate: () => this.toggleCalibration(),
      saveCalibration: () => this.app.saveCalibration(),
      resetCalibration: () => this.app.resetCalibration(),
      fullscreen: () => this.toggleFullscreen()
    };
  }

  /**
   * Initialize the GUI
   * @param {HTMLElement} container - Container element for GUI
   */
  init(container) {
    this.gui = new GUI({ container, width: 300, title: 'L.A.S.E.R. TAG Controls' });

    this.createBrushFolder();
    this.createTrackingFolder();
    this.createCalibrationFolder();
    this.createDisplayFolder();
    this.createActionsFolder();

    // Sync initial state
    this.syncFromApp();
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

    // Color
    folder.addColor(this.state, 'brushColor')
      .name('Color')
      .onChange(v => this.app.setBrushColor(v));

    // Width
    folder.add(this.state, 'brushWidth', 1, 100, 1)
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

    // Drips
    folder.add(this.state, 'dripsEnabled')
      .name('Drips')
      .onChange(v => {
        const brush = this.app.getActiveBrush();
        if (brush.params.dripsEnabled !== undefined) {
          brush.params.dripsEnabled = v;
        }
      });

    folder.open();
  }

  /**
   * Create tracking settings folder
   */
  createTrackingFolder() {
    const folder = this.gui.addFolder('Laser Detection');
    this.folders.tracking = folder;

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

    folder.open();
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
