/**
 * PngBrush - Image stamp-based brush
 * Based on pngBrush.cpp from the original L.A.S.E.R. TAG
 */
import { BaseBrush } from './BaseBrush.js';

export class PngBrush extends BaseBrush {
  constructor() {
    super('PNG Stamp');

    // PNG brush specific parameters
    this.params = {
      ...this.params,
      brushWidth: 30,
      spacing: 0.3,          // Spacing between stamps (as fraction of brush size)
      rotation: 0,           // Fixed rotation in degrees
      randomRotation: true,  // Randomize rotation per stamp
      scaleVariation: 0.2,   // Random scale variation
      colorize: true,        // Apply color tinting
      blendMode: 'lighter'   // Canvas composite operation
    };

    // Brush images
    this.brushImages = [];
    this.currentBrushIndex = 0;

    // Distance tracking for spacing
    this.lastStampPos = null;
    this.accumulatedDistance = 0;
  }

  /**
   * Initialize with default procedural brushes
   */
  init(width, height) {
    super.init(width, height);

    // Create default procedural brush images
    this.createDefaultBrushes();
  }

  /**
   * Create procedural brush images
   */
  createDefaultBrushes() {
    // Soft circle brush
    this.brushImages.push(this.createSoftCircle(64));

    // Splatter brush
    this.brushImages.push(this.createSplatter(64));

    // Star brush
    this.brushImages.push(this.createStar(64));

    // Spray brush
    this.brushImages.push(this.createSpray(64));
  }

  /**
   * Create a soft circular brush
   */
  createSoftCircle(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    return { canvas, name: 'Soft Circle' };
  }

  /**
   * Create a splatter brush
   */
  createSplatter(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#fff';

    // Main blob
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Random smaller blobs
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * size * 0.4;
      const x = size / 2 + Math.cos(angle) * dist;
      const y = size / 2 + Math.sin(angle) * dist;
      const r = Math.random() * size * 0.1 + 2;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    return { canvas, name: 'Splatter' };
  }

  /**
   * Create a star brush
   */
  createStar(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const cx = size / 2;
    const cy = size / 2;
    const outerRadius = size * 0.45;
    const innerRadius = size * 0.2;
    const points = 5;

    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI / points) - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();

    return { canvas, name: 'Star' };
  }

  /**
   * Create a spray brush
   */
  createSpray(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#fff';

    // Random dots with density gradient
    for (let i = 0; i < 100; i++) {
      const angle = Math.random() * Math.PI * 2;
      const maxDist = Math.random() * size * 0.45;
      const dist = Math.pow(Math.random(), 0.5) * maxDist; // More dots near center
      const x = size / 2 + Math.cos(angle) * dist;
      const y = size / 2 + Math.sin(angle) * dist;

      ctx.globalAlpha = 0.3 + Math.random() * 0.7;
      ctx.beginPath();
      ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    return { canvas, name: 'Spray' };
  }

  /**
   * Load a custom brush image from URL
   */
  async loadBrush(url, name) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        this.brushImages.push({ canvas, name: name || url });
        resolve();
      };

      img.onerror = reject;
      img.src = url;
    });
  }

  /**
   * Select brush by index
   */
  selectBrush(index) {
    if (index >= 0 && index < this.brushImages.length) {
      this.currentBrushIndex = index;
    }
  }

  /**
   * Get list of available brushes
   */
  getBrushList() {
    return this.brushImages.map((b, i) => ({ index: i, name: b.name }));
  }

  /**
   * Continue stroke with stamp spacing
   */
  continueStroke(x, y) {
    if (!this.currentStroke) return;

    const points = this.currentStroke.points;
    const lastPoint = points[points.length - 1];

    // Calculate distance from last point
    const dx = x - lastPoint.x;
    const dy = y - lastPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Add to accumulated distance
    this.accumulatedDistance += dist;

    // Calculate spacing threshold
    const spacing = this.params.brushWidth * this.params.spacing;

    // Stamp at intervals
    while (this.accumulatedDistance >= spacing) {
      // Interpolate position
      const t = spacing / dist;
      const stampX = lastPoint.x + dx * t;
      const stampY = lastPoint.y + dy * t;

      // Add point and stamp
      this.currentStroke.points.push({
        x: stampX,
        y: stampY,
        time: Date.now()
      });

      this.stampAt(stampX, stampY);

      this.accumulatedDistance -= spacing;
    }

    // Always add final point
    if (dist > 0) {
      this.currentStroke.points.push({ x, y, time: Date.now() });
    }
  }

  /**
   * Start a new stroke
   */
  startNewStroke(x, y) {
    super.startNewStroke(x, y);
    this.accumulatedDistance = 0;
    this.lastStampPos = { x, y };

    // Stamp at starting point
    this.stampAt(x, y);
  }

  /**
   * Stamp the brush at a position
   */
  stampAt(x, y) {
    const brush = this.brushImages[this.currentBrushIndex];
    if (!brush) return;

    const ctx = this.ctx;
    const size = this.params.brushWidth;

    // Calculate scale with variation
    const scaleVar = this.params.scaleVariation;
    const scale = 1 + (Math.random() - 0.5) * scaleVar * 2;
    const scaledSize = Math.max(4, size * scale);
    const scaledHalf = scaledSize / 2;

    // Calculate rotation
    let rotation = this.params.rotation * Math.PI / 180;
    if (this.params.randomRotation) {
      rotation = Math.random() * Math.PI * 2;
    }

    // Create a temporary canvas for colorized stamp
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = Math.ceil(scaledSize);
    tempCanvas.height = Math.ceil(scaledSize);
    const tempCtx = tempCanvas.getContext('2d');

    // Draw brush onto temp canvas
    tempCtx.drawImage(brush.canvas, 0, 0, scaledSize, scaledSize);

    // Apply color tinting if enabled
    if (this.params.colorize) {
      tempCtx.globalCompositeOperation = 'source-in';
      tempCtx.fillStyle = `rgb(${this.params.color.r}, ${this.params.color.g}, ${this.params.color.b})`;
      tempCtx.fillRect(0, 0, scaledSize, scaledSize);
    }

    // Now draw the colorized stamp onto main canvas
    ctx.save();
    ctx.globalCompositeOperation = this.params.blendMode;
    ctx.globalAlpha = this.params.opacity;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.drawImage(tempCanvas, -scaledHalf, -scaledHalf);
    ctx.restore();
  }

  /**
   * Redraw all strokes
   */
  redraw() {
    // Clear canvas (transparent for compositing)
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Re-stamp all points in all strokes
    for (const stroke of this.strokes) {
      // Temporarily set stroke color
      const originalColor = this.params.color;
      this.params.color = stroke.color;

      for (const point of stroke.points) {
        this.stampAt(point.x, point.y);
      }

      this.params.color = originalColor;
    }
  }
}
