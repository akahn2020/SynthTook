// Shared slider helpers used by both controls.js (synth ADSR/filter sliders)
// and mixer.js (channel faders). Curves: 'exp' for log-perceptual params like
// time and frequency, 'lin' for linear params like sustain and pan.

export function mapValue(t, min, max, curve) {
  if (curve === 'exp') return min * Math.pow(max / min, t);
  return min + t * (max - min);
}

export function unmapValue(v, min, max, curve) {
  if (curve === 'exp') return Math.log(v / min) / Math.log(max / min);
  return (v - min) / (max - min);
}

export function fmt(v, kind) {
  switch (kind) {
    case 'time':    return v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`;
    case 'hz':      return v < 1000 ? `${Math.round(v)} Hz` : `${(v / 1000).toFixed(1)} kHz`;
    case 'q':       return v.toFixed(1);
    case 'unit':    return v.toFixed(2);
    case 'percent': return `${Math.round(v * 100)}%`;
    default:        return String(v);
  }
}
