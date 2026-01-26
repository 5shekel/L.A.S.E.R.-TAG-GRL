/**
 * LaserTracker - Detects and tracks laser pointer position using OpenCV.js
 * Based on the original laserTracking.cpp from L.A.S.E.R. TAG
 */
export class LaserTracker {
  constructor() {
    // Tracking state
    this.isTracking = false;
    this.lastPosition = null;
    this.currentPosition = null;
    this.velocity = { x: 0, y: 0 };
    this.isNewStroke = false;
    this.framesSinceLastDetection = 0;

    // OpenCV matrices (lazy initialized)
    this.srcMat = null;
    this.hsvMat = null;
    this.maskMat = null;
    this.morphKernel = null;

    // Tracking parameters (configurable via GUI)
    this.params = {
      // HSV range for laser detection (default: green laser)
      hueMin: 35,
      hueMax: 85,
      satMin: 50,
      satMax: 255,
      valMin: 200,
      valMax: 255,

      // Blob detection parameters
      minBlobArea: 10,
      maxBlobArea: 5000,

      // Tracking parameters
      smoothing: 0.5,           // Position smoothing (0-1)
      newStrokeThreshold: 10,   // Frames without detection to trigger new stroke
      maxVelocity: 100,         // Max pixels per frame (filters noise)

      // Debug
      showDebug: true
    };

    // Performance tracking
    this.processTime = 0;
  }

