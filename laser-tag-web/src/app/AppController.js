/**
 * AppController - Main application orchestrator
 * Based on appController.cpp from the original L.A.S.E.R. TAG
 */
import { Camera } from '../tracking/Camera.js';
import { LaserTracker } from '../tracking/LaserTracker.js';
import { CoordWarping } from '../tracking/CoordWarping.js';
import { VectorBrush } from '../brushes/VectorBrush.js';
import { PngBrush } from '../brushes/PngBrush.js';
import { PostProcessor } from '../effects/PostProcessor.js';
import { Homography } from '../utils/Homography.js';

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
    this.isCalibrating = false;  // Camera calibration
    this.isProjectorCalibrating = false;  // Projector output calibration
    this.projectorSelectedPoint = -1;
    this.frameCount = 0;
    this.fps = 0;
    this.lastFpsUpdate = 0;

    // Mouse input mode (for testing without laser)
    this.useMouseInput = false;
    this.mousePosition = null;
    this.mouseIsDown = false;

    // Animation frame ID
    this.animationFrameId = null;

    // Post-processing (WebGL bloom/glow effects)
    this.postProcessor = null;

    // Settings
    this.settings = {
      projectorWidth: 1280,
      projectorHeight: 720,
      showDebug: true,
      backgroundColor: '#000000',
      // Erase zone settings (in normalized 0-1 coordinates)
      eraseZoneEnabled: false,
      eraseZoneX: 0.0,       // Left edge (0-1)
      eraseZoneY: 0.0,       // Top edge (0-1)
      eraseZoneWidth: 0.15,  // Width (0-1)
      eraseZoneHeight: 0.15, // Height (0-1)
      // Projector output quad (normalized 0-1 coordinates)
      // Default is full canvas, can be adjusted to limit projection area
      projectorQuad: [
        { x: 0, y: 0 },      // Top-left
        { x: 1, y: 0 },      // Top-right
        { x: 1, y: 1 },      // Bottom-right
        { x: 0, y: 1 }       // Bottom-left
      ]
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
    this.captureCtx = this.captureCanvas.getContext('2d', { willReadFrequently: true });

    // Initialize camera
    await this.camera.init(this.videoElement, {
      width: 640,
      height: 480,
      frameRate: 30
    });

    // Set capture canvas to camera dimensions
    this.captureCanvas.width = this.camera.width;
    this.captureCanvas.height = this.camera.height;

    // Set debug canvas to match camera resolution
    this.debugCanvas.width = this.camera.width;
    this.debugCanvas.height = this.camera.height;

    console.log(`Camera resolution: ${this.camera.width}x${this.camera.height}`);

    // Initialize tracker
    this.tracker.init(this.camera.width, this.camera.height);

    // Initialize coordinate warping
    this.warping.setSourceDimensions(this.camera.width, this.camera.height);
    this.warping.setDestinationDimensions(
      this.projectorCanvas.width,
      this.projectorCanvas.height
    );

    // Try to load saved calibrations
    this.warping.load();
    this.loadProjectorCalibration();

    // Initialize brushes
    this.initBrushes();

    // Initialize post-processor for bloom/glow effects
    this.postProcessor = new PostProcessor();
    const ppInitialized = this.postProcessor.init(
      this.projectorCanvas.width,
      this.projectorCanvas.height
    );
    if (ppInitialized) {
      console.log('WebGL post-processor initialized');
    } else {
      console.warn('WebGL post-processor unavailable, bloom effects disabled');
      this.postProcessor = null;
    }

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

    // Skip if container has no dimensions yet
    if (rect.width === 0 || rect.height === 0) return;

    // Set projector canvas to fill container
    this.projectorCanvas.width = rect.width;
    this.projectorCanvas.height = rect.height;

    // Set debug canvas to match camera aspect ratio
    // CSS sizes it to 320x240, but internal resolution should match camera
    if (this.camera && this.camera.width) {
      this.debugCanvas.width = this.camera.width;
      this.debugCanvas.height = this.camera.height;
    } else {
      // Fallback to CSS size if camera not ready
      const debugRect = this.debugCanvas.getBoundingClientRect();
      this.debugCanvas.width = debugRect.width * window.devicePixelRatio;
      this.debugCanvas.height = debugRect.height * window.devicePixelRatio;
    }

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

    // Check erase zone if enabled and tracking
    if (this.settings.eraseZoneEnabled && this.tracker.isTracking && this.tracker.currentPosition) {
      const normX = this.tracker.currentPosition.x / this.camera.width;
      const normY = this.tracker.currentPosition.y / this.camera.height;

      // Check if laser is in erase zone
      const ez = this.settings;
      if (normX >= ez.eraseZoneX && normX <= ez.eraseZoneX + ez.eraseZoneWidth &&
          normY >= ez.eraseZoneY && normY <= ez.eraseZoneY + ez.eraseZoneHeight) {
        this.clearCanvas();
        console.log('Erase zone triggered!');
      }
    }

    // Draw debug view if enabled
    if (this.settings.showDebug && this.debugCtx) {
      this.tracker.drawDebug(this.debugCtx, imageData);

      // Draw calibration quad on debug canvas
      if (this.isCalibrating) {
        const scaleX = this.debugCanvas.width / this.camera.width;
        const scaleY = this.debugCanvas.height / this.camera.height;
        this.warping.draw(this.debugCtx, scaleX, scaleY);
      }

      // Draw erase zone rectangle if enabled
      if (this.settings.eraseZoneEnabled) {
        const ctx = this.debugCtx;
        const ez = this.settings;
        const x = ez.eraseZoneX * this.debugCanvas.width;
        const y = ez.eraseZoneY * this.debugCanvas.height;
        const w = ez.eraseZoneWidth * this.debugCanvas.width;
        const h = ez.eraseZoneHeight * this.debugCanvas.height;

        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
        ctx.fillRect(x, y, w, h);

        ctx.fillStyle = '#ff0000';
        ctx.font = '12px monospace';
        ctx.fillText('ERASE', x + 4, y + 14);
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
   * Update painting based on tracking or mouse input
   */
  updatePainting() {
    const brush = this.getActiveBrush();

    // Mouse input mode (when mouse is down)
    if (this.useMouseInput && this.mouseIsDown && this.mousePosition) {
      // Use mouse position directly (already normalized 0-1)
      brush.addPoint(this.mousePosition.x, this.mousePosition.y, this._mouseIsNewStroke);
      this._mouseIsNewStroke = false;
      return;  // Mouse takes priority when actively drawing
    }

    // Laser tracking mode (works alongside mouse when mouse is not pressed)
    if (!this.tracker.isTracking) {
      // Only end stroke if we're not waiting for mouse input
      if (brush.isDrawing && !(this.useMouseInput && !this.mouseIsDown)) {
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

    brush.addPoint(finalPos.x, finalPos.y, this.tracker.isNewStroke);
  }

  /**
   * Handle mouse down on projector canvas
   */
  handleMouseDown(e) {
    if (!this.useMouseInput) return;

    const rect = this.projectorCanvas.getBoundingClientRect();
    this.mousePosition = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    };
    this.mouseIsDown = true;
    this._mouseIsNewStroke = true;
  }

  /**
   * Handle mouse move on projector canvas
   */
  handleMouseMove(e) {
    if (!this.useMouseInput || !this.mouseIsDown) return;

    const rect = this.projectorCanvas.getBoundingClientRect();
    this.mousePosition = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    };
  }

  /**
   * Handle mouse up
   */
  handleMouseUp() {
    this.mouseIsDown = false;
  }

  /**
   * Toggle mouse input mode
   */
  toggleMouseInput() {
    this.useMouseInput = !this.useMouseInput;
    this.notifyStateChange('mouseInput', this.useMouseInput);
    return this.useMouseInput;
  }

  /**
   * Render the output
   */
  render() {
    const ctx = this.projectorCtx;

    // Clear with background color
    ctx.fillStyle = this.settings.backgroundColor;
    ctx.fillRect(0, 0, this.projectorCanvas.width, this.projectorCanvas.height);

    // Render and composite ALL brushes (so strokes persist across brush switches)
    for (const brush of this.brushes) {
      brush.render();
      brush.draw(ctx);
    }

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

    // Apply WebGL post-processing (bloom effect)
    if (this.postProcessor && this.postProcessor.enabled && this.postProcessor.params.bloomEnabled) {
      const processedCanvas = this.postProcessor.process(this.projectorCanvas);
      // Draw processed result back to the projector canvas (flip Y to correct WebGL orientation)
      ctx.save();
      ctx.translate(0, this.projectorCanvas.height);
      ctx.scale(1, -1);
      ctx.drawImage(processedCanvas, 0, 0);
      ctx.restore();
    }

    // Draw projector calibration overlay if active
    if (this.isProjectorCalibrating) {
      this.drawProjectorCalibrationOverlay(ctx);
    }

    // Also draw to popup projector window if open
    if (this.projectorPopup && this.projectorPopup.window && !this.projectorPopup.window.closed) {
      const popupCtx = this.projectorPopup.ctx;
      const popupCanvas = this.projectorPopup.canvas;
      // Use main projector canvas as source (already composited all brushes)
      const srcCanvas = this.projectorCanvas;

      const w = popupCanvas.width;
      const h = popupCanvas.height;

      // Clear the popup canvas
      popupCtx.fillStyle = this.settings.backgroundColor;
      popupCtx.fillRect(0, 0, w, h);

      // Check if projector quad differs from default (full canvas)
      const quad = this.settings.projectorQuad;
      const isWarped = quad.some((p, i) => {
        const defaultX = (i === 0 || i === 3) ? 0 : 1;
        const defaultY = (i === 0 || i === 1) ? 0 : 1;
        return Math.abs(p.x - defaultX) > 0.001 || Math.abs(p.y - defaultY) > 0.001;
      });

      if (isWarped && !this.isProjectorCalibrating) {
        // Apply perspective warp using CSS matrix3d on the canvas element
        // (Disabled during calibration so handles can be dragged correctly)
        const H = Homography.createProjectionMapping(w, h, quad, w, h);
        const cssMatrix = Homography.toMatrix3d(H, w, h);

        // Apply CSS transform to the canvas element
        popupCanvas.style.transformOrigin = '0 0';
        popupCanvas.style.transform = cssMatrix;

        // Draw content at full size (CSS will warp it)
        popupCtx.drawImage(srcCanvas, 0, 0, w, h);
      } else if (isWarped && this.isProjectorCalibrating) {
        // During calibration, show unwarped view with overlay
        // Reset any existing transform
        popupCanvas.style.transform = 'none';

        // Draw content at full size
        popupCtx.drawImage(srcCanvas, 0, 0, w, h);

        // Draw calibration overlay
        this.drawProjectorCalibrationOverlay(popupCtx, w, h);
      } else {
        // No warping needed - reset any transform and draw normally
        popupCanvas.style.transform = 'none';

        // Calculate aspect-ratio-preserving scale (letterbox/pillarbox)
        const srcAspect = srcCanvas.width / srcCanvas.height;
        const dstAspect = w / h;

        let drawWidth, drawHeight, offsetX, offsetY;

        if (srcAspect > dstAspect) {
          // Source is wider - fit to width, letterbox top/bottom
          drawWidth = w;
          drawHeight = w / srcAspect;
          offsetX = 0;
          offsetY = (h - drawHeight) / 2;
        } else {
          // Source is taller - fit to height, pillarbox left/right
          drawHeight = h;
          drawWidth = h * srcAspect;
          offsetX = (w - drawWidth) / 2;
          offsetY = 0;
        }

        popupCtx.drawImage(srcCanvas, offsetX, offsetY, drawWidth, drawHeight);

        // Draw calibration overlay on popup if active
        if (this.isProjectorCalibrating) {
          this.drawProjectorCalibrationOverlay(popupCtx, w, h);
        }
      }
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

    // Scale to camera coordinates using display size (not canvas resolution)
    const rect = this.debugCanvas.getBoundingClientRect();
    const scaleX = this.camera.width / rect.width;
    const scaleY = this.camera.height / rect.height;

    const camX = x * scaleX;
    const camY = y * scaleY;

    return this.warping.findNearestPoint(camX, camY, 30);
  }

  /**
   * Move a calibration point
   * @param {number} pointIndex - Point index
   * @param {number} x - New X in debug canvas CSS coordinates
   * @param {number} y - New Y in debug canvas CSS coordinates
   */
  moveCalibrationPoint(pointIndex, x, y) {
    if (pointIndex < 0) return;

    // Scale to camera coordinates using display size (not canvas resolution)
    const rect = this.debugCanvas.getBoundingClientRect();
    const scaleX = this.camera.width / rect.width;
    const scaleY = this.camera.height / rect.height;

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

  // =========================================
  // Projector Calibration (Output Warping)
  // =========================================

  /**
   * Toggle projector calibration mode
   */
  toggleProjectorCalibration() {
    this.isProjectorCalibrating = !this.isProjectorCalibrating;
    if (this.isProjectorCalibrating) {
      // Turn off camera calibration if on
      this.isCalibrating = false;
    }
    this.notifyStateChange('projectorCalibrating', this.isProjectorCalibrating);
    return this.isProjectorCalibrating;
  }

  /**
   * Draw projector calibration overlay with draggable corners
   * @param {CanvasRenderingContext2D} ctx - Canvas context to draw on
   * @param {number} [width] - Canvas width (defaults to projectorCanvas)
   * @param {number} [height] - Canvas height (defaults to projectorCanvas)
   */
  drawProjectorCalibrationOverlay(ctx, width, height) {
    const w = width || this.projectorCanvas.width;
    const h = height || this.projectorCanvas.height;
    const quad = this.settings.projectorQuad;

    // Convert normalized coords to pixels
    const points = quad.map(p => ({
      x: p.x * w,
      y: p.y * h
    }));

    // Draw semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, w, h);

    // Draw the quad outline (white)
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.lineTo(points[2].x, points[2].y);
    ctx.lineTo(points[3].x, points[3].y);
    ctx.closePath();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw diagonal lines for reference
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[2].x, points[2].y);
    ctx.moveTo(points[1].x, points[1].y);
    ctx.lineTo(points[3].x, points[3].y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw corner handles with colors (like original C++)
    const colors = ['#FF0000', '#00FF00', '#0000FF', '#00FFFF']; // TL, TR, BR, BL
    const labels = ['TL', 'TR', 'BR', 'BL'];
    const handleRadius = 15;

    points.forEach((p, i) => {
      // Outer circle
      ctx.beginPath();
      ctx.arc(p.x, p.y, handleRadius, 0, Math.PI * 2);
      ctx.fillStyle = this.projectorSelectedPoint === i ? '#FFFF00' : colors[i];
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[i], p.x, p.y);
    });

    // Instructions
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Drag corners to adjust projection area', w / 2, 30);
    ctx.fillText('Press P to exit, Ctrl+S to save', w / 2, 55);
  }

  /**
   * Select projector calibration point at given coordinates
   * @param {number} clientX - Client X coordinate
   * @param {number} clientY - Client Y coordinate
   * @param {HTMLCanvasElement} [canvas] - Optional canvas (defaults to projectorCanvas, use popup canvas when called from popup)
   */
  selectProjectorPoint(clientX, clientY, canvas) {
    if (!this.isProjectorCalibrating) return -1;

    // Use provided canvas or default to main projector canvas
    const targetCanvas = canvas || this.projectorCanvas;
    const rect = targetCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const scaleX = targetCanvas.width / rect.width;
    const scaleY = targetCanvas.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;

    const w = targetCanvas.width;
    const h = targetCanvas.height;
    const handleRadius = 30; // Larger for easier grabbing

    // Find closest point within radius
    let closestDist = handleRadius;
    let closestIdx = -1;

    this.settings.projectorQuad.forEach((p, i) => {
      const px = p.x * w;
      const py = p.y * h;
      const dist = Math.sqrt((canvasX - px) ** 2 + (canvasY - py) ** 2);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });

    this.projectorSelectedPoint = closestIdx;
    return closestIdx;
  }

  /**
   * Move selected projector calibration point
   * @param {number} pointIndex - Point index (0-3)
   * @param {number} clientX - Client X coordinate
   * @param {number} clientY - Client Y coordinate
   * @param {HTMLCanvasElement} [canvas] - Optional canvas (defaults to projectorCanvas)
   */
  moveProjectorPoint(pointIndex, clientX, clientY, canvas) {
    if (pointIndex < 0 || pointIndex >= 4) return;

    // Use provided canvas or default to main projector canvas
    const targetCanvas = canvas || this.projectorCanvas;
    const rect = targetCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const scaleX = targetCanvas.width / rect.width;
    const scaleY = targetCanvas.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;

    // Store as normalized coordinates (0-1)
    this.settings.projectorQuad[pointIndex] = {
      x: Math.max(0, Math.min(1, canvasX / targetCanvas.width)),
      y: Math.max(0, Math.min(1, canvasY / targetCanvas.height))
    };
  }

  /**
   * Save projector calibration to localStorage
   */
  saveProjectorCalibration() {
    try {
      localStorage.setItem('laserTag_projectorQuad', JSON.stringify(this.settings.projectorQuad));
      console.log('Projector calibration saved');
    } catch (e) {
      console.error('Failed to save projector calibration:', e);
    }
  }

  /**
   * Load projector calibration from localStorage
   */
  loadProjectorCalibration() {
    try {
      const saved = localStorage.getItem('laserTag_projectorQuad');
      if (saved) {
        this.settings.projectorQuad = JSON.parse(saved);
        console.log('Projector calibration loaded');
      }
    } catch (e) {
      console.error('Failed to load projector calibration:', e);
    }
  }

  /**
   * Reset projector calibration to full canvas
   */
  resetProjectorCalibration() {
    this.settings.projectorQuad = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ];
    console.log('Projector calibration reset');
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
