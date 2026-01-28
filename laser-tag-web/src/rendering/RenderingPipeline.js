/**
 * RenderingPipeline - Manages all rendering operations
 * Extracted from AppController to separate visual concerns
 *
 * Responsibilities:
 * - Main canvas rendering
 * - Post-processing (bloom effects)
 * - Popup window sync
 * - Calibration overlay drawing
 */
export class RenderingPipeline {
  constructor() {
    // Canvas references
    this.projectorCanvas = null;
    this.projectorCtx = null;

    // Clone canvas (mirrors popup in main window)
    this.cloneCanvas = null;
    this.cloneCtx = null;

    // Dependencies (set via configure)
    this.brushManager = null;
    this.postProcessor = null;
    this.cameraCalibration = null;
    this.projectorCalibration = null;
    this.tracker = null;

    // Popup window reference
    this.projectorPopup = null;

    // Settings reference
    this.settings = null;
  }

  /**
   * Configure the pipeline with dependencies
   * @param {Object} config - Configuration object
   */
  configure(config) {
    this.projectorCanvas = config.projectorCanvas;
    this.projectorCtx = config.projectorCtx;
    this.brushManager = config.brushManager;
    this.postProcessor = config.postProcessor;
    this.cameraCalibration = config.cameraCalibration;
    this.projectorCalibration = config.projectorCalibration;
    this.tracker = config.tracker;
    this.settings = config.settings;
  }

  /**
   * Set clone canvas reference (mirrors popup in main window)
   * @param {HTMLCanvasElement} canvas
   */
  setCloneCanvas(canvas) {
    this.cloneCanvas = canvas;
    this.cloneCtx = canvas ? canvas.getContext('2d') : null;
  }

  /**
   * Set projector popup window reference
   * @param {Object|null} popup - {window, canvas, ctx}
   */
  setProjectorPopup(popup) {
    this.projectorPopup = popup;
  }

  /**
   * Get projector popup reference
   * @returns {Object|null}
   */
  getProjectorPopup() {
    return this.projectorPopup;
  }

  /**
   * Render the main output canvas
   */
  render() {
    this.renderMainCanvas();
    this.renderCloneCanvas();
    this.renderPopupWindow();
  }

  /**
   * Render the main projector canvas
   */
  renderMainCanvas() {
    const ctx = this.projectorCtx;
    const width = this.projectorCanvas.width;
    const height = this.projectorCanvas.height;

    // Clear with background color
    ctx.fillStyle = this.settings.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Render and composite all brushes
    this.brushManager.render();
    this.brushManager.draw(ctx);

    // Note: Laser position indicator removed from projection output
    // It's only shown on debug canvas for calibration purposes

    // Apply WebGL post-processing (bloom effect)
    this.applyPostProcessing(ctx, width, height);

    // Note: Projector calibration overlay is drawn separately via drawProjectorCalibrationOverlay()
    // to avoid duplicating it when the popup copies the main canvas
  }

  /**
   * Draw projector calibration overlay on main canvas (called after render)
   * This is separate from render() so the popup can copy content without the overlay
   */
  drawProjectorCalibrationOverlay() {
    if (this.projectorCalibration.isCalibrating) {
      this.projectorCalibration.draw(this.projectorCtx);
    }
  }

  /**
   * Render to clone canvas (mirrors popup in main window)
   * Shows the warped projection output with calibration overlay
   */
  renderCloneCanvas() {
    if (!this.cloneCanvas || !this.cloneCtx) {
      return;
    }

    const ctx = this.cloneCtx;
    const srcCanvas = this.projectorCanvas;
    const w = this.cloneCanvas.width;
    const h = this.cloneCanvas.height;

    // Clear the clone canvas
    ctx.fillStyle = this.settings.backgroundColor;
    ctx.fillRect(0, 0, w, h);

    const isWarped = this.projectorCalibration.isWarped();
    const isCalibrating = this.projectorCalibration.isCalibrating;

    if (isWarped && !isCalibrating) {
      // Apply CSS transform for warping
      const cssMatrix = this.projectorCalibration.getCssTransform(w, h);
      this.cloneCanvas.style.transformOrigin = '0 0';
      this.cloneCanvas.style.transform = cssMatrix;
      ctx.drawImage(srcCanvas, 0, 0, w, h);
    } else if (isCalibrating) {
      // During calibration, show warped preview with checkerboard
      const cssMatrix = this.projectorCalibration.getCssTransform(w, h, true);
      this.cloneCanvas.style.transformOrigin = '0 0';
      this.cloneCanvas.style.transform = cssMatrix !== 'none' ? cssMatrix : 'none';

      if (this.projectorCalibration.showCheckerboard) {
        this.projectorCalibration.drawCheckerboardFullscreen(ctx, w, h);
      }
      ctx.drawImage(srcCanvas, 0, 0, w, h);
    } else {
      // No warping - reset transform and draw normally
      this.cloneCanvas.style.transform = 'none';
      ctx.drawImage(srcCanvas, 0, 0, w, h);
    }

    // Draw calibration overlay (frame and handles) when calibrating
    // Note: This will be visually transformed by CSS along with the content,
    // showing how the calibration frame appears on the actual projection
    if (isCalibrating) {
      this.projectorCalibration.draw(ctx, w, h, true); // skipCheckerboard=true (already drawn above)
    }
  }

