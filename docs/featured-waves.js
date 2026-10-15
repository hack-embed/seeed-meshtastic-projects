// Both activity banners share the reference waves. Each uses one bounded
// surface and only animates while visible.
for (const card of document.querySelectorAll('.campaign-banner, .featured-activity')) {
  const overlay = card.classList.contains('campaign-banner');
  const canvas = document.createElement('canvas');
  canvas.className = 'featured-waves';
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d', { alpha: overlay });
  // The top banner already has a page-wide motion control in hub-motion.js.
  const button = card.querySelector('.featured-motion');
  if (context) initWaves();
  else if (button) button.hidden = true;

  function initWaves() {
    const colors = ['#ffffff', '#8fc31f', '#00a651'];
    const lines = [];
    // Sample each curve once to set a proportional dash length. Path2D geometry
    // and lengths are reused on every frame; no per-frame DOM or layout reads.
    function curveLength(points) {
      let length = 0, previous = points[0];
      for (let step = 1; step <= 32; step++) {
        const t = step / 32, u = 1 - t;
        const point = [0, 1].map(axis => u ** 3 * points[0][axis] + 3 * u * u * t * points[1][axis] + 3 * u * t * t * points[2][axis] + t ** 3 * points[3][axis]);
        length += Math.hypot(point[0] - previous[0], point[1] - previous[1]);
        previous = point;
      }
      return length;
    }
    for (const direction of [1, -1]) {
      for (let i = 0; i < 36; i += 2) {
        const start = [-(380 - i * 5 * direction), -(189 + i * 6)];
        const middle = [152 - i * 5 * direction, 343 - i * 6];
        const end = [684 - i * 5 * direction, 875 - i * 6];
        const first = [start, start, [-(312 - i * 5 * direction), 216 - i * 6], middle];
        const second = [middle, [616 - i * 5 * direction, 470 - i * 6], end, end];
        const path = new Path2D();
        path.moveTo(...start);
        path.bezierCurveTo(...first[1], ...first[2], ...first[3]);
        path.bezierCurveTo(...second[1], ...second[2], ...second[3]);
        const seed = i * 7 + (direction === 1 ? 0 : 23);
        const length = curveLength(first) + curveLength(second);
        lines.push({ path, length, dash: [length * .3, length], color: colors[i % 3], width: .65 + i * .03, opacity: (.1 + i * .03) * .45, speed: .18 + seed % 10 / 100, pulse: .25 + seed % 20 / 100, phase: seed * 2.4 });
      }
    }
    card.prepend(canvas);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const frameInterval = 1000 / 24;
    let paused = false, visible = false, frame = 0, last = 0, time = 8;
    let width = 0, height = 0, background;

    function draw() {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalAlpha = 1;
      if (overlay) context.clearRect(0, 0, canvas.width, canvas.height);
      else {
        context.fillStyle = background;
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.setTransform(canvas.width / 696, 0, 0, canvas.height / 316, 0, 0);
      for (const line of lines) {
        context.strokeStyle = line.color;
        context.lineWidth = line.width;
        context.globalAlpha = line.opacity * (.65 + .35 * Math.sin(time * line.pulse + line.phase));
        context.setLineDash(line.dash);
        context.lineDashOffset = -(Math.sin(time * line.speed + line.phase) + 1) / 2 * line.length;
        context.stroke(line.path);
      }
    }
    function resize() {
      width = card.clientWidth;
      height = card.clientHeight;
      // Decorative detail does not need a full Retina-sized backing store.
      const ratio = Math.min(devicePixelRatio || 1, 1.5, 1600 / width, 1000 / height);
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      if (!overlay) {
        background = context.createLinearGradient(0, 0, canvas.width, 0);
        background.addColorStop(0, '#031f25');
        background.addColorStop(1, '#053f49');
      }
      draw();
    }
    function animate(now) {
      const elapsed = now - last;
      if (elapsed >= frameInterval) {
        time += Math.min(elapsed - elapsed % frameInterval, 100) / 1000;
        last = now - elapsed % frameInterval;
        draw();
      }
      frame = requestAnimationFrame(animate);
    }
    function sync() {
      cancelAnimationFrame(frame);
      frame = 0;
      const pagePaused = document.body.classList.contains('motion-paused');
      const stopped = paused || reduce.matches || pagePaused;
      card.classList.toggle('featured-paused', stopped || document.hidden || !visible);
      if (button) {
        button.disabled = reduce.matches || pagePaused;
        button.setAttribute('aria-pressed', String(stopped));
        button.textContent = reduce.matches ? 'Reduced motion' : pagePaused ? 'Motion paused' : paused ? 'Resume motion ▷' : 'Pause motion Ⅱ';
        button.title = pagePaused && !reduce.matches ? 'Resume page motion using the control in the top banner.' : '';
      }
      if (!stopped && !document.hidden && visible) {
        last = performance.now();
        frame = requestAnimationFrame(animate);
      }
    }
    button?.addEventListener('click', () => { paused = !paused; sync(); });
    reduce.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(card);
    new ResizeObserver(() => {
      if (card.clientWidth !== width || card.clientHeight !== height) resize();
    }).observe(card);
    resize();
    sync();
  }
}
