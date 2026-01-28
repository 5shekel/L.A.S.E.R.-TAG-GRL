/**
 * BasicModeStrategy - Basic mode with diagonal shadow
 *
 * Port of drawBasic() from original L.A.S.E.R. TAG C++
 * Uses GL_QUAD_STRIP style with 45° diagonal offset pattern
 */
import { BrushModeStrategy } from './BrushModeStrategy.js';

export class BasicModeStrategy extends BrushModeStrategy {
  constructor() {
    super('basic');
  }

  /**
   * Basic mode requires full redraw for proper shadow layering
   */
  requiresFullRedraw() {
    return true;
  }

  /**
   * Render segment (only used in isolation, full stroke uses drawStroke)
   */
  renderSegment(ctx, p0, p1, color, params) {
    const w0 = p0.width || params.brushWidth;
    const w1 = p1.width || params.brushWidth;
    const offset = params.shadowOffset;

    // Draw shadow first (diagonal offset, black with alpha)
    ctx.beginPath();
    ctx.moveTo(p0.x - offset, p0.y + offset);
    ctx.lineTo(p1.x - offset, p1.y + offset);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.63)';
    ctx.lineWidth = (w0 + w1) / 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Draw main stroke
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${params.opacity})`;
    ctx.lineWidth = (w0 + w1) / 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  /**
   * Draw stroke shadow as diagonal ribbon (like GL_QUAD_STRIP)
   */
  drawStrokeShadow(ctx, stroke, params) {
    const points = stroke.points;
    const offset = params.shadowOffset;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.63)';

    // Draw each segment as a separate quad
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const halfBrush0 = (p0.width || params.brushWidth) / 2;
      const halfBrush1 = (p1.width || params.brushWidth) / 2;

      ctx.beginPath();
      ctx.moveTo(p0.x - offset + halfBrush0, p0.y + offset + halfBrush0);
      ctx.lineTo(p1.x - offset + halfBrush1, p1.y + offset + halfBrush1);
      ctx.lineTo(p1.x - offset - halfBrush1, p1.y + offset - halfBrush1);
      ctx.lineTo(p0.x - offset - halfBrush0, p0.y + offset - halfBrush0);
      ctx.closePath();
      ctx.fill();
    }
  }

  /**
   * Draw stroke main color as diagonal ribbon
   */
  drawStroke(ctx, stroke, params) {
    const points = stroke.points;
    const color = stroke.color;

    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${params.opacity})`;

    // Draw each segment as a separate quad
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const halfBrush0 = (p0.width || params.brushWidth) / 2;
      const halfBrush1 = (p1.width || params.brushWidth) / 2;

      ctx.beginPath();
      ctx.moveTo(p0.x + halfBrush0, p0.y + halfBrush0);
      ctx.lineTo(p1.x + halfBrush1, p1.y + halfBrush1);
      ctx.lineTo(p1.x - halfBrush1, p1.y - halfBrush1);
      ctx.lineTo(p0.x - halfBrush0, p0.y - halfBrush0);
      ctx.closePath();
      ctx.fill();
    }
  }
}
