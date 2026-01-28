/**
 * BrushModeStrategy - Base class for brush rendering modes
 *
 * Each mode defines how strokes are rendered (smooth, glow, basic, dope, arrow, arrowFat)
 */
export class BrushModeStrategy {
  constructor(name) {
    this.name = name;
  }

  /**
   * Render a single segment during live drawing
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} p0 - Start point {x, y, width, velocity}
   * @param {Object} p1 - End point {x, y, width, velocity}
   * @param {Object} color - {r, g, b}
   * @param {Object} params - Brush parameters
   */
  renderSegment(ctx, p0, p1, color, params) {
    throw new Error('renderSegment must be implemented by subclass');
  }

  /**
   * Check if this mode requires full redraw on each segment
   * (Modes with shadows need full redraw for proper layering)
   * @returns {boolean}
   */
  requiresFullRedraw() {
    return false;
  }

  /**
   * Draw a complete stroke
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} stroke - Complete stroke data
   * @param {Object} params - Brush parameters
   */
  drawStroke(ctx, stroke, params) {
    const points = stroke.points;
    for (let i = 1; i < points.length; i++) {
      this.renderSegment(ctx, points[i - 1], points[i], stroke.color, params);
    }
  }

  /**
   * Draw stroke shadow (if applicable)
   * Override in modes that have shadows
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} stroke - Complete stroke data
   * @param {Object} params - Brush parameters
   */
  drawStrokeShadow(ctx, stroke, params) {
    // Default: no shadow
  }

  /**
   * Draw stroke decorations (arrow heads, etc.)
   * Override in modes that have extra decorations
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} stroke - Complete stroke data
   * @param {Object} params - Brush parameters
   */
  drawStrokeDecorations(ctx, stroke, params) {
    // Default: no decorations
  }

  /**
   * Check if this mode supports drips
   * @returns {boolean}
   */
  supportsDrips() {
    return true;
  }

  /**
   * Utility: Convert hex color to rgba string
   * @param {string} hex
   * @param {number} alpha
   * @returns {string}
   */
  hexToRgba(hex, alpha = 1) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return `rgba(0, 0, 0, ${alpha})`;
  }
}
