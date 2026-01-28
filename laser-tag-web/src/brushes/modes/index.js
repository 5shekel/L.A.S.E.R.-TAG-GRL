/**
 * Brush Mode Strategies Index
 *
 * Provides factory function to get strategy by name
 */
import { BrushModeStrategy } from './BrushModeStrategy.js';
import { SmoothModeStrategy } from './SmoothModeStrategy.js';
import { GlowModeStrategy } from './GlowModeStrategy.js';
import { BasicModeStrategy } from './BasicModeStrategy.js';
import {
  DopeModeStrategy,
  ArrowModeStrategy,
  ArrowFatModeStrategy
} from './RibbonModeStrategy.js';

// Registry of all available strategies
const strategies = {
  smooth: new SmoothModeStrategy(),
  glow: new GlowModeStrategy(),
  basic: new BasicModeStrategy(),
  dope: new DopeModeStrategy(),
  arrow: new ArrowModeStrategy(),
  arrowFat: new ArrowFatModeStrategy()
};

/**
 * Get strategy by mode name
 * @param {string} mode - Mode name
 * @returns {BrushModeStrategy}
 */
export function getStrategy(mode) {
  return strategies[mode] || strategies.smooth;
}

/**
 * Get all available mode names
 * @returns {string[]}
 */
export function getAvailableModes() {
  return Object.keys(strategies);
}

export {
  BrushModeStrategy,
  SmoothModeStrategy,
  GlowModeStrategy,
  BasicModeStrategy,
  DopeModeStrategy,
  ArrowModeStrategy,
  ArrowFatModeStrategy
};
