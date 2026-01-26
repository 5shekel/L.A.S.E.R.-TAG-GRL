/**
 * AppController - Main application orchestrator
 * Based on appController.cpp from the original L.A.S.E.R. TAG
 */
import { Camera } from '../tracking/Camera.js';
import { LaserTracker } from '../tracking/LaserTracker.js';
import { CoordWarping } from '../tracking/CoordWarping.js';
import { VectorBrush } from '../brushes/VectorBrush.js';
import { PngBrush } from '../brushes/PngBrush.js';

export class AppController {
  constructor() {
    // Core components
    this.camera = new Camera();
    this.tracker = new LaserTracker();
    this.warping = new CoordWarping();

    // Brushes
    this.brushes = [];
    this.activeBrushIndex = 0;

    // Canvas elements
    this.projectorCanvas = null;
    this.projectorCtx = null;
    this.debugCanvas = null;
    this.debugCtx = null;

    // Internal canvas for camera capture
    this.captureCanvas = null;
    this.captureCtx = null;

    // State
    this.isRunning = false;
    this.isCalibrating = false;
    this.frameCount = 0;
    this.fps = 0;
    this.lastFpsUpdate = 0;

    // Animation frame ID
    this.animationFrameId = null;

    // Settings
    this.settings = {
      projectorWidth: 1280,
      projectorHeight: 720,
      showDebug: true,
      backgroundColor: '#000000'
    };

    // Callbacks for UI updates
    this.onStateChange = null;
  }

  /**
   * Initialize the application
   * @param {Object} elements - DOM element references
   */
  async init(elements) {
    console.log('AppController initializing...');

    // Store canvas references
    this.projectorCanvas = elements.projectorCanvas;
    this.debugCanvas = elements.debugCanvas;
    this.videoElement = elements.videoElement;

    // Get canvas contexts
    this.projectorCtx = this.projectorCanvas.getContext('2d');
    this.debugCtx = this.debugCanvas.getContext('2d');

    // Set canvas sizes
    this.resizeCanvases();

    // Create capture canvas for camera frames
    this.captureCanvas = document.createElement('canvas');
    this.captureCtx = this.captureCanvas.getContext('2d');

    // Initialize camera
    await this.camera.init(this.videoElement, {
      width: 640,
      height: 480,
      frameRate: 30
    });

    // Set capture canvas to camera dimensions
    this.captureCanvas.width = this.camera.width;
    this.captureCanvas.height = this.camera.height;

    // Initialize tracker
    this.tracker.init(this.camera.width, this.camera.height);

    // Initialize coordinate warping
    this.warping.setSourceDimensions(this.camera.width, this.camera.height);
    this.warping.setDestinationDimensions(
      this.projectorCanvas.width,
      this.projectorCanvas.height
    );

    // Try to load saved calibration
    this.warping.load();

    // Initialize brushes
    this.initBrushes();

    console.log('AppController initialized');
    return true;
  }

  /**
   * Initialize brush system
   */
  initBrushes() {
    // Vector brush
    const vectorBrush = new VectorBrush();
    vectorBrush.init(this.projectorCanvas.width, this.projectorCanvas.height);
    this.brushes.push(vectorBrush);

    // PNG stamp brush
    const pngBrush = new PngBrush();
    pngBrush.init(this.projectorCanvas.width, this.projectorCanvas.height);
    this.brushes.push(pngBrush);

    console.log(`Initialized ${this.brushes.length} brushes`);
  }

  /**
   * Get the currently active brush
   * @returns {BaseBrush}
   */
  getActiveBrush() {
    return this.brushes[this.activeBrushIndex];
  }

  /**
   * Set active brush by index
   * @param {number} index - Brush index
   */
  setActiveBrush(index) {
    if (index >= 0 && index < this.brushes.length) {
      this.activeBrushIndex = index;
      this.notifyStateChange('brush', this.getActiveBrush().name);
    }
  }

  /**
   * Get list of available brushes
   * @returns {Array}
   */
  getBrushList() {
    return this.brushes.map((b, i) => ({
      index: i,
      name: b.name,
      active: i === this.activeBrushIndex
    }));
  }

  /**
   * Resize canvases to fit container
   */
  resizeCanvases() {
    const container = this.projectorCanvas.parentElement;
    if (!container) return;

    // Get container dimensions
    const rect = container.getBoundingClientRect();

    // Set projector canvas to fill container
    this.projectorCanvas.width = rect.width;
    this.projectorCanvas.height = rect.height;

    // Update brush canvas sizes
    for (const brush of this.brushes) {
      brush.init(rect.width, rect.height);
    }

    // Update warping destination
    this.warping.setDestinationDimensions(rect.width, rect.height);
  }

  /**
   * Start the main loop
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastFpsUpdate = performance.now();
    this.frameCount = 0;

    this.mainLoop();
    console.log('AppController started');
  }

  /**
   * Stop the main loop
   */
  stop() {
    this.isRunning = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    console.log('AppController stopped');
  }

  /**
   * Main application loop
   */
  mainLoop() {
    if (!this.isRunning) return;

    // Process tracking
    this.processTracking();

    // Update painting
    this.updatePainting();

    // Render output
    this.render();

    // Update FPS
    this.updateFps();

    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(() => this.mainLoop());
  }

