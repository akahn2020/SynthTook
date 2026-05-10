// Spectrum analyzer rendered to a canvas. Synthwave gradient bars (magenta
// at the bottom rising to cyan), with a subtle horizon/grid baseline.

const FFT_SIZE = 512;     // 256 frequency bins
const SMOOTHING = 0.75;
const VISIBLE_BINS = 96;  // skip the highest bins (mostly noise floor)

export function initVisualizer(audioCtx, sourceNode, canvas) {
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = SMOOTHING;
  sourceNode.connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let cssW = 0, cssH = 0;

  const resize = () => {
    dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    cssW = rect.width;
    cssH = rect.height;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const HORIZON_Y_FRAC = 0.92;

  function drawBackground(w, h) {
    ctx.fillStyle = '#050308';
    ctx.fillRect(0, 0, w, h);
    // Horizon line
    ctx.strokeStyle = 'rgba(0,255,255,0.25)';
    ctx.lineWidth = 1;
    const y = h * HORIZON_Y_FRAC;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    // Receding grid lines for depth
    ctx.strokeStyle = 'rgba(0,255,255,0.08)';
    for (let i = 1; i <= 3; i++) {
      const yy = y + (h - y) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(w, yy);
      ctx.stroke();
    }
  }

  function frame() {
    requestAnimationFrame(frame);
    analyser.getByteFrequencyData(data);

    const w = cssW;
    const h = cssH;
    drawBackground(w, h);

    const usable = Math.min(VISIBLE_BINS, data.length);
    const barWidth = w / usable;
    for (let i = 0; i < usable; i++) {
      const v = data[i] / 255;
      if (v < 0.01) continue;
      const barHeight = v * h * HORIZON_Y_FRAC;
      const x = i * barWidth;
      const y0 = h * HORIZON_Y_FRAC - barHeight;

      const grad = ctx.createLinearGradient(0, h * HORIZON_Y_FRAC, 0, y0);
      grad.addColorStop(0, '#ff00d4');
      grad.addColorStop(1, '#00ffff');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y0, Math.max(1, barWidth - 1), barHeight);
    }
  }

  frame();
}
