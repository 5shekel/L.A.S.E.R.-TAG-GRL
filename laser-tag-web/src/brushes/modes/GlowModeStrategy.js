/**
 * GlowModeStrategy - Multi-layer glow effect rendering
 *
 * Draws multiple layers with decreasing opacity and increasing width
 * to create a glowing effect. Does not support drips (they don't look good).
 */
import { BrushModeStrategy } from './BrushModeStrategy.js';

export class GlowModeStrategy extends BrushModeStrategy {
  constructor() {
    super('glow');
  }

  /**
   * Render a glowing segment with multiple layers
   */
  renderSegment(ctx, p0, p1, color, params) {
    const w = (p0.width + p1.width) / 2 || params.brushWidth;
    const intensity = params.glowIntensity || 0.5;

    // Draw multiple layers for glow effect
    for (let i = 3; i >= 0; i--) {
      const alpha = (params.opacity / (i + 1)) * intensity;
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
   * Glow mode doesn't support drips (they don't look good with the glow effect)
   */
  supportsDrips() {
    return false;
  }
}
