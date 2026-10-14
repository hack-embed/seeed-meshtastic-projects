// Scoped adaptation of the community waves on seeedstudio.com/meshtastic-products.
// CSS handles the slow travel and pulse; hidden cards and reduced motion pause it.
const card = document.getElementById('featured-activity');
if (card) {
  const ns = 'http://www.w3.org/2000/svg';
  const waves = document.createElementNS(ns, 'svg');
  waves.setAttribute('class', 'featured-waves');
  waves.setAttribute('viewBox', '0 0 696 316');
  waves.setAttribute('preserveAspectRatio', 'none');
  waves.setAttribute('aria-hidden', 'true');
  waves.setAttribute('focusable', 'false');
  const colors = ['rgba(255,255,255,.85)', 'rgba(143,195,31,.85)', 'rgba(0,166,81,.85)'];
  for (const direction of [1, -1]) {
    for (let i = 0; i < 36; i++) {
      const path = document.createElementNS(ns, 'path');
      const x = -(380 - i * 5 * direction), y = -(189 + i * 6);
      const endX = 684 - i * 5 * direction, endY = 875 - i * 6;
      path.setAttribute('d', `M${x} ${y} C${x} ${y} ${-(312 - i * 5 * direction)} ${216 - i * 6} ${152 - i * 5 * direction} ${343 - i * 6} C${616 - i * 5 * direction} ${470 - i * 6} ${endX} ${endY} ${endX} ${endY}`);
      path.setAttribute('stroke', colors[i % colors.length]);
      path.setAttribute('stroke-width', String(.5 + i * .03));
      path.setAttribute('pathLength', '100');
      path.setAttribute('stroke-dasharray', '30 100');
      const opacity = (.1 + i * .03) * .45;
      path.setAttribute('opacity', String(opacity * .65));
      path.style.setProperty('--wave-opacity', String(opacity));
      // Deterministic phases keep reloads stable while staggering the parallel lines.
      const seed = i * 7 + (direction === 1 ? 0 : 23);
      path.style.setProperty('--travel', `${11.2 + seed % 64 / 10}s`);
      path.style.setProperty('--travel-delay', `${-(seed % 37)}s`);
      path.style.setProperty('--pulse', `${14 + seed % 112 / 10}s`);
      path.style.setProperty('--pulse-delay', `${-(seed % 29)}s`);
      waves.append(path);
    }
  }
  card.prepend(waves);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const button = document.getElementById('featured-motion');
  let paused = false, visible = true;
  function sync() {
    const pagePaused = document.body.classList.contains('motion-paused');
    const stopped = paused || reduce.matches || pagePaused;
    card.classList.toggle('featured-paused', stopped || document.hidden || !visible);
    button.disabled = reduce.matches || pagePaused;
    button.setAttribute('aria-pressed', String(stopped));
    button.textContent = reduce.matches ? 'Reduced motion' : pagePaused ? 'Motion paused' : paused ? 'Resume motion ▷' : 'Pause motion Ⅱ';
    button.title = pagePaused && !reduce.matches ? 'Resume page motion using the control in the top banner.' : '';
  }
  button.addEventListener('click', () => { paused = !paused; sync(); });
  reduce.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(card);
  sync();
}