  /**
   * Process camera frame and track laser
   */
  processTracking() {
    if (!this.camera.isReady) return;

    // Capture frame from camera
    const imageData = this.camera.getFrame(this.captureCtx);
    if (!imageData) return;

    // Process frame with tracker
    this.tracker.processFrame(imageData);

    // Draw debug view if enabled
    if (this.settings.showDebug && this.debugCtx) {
      this.tracker.drawDebug(this.debugCtx, imageData);

      // Draw calibration quad on debug canvas
      if (this.isCalibrating) {
        const scaleX = this.debugCanvas.width / this.camera.width;
        const scaleY = this.debugCanvas.height / this.camera.height;
        this.warping.draw(this.debugCtx, scaleX, scaleY);
      }
    }

    // Update status
    this.notifyStateChange('tracking', this.tracker.isTracking);
    if (this.tracker.currentPosition) {
      this.notifyStateChange('position', {
        x: Math.round(this.tracker.currentPosition.x),
        y: Math.round(this.tracker.currentPosition.y)
      });
    }
  }

  /**
   * Update painting based on tracking
   */
  updatePainting() {
    if (!this.tracker.isTracking) {
      // End stroke if tracking lost
      const brush = this.getActiveBrush();
      if (brush.isDrawing) {
        brush.endStroke();
      }
      return;
    }

    // Get normalized position from tracker
    const normPos = this.tracker.getNormalizedPosition();
    if (!normPos) return;

    // Transform through calibration
    const transformed = this.warping.transform(
      this.tracker.currentPosition.x,
      this.tracker.currentPosition.y
    );

    // Normalize to 0-1 range for brush
    const finalPos = {
      x: transformed.x / this.projectorCanvas.width,
      y: transformed.y / this.projectorCanvas.height
    };

    // Clamp to valid range
    finalPos.x = Math.max(0, Math.min(1, finalPos.x));
    finalPos.y = Math.max(0, Math.min(1, finalPos.y));

    // Add point to active brush
    const brush = this.getActiveBrush();
    brush.addPoint(finalPos.x, finalPos.y, this.tracker.isNewStroke);
  }

  /**
   * Render the output
   */
  render() {
    const ctx = this.projectorCtx;

    // Clear with background color
    ctx.fillStyle = this.settings.backgroundColor;
    ctx.fillRect(0, 0, this.projectorCanvas.width, this.projectorCanvas.height);

    // Render active brush
    const brush = this.getActiveBrush();
    brush.render();
    brush.draw(ctx);

    // Draw laser position indicator (optional)
    if (this.tracker.isTracking && this.tracker.currentPosition) {
      const transformed = this.warping.transform(
        this.tracker.currentPosition.x,
        this.tracker.currentPosition.y
      );

      ctx.beginPath();
      ctx.arc(transformed.x, transformed.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.fill();
    }
  }

  /**
   * Update FPS counter
   */
  updateFps() {
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastFpsUpdate;

    if (elapsed >= 1000) {
      this.fps = Math.round(this.frameCount * 1000 / elapsed);
      this.frameCount = 0;
      this.lastFpsUpdate = now;
      this.notifyStateChange('fps', this.fps);
    }
  }

  /**
   * Toggle calibration mode
   */
  toggleCalibration() {
    this.isCalibrating = !this.isCalibrating;
    this.notifyStateChange('calibrating', this.isCalibrating);
    return this.isCalibrating;
  }

  /**
   * Handle calibration point selection
   * @param {number} x - Click X in debug canvas coordinates
   * @param {number} y - Click Y in debug canvas coordinates
   */
  selectCalibrationPoint(x, y) {
    if (!this.isCalibrating) return -1;

    // Scale to camera coordinates
    const scaleX = this.camera.width / this.debugCanvas.width;
    const scaleY = this.camera.height / this.debugCanvas.height;

    const camX = x * scaleX;
    const camY = y * scaleY;

    return this.warping.findNearestPoint(camX, camY, 30);
  }

  /**
   * Move a calibration point
   * @param {number} pointIndex - Point index
   * @param {number} x - New X in debug canvas coordinates
   * @param {number} y - New Y in debug canvas coordinates
   */
  moveCalibrationPoint(pointIndex, x, y) {
    if (pointIndex < 0) return;

    // Scale to camera coordinates
    const scaleX = this.camera.width / this.debugCanvas.width;
    const scaleY = this.camera.height / this.debugCanvas.height;

    this.warping.setSourcePoint(pointIndex, x * scaleX, y * scaleY);
  }

  /**
   * Save current calibration
   */
  saveCalibration() {
    this.warping.save();
    console.log('Calibration saved');
  }

  /**
   * Reset calibration to defaults
   */
  resetCalibration() {
    this.warping.setSourceDimensions(this.camera.width, this.camera.height);
    console.log('Calibration reset');
  }

  /**
   * Clear the canvas
   */
  clearCanvas() {
    for (const brush of this.brushes) {
      brush.clear();
    }
  }

  /**
   * Undo last stroke on active brush
   */
  undo() {
    this.getActiveBrush().undo();
  }

  /**
   * Set brush color
   * @param {string} hexColor - Hex color string
   */
  setBrushColor(hexColor) {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);

    for (const brush of this.brushes) {
      brush.setColor(r, g, b);
    }
  }

  /**
   * Set brush width
   * @param {number} width - Width in pixels
   */
  setBrushWidth(width) {
    for (const brush of this.brushes) {
      brush.setBrushWidth(width);
    }
  }

  /**
   * Get tracker parameters
   * @returns {Object}
   */
  getTrackerParams() {
    return { ...this.tracker.params };
  }

  /**
   * Update tracker parameters
   * @param {Object} params - New parameters
   */
  setTrackerParams(params) {
    this.tracker.setParams(params);
  }

  /**
   * Notify UI of state changes
   */
  notifyStateChange(key, value) {
    if (this.onStateChange) {
      this.onStateChange(key, value);
    }
  }

  /**
   * Handle window resize
   */
  handleResize() {
    this.resizeCanvases();
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.stop();
    this.camera.stop();
    this.tracker.dispose();

    for (const brush of this.brushes) {
      brush.dispose();
    }
  }
}
