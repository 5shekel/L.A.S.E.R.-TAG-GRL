/**
 * BaseBrush - Abstract base class for all brush types
 * Based on baseBrush.h from the original L.A.S.E.R. TAG
 */
export class BaseBrush {
  constructor(name) {
    this.name = name;

    // Canvas and rendering context
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;

    // Brush parameters
    this.params = {
      color: { r: 255, g: 255, b: 255 },
      brushWidth: 10,
      opacity: 1.0,
      enabled: true
    };

    // State
    this.isDrawing = false;
    this.strokes = [];
    this.currentStroke = null;
  }

  /**
   * Initialize the brush with a canvas
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   */
  init(width, height) {
    this.width = width;
    this.height = height;

    // Create offscreen canvas for this brush
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');

    // Initialize to black/transparent
    this.clear();
  }

  /**
   * Add a point to the current stroke
   * @param {number} x - X coordinate (0-1 normalized)
   * @param {number} y - Y coordinate (0-1 normalized)
   * @param {boolean} isNewStroke - Whether this starts a new stroke
   */
  addPoint(x, y, isNewStroke) {
    // Convert normalized coordinates to canvas coordinates
    const canvasX = x * this.width;
    const canvasY = y * this.height;

    if (isNewStroke || !this.currentStroke) {
      this.startNewStroke(canvasX, canvasY);
    } else {
      this.continueStroke(canvasX, canvasY);
    }

    this.isDrawing = true;
  }

  /**
   * Start a new stroke
   * @param {number} x - Canvas X coordinate
   * @param {number} y - Canvas Y coordinate
   */
  startNewStroke(x, y) {
    this.currentStroke = {
      points: [{ x, y, time: Date.now() }],
      color: { ...this.params.color },
      width: this.params.brushWidth,
      opacity: this.params.opacity
    };
    this.strokes.push(this.currentStroke);
  }

  /**
   * Continue the current stroke
   * @param {number} x - Canvas X coordinate
   * @param {number} y - Canvas Y coordinate
   */
  continueStroke(x, y) {
    if (this.currentStroke) {
      this.currentStroke.points.push({ x, y, time: Date.now() });
    }
  }

  /**
   * End the current stroke
   */
  endStroke() {
    this.currentStroke = null;
    this.isDrawing = false;
  }

  /**
   * Update brush parameters
   * @param {Object} newParams - New parameter values
   */
  setParams(newParams) {
    Object.assign(this.params, newParams);
  }

  /**
   * Set brush color
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   */
  setColor(r, g, b) {
    this.params.color = { r, g, b };
  }

  /**
   * Set brush width
   * @param {number} width - Brush width in pixels
   */
  setBrushWidth(width) {
    this.params.brushWidth = width;
  }

  /**
   * Render the brush to its internal canvas
   * Subclasses should override this
   */
  render() {
    // Abstract - implement in subclass
  }

  /**
   * Draw the brush canvas to a destination context
   * @param {CanvasRenderingContext2D} destCtx - Destination context
   */
  draw(destCtx) {
    if (this.canvas) {
      destCtx.drawImage(this.canvas, 0, 0);
    }
  }

  /**
   * Clear all strokes and the canvas
   */
  clear() {
    this.strokes = [];
    this.currentStroke = null;
    this.isDrawing = false;

    if (this.ctx) {
      // Use transparent clear so multiple brushes can composite
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  /**
   * Undo the last stroke
   */
  undo() {
    if (this.strokes.length > 0) {
      this.strokes.pop();
      this.redraw();
    }
  }

  /**
   * Redraw all strokes
   */
  redraw() {
    this.clear();
    // Subclasses implement specific redraw logic
  }

  /**
   * Get the brush's canvas for compositing
   * @returns {HTMLCanvasElement}
   */
  getCanvas() {
    return this.canvas;
  }

  /**
   * Dispose of resources
   */
  dispose() {
    this.canvas = null;
    this.ctx = null;
    this.strokes = [];
  }
}
