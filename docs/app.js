import { CATEGORIES, PRODUCTS, ACTIVITIES, REPO_URL } from './config.js';
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = (value) => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
};
const normalize = (value) => value.toLowerCase().replace(/[\s_\-–]+/g, '');
const link = (url, label, cls = '') => safeUrl(url) ? `<a class="${cls}" href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>` : '';
const fallback = '<div class="fallback-cover"><span aria-hidden="true">⌁</span><span>MADE FOR THE MESH</span></div>';
const dateLabel = (date) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(date));
const params = new URLSearchParams(location.search);
let projects = [], engagement = {}, activeProject = null;
let category = CATEGORIES.includes(params.get('category')) ? params.get('category') : 'all';
let submissionBody = '';
function readStorage(key, initial) {
  try { return JSON.parse(localStorage.getItem(key)) ?? initial; } catch { return initial; }
}
const savedLikes = readStorage('meshlab-likes', []);
const likes = new Set(Array.isArray(savedLikes) ? savedLikes.filter(x => typeof x === 'string') : []);
const savedShares = readStorage('meshlab-shares', {});
const shares = Object.fromEntries(Object.entries(savedShares && typeof savedShares === 'object' ? savedShares : {}).filter(([, n]) => Number.isSafeInteger(n) && n >= 0));
function persist(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { notify('Browser storage is unavailable. This change lasts for this visit only.'); }
}
function stats(p) {
  const e = engagement[p.id] || {};
  return { hearts: (Number.isSafeInteger(e.hearts) ? e.hearts : 0) + Number(likes.has(p.id)), comments: Number.isSafeInteger(e.comments) ? e.comments : 0, issueNumber: Number.isSafeInteger(e.issueNumber) && e.issueNumber > 0 ? e.issueNumber : null };
}
function attachImageFallbacks(root) {
  root.querySelectorAll('img[data-cover]').forEach(img => {
    const replace = () => { const wrapper = document.createElement('div'); wrapper.innerHTML = fallback; img.replaceWith(wrapper.firstElementChild); };
    img.addEventListener('error', replace, { once: true });
    if (img.complete && !img.naturalWidth) replace();
  });
}
function notify(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(notify.timer); notify.timer = setTimeout(() => { $('toast').hidden = true; }, 4000);
}
function setFiltersFromUrl() {
  const current = new URLSearchParams(location.search);
  $('search').value = current.get('q') || '';
  $('device').value = PRODUCTS.includes(current.get('device')) ? current.get('device') : 'all';
  $('sort').value = ['newest', 'oldest', 'likes'].includes(current.get('sort')) ? current.get('sort') : 'newest';
  category = CATEGORIES.includes(current.get('category')) ? current.get('category') : 'all';
}
function syncUrl() {
  const url = new URL(location.href);
  for (const key of ['q', 'category', 'device', 'sort']) url.searchParams.delete(key);
  if ($('search').value.trim()) url.searchParams.set('q', $('search').value.trim());
  if (category !== 'all') url.searchParams.set('category', category);
  if ($('device').value !== 'all') url.searchParams.set('device', $('device').value);
  if ($('sort').value !== 'newest') url.searchParams.set('sort', $('sort').value);
  history.replaceState(null, '', url);
}
function render() {
  const words = $('search').value.trim().split(/\s+/).filter(Boolean).map(normalize);
  const result = projects.filter(p => (category === 'all' || p.categories.includes(category)) && ($('device').value === 'all' || p.products.includes($('device').value)) && words.every(word => normalize([p.title,p.description,p.author,...p.categories,...p.devices,...p.products,...p.tags].join(' ')).includes(word)));
  const sort = $('sort').value;
  result.sort((a,b) => (sort === 'likes' ? stats(b).hearts - stats(a).hearts : 0) || (sort === 'oldest' ? a.addedAt.localeCompare(b.addedAt) : b.addedAt.localeCompare(a.addedAt)));
  $('categories').innerHTML = ['all', ...CATEGORIES].map(name => `<button class="tab" type="button" data-category="${escapeHtml(name)}" aria-pressed="${name === category}">${name === 'all' ? 'All Projects' : escapeHtml(name)}</button>`).join('');
  $('result-count').textContent = `${result.length} project${result.length === 1 ? '' : 's'} to explore`;
  $('empty').hidden = result.length > 0 || !$('load-error').hidden;
  $('project-grid').innerHTML = result.map(p => `<article class="project-card"><div class="card-cover"><button type="button" class="cover-button" data-detail="${p.id}" aria-label="View ${escapeHtml(p.title)}">${safeUrl(p.image) ? `<img data-cover src="${escapeHtml(safeUrl(p.image))}" alt="${escapeHtml(p.title)}" loading="lazy" decoding="async">` : fallback}</button><div class="cover-tags"><span>${escapeHtml(p.categories[0])}</span>${p.products.map(product => `<span>${escapeHtml(product)}</span>`).join('')}</div></div><div class="card-body"><span class="card-category">${escapeHtml(p.tags[0] || 'COMMUNITY BUILD')}</span><h3><button class="card-title" data-detail="${p.id}" type="button">${escapeHtml(p.title)}</button></h3><p class="card-description">${escapeHtml(p.description)}</p><div class="card-meta"><span aria-label="${stats(p).hearts} hearts">${likes.has(p.id) ? '♥' : '♡'} ${stats(p).hearts}</span><time datetime="${p.addedAt}" title="Added to Mesh Lab">${dateLabel(p.addedAt)}</time></div><div class="card-bottom"><span class="author" title="${escapeHtml(p.author)}">by ${escapeHtml(p.author)}</span><button class="view-project" type="button" data-detail="${p.id}">View Project ↗</button></div></div></article>`).join('');
  attachImageFallbacks($('project-grid'));
}
function discussionUrl(p) {
  const issue = stats(p).issueNumber;
  if (issue) return `${REPO_URL}/issues/${issue}`;
  const url = new URL(`${REPO_URL}/issues/new`);
  url.searchParams.set('title', `[Discussion] ${p.title}`);
  url.searchParams.set('body', `<!-- mesh-lab-project: ${p.id} -->\n\nProject: ${p.url}\n\nShare your question or experience below:\n\n`);
  return url.href;
}
function detailHtml(p) {
  const s = stats(p);
  const activity = ACTIVITIES.find(a => a.id === p.activity);
  return `${safeUrl(p.image) ? `<img class="detail-image" data-cover src="${escapeHtml(safeUrl(p.image))}" alt="${escapeHtml(p.title)}">` : fallback}<div class="dialog-body"><p class="eyebrow">${p.categories.map(escapeHtml).join(' / ')}</p><h2 id="detail-title">${escapeHtml(p.title)}</h2><p class="detail-meta">By ${escapeHtml(p.author)} · Added ${dateLabel(p.addedAt)}</p><h3>Project Description</h3><p>${escapeHtml(p.description)}</p><h3>Products Used</h3><div class="tags">${p.devices.map(d => `<span class="tag">${escapeHtml(d)}</span>`).join('')}</div><h3>Setup Instructions</h3>${p.setup.length ? `<ol>${p.setup.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>` : '<p>The maker has not added setup instructions yet. See the resources below.</p>'}<h3>Resources &amp; Links</h3><ul class="detail-resources">${p.resources.map(r => `<li>${link(r.url,r.label)}</li>`).join('')}</ul><h3>Related Activity</h3><p>${activity ? (activity.url ? link(activity.url,activity.title) : `${escapeHtml(activity.title)} · Details coming soon`) : 'Independent community project'}</p><div class="detail-actions"><button type="button" class="button outline" id="detail-like" aria-pressed="${likes.has(p.id)}">${likes.has(p.id) ? '♥ Liked' : '♡ Like'} <span>${s.hearts}</span></button>${link(discussionUrl(p), `Comments · ${s.comments}`, 'button outline')}<button type="button" class="button outline" id="detail-share">Share ↗ <span>${shares[p.id] || 0}</span></button></div><p class="engagement-note">Likes and shares you add here are saved in this browser. Comments open on GitHub and require sign-in. Published GitHub heart and comment counts update periodically.${s.issueNumber ? ` ${link(`${REPO_URL}/issues/${s.issueNumber}`, 'Add a public heart on GitHub')}` : ' No discussion has been linked yet; start one using Comments.'}</p><p class="detail-attribution">Project and images credited to ${escapeHtml(p.author)}. Consult the original resources for design files, licenses, and complete build instructions.</p></div>`;
}
function showDetail(id) {
  const p = projects.find(item => item.id === id); if (!p) return;
  activeProject = id;
  $('detail-content').innerHTML = detailHtml(p); attachImageFallbacks($('detail-content'));
  if (!$('detail').open) $('detail').showModal();
  $('detail').scrollTop = 0;
}
function openProject(id) {
  const url = new URL(location.href); url.searchParams.set('project', id); url.hash = 'projects';
  history.pushState(null, '', url); route(false); showDetail(id);
}
function closeDetailRoute() {
  activeProject = null;
  const url = new URL(location.href); url.searchParams.delete('project'); history.replaceState(null, '', url);
}
function route(scroll = true) {
  const page = ['home','projects','activities','submit','contact'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  document.querySelectorAll('[data-page]').forEach(section => { section.hidden = section.dataset.page !== page; });
  document.querySelectorAll('#main-nav a').forEach(a => { if (a.hash === `#${page}`) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  $('main-nav').classList.remove('is-open'); $('menu-toggle').setAttribute('aria-expanded','false');
  const names = { home:'Your next Mesh project starts here.', projects:'Projects', activities:'Community Activities', submit:'Submit a Project', contact:'Contact Us' };
  document.title = `Mesh Lab · ${names[page]}`;
  const requested = new URLSearchParams(location.search).get('project');
  if (page === 'projects' && requested && projects.some(p => p.id === requested)) showDetail(requested);
  else if ($('detail').open) $('detail').close();
  if (scroll) window.scrollTo({top:0, behavior:'instant'});
}
async function loadProjects() {
  $('load-error').hidden = true; $('result-count').textContent = 'Loading projects…';
  try {
    const response = await fetch('./data/projects.json'); if (!response.ok) throw new Error('Catalog unavailable');
    projects = await response.json(); if (!Array.isArray(projects)) throw new Error('Invalid catalog');
    $('catalog-stats').textContent = `${projects.length} PROJECTS / A WORLD OF POSSIBILITIES`;
    render(); route(false);
    try { const r = await fetch('./data/engagement.json'); if (r.ok) { engagement = (await r.json()).projects || {}; render(); if (activeProject && $('detail').open) showDetail(activeProject); } } catch { /* The catalog works without engagement snapshots. */ }
  } catch {
    $('load-error').hidden = false; $('empty').hidden = true; $('result-count').textContent = 'Projects are unavailable';
  }
}
async function shareProject(p) {
  const url = new URL(location.href); url.search = ''; url.searchParams.set('project',p.id); url.hash = 'projects';
  try {
    if (navigator.share) await navigator.share({title:p.title,url:url.href});
    else { await navigator.clipboard.writeText(url.href); notify('Project link copied.'); }
    shares[p.id] = (shares[p.id] || 0) + 1; persist('meshlab-shares', shares);
    if (activeProject === p.id) $('detail-share').innerHTML = `Share ↗ <span>${shares[p.id]}</span>`;
  } catch (error) {
    if (error.name !== 'AbortError') {
      notify('Copy the project link from your address bar to share it.');
    }
  }
}
$('device').innerHTML += PRODUCTS.map(p => `<option>${escapeHtml(p)}</option>`).join('');
setFiltersFromUrl();
for (const id of ['search','device','sort']) $(id).addEventListener(id === 'search' ? 'input' : 'change', () => { render(); syncUrl(); });
$('categories').addEventListener('click', event => { const button = event.target.closest('[data-category]'); if (button) { category = button.dataset.category; render(); syncUrl(); $('categories').querySelector(`[data-category="${CSS.escape(category)}"]`).focus({preventScroll:true}); } });
$('project-grid').addEventListener('click', event => { const button = event.target.closest('[data-detail]'); if (button) openProject(button.dataset.detail); });
$('detail-content').addEventListener('click', event => {
  if (!activeProject) return;
  const p = projects.find(item => item.id === activeProject);
  if (event.target.closest('#detail-like')) {
    likes.has(p.id) ? likes.delete(p.id) : likes.add(p.id); persist('meshlab-likes',[...likes]); render();
    $('detail-like').setAttribute('aria-pressed',String(likes.has(p.id)));
    $('detail-like').innerHTML = `${likes.has(p.id) ? '♥ Liked' : '♡ Like'} <span>${stats(p).hearts}</span>`;
  }
  if (event.target.closest('#detail-share')) shareProject(p);
});
function dismissDetail() { closeDetailRoute(); $('detail').close(); }
$('detail').querySelector('[data-close]').addEventListener('click', dismissDetail);
$('detail').addEventListener('cancel', event => { event.preventDefault(); dismissDetail(); });
$('detail').addEventListener('close', closeDetailRoute);
$('detail').addEventListener('click', event => { const r = $('detail').getBoundingClientRect(); if (event.target === $('detail') && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dismissDetail(); });
$('reset').addEventListener('click', () => { category = 'all'; $('device').value = 'all'; $('search').value = ''; $('sort').value = 'newest'; render(); syncUrl(); });
$('retry').addEventListener('click',loadProjects);
$('menu-toggle').addEventListener('click', () => { const open = $('main-nav').classList.toggle('is-open'); $('menu-toggle').setAttribute('aria-expanded', String(open)); });
window.addEventListener('hashchange', () => route());
window.addEventListener('popstate', () => { setFiltersFromUrl(); render(); route(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && $('main-nav').classList.contains('is-open')) { $('main-nav').classList.remove('is-open'); $('menu-toggle').setAttribute('aria-expanded','false'); $('menu-toggle').focus(); }
  if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !$('detail').open && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable) { event.preventDefault(); if (location.hash !== '#projects') { location.hash = 'projects'; route(false); } $('search').focus(); }
});
function checkboxes(values, name) { return values.map(v => `<label class="check-option"><input type="checkbox" name="${name}" value="${escapeHtml(v)}"><span>${escapeHtml(v)}</span></label>`).join(''); }
$('hardware-options').innerHTML = checkboxes(PRODUCTS,'hardware');
$('category-options').innerHTML = checkboxes(CATEGORIES,'categories');
$('related-activity').innerHTML += ACTIVITIES.map(a => `<option value="${a.id}">${escapeHtml(a.title)}</option>`).join('');
$('related-activity').addEventListener('change', () => { $('social-field').hidden = $('related-activity').value !== 'l2-pro'; });
$('project-form').addEventListener('input', () => { $('submission-ready').hidden = true; $('form-error').hidden = true; });
function formError(message) { $('form-error').textContent = message; $('form-error').hidden = false; $('form-error').scrollIntoView({block:'center'}); }
function submissionSection(label, text) { return `### ${label}\n\n${text || '_No response_'}\n\n`; }
$('project-form').addEventListener('submit', event => {
  event.preventDefault(); const form = new FormData(event.currentTarget);
  if (!form.getAll('hardware').length || !form.getAll('categories').length) return formError('Select at least one product and one category.');
  if (!safeUrl(form.get('image'))) return formError('Use a public HTTPS link for the cover image.');
  const resources = String(form.get('resources')).split(/\n/).map(s => s.trim()).filter(Boolean);
  const social = form.get('activity') === 'l2-pro' ? String(form.get('social')).split(/\n/).map(s => s.trim()).filter(Boolean) : [];
  if (!resources.length || !resources.every(safeUrl) || !social.every(safeUrl)) return formError('Add one valid HTTPS URL per line in Resources & Links and Social Links.');
  const values = {
    'Project Title':String(form.get('title')).trim(), 'Author / Maker':String(form.get('author')).trim(),
    'Project Description':String(form.get('description')).trim(), 'Project Cover Image':String(form.get('image')).trim(),
    'Hardware':form.getAll('hardware').join(', '), 'Category':form.getAll('categories').join(', '),
    'Setup Instructions':String(form.get('setup')).trim(), 'Resources & Links':resources.join('\n'),
    'Related Activity':ACTIVITIES.find(a => a.id === form.get('activity'))?.title || 'No related activity',
    'Social Links':social.join('\n'), 'Attribution':'- [x] I have credited the original maker and have permission to share this content and its images.',
  };
  if (!values['Project Title'] || !values['Author / Maker'] || values['Project Description'].length < 30) return formError('Add a project title, maker, and a description of at least 30 characters.');
  if (Object.values(values).some(v => /^### /m.test(v))) return formError('Use plain text or headings with two # characters in your submission. Three-# headings are reserved for form fields.');
  submissionBody = Object.entries(values).map(([label,value]) => submissionSection(label,value)).join('');
  const url = new URL(`${REPO_URL}/issues/new`); url.searchParams.set('title',`[Project] ${values['Project Title']}`); url.searchParams.set('body',submissionBody);
  $('github-submit').href = url.href.length < 7500 ? url.href : `${REPO_URL}/issues/new?title=${encodeURIComponent(`[Project] ${values['Project Title']}`)}`;
  $('submission-help').textContent = url.href.length < 7500 ? 'Sign in to GitHub, review the details, then select Create. Your project goes live only after AE approval.' : 'This submission is too long to prefill safely. Copy the submission below, open GitHub, and paste it into the issue body before selecting Create.';
  $('private-email').hidden = !String(form.get('email')).trim();
  if (!$('private-email').hidden) $('private-email').href = `mailto:sensecap@seeed.cc?subject=${encodeURIComponent(`Mesh Lab reward contact: ${values['Project Title']}`)}&body=${encodeURIComponent(`Project: ${values['Project Title']}\nGitHub submission URL: [paste your issue URL here]\nReward contact email: ${form.get('email')}\nRelated activity: ${values['Related Activity']}\n\nPlease use this address for community activity reward follow-up.`)}`;
  $('submission-ready').hidden = false; $('form-error').hidden = true; $('submission-ready').scrollIntoView({block:'center',behavior:'smooth'}); $('github-submit').focus({preventScroll:true});
});
$('copy-submission').addEventListener('click', async () => { try { await navigator.clipboard.writeText(submissionBody); notify('Submission copied. Paste it into your GitHub issue.'); } catch { formError('Clipboard access is unavailable. Please use the GitHub form link in the introduction.'); } });
route(false); render(); loadProjects();
