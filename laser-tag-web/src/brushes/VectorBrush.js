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
      dripsEnabled: false
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

      // Maybe spawn drip
      if (this.params.dripsEnabled && velocity < 0.1 && Math.random() < 0.02) {
        this.spawnDrip(x, y);
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
   * Spawn a drip particle
   */
  spawnDrip(x, y) {
    this.drips.push({
      x,
      y,
      vy: 0,
      width: this.params.brushWidth * (0.3 + Math.random() * 0.4),
      color: { ...this.params.color },
      opacity: this.params.opacity,
      life: 1
    });
  }

  /**
   * Update and render drips
   */
  updateDrips() {
    const gravity = 0.5;
    const decay = 0.995;

    for (let i = this.drips.length - 1; i >= 0; i--) {
      const drip = this.drips[i];

      // Update physics
      drip.vy += gravity;
      drip.y += drip.vy;
      drip.life *= decay;
      drip.width *= 0.998;

      // Draw drip
      if (drip.life > 0.01 && drip.y < this.height) {
        this.ctx.beginPath();
        this.ctx.arc(drip.x, drip.y, drip.width / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(${drip.color.r}, ${drip.color.g}, ${drip.color.b}, ${drip.opacity * drip.life})`;
        this.ctx.fill();
      } else {
        // Remove dead drip
        this.drips.splice(i, 1);
      }
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
    // Clear canvas
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.width, this.height);

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
