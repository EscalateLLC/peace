import { describe, expect, it } from 'vitest';
import { createLinearResampler, upmixMonoToStereo } from './discord-adapter';

describe('upmixMonoToStereo', () => {
  it('duplicates each 16-bit sample into both channels', () => {
    const mono = Buffer.alloc(4);

    mono.writeInt16LE(1000, 0);
    mono.writeInt16LE(-2000, 2);

    const stereo = upmixMonoToStereo(mono);

    expect(stereo.length).toBe(8); // 2 samples → 4 stereo samples
    expect(stereo.readInt16LE(0)).toBe(1000); // L0
    expect(stereo.readInt16LE(2)).toBe(1000); // R0
    expect(stereo.readInt16LE(4)).toBe(-2000); // L1
    expect(stereo.readInt16LE(6)).toBe(-2000); // R1
  });

  it('handles an empty buffer', () => {
    expect(upmixMonoToStereo(Buffer.alloc(0)).length).toBe(0);
  });
});

describe('createLinearResampler (24k → 48k)', () => {
  it('roughly doubles the sample count', () => {
    const resample = createLinearResampler(24000, 48000);
    const out = resample(Int16Array.from([0, 100, 200, 300, 400]));

    // 5 input samples → ~2× output (first sample is consumed as the seed).
    expect(out.length).toBeGreaterThanOrEqual(7);
    expect(out.length).toBeLessThanOrEqual(9);
  });

  it('linearly interpolates midpoints', () => {
    const resample = createLinearResampler(24000, 48000);
    const out = resample(Int16Array.from([0, 200, 400]));

    // Between 0 and 200 → 0,100; between 200 and 400 → 200,300.
    expect([...out]).toEqual([0, 100, 200, 300]);
  });

  it('preserves continuity across streamed chunks', () => {
    const resample = createLinearResampler(24000, 48000);
    const a = resample(Int16Array.from([0, 200]));
    const b = resample(Int16Array.from([400]));

    // chunk a: 0,100 ; chunk b continues 200,300 from the carried sample.
    expect([...a]).toEqual([0, 100]);
    expect([...b]).toEqual([200, 300]);
  });
});
