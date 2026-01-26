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
      mode: 'smooth',        // 'smooth', 'ribbon', 'glow', 'neon'
      glowIntensity: 0.5,
      // Drip parameters (inverted from original so higher = more drips)
      dripsEnabled: true,
      dripsFrequency: 30,    // 1-120, higher = more drips
      dripsSpeed: 0.3,       // 0.0-12.0, movement speed
      dripsDirection: 0,     // 0=south, 1=west, 2=north, 3=east
      dripsWidth: 1          // 1-25, line thickness
    };

    // Drip particles
    this.drips = [];
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
   * Render a single segment of a stroke
   */
  renderSegment(segmentIndex) {
    if (!this.currentStroke || segmentIndex < 1) return;

    const points = this.currentStroke.points;
    const p0 = points[segmentIndex - 1];
    const p1 = points[segmentIndex];

    const ctx = this.ctx;
    const color = this.currentStroke.color;

    switch (this.params.mode) {
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

  /**
   * Spawn a drip - based on original L.A.S.E.R. TAG drips.cpp
   * Drips travel a set distance with deceleration, drawing continuous lines
   * Supports 4 directions: 0=south, 1=west, 2=north, 3=east
   */
  spawnDrip(x, y) {
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
      color: { ...this.params.color },
      opacity: this.params.opacity,
      active: true
    });
  }

  /**
   * Update and render drips - draws continuous lines like paint dripping
   * Based on original drips.cpp physics
   */
  updateDrips() {
    const ctx = this.ctx;

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

      // Draw line from previous to current position (continuous drip trail)
      ctx.beginPath();
      ctx.moveTo(drip.prevX, drip.prevY);
      ctx.lineTo(drip.x, drip.y);
      ctx.strokeStyle = `rgba(${drip.color.r}, ${drip.color.g}, ${drip.color.b}, ${drip.opacity})`;
      ctx.lineWidth = drip.width;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  /**
   * Render all strokes and drips
   */
  render() {
    // Update drips
    if (this.params.dripsEnabled) {
      this.updateDrips();
    }
  }

  /**
   * Redraw all strokes from scratch
   */
  redraw() {
    // Clear canvas (transparent for compositing)
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Redraw all strokes
    for (const stroke of this.strokes) {
      if (stroke.points.length < 2) continue;

      for (let i = 1; i < stroke.points.length; i++) {
        const p0 = stroke.points[i - 1];
        const p1 = stroke.points[i];

        switch (this.params.mode) {
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
  }

  /**
   * Clear everything including drips
   */
  clear() {
    super.clear();
    this.drips = [];
  }
}
