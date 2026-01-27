/**
 * VectorBrush - Vector-based brush with smooth line rendering
 * Based on vectorBrush.cpp from the original L.A.S.E.R. TAG
 */
import { BaseBrush } from './BaseBrush.js';

export class VectorBrush extends BaseBrush {
  constructor() {
    super('Vector');

    // Vector brush specific parameters
    this.params = {
      ...this.params,
      brushWidth: 15,
      minWidth: 2,
      maxWidth: 40,
      velocityScale: 0.5,    // How much velocity affects width
      smoothing: 0.3,        // Line smoothing factor
      mode: 'smooth',        // 'smooth', 'ribbon', 'glow', 'neon', 'arrow', 'basic', 'dope', 'arrowFat'
      shadowOffset: 8,       // Shadow offset for C++ style modes
      shadowColor: '#FF0AC2', // Shadow color for C++ style modes (magenta default)
      glowIntensity: 0.5,
      // Drip parameters (inverted from original so higher = more drips)
      dripsEnabled: true,
      dripsFrequency: 30,    // 1-120, higher = more drips
      dripsSpeed: 0.3,       // 0.0-12.0, movement speed
      dripsDirection: 0,     // 0=south, 1=west, 2=north, 3=east
      dripsWidth: 1          // 1-25, line thickness
    };

    // Drip particles (active drips) - each has strokeIndex
    this.drips = [];
    // Drip trails - each has strokeIndex for proper layering
    this.dripTrails = [];
    // Counter for stroke ordering
    this.strokeCounter = 0;

    // Background canvas for finalized/baked content
    this.backgroundCanvas = null;
    this.backgroundCtx = null;
  }

  /**
   * Override setCanvas to create background layer
   */
  setCanvas(canvas) {
    super.setCanvas(canvas);

    // Create background canvas for finalized content
    this.backgroundCanvas = document.createElement('canvas');
    this.backgroundCanvas.width = canvas.width;
    this.backgroundCanvas.height = canvas.height;
    this.backgroundCtx = this.backgroundCanvas.getContext('2d');
  }

  /**
   * Override startNewStroke to store the current mode with the stroke
   * Also bakes previous content to background before starting new stroke
   */
  startNewStroke(x, y) {
    // Bake all previous content to background before starting new stroke
    this.bakeToBackground();

    this.strokeCounter++;
    this.currentStroke = {
      points: [{ x, y, time: Date.now() }],
      color: { ...this.params.color },
      width: this.params.brushWidth,
      opacity: this.params.opacity,
      mode: this.params.mode,  // Store mode with stroke
      shadowColor: this.params.shadowColor,  // Store shadow color with stroke
      strokeIndex: this.strokeCounter  // For layering with drips
    };
    this.strokes.push(this.currentStroke);
  }

  /**
   * Override endStroke to mark stroke as complete
   */
  endStroke() {
    if (this.currentStroke) {
      this.currentStroke.complete = true;
    }
    this.currentStroke = null;
  }