  /**
   * Draw laser position indicator on canvas
   * @param {CanvasRenderingContext2D} ctx
   */
  drawLaserIndicator(ctx) {
    if (!this.tracker.isTracking || !this.tracker.currentPosition) {
      return;
    }

    const transformed = this.cameraCalibration.transform(
      this.tracker.currentPosition.x,
      this.tracker.currentPosition.y
    );

    ctx.beginPath();
    ctx.arc(transformed.x, transformed.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fill();
  }

  /**
   * Apply WebGL post-processing (bloom effect)
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width
   * @param {number} height
   */
  applyPostProcessing(ctx, width, height) {
    if (!this.postProcessor ||
        !this.postProcessor.enabled ||
        !this.postProcessor.params.bloomEnabled) {
      return;
    }

    const processedCanvas = this.postProcessor.process(this.projectorCanvas);

    // Clear and draw processed result (flip Y to correct WebGL orientation)
    ctx.fillStyle = this.settings.backgroundColor;
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(0, height);
    ctx.scale(1, -1);
    ctx.drawImage(processedCanvas, 0, 0);
    ctx.restore();
  }

  /**
   * Render to popup projector window if open
   */
  renderPopupWindow() {
    if (!this.projectorPopup ||
        !this.projectorPopup.window ||
        this.projectorPopup.window.closed) {
      return;
    }

    const popupCanvas = this.projectorPopup.canvas;
    const overlayCanvas = this.projectorPopup.overlayCanvas;
    const srcCanvas = this.projectorCanvas;

    // Get fresh context references (helps after fullscreen changes)
    const popupCtx = popupCanvas.getContext('2d');

    const w = popupCanvas.width;
    const h = popupCanvas.height;

    // Clear the popup canvas
    popupCtx.fillStyle = this.settings.backgroundColor;
    popupCtx.fillRect(0, 0, w, h);

    // Clear and prepare overlay canvas
    let overlayCtx = null;
    if (overlayCanvas) {
      overlayCtx = overlayCanvas.getContext('2d');
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }

    const isWarped = this.projectorCalibration.isWarped();
    const isCalibrating = this.projectorCalibration.isCalibrating;

    if (isWarped && !isCalibrating) {
      this.renderPopupWarped(popupCtx, popupCanvas, srcCanvas, w, h);
    } else if (isCalibrating) {
      // During calibration, always show warped preview + overlay on separate canvas
      this.renderPopupCalibrating(popupCtx, popupCanvas, srcCanvas, w, h);
      // Draw calibration overlay (frame + handles) on the non-transformed overlay canvas
      if (overlayCtx && overlayCanvas) {
        const ow = overlayCanvas.width;
        const oh = overlayCanvas.height;
        // Draw only frame and handles on overlay (skipCheckerboard=true)
        this.projectorCalibration.draw(overlayCtx, ow, oh, true);
      }
    } else {
      this.renderPopupNormal(popupCtx, popupCanvas, srcCanvas, w, h);
    }
  }

  /**
   * Render popup with perspective warp applied via CSS
   */
  renderPopupWarped(popupCtx, popupCanvas, srcCanvas, w, h) {
    const cssMatrix = this.projectorCalibration.getCssTransform(w, h);

    // Apply CSS transform to the canvas element
    popupCanvas.style.transformOrigin = '0 0';
    popupCanvas.style.transform = cssMatrix;

    // Draw content at full size (CSS will warp it)
    popupCtx.drawImage(srcCanvas, 0, 0, w, h);
  }

  /**
   * Render popup during calibration (with live warp preview)
   * Note: Calibration frame/handles drawn separately on overlay canvas (not transformed)
   */
  renderPopupCalibrating(popupCtx, popupCanvas, srcCanvas, w, h) {
    // Apply CSS transform to show live warp preview (force=true to get transform during calibration)
    const cssMatrix = this.projectorCalibration.getCssTransform(w, h, true);
    popupCanvas.style.transformOrigin = '0 0';
    popupCanvas.style.transform = cssMatrix !== 'none' ? cssMatrix : 'none';

    // Draw checkerboard on content canvas (gets warped with content)
    if (this.projectorCalibration.showCheckerboard) {
      this.projectorCalibration.drawCheckerboardFullscreen(popupCtx, w, h);
    }

    // Draw content at full size (CSS will warp it)
    popupCtx.drawImage(srcCanvas, 0, 0, w, h);
  }

  /**
   * Render popup normally with aspect ratio preservation
   * Note: Calibration overlay is drawn separately on overlay canvas
   */
  renderPopupNormal(popupCtx, popupCanvas, srcCanvas, w, h) {
    // Reset any existing transform
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
  }

  /**
   * Resize post-processor if needed
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    if (this.postProcessor && this.postProcessor.enabled) {
      this.postProcessor.resize(width, height);
    }
  }

  /**
   * Dispose resources
   */
  dispose() {
    this.projectorPopup = null;
  }
}
