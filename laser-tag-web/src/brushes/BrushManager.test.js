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

describe('BrushManager', () => {
  let brushManager;

  beforeEach(() => {
    vi.clearAllMocks();
    brushManager = new BrushManager();
    brushManager.init(800, 600);
  });

  describe('init', () => {
    it('creates brush on initialization', () => {
      expect(brushManager.brushes.length).toBe(1);
    });

    it('initializes brush with canvas dimensions', () => {
      const brush = brushManager.brushes[0];
      expect(brush.init).toHaveBeenCalledWith(800, 600);
    });
  });

  describe('getActiveBrush', () => {
    it('returns the brush', () => {
      const brush = brushManager.getActiveBrush();
      expect(brush.name).toBe('Vector');
    });
  });

  describe('setActiveBrush', () => {
    it('keeps brush index at 0 for valid index', () => {
      brushManager.setActiveBrush(0);
      expect(brushManager.activeBrushIndex).toBe(0);
    });

    it('ignores invalid indices', () => {
      brushManager.setActiveBrush(99);
      expect(brushManager.activeBrushIndex).toBe(0);

      brushManager.setActiveBrush(-1);
      expect(brushManager.activeBrushIndex).toBe(0);
    });

    it('notifies state change when mode set', () => {
      const callback = vi.fn();
      brushManager.onStateChange = callback;

      brushManager.setActiveBrush(0);
      expect(callback).toHaveBeenCalledWith('mode', 'smooth');
    });
  });

  describe('getBrushList', () => {
    it('returns list of brushes with metadata', () => {
      const list = brushManager.getBrushList();

      expect(list).toHaveLength(1);
      expect(list[0]).toEqual({ index: 0, name: 'Vector', active: true });
    });
  });

  describe('setColor', () => {
    it('parses hex color and sets on brush', () => {
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
    it('sets width on brush', () => {
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
    it('clears brush', () => {
      brushManager.clearAll();

      for (const brush of brushManager.brushes) {
        expect(brush.clear).toHaveBeenCalled();
      }
    });
  });

  describe('undo', () => {
    it('undoes on active brush', () => {
      brushManager.undo();

      expect(brushManager.brushes[0].undo).toHaveBeenCalled();
    });
  });

  describe('render', () => {
    it('renders brush', () => {
      brushManager.render();

      for (const brush of brushManager.brushes) {
        expect(brush.render).toHaveBeenCalled();
      }
    });
  });

  describe('dispose', () => {
    it('disposes brush and clears array', () => {
      brushManager.dispose();

      expect(brushManager.brushes).toHaveLength(0);
    });
  });
});
