import { describe, expect, it } from 'vitest';
import { jumpTimeline } from '@sulo/ui/mascot/jump';

const ys = (frames: Keyframe[]) => frames.map((k) => Number(/translateY\((-?[\d.]+)px\)/.exec(String(k.transform))![1]));

describe('jumpTimeline', () => {
  it('starts and ends at rest, with offsets increasing from 0 to 1', () => {
    const { keyframes, duration } = jumpTimeline([80]);
    expect(keyframes[0]!.offset).toBe(0);
    expect(keyframes.at(-1)!.offset).toBe(1);
    expect(keyframes.at(-1)!.transform).toBe('translateY(0.0px) scale(1, 1)');
    const offsets = keyframes.map((k) => k.offset as number);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
    expect(duration).toBeGreaterThan(800);
  });

  it('squashes before take-off and on landing', () => {
    const [, anticipation] = jumpTimeline([80]).keyframes;
    expect(anticipation!.transform).toContain('scale(1.08, 0.9)');
    expect(jumpTimeline([80]).keyframes.some((k) => String(k.transform).includes('scale(1.1, 0.88)'))).toBe(true);
  });

  it('eases out on the way up and in on the way down', () => {
    const { keyframes } = jumpTimeline([80]);
    const apex = ys(keyframes).indexOf(-80);
    expect(keyframes[apex - 1]!.easing).toMatch(/^cubic-bezier\(0\.22/);
    expect(keyframes[apex]!.easing).toMatch(/^cubic-bezier\(0\.55/);
  });

  it('plays a lower second jump with a single anticipation', () => {
    const { keyframes } = jumpTimeline([80, 44]);
    const peaks = ys(keyframes).filter((y) => y === -80 || y === -44);
    expect(peaks).toEqual([-80, -44]);
    expect(keyframes.filter((k) => String(k.transform).includes('scale(1.08, 0.9)'))).toHaveLength(1);
  });

  it('shrinks and fades the shadow at the apex', () => {
    const { keyframes, shadow } = jumpTimeline([80]);
    const apex = ys(keyframes).indexOf(-80);
    expect(shadow[apex]!.transform).toBe('scale(0.550)');
    expect(Number(shadow[apex]!.opacity)).toBeCloseTo(0.55);
    expect(shadow.at(-1)!.transform).toBe('scale(1.000)');
  });
});