  /**
   * Bake all completed strokes, drip trails, and active drips to background canvas
   * This makes them immutable - subsequent operations won't affect them
   */
  bakeToBackground() {
    if (!this.backgroundCtx) return;

    // Only bake if there's content to bake
    const completedStrokes = this.strokes.filter(s => s.complete && s.points.length >= 2);
    const hasContent = completedStrokes.length > 0 || this.dripTrails.length > 0 || this.drips.length > 0;
    if (!hasContent) return;

    // Finalize all active drips - add their current position as final trail segment
    for (const drip of this.drips) {
      if (drip.active) {
        this.dripTrails.push({
          x0: drip.prevX,
          y0: drip.prevY,
          x1: drip.x,
          y1: drip.y,
          width: drip.width,
          color: { ...drip.color },
          opacity: drip.opacity,
          strokeIndex: drip.strokeIndex
        });
      }
    }

    // Draw current content to background
    this.redraw();

    // Composite main canvas onto background
    this.backgroundCtx.drawImage(this.canvas, 0, 0);

    // Clear working arrays (content is now in background)
    this.strokes = this.strokes.filter(s => !s.complete);
    this.dripTrails = [];
    this.drips = [];  // Clear active drips too

    // Clear main canvas
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * Continue the current stroke with velocity-based width
   */
  continueStroke(x, y) {
    if (!this.currentStroke) return;

    const points = this.currentStroke.points;
    const lastPoint = points[points.length - 1];

    // Calculate velocity
    const dx = x - lastPoint.x;
    const dy = y - lastPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dt = Date.now() - lastPoint.time;
    const velocity = dt > 0 ? dist / dt : 0;

    // Calculate width based on velocity
    let width = this.params.brushWidth;
    if (this.params.velocityScale > 0) {
      // Faster = thinner, slower = thicker
      const velocityFactor = 1 - Math.min(velocity * this.params.velocityScale, 0.8);
      width = this.params.minWidth +
        (this.params.maxWidth - this.params.minWidth) * velocityFactor;
    }

    // Only add point if moved enough
    if (dist > 2) {
      this.currentStroke.points.push({
        x,
        y,
        time: Date.now(),
        width,
        velocity
      });

      // Render the new segment immediately
      this.renderSegment(points.length - 1);

      // Drip spawning - inverted from C++ so higher frequency = more drips
      // C++ used: ofRandom(0,freq) > freq-1 (higher freq = fewer drips)
      // We use: probability = freq/maxFreq (higher freq = more drips)
      if (this.params.dripsEnabled) {
        const maxFreq = 120;
        const probability = this.params.dripsFrequency / maxFreq;
        if (Math.random() < probability) {
          this.spawnDrip(x, y);
        }
      }
    }
  }

  /**
   * Render a single segment of a stroke (live drawing)
   * For C++ modes, we do a full redraw to get proper shadow layering
   */
  renderSegment(segmentIndex) {
    if (!this.currentStroke || segmentIndex < 1) return;

    const points = this.currentStroke.points;
    const p0 = points[segmentIndex - 1];
    const p1 = points[segmentIndex];

    const ctx = this.ctx;
    const color = this.currentStroke.color;
    const mode = this.params.mode;

    // C++ modes need full redraw for proper shadow layering
    if (['basic', 'dope', 'arrow', 'arrowFat'].includes(mode)) {
      this.redraw();
      return;
    }

    switch (mode) {
      case 'ribbon':
        this.drawRibbonSegment(ctx, p0, p1, color);
        break;
      case 'glow':
        this.drawGlowSegment(ctx, p0, p1, color);
        break;
      case 'neon':
        this.drawNeonSegment(ctx, p0, p1, color);
        break;
      case 'smooth':
      default:
        this.drawSmoothSegment(ctx, p0, p1, color);
        break;
    }
  }

  /**
   * Draw a smooth line segment with variable width
   */
  drawSmoothSegment(ctx, p0, p1, color) {
    const w0 = p0.width || this.params.brushWidth;
    const w1 = p1.width || this.params.brushWidth;

    // Calculate perpendicular offset
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len < 0.1) return;

    const nx = -dy / len;
    const ny = dx / len;

    // Draw filled quad with gradient width
    ctx.beginPath();
    ctx.moveTo(p0.x + nx * w0 / 2, p0.y + ny * w0 / 2);
    ctx.lineTo(p1.x + nx * w1 / 2, p1.y + ny * w1 / 2);
    ctx.lineTo(p1.x - nx * w1 / 2, p1.y - ny * w1 / 2);
    ctx.lineTo(p0.x - nx * w0 / 2, p0.y - ny * w0 / 2);
    ctx.closePath();

    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${this.params.opacity})`;
    ctx.fill();

    // Draw end caps
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, w1 / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw a ribbon-style segment
   */
  drawRibbonSegment(ctx, p0, p1, color) {
    const w0 = p0.width || this.params.brushWidth;
    const w1 = p1.width || this.params.brushWidth;

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${this.params.opacity})`;
    ctx.lineWidth = (w0 + w1) / 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  /**
   * Draw a glowing segment
   */
  drawGlowSegment(ctx, p0, p1, color) {
    const w = (p0.width + p1.width) / 2 || this.params.brushWidth;
    const intensity = this.params.glowIntensity;

    // Draw multiple layers for glow effect
    for (let i = 3; i >= 0; i--) {
      const alpha = (this.params.opacity / (i + 1)) * intensity;
      const width = w + i * 8;

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  /**
   * Draw a neon-style segment with hard center
   */
  drawNeonSegment(ctx, p0, p1, color) {
    const w = (p0.width + p1.width) / 2 || this.params.brushWidth;

    // Outer glow
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.3)`;
    ctx.lineWidth = w + 20;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Middle glow
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.6)`;
    ctx.lineWidth = w + 8;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Bright center
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.strokeStyle = `rgba(255, 255, 255, ${this.params.opacity})`;
    ctx.lineWidth = w / 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // ============================================
  // C++ Style Brush Modes (from vectorBrush.cpp)
  // ============================================

  /**
   * Convert hex color to rgba string
   */
  hexToRgba(hex, alpha = 1) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return `rgba(0, 0, 0, ${alpha})`;  // Fallback to black
  }

  /**
   * Draw a basic segment with diagonal shadow offset
   * Port of drawBasic() from original C++
   */
  drawBasicSegment(ctx, p0, p1, color) {
    const w0 = p0.width || this.params.brushWidth;
    const w1 = p1.width || this.params.brushWidth;
    const offset = this.params.shadowOffset;

    // Draw shadow first (diagonal offset, black with alpha)
    ctx.beginPath();
    ctx.moveTo(p0.x - offset, p0.y + offset);
    ctx.lineTo(p1.x - offset, p1.y + offset);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.63)';  // 160/255 ≈ 0.63
    ctx.lineWidth = (w0 + w1) / 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Draw main stroke
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${this.params.opacity})`;
    ctx.lineWidth = (w0 + w1) / 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  /**
   * Draw a dope segment with normal-perpendicular ribbon and shadow
   * Port of drawDope() from original C++ - follows stroke direction
   * C++ pattern: perpendicular = (nrm_y, -nrm_x) where nrm is normalized direction
   */
  drawDopeSegment(ctx, p0, p1, color) {
    const w0 = p0.width || this.params.brushWidth;
    const w1 = p1.width || this.params.brushWidth;
    const offset = this.params.shadowOffset;

    // Normalized direction vector (like C++ nrm)
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.1) return;

    const nrmX = dx / len;
    const nrmY = dy / len;

    // Perpendicular using C++ pattern: (nrm_y, -nrm_x)
    // Point A: (x + nrm_y * halfBrush, y - nrm_x * halfBrush)
    // Point B: (x - nrm_y * halfBrush, y + nrm_x * halfBrush)

    // Draw shadow quad (offset: -offset on x, +offset on y)
    ctx.beginPath();
    ctx.moveTo(p0.x - offset + nrmY * w0 / 2, p0.y + offset - nrmX * w0 / 2);
    ctx.lineTo(p1.x - offset + nrmY * w1 / 2, p1.y + offset - nrmX * w1 / 2);
    ctx.lineTo(p1.x - offset - nrmY * w1 / 2, p1.y + offset + nrmX * w1 / 2);
    ctx.lineTo(p0.x - offset - nrmY * w0 / 2, p0.y + offset + nrmX * w0 / 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.63)';
    ctx.fill();

    // Draw main quad
    ctx.beginPath();
    ctx.moveTo(p0.x + nrmY * w0 / 2, p0.y - nrmX * w0 / 2);
    ctx.lineTo(p1.x + nrmY * w1 / 2, p1.y - nrmX * w1 / 2);
    ctx.lineTo(p1.x - nrmY * w1 / 2, p1.y + nrmX * w1 / 2);
    ctx.lineTo(p0.x - nrmY * w0 / 2, p0.y + nrmX * w0 / 2);
    ctx.closePath();
    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${this.params.opacity})`;
    ctx.fill();
  }

  /**
   * Draw an arrow segment - like dope but with arrow head at end
   * Port of drawArrow() from original C++
   * Note: Arrow head is drawn in endStroke() for full stroke
   */
  drawArrowSegment(ctx, p0, p1, color) {
    // Same as dope for segments - arrow head added at stroke end
    this.drawDopeSegment(ctx, p0, p1, color);
  }

  /**
   * Draw an arrow fat segment with magenta outline shadow
   * Port of drawArrowFAT() from original C++ - uses 0xFF0AC2 magenta shadow
   */
  drawArrowFatSegment(ctx, p0, p1, color) {
    const w0 = p0.width || this.params.brushWidth;
    const w1 = p1.width || this.params.brushWidth;
    const offset = this.params.shadowOffset;

    // Normalized direction vector
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.1) return;

    const nrmX = dx / len;
    const nrmY = dy / len;

    // Draw magenta shadow quad (0xFF0AC2 from original)
    ctx.beginPath();
    ctx.moveTo(p0.x - offset + nrmY * w0 / 2, p0.y + offset - nrmX * w0 / 2);
    ctx.lineTo(p1.x - offset + nrmY * w1 / 2, p1.y + offset - nrmX * w1 / 2);
    ctx.lineTo(p1.x - offset - nrmY * w1 / 2, p1.y + offset + nrmX * w1 / 2);
    ctx.lineTo(p0.x - offset - nrmY * w0 / 2, p0.y + offset + nrmX * w0 / 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 10, 194, 0.8)';  // 0xFF0AC2
    ctx.fill();

    // Draw main quad
    ctx.beginPath();
    ctx.moveTo(p0.x + nrmY * w0 / 2, p0.y - nrmX * w0 / 2);
    ctx.lineTo(p1.x + nrmY * w1 / 2, p1.y - nrmX * w1 / 2);
    ctx.lineTo(p1.x - nrmY * w1 / 2, p1.y + nrmX * w1 / 2);
    ctx.lineTo(p0.x - nrmY * w0 / 2, p0.y + nrmX * w0 / 2);
    ctx.closePath();
    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${this.params.opacity})`;
    ctx.fill();
  }

  /**
   * Draw arrow head shadow at end of stroke (for arrow/arrowFat modes)
   * Uses same perpendicular pattern as C++ stroke: (nrmY, -nrmX)
   */
  drawArrowHeadShadow(ctx, stroke) {
    const points = stroke.points;
    if (points.length < 2) return;

    const lastPt = points[points.length - 1];
    const prevPt = points[points.length - 2];
    const w = lastPt.width || this.params.brushWidth;
    const offset = this.params.shadowOffset;
    const shadowColor = stroke.shadowColor || this.params.shadowColor || '#000000';

    // Calculate normalized direction vector (same as C++)
    const dx = lastPt.x - prevPt.x;
    const dy = lastPt.y - prevPt.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.1) return;

    const nrmX = dx / len;
    const nrmY = dy / len;

    // Shadow offset applied: -offset on X, +offset on Y (down-left)
    const sx = lastPt.x - offset;
    const sy = lastPt.y + offset;

    // Arrow tip point with shadow offset
    const tipX = sx + nrmX * w * 2;
    const tipY = sy + nrmY * w * 2;

    // Arrow base points using C++ perpendicular pattern: (nrmY, -nrmX)
    const baseLeftX = sx + nrmY * w * 1.5;
    const baseLeftY = sy - nrmX * w * 1.5;
    const baseRightX = sx - nrmY * w * 1.5;
    const baseRightY = sy + nrmX * w * 1.5;

    // Draw arrow head shadow
    ctx.beginPath();
    ctx.moveTo(baseLeftX, baseLeftY);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(baseRightX, baseRightY);
    ctx.closePath();
    ctx.fillStyle = this.hexToRgba(shadowColor, 0.7);
    ctx.fill();
  }

  /**
   * Draw arrow head at end of stroke (for arrow/arrowFat modes)
   * Uses same perpendicular pattern as C++ stroke: (nrmY, -nrmX)
   */
  drawArrowHead(ctx, stroke) {
    const points = stroke.points;
    if (points.length < 2) return;

    const lastPt = points[points.length - 1];
    const prevPt = points[points.length - 2];
    const w = lastPt.width || this.params.brushWidth;
    const color = stroke.color;

    // Calculate normalized direction vector (same as C++)
    const dx = lastPt.x - prevPt.x;
    const dy = lastPt.y - prevPt.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.1) return;

    const nrmX = dx / len;
    const nrmY = dy / len;

    // Arrow tip point (extends beyond last point in direction of movement)
    const tipX = lastPt.x + nrmX * w * 2;
    const tipY = lastPt.y + nrmY * w * 2;

    // Arrow base points using C++ perpendicular pattern: (nrmY, -nrmX)
    // Point A: (x + nrmY * width, y - nrmX * width)
    // Point B: (x - nrmY * width, y + nrmX * width)
    const baseLeftX = lastPt.x + nrmY * w * 1.5;
    const baseLeftY = lastPt.y - nrmX * w * 1.5;
    const baseRightX = lastPt.x - nrmY * w * 1.5;
    const baseRightY = lastPt.y + nrmX * w * 1.5;

    // Draw arrow head
    ctx.beginPath();
    ctx.moveTo(baseLeftX, baseLeftY);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(baseRightX, baseRightY);
    ctx.closePath();
    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${this.params.opacity})`;
    ctx.fill();
  }

  /**
   * Spawn a drip - based on original L.A.S.E.R. TAG drips.cpp
   * Drips travel a set distance with deceleration, drawing continuous lines
   * Supports 4 directions: 0=south, 1=west, 2=north, 3=east
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} colorOverride - Optional hex color (for shadow drips)
   */
  spawnDrip(x, y, colorOverride = null) {
    const direction = this.params.dripsDirection;
    const speed = this.params.dripsSpeed;

    // Calculate max length based on direction and available space
    let maxLength = 0;
    if (direction === 0) {        // south
      maxLength = this.height - y;
    } else if (direction === 1) { // west
      maxLength = x;
    } else if (direction === 2) { // north
      maxLength = y;
    } else if (direction === 3) { // east
      maxLength = this.width - x;
    }

    if (maxLength < 10) return;

    // Random length up to 1/3 of available space (like original)
    let length = Math.random() * (maxLength / 3);
    length *= 0.75;
    length = Math.max(20, Math.min(150, length)); // Clamp to reasonable range

    // Calculate velocity based on direction
    let vx = 0, vy = 0;
    if (direction === 0) {        // south
      vy = speed;
    } else if (direction === 1) { // west
      vx = -speed;
    } else if (direction === 2) { // north
      vy = -speed;
    } else if (direction === 3) { // east
      vx = speed;
    }

    // Determine color - use override for shadow drips
    let dripColor;
    if (colorOverride) {
      // Convert hex to RGB
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(colorOverride);
      if (result) {
        dripColor = {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        };
      } else {
        dripColor = { ...this.params.color };
      }
    } else {
      dripColor = { ...this.params.color };
    }

    this.drips.push({
      x: x,
      y: y,
      prevX: x,
      prevY: y,
      vx: vx,
      vy: vy,
      distance: 0,
      maxDistance: length,
      width: this.params.dripsWidth,  // Use drip-specific width
      color: dripColor,
      opacity: colorOverride ? 0.7 : this.params.opacity,  // Shadow drips slightly transparent
      active: true,
      strokeIndex: this.currentStroke ? this.currentStroke.strokeIndex : this.strokeCounter
    });
  }

  /**
   * Update drips physics and store trail segments for redraw
   * Based on original drips.cpp physics
   */
  updateDrips() {
    for (let i = this.drips.length - 1; i >= 0; i--) {
      const drip = this.drips[i];

      if (!drip.active) {
        this.drips.splice(i, 1);
        continue;
      }

      // Store previous position
      drip.prevX = drip.x;
      drip.prevY = drip.y;

      // Update distance traveled
      drip.distance += Math.abs(drip.vx) + Math.abs(drip.vy);

      // Check if we've reached the target
      if (drip.distance >= drip.maxDistance) {
        drip.active = false;
        continue;
      }

      // Deceleration when approaching end (last 24 pixels)
      if (drip.maxDistance - drip.distance < 24) {
        drip.vx *= 0.987;
        drip.vy *= 0.987;

        // Stop if velocity is negligible
        if (Math.abs(drip.vx) < 0.01 && Math.abs(drip.vy) < 0.01) {
          drip.active = false;
          continue;
        }
      }

      // Update position
      drip.x += drip.vx;
      drip.y += drip.vy;

      // Clamp to canvas bounds
      if (drip.x < 0 || drip.x >= this.width || drip.y < 0 || drip.y >= this.height) {
        drip.active = false;
        continue;
      }

      // Store trail segment for redraw (instead of drawing directly)
      this.dripTrails.push({
        x0: drip.prevX,
        y0: drip.prevY,
        x1: drip.x,
        y1: drip.y,
        width: drip.width,
        color: { ...drip.color },
        opacity: drip.opacity,
        strokeIndex: drip.strokeIndex
      });
    }
  }

  /**
   * Draw all drip trails
   */
  drawDripTrails(ctx) {
    for (const trail of this.dripTrails) {
      ctx.beginPath();
      ctx.moveTo(trail.x0, trail.y0);
      ctx.lineTo(trail.x1, trail.y1);
      ctx.strokeStyle = `rgba(${trail.color.r}, ${trail.color.g}, ${trail.color.b}, ${trail.opacity})`;
      ctx.lineWidth = trail.width;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  /**
   * Render all strokes and drips
   */
  render() {
    // Update drip physics (adds new trail segments)
    if (this.params.dripsEnabled && this.drips.length > 0) {
      this.updateDrips();
      // Redraw everything to show new drip trails with proper layering
      this.redraw();
    }
  }

  /**
   * Redraw all strokes from scratch
   * Strokes are drawn in creation order, with drip trails drawn with their parent stroke
   */
  redraw() {
    // Clear canvas (transparent for compositing)
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw baked background first (immutable previous content)
    if (this.backgroundCanvas) {
      this.ctx.drawImage(this.backgroundCanvas, 0, 0);
    }

    const quadModes = ['dope', 'arrow', 'arrowFat'];  // Modes that use quad-based ribbons
    const validStrokes = this.strokes.filter(s => s.points.length >= 2);

    // Draw strokes in creation order
    // For each stroke: draw stroke, then its drip trails
    for (const stroke of validStrokes) {
      const mode = stroke.mode || 'smooth';
      const isQuadMode = quadModes.includes(mode);
      const strokeIdx = stroke.strokeIndex;

      if (mode === 'basic') {
        // Basic mode: rounded strokes with diagonal shadow
        this.drawBasicStrokeShadow(this.ctx, stroke);
        this.drawBasicStrokeMain(this.ctx, stroke);
      } else if (isQuadMode) {
        // Quad-based modes: dope, arrow, arrowFat - use ribbon quads
        this.drawCppStrokeShadow(this.ctx, stroke, mode);
        if (mode === 'arrow' || mode === 'arrowFat') {
          this.drawArrowHeadShadow(this.ctx, stroke);
        }
        // Then draw main stroke
        this.drawCppStrokeMain(this.ctx, stroke, mode);
        if (mode === 'arrow' || mode === 'arrowFat') {
          this.drawArrowHead(this.ctx, stroke);
        }
      } else {
        // Standard stroke - no shadow
        for (let i = 1; i < stroke.points.length; i++) {
          const p0 = stroke.points[i - 1];
          const p1 = stroke.points[i];

          switch (mode) {
            case 'ribbon':
              this.drawRibbonSegment(this.ctx, p0, p1, stroke.color);
              break;
            case 'glow':
              this.drawGlowSegment(this.ctx, p0, p1, stroke.color);
              break;
            case 'neon':
              this.drawNeonSegment(this.ctx, p0, p1, stroke.color);
              break;
            default:
              this.drawSmoothSegment(this.ctx, p0, p1, stroke.color);
          }
        }
      }

      // Draw drip trails that belong to this stroke
      this.drawDripTrailsForStroke(this.ctx, strokeIdx);
    }

    // Draw any orphan drip trails (from strokes already baked)
    this.drawDripTrailsForStroke(this.ctx, null);
  }

  /**
   * Draw drip trails for a specific stroke (or orphans if strokeIdx is null)
   */
  drawDripTrailsForStroke(ctx, strokeIdx) {
    for (const trail of this.dripTrails) {
      const matches = strokeIdx === null
        ? (trail.strokeIndex === undefined || !this.strokes.some(s => s.strokeIndex === trail.strokeIndex))
        : trail.strokeIndex === strokeIdx;

      if (matches) {
        ctx.beginPath();
        ctx.moveTo(trail.x0, trail.y0);
        ctx.lineTo(trail.x1, trail.y1);
        ctx.strokeStyle = `rgba(${trail.color.r}, ${trail.color.g}, ${trail.color.b}, ${trail.opacity})`;
        ctx.lineWidth = trail.width;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }
  }

  /**
   * Draw basic mode stroke shadow (rounded line strokes with diagonal offset)
   */
  drawBasicStrokeShadow(ctx, stroke) {
    const points = stroke.points;
    const offset = this.params.shadowOffset;

    ctx.beginPath();
    ctx.moveTo(points[0].x - offset, points[0].y + offset);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x - offset, points[i].y + offset);
    }

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.63)';
    ctx.lineWidth = points[0].width || this.params.brushWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  /**
   * Draw basic mode stroke main color (rounded line strokes)
   */
  drawBasicStrokeMain(ctx, stroke) {
    const points = stroke.points;
    const color = stroke.color;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${this.params.opacity})`;
    ctx.lineWidth = points[0].width || this.params.brushWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  /**
   * Draw C++ style stroke shadow as continuous path
   * dope/arrow use black shadow, arrowFat uses configurable shadow color
   */
  drawCppStrokeShadow(ctx, stroke, mode) {
    const points = stroke.points;
    const offset = this.params.shadowOffset;
    // Only arrowFat uses the configurable shadow color; dope/arrow use black
    const shadowColor = mode === 'arrowFat'
      ? (stroke.shadowColor || this.params.shadowColor || '#FF0AC2')
      : '#000000';

    ctx.beginPath();

    // Build path along one side, then back along the other (like GL_QUAD_STRIP)
    const topPoints = [];
    const bottomPoints = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const w = p.width || this.params.brushWidth;

      // Calculate normal from surrounding points
      let nrmX = 0, nrmY = 1;
      if (i < points.length - 1) {
        const next = points[i + 1];
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.1) {
          nrmX = dx / len;
          nrmY = dy / len;
        }
      } else if (i > 0) {
        const prev = points[i - 1];
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.1) {
          nrmX = dx / len;
          nrmY = dy / len;
        }
      }

      // Perpendicular using C++ pattern: (nrm_y, -nrm_x)
      topPoints.push({
        x: p.x - offset + nrmY * w / 2,
        y: p.y + offset - nrmX * w / 2
      });
      bottomPoints.push({
        x: p.x - offset - nrmY * w / 2,
        y: p.y + offset + nrmX * w / 2
      });
    }

    // Draw as single filled shape
    if (topPoints.length > 0) {
      ctx.moveTo(topPoints[0].x, topPoints[0].y);
      for (let i = 1; i < topPoints.length; i++) {
        ctx.lineTo(topPoints[i].x, topPoints[i].y);
      }
      for (let i = bottomPoints.length - 1; i >= 0; i--) {
        ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
      }
      ctx.closePath();
    }

    ctx.fillStyle = this.hexToRgba(shadowColor, 0.7);
    ctx.fill();
  }

  /**
   * Draw C++ style stroke main color as continuous path
   */
  drawCppStrokeMain(ctx, stroke, mode) {
    const points = stroke.points;
    const color = stroke.color;

    ctx.beginPath();

    const topPoints = [];
    const bottomPoints = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const w = p.width || this.params.brushWidth;

      // Calculate normal
      let nrmX = 0, nrmY = 1;
      if (i < points.length - 1) {
        const next = points[i + 1];
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.1) {
          nrmX = dx / len;
          nrmY = dy / len;
        }
      } else if (i > 0) {
        const prev = points[i - 1];
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.1) {
          nrmX = dx / len;
          nrmY = dy / len;
        }
      }

      topPoints.push({
        x: p.x + nrmY * w / 2,
        y: p.y - nrmX * w / 2
      });
      bottomPoints.push({
        x: p.x - nrmY * w / 2,
        y: p.y + nrmX * w / 2
      });
    }

    if (topPoints.length > 0) {
      ctx.moveTo(topPoints[0].x, topPoints[0].y);
      for (let i = 1; i < topPoints.length; i++) {
        ctx.lineTo(topPoints[i].x, topPoints[i].y);
      }
      for (let i = bottomPoints.length - 1; i >= 0; i--) {
        ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
      }
      ctx.closePath();
    }

    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${this.params.opacity})`;
    ctx.fill();
  }

  /**
   * Clear everything including drips and background
   */
  clear() {
    super.clear();
    this.drips = [];
    this.dripTrails = [];
    this.strokeCounter = 0;
    // Clear background canvas
    if (this.backgroundCtx) {
      this.backgroundCtx.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
    }
  }
}
