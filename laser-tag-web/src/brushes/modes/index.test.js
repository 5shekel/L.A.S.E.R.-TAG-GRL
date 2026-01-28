import { describe, it, expect } from 'vitest';
import {
  getStrategy,
  getAvailableModes,
  SmoothModeStrategy,
  GlowModeStrategy,
  BasicModeStrategy,
  DopeModeStrategy,
  ArrowModeStrategy,
  ArrowFatModeStrategy
} from './index.js';

describe('Brush Mode Strategies', () => {
  describe('getAvailableModes', () => {
    it('returns all available mode names', () => {
      const modes = getAvailableModes();

      expect(modes).toContain('smooth');
      expect(modes).toContain('glow');
      expect(modes).toContain('basic');
      expect(modes).toContain('dope');
      expect(modes).toContain('arrow');
      expect(modes).toContain('arrowFat');
      expect(modes).toHaveLength(6);
    });
  });

  describe('getStrategy', () => {
    it('returns correct strategy for each mode', () => {
      expect(getStrategy('smooth')).toBeInstanceOf(SmoothModeStrategy);
      expect(getStrategy('glow')).toBeInstanceOf(GlowModeStrategy);
      expect(getStrategy('basic')).toBeInstanceOf(BasicModeStrategy);
      expect(getStrategy('dope')).toBeInstanceOf(DopeModeStrategy);
      expect(getStrategy('arrow')).toBeInstanceOf(ArrowModeStrategy);
      expect(getStrategy('arrowFat')).toBeInstanceOf(ArrowFatModeStrategy);
    });

    it('returns smooth strategy for unknown mode', () => {
      expect(getStrategy('unknown')).toBeInstanceOf(SmoothModeStrategy);
      expect(getStrategy('')).toBeInstanceOf(SmoothModeStrategy);
      expect(getStrategy(null)).toBeInstanceOf(SmoothModeStrategy);
    });
  });

  describe('SmoothModeStrategy', () => {
    const strategy = new SmoothModeStrategy();

    it('does not require full redraw', () => {
      expect(strategy.requiresFullRedraw()).toBe(false);
    });

    it('supports drips', () => {
      expect(strategy.supportsDrips()).toBe(true);
    });
  });

  describe('GlowModeStrategy', () => {
    const strategy = new GlowModeStrategy();

    it('does not require full redraw', () => {
      expect(strategy.requiresFullRedraw()).toBe(false);
    });

    it('does not support drips', () => {
      expect(strategy.supportsDrips()).toBe(false);
    });
  });

  describe('BasicModeStrategy', () => {
    const strategy = new BasicModeStrategy();

    it('requires full redraw for shadow layering', () => {
      expect(strategy.requiresFullRedraw()).toBe(true);
    });

    it('supports drips', () => {
      expect(strategy.supportsDrips()).toBe(true);
    });
  });

  describe('DopeModeStrategy', () => {
    const strategy = new DopeModeStrategy();

    it('requires full redraw for shadow layering', () => {
      expect(strategy.requiresFullRedraw()).toBe(true);
    });

    it('supports drips', () => {
      expect(strategy.supportsDrips()).toBe(true);
    });
  });

  describe('ArrowModeStrategy', () => {
    const strategy = new ArrowModeStrategy();

    it('requires full redraw for shadow layering', () => {
      expect(strategy.requiresFullRedraw()).toBe(true);
    });

    it('supports drips', () => {
      expect(strategy.supportsDrips()).toBe(true);
    });
  });

  describe('ArrowFatModeStrategy', () => {
    const strategy = new ArrowFatModeStrategy();

    it('requires full redraw for shadow layering', () => {
      expect(strategy.requiresFullRedraw()).toBe(true);
    });

    it('supports drips', () => {
      expect(strategy.supportsDrips()).toBe(true);
    });
  });
});