  /**
   * Initialize OpenCV matrices
   * @param {number} width - Frame width
   * @param {number} height - Frame height
   */
  init(width, height) {
    if (typeof cv === 'undefined') {
      throw new Error('OpenCV.js not loaded');
    }

    this.width = width;
    this.height = height;

    // Create reusable matrices
    this.srcMat = new cv.Mat(height, width, cv.CV_8UC4);
    this.hsvMat = new cv.Mat();
    this.maskMat = new cv.Mat();
    this.morphKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));

    console.log('LaserTracker initialized');
  }

  /**
   * Process a video frame and detect laser position
   * @param {ImageData} imageData - Frame from camera
   * @returns {Object|null} - Detected position {x, y} or null
   */
  processFrame(imageData) {
    if (!this.srcMat) {
      throw new Error('LaserTracker not initialized');
    }

    const startTime = performance.now();

    try {
      // Load image data into OpenCV matrix
      this.srcMat.data.set(imageData.data);

      // Convert RGBA to HSV
      cv.cvtColor(this.srcMat, this.hsvMat, cv.COLOR_RGBA2RGB);
      cv.cvtColor(this.hsvMat, this.hsvMat, cv.COLOR_RGB2HSV);

      // Create mask for laser color range
      const lowerBound = new cv.Mat(this.hsvMat.rows, this.hsvMat.cols, this.hsvMat.type(), [
        this.params.hueMin, this.params.satMin, this.params.valMin, 0
      ]);
      const upperBound = new cv.Mat(this.hsvMat.rows, this.hsvMat.cols, this.hsvMat.type(), [
        this.params.hueMax, this.params.satMax, this.params.valMax, 255
      ]);

      cv.inRange(this.hsvMat, lowerBound, upperBound, this.maskMat);

      // Clean up temporary matrices
      lowerBound.delete();
      upperBound.delete();

      // Morphological operations to clean up noise
      cv.morphologyEx(this.maskMat, this.maskMat, cv.MORPH_OPEN, this.morphKernel);
      cv.morphologyEx(this.maskMat, this.maskMat, cv.MORPH_CLOSE, this.morphKernel);

      // Find contours
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(this.maskMat, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      // Find largest blob
      let maxArea = 0;
      let maxContourIdx = -1;

      for (let i = 0; i < contours.size(); i++) {
        const area = cv.contourArea(contours.get(i));
        if (area > this.params.minBlobArea &&
            area < this.params.maxBlobArea &&
            area > maxArea) {
          maxArea = area;
          maxContourIdx = i;
        }
      }

      let detectedPosition = null;

      if (maxContourIdx >= 0) {
        // Calculate centroid of largest contour
        const moments = cv.moments(contours.get(maxContourIdx));
        if (moments.m00 !== 0) {
          const cx = moments.m10 / moments.m00;
          const cy = moments.m01 / moments.m00;

          detectedPosition = { x: cx, y: cy };
        }
      }

      // Clean up
      contours.delete();
      hierarchy.delete();

      // Update tracking state
      this.updateTrackingState(detectedPosition);

      this.processTime = performance.now() - startTime;

      return this.currentPosition;

    } catch (error) {
      console.error('LaserTracker processFrame error:', error);
      return null;
    }
  }

  /**
   * Update tracking state with new detection
   * @param {Object|null} detectedPosition - Raw detected position
   */
  updateTrackingState(detectedPosition) {
    if (detectedPosition) {
      // Check for valid velocity (filter out noise jumps)
      if (this.lastPosition) {
        const dx = detectedPosition.x - this.lastPosition.x;
        const dy = detectedPosition.y - this.lastPosition.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > this.params.maxVelocity) {
          // Too fast - likely noise, ignore
          this.framesSinceLastDetection++;
          return;
        }

        this.velocity = { x: dx, y: dy };
      }

      // Check if this is a new stroke
      this.isNewStroke = this.framesSinceLastDetection > this.params.newStrokeThreshold;

      // Apply smoothing
      if (this.currentPosition && !this.isNewStroke) {
        const s = this.params.smoothing;
        this.currentPosition = {
          x: this.currentPosition.x * s + detectedPosition.x * (1 - s),
          y: this.currentPosition.y * s + detectedPosition.y * (1 - s)
        };
      } else {
        this.currentPosition = { ...detectedPosition };
      }

      this.lastPosition = { ...detectedPosition };
      this.isTracking = true;
      this.framesSinceLastDetection = 0;

    } else {
      // No detection
      this.framesSinceLastDetection++;

      if (this.framesSinceLastDetection > this.params.newStrokeThreshold) {
        this.isTracking = false;
      }
    }
  }

  /**
   * Draw debug visualization
   * @param {CanvasRenderingContext2D} ctx - Canvas context to draw on
   * @param {ImageData} originalFrame - Original camera frame
   */
  drawDebug(ctx, originalFrame) {
    if (!this.params.showDebug) return;

    const canvas = ctx.canvas;

    // Draw original frame
    ctx.putImageData(originalFrame, 0, 0);

    // Draw mask overlay if available
    if (this.maskMat && !this.maskMat.isDeleted()) {
      try {
        const maskData = new ImageData(
          new Uint8ClampedArray(this.maskMat.data),
          this.maskMat.cols,
          this.maskMat.rows
        );

        // Create overlay
        const overlayCanvas = document.createElement('canvas');
        overlayCanvas.width = this.maskMat.cols;
        overlayCanvas.height = this.maskMat.rows;
        const overlayCtx = overlayCanvas.getContext('2d');

        // Draw mask as colored overlay
        const tempImageData = overlayCtx.createImageData(this.maskMat.cols, this.maskMat.rows);
        for (let i = 0; i < this.maskMat.data.length; i++) {
          const idx = i * 4;
          if (this.maskMat.data[i] > 0) {
            tempImageData.data[idx] = 0;      // R
            tempImageData.data[idx + 1] = 255; // G
            tempImageData.data[idx + 2] = 0;   // B
            tempImageData.data[idx + 3] = 128; // A
          } else {
            tempImageData.data[idx + 3] = 0;   // Transparent
          }
        }
        overlayCtx.putImageData(tempImageData, 0, 0);
        ctx.drawImage(overlayCanvas, 0, 0, canvas.width, canvas.height);
      } catch (e) {
        // Mask not ready yet
      }
    }

    // Draw detected position
    if (this.currentPosition) {
      const scaleX = canvas.width / this.width;
      const scaleY = canvas.height / this.height;

      ctx.beginPath();
      ctx.arc(
        this.currentPosition.x * scaleX,
        this.currentPosition.y * scaleY,
        10, 0, Math.PI * 2
      );
      ctx.strokeStyle = this.isTracking ? '#0f0' : '#f00';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Crosshair
      ctx.beginPath();
      ctx.moveTo(this.currentPosition.x * scaleX - 15, this.currentPosition.y * scaleY);
      ctx.lineTo(this.currentPosition.x * scaleX + 15, this.currentPosition.y * scaleY);
      ctx.moveTo(this.currentPosition.x * scaleX, this.currentPosition.y * scaleY - 15);
      ctx.lineTo(this.currentPosition.x * scaleX, this.currentPosition.y * scaleY + 15);
      ctx.stroke();
    }

    // Draw status text
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(`Tracking: ${this.isTracking ? 'ON' : 'OFF'}`, 5, 15);
    ctx.fillText(`Process: ${this.processTime.toFixed(1)}ms`, 5, 30);
  }

  /**
   * Get normalized position (0-1 range)
   * @returns {Object|null} - Normalized position {x, y} or null
   */
  getNormalizedPosition() {
    if (!this.currentPosition) return null;

    return {
      x: this.currentPosition.x / this.width,
      y: this.currentPosition.y / this.height
    };
  }

  /**
   * Update tracking parameters
   * @param {Object} newParams - New parameter values
   */
  setParams(newParams) {
    Object.assign(this.params, newParams);
  }

  /**
   * Clean up OpenCV matrices
   */
  dispose() {
    if (this.srcMat) this.srcMat.delete();
    if (this.hsvMat) this.hsvMat.delete();
    if (this.maskMat) this.maskMat.delete();
    if (this.morphKernel) this.morphKernel.delete();

    this.srcMat = null;
    this.hsvMat = null;
    this.maskMat = null;
    this.morphKernel = null;
  }
}
