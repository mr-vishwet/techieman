// TechieMan — per-node enemy designs (the villain rule, user correction 2026-11-26).
// The enemy IS the language/concept itself: a living stick-creature built
// from the concept's own symbols. Chapter bosses live in roadmap.ts.
// Each chapter file exports ENEMIES_CHn; this file aggregates them.

import type { NodeEnemy } from './questions';
import { ENEMIES_CH2 } from './questions-ch2';
import { ENEMIES_CH3 } from './questions-ch3';
import { ENEMIES_CH4 } from './questions-ch4';
import { ENEMIES_CH5 } from './questions-ch5';
import { ENEMIES_CH6 } from './questions-ch6';
import { ENEMIES_CH7 } from './questions-ch7';
import { ENEMIES_CH8 } from './questions-ch8';

/** Chapter 1 enemies (M6 — the "?" Goblin is deleted). */
export const ENEMIES_CH1: NodeEnemy[] = [
  {
    nodeId: '1.1-js-basics',
    enemyName: 'The Loose Equality',
    symbols: ['==', '!=', '0 == false'],
    accent: '#f59e0b', // JS amber
  },
  {
    nodeId: '1.2-css-basics',
    enemyName: 'The Collapsing Box',
    symbols: ['{}', 'px', '%'],
    accent: '#38bdf8',
  },
  {
    nodeId: '1.3-jsx',
    enemyName: 'The Unclosed Tag',
    symbols: ['<', '/>', '{ }'],
    accent: '#a78bfa',
  },
  {
    nodeId: '1.4-components-state-props',
    enemyName: 'The Stale State',
    symbols: ['useState', '() =>', '↻'],
    accent: '#fb7185',
  },
];

export const ALL_ENEMIES: NodeEnemy[] = [
  ...ENEMIES_CH1,
  ...ENEMIES_CH2,
  ...ENEMIES_CH3,
  ...ENEMIES_CH4,
  ...ENEMIES_CH5,
  ...ENEMIES_CH6,
  ...ENEMIES_CH7,
  ...ENEMIES_CH8,
];

export function enemyForNode(nodeId: string): NodeEnemy | undefined {
  return ALL_ENEMIES.find(e => e.nodeId === nodeId);
}
