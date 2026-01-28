import { describe, it, expect, beforeEach } from 'vitest';
import { DripManager } from './DripManager.js';

describe('DripManager', () => {
  let dripManager;

  beforeEach(() => {
    dripManager = new DripManager();
  });

  describe('spawn', () => {
    it('creates a new drip with default parameters', () => {
      dripManager.spawn({
        x: 100,
        y: 100,
        direction: 0,
        speed: 0.5,
        width: 2,
        color: { r: 255, g: 0, b: 0 },
        opacity: 1.0,
        canvasWidth: 800,
        canvasHeight: 600,
        strokeIndex: 1
      });

      expect(dripManager.hasActiveDrips()).toBe(true);
    });

    it('sets correct direction vector for south (0)', () => {
      dripManager.spawn({
        x: 100,
        y: 100,
        direction: 0, // south
        speed: 1,
        width: 2,
        color: { r: 255, g: 0, b: 0 },
        opacity: 1.0,
        canvasWidth: 800,
        canvasHeight: 600,
        strokeIndex: 1
      });

      const drip = dripManager.drips[0];
      expect(drip.vx).toBe(0);
      expect(drip.vy).toBeGreaterThan(0);
    });

    it('sets correct direction vector for north (2)', () => {
      dripManager.spawn({
        x: 100,
        y: 100,
        direction: 2, // north
        speed: 1,
        width: 2,
        color: { r: 255, g: 0, b: 0 },
        opacity: 1.0,
        canvasWidth: 800,
        canvasHeight: 600,
        strokeIndex: 1
      });

      const drip = dripManager.drips[0];
      expect(drip.vx).toBe(0);
      expect(drip.vy).toBeLessThan(0);
    });
  });

  describe('update', () => {
    it('moves drips in their direction', () => {
      dripManager.spawn({
        x: 100,
        y: 100,
        direction: 0, // south
        speed: 10,
        width: 2,
        color: { r: 255, g: 0, b: 0 },
        opacity: 1.0,
        canvasWidth: 800,
        canvasHeight: 600,
        strokeIndex: 1
      });

      const initialY = dripManager.drips[0].y;
      dripManager.update();
      expect(dripManager.drips[0].y).toBeGreaterThan(initialY);
    });

    it('records trail points as drips move', () => {
      dripManager.spawn({
        x: 100,
        y: 100,
        direction: 0,
        speed: 10,
        width: 2,
        color: { r: 255, g: 0, b: 0 },
        opacity: 1.0,
        canvasWidth: 800,
        canvasHeight: 600,
        strokeIndex: 1
      });

      dripManager.update();
      expect(dripManager.hasTrails()).toBe(true);
    });

    it('removes drips that go off canvas', () => {
      dripManager.spawn({
        x: 100,
        y: 598, // near bottom
        direction: 0, // south
        speed: 10,
        width: 2,
        color: { r: 255, g: 0, b: 0 },
        opacity: 1.0,
        canvasWidth: 800,
        canvasHeight: 600,
        strokeIndex: 1
      });

      // Update several times to move drip off canvas
      for (let i = 0; i < 10; i++) {
        dripManager.update();
      }

      expect(dripManager.hasActiveDrips()).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all drips and trails', () => {
      dripManager.spawn({
        x: 100,
        y: 100,
        direction: 0,
        speed: 1,
        width: 2,
        color: { r: 255, g: 0, b: 0 },
        opacity: 1.0,
        canvasWidth: 800,
        canvasHeight: 600,
        strokeIndex: 1
      });

      dripManager.update();
      expect(dripManager.hasActiveDrips()).toBe(true);
      expect(dripManager.hasTrails()).toBe(true);

      dripManager.clear();
      expect(dripManager.hasActiveDrips()).toBe(false);
      expect(dripManager.hasTrails()).toBe(false);
    });
  });

  describe('finalize', () => {
    it('adds active drip positions to trails', () => {
      dripManager.spawn({
        x: 100,
        y: 100,
        direction: 0,
        speed: 1,
        width: 2,
        color: { r: 255, g: 0, b: 0 },
        opacity: 1.0,
        canvasWidth: 800,
        canvasHeight: 600,
        strokeIndex: 1
      });

      dripManager.update();
      const trailCountBefore = dripManager.trails.length;

      dripManager.finalize();
      // Finalize should add final trail segments
      expect(dripManager.trails.length).toBeGreaterThanOrEqual(trailCountBefore);
      expect(dripManager.hasTrails()).toBe(true);
    });
  });
});
