import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrushManager } from './BrushManager.js';

// Mock the brush classes since they depend on canvas
vi.mock('./VectorBrush.js', () => ({
  VectorBrush: vi.fn().mockImplementation(() => ({
    name: 'Vector',
    params: { brushWidth: 15 },
    init: vi.fn(),
    setColor: vi.fn(),
    setBrushWidth: vi.fn(),
    addPoint: vi.fn(),
    endStroke: vi.fn(),
    render: vi.fn(),
    draw: vi.fn(),
    clear: vi.fn(),
    undo: vi.fn(),
    dispose: vi.fn(),
    isDrawing: false
  }))
}));

vi.mock('./PngBrush.js', () => ({
  PngBrush: vi.fn().mockImplementation(() => ({
    name: 'PNG Stamp',
    params: { brushWidth: 15 },
    init: vi.fn(),
    setColor: vi.fn(),
    setBrushWidth: vi.fn(),
    addPoint: vi.fn(),
    endStroke: vi.fn(),
    render: vi.fn(),
    draw: vi.fn(),
    clear: vi.fn(),
    undo: vi.fn(),
    dispose: vi.fn(),
    isDrawing: false
  }))
}));

describe('BrushManager', () => {
  let brushManager;

  beforeEach(() => {
    vi.clearAllMocks();
    brushManager = new BrushManager();
    brushManager.init(800, 600);
  });

  describe('init', () => {
    it('creates brushes on initialization', () => {
      expect(brushManager.brushes.length).toBe(2);
    });

    it('initializes brushes with canvas dimensions', () => {
      const brush = brushManager.brushes[0];
      expect(brush.init).toHaveBeenCalledWith(800, 600);
    });
  });

  describe('getActiveBrush', () => {
    it('returns the first brush by default', () => {
      const brush = brushManager.getActiveBrush();
      expect(brush.name).toBe('Vector');
    });
  });

  describe('setActiveBrush', () => {
    it('changes the active brush index', () => {
      brushManager.setActiveBrush(1);
      expect(brushManager.activeBrushIndex).toBe(1);
    });

    it('ignores invalid indices', () => {
      brushManager.setActiveBrush(99);
      expect(brushManager.activeBrushIndex).toBe(0);

      brushManager.setActiveBrush(-1);
      expect(brushManager.activeBrushIndex).toBe(0);
    });

    it('notifies state change when brush changes', () => {
      const callback = vi.fn();
      brushManager.onStateChange = callback;

      brushManager.setActiveBrush(1);
      expect(callback).toHaveBeenCalledWith('brush', 'PNG Stamp');
    });
  });

  describe('getBrushList', () => {
    it('returns list of brushes with metadata', () => {
      const list = brushManager.getBrushList();

      expect(list).toHaveLength(2);
      expect(list[0]).toEqual({ index: 0, name: 'Vector', active: true });
      expect(list[1]).toEqual({ index: 1, name: 'PNG Stamp', active: false });
    });

    it('reflects active brush state', () => {
      brushManager.setActiveBrush(1);
      const list = brushManager.getBrushList();

      expect(list[0].active).toBe(false);
      expect(list[1].active).toBe(true);
    });
  });

  describe('setColor', () => {
    it('parses hex color and sets on all brushes', () => {
      brushManager.setColor('#FF0000');

      for (const brush of brushManager.brushes) {
        expect(brush.setColor).toHaveBeenCalledWith(255, 0, 0);
      }
    });

    it('handles lowercase hex colors', () => {
      brushManager.setColor('#00ff00');

      for (const brush of brushManager.brushes) {
        expect(brush.setColor).toHaveBeenCalledWith(0, 255, 0);
      }
    });
  });

  describe('setWidth', () => {
    it('sets width on all brushes', () => {
      brushManager.setWidth(20);

      for (const brush of brushManager.brushes) {
        expect(brush.setBrushWidth).toHaveBeenCalledWith(20);
      }
    });
  });

  describe('addPoint', () => {
    it('adds point to active brush', () => {
      brushManager.addPoint(0.5, 0.5, true);

      const activeBrush = brushManager.getActiveBrush();
      expect(activeBrush.addPoint).toHaveBeenCalledWith(0.5, 0.5, true);
    });
  });

  describe('clearAll', () => {
    it('clears all brushes', () => {
      brushManager.clearAll();

      for (const brush of brushManager.brushes) {
        expect(brush.clear).toHaveBeenCalled();
      }
    });
  });

  describe('undo', () => {
    it('undoes on active brush only', () => {
      brushManager.undo();

      expect(brushManager.brushes[0].undo).toHaveBeenCalled();
      expect(brushManager.brushes[1].undo).not.toHaveBeenCalled();
    });
  });

  describe('render', () => {
    it('renders all brushes', () => {
      brushManager.render();

      for (const brush of brushManager.brushes) {
        expect(brush.render).toHaveBeenCalled();
      }
    });
  });

  describe('dispose', () => {
    it('disposes all brushes and clears array', () => {
      brushManager.dispose();

      expect(brushManager.brushes).toHaveLength(0);
    });
  });
});
