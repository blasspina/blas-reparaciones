/* =========================================================================
   BLAS REPARACIONES · Patrón de desbloqueo (cuadrícula 3x3 interactiva)
   ========================================================================= */
'use strict';

const Pattern = (() => {
  const DPR = 3;
  const HIT = 0.13;
  let canvas = null;
  let ctx = null;
  let points = [];
  let drawing = false;
  let cursor = null;
  let onChange = () => {};

  function pos(i) {
    const c = i % 3;
    const r = Math.floor(i / 3);
    return { x: 0.2 + 0.3 * c, y: 0.2 + 0.3 * r };
  }

  function render(context, size, pts, cur) {
    context.save();
    context.clearRect(0, 0, size, size);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);

    if (pts.length) {
      context.strokeStyle = '#111111';
      context.lineWidth = size * 0.032;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      pts.forEach((p, idx) => {
        const q = pos(p);
        if (idx === 0) context.moveTo(q.x * size, q.y * size);
        else context.lineTo(q.x * size, q.y * size);
      });
      if (cur) context.lineTo(cur.x * size, cur.y * size);
      context.stroke();

      for (let k = 1; k < pts.length; k++) {
        const a = pos(pts[k - 1]);
        const b = pos(pts[k]);
        const mx = (a.x + b.x) / 2 * size;
        const my = (a.y + b.y) / 2 * size;
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const s = size * 0.045;
        context.save();
        context.translate(mx, my);
        context.rotate(ang);
        context.fillStyle = '#111111';
        context.beginPath();
        context.moveTo(s, 0);
        context.lineTo(-s * 0.7, -s * 0.8);
        context.lineTo(-s * 0.7, s * 0.8);
        context.closePath();
        context.fill();
        context.restore();
      }
    }

    for (let i = 0; i < 9; i++) {
      const p = pos(i);
      const x = p.x * size;
      const y = p.y * size;
      const order = pts.indexOf(i);
      context.beginPath();
      if (order > -1) {
        context.fillStyle = '#111111';
        context.arc(x, y, size * 0.088, 0, Math.PI * 2);
        context.fill();
        if (order === 0) {
          context.beginPath();
          context.strokeStyle = '#111111';
          context.lineWidth = size * 0.012;
          context.arc(x, y, size * 0.115, 0, Math.PI * 2);
          context.stroke();
        }
        context.fillStyle = '#ffffff';
        context.font = `800 ${Math.round(size * 0.1)}px Poppins, Arial, sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(String(order + 1), x, y + size * 0.004);
      } else {
        context.fillStyle = '#1a1a1a';
        context.arc(x, y, size * 0.058, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.restore();
  }

  function draw() {
    if (!canvas) return;
    render(ctx, canvas.width, points, drawing ? cursor : null);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const size = Math.max(60, Math.round(rect.width * DPR));
    if (canvas.width !== size) {
      canvas.width = size;
      canvas.height = size;
    }
    draw();
  }

  function rel(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  }

  function addPoint(i) {
    if (points.includes(i)) return;
    const last = points[points.length - 1];
    if (last !== undefined) {
      const lc = last % 3, lr = Math.floor(last / 3);
      const nc = i % 3, nr = Math.floor(i / 3);
      if ((lc + nc) % 2 === 0 && (lr + nr) % 2 === 0) {
        const mid = ((lr + nr) / 2) * 3 + (lc + nc) / 2;
        if (!points.includes(mid) && mid !== i) points.push(mid);
      }
    }
    points.push(i);
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* sin vibración */ } }
  }

  function handle(e) {
    const p = rel(e);
    cursor = p;
    for (let i = 0; i < 9; i++) {
      const q = pos(i);
      if (Math.hypot(p.x - q.x, p.y - q.y) < HIT) addPoint(i);
    }
    draw();
  }

  function init(el, changeCb) {
    canvas = el;
    ctx = canvas.getContext('2d');
    onChange = changeCb || onChange;

    canvas.addEventListener('pointerdown', e => {
      const p = rel(e);
      let hit = false;
      for (let i = 0; i < 9; i++) {
        const q = pos(i);
        if (Math.hypot(p.x - q.x, p.y - q.y) < HIT) { hit = true; break; }
      }
      if (!hit) return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* puntero no capturable */ }
      points = [];
      drawing = true;
      handle(e);
    });
    canvas.addEventListener('pointermove', e => { if (drawing) { e.preventDefault(); handle(e); } });
    const end = () => {
      if (!drawing) return;
      drawing = false;
      cursor = null;
      draw();
      onChange(points.slice());
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);

    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
    window.addEventListener('resize', resize);
    resize();
  }

  function set(pts) {
    points = (pts || []).map(Number).filter(n => n >= 0 && n <= 8);
    draw();
  }
  function get() { return points.slice(); }
  function clear() { points = []; draw(); onChange([]); }

  function toDataURL(size = 600, pts = points) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    render(c.getContext('2d'), size, pts, null);
    return c.toDataURL('image/png');
  }

  /** Texto legible: posiciones tipo teclado numérico 1..9 */
  function toText(pts) {
    return (pts || []).map(n => Number(n) + 1).join('-');
  }

  return { init, set, get, clear, toDataURL, toText };
})();
