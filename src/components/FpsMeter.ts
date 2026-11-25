// TechieMan — FPS meter for the M2 spike (plan §6.3, §7.4).
// Uses Reanimated's useFrameCallback (UI thread) to measure real frame times
// during a fight. Samples every 120 frames (~2s at 60fps) and reports via
// runOnJS — the callback is throttled so it never touches React per-frame.

import { useRef } from 'react';
import { runOnJS, useFrameCallback, type FrameInfo } from 'react-native-reanimated';

export interface FpsSample {
  fps: number;
  avgFrameMs: number;
  p95FrameMs: number;
  frames: number;
  droppedFrames: number; // frames slower than 2x budget (>33.4ms)
}

const SAMPLE_FRAMES = 120;
const FRAME_BUDGET_MS = 1000 / 60;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

export function useFpsMeter(onSample: (s: FpsSample) => void) {
  const deltas = useRef<number[]>([]);
  const lastTs = useRef<number | null>(null);
  const onSampleRef = useRef(onSample);
  onSampleRef.current = onSample;

  useFrameCallback((frameInfo: FrameInfo) => {
    const ts = frameInfo.timestamp;
    if (lastTs.current !== null) {
      deltas.current.push(ts - lastTs.current);
    }
    lastTs.current = ts;
    if (deltas.current.length >= SAMPLE_FRAMES) {
      const sorted = [...deltas.current].sort((a, b) => a - b);
      const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      const sample: FpsSample = {
        fps: Math.round(1000 / avg),
        avgFrameMs: Math.round(avg * 100) / 100,
        p95FrameMs: Math.round(percentile(sorted, 95) * 100) / 100,
        frames: deltas.current.length,
        droppedFrames: sorted.filter(d => d > FRAME_BUDGET_MS * 2).length,
      };
      deltas.current = [];
      runOnJS(onSampleRef.current)(sample);
    }
  }, true);
}

// Headless frame-budget check lives in src/engine/frameBudget.ts (pure TS,
// no Reanimated import — this file cannot load under Jest without the
// Reanimated jest mock, and the tick-cost test must stay headless).
