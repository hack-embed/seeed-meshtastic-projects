import { PRODUCTS, CATEGORIES } from './config.js';
// Rule-based extraction that turns a public repository and its README into submission form values.
const HARDWARE = {
  'T1000-E': /t1000[\s-]?e\b/i,
  'Wio Tracker L1 Pro': /\bl1[\s-]?pro\b/i,
  'Wio Tracker L1/E-ink': /\bl1\W{0,3}e[\s-]?ink\b/i,
  'Solar Node P1 series': /solar[\s-]?node|\bp1[\s-]?pro\b/i,
  'Wio Tracker L2 Pro': /\bl2[\s-]?pro\b/i,
  'XIAO nRF52840 Kit': /xiao[\w\s-]{0,20}nrf52840|nrf52840[\w\s-]{0,20}xiao/i,
  'XIAO ESP32S3 Kit': /xiao[\w\s-]{0,20}esp32[\s-]?s3|esp32[\s-]?s3[\w\s-]{0,20}xiao/i,
};
const CATEGORY_RULES = {
  'Firmware': /firmware|platformio|arduino|esp-idf|zephyr|\bflash(?:ing)?\b/gi,
  '3D Prints & Enclosures': /3d[\s-]?print|enclosure|\bstls?\b|\.3mf\b/gi,
  'Hardware': /\bpcb\b|kicad|schematic|gerber|easyeda/gi,
  'APP': /android|\bios\b|flutter|react native|mobile app|desktop app|web app/gi,
  'Integrations': /home assistant|mqtt|node-red|webhook|telegram|discord|grafana|influxdb/gi,
  'Intelligent System': /\bai\b|\bllm\b|machine learning|tinyml|neural network|computer vision/gi,
};
const LANGUAGE_CATEGORY = { C: 'Firmware', 'C++': 'Firmware', Rust: 'Firmware', Kotlin: 'APP', Swift: 'APP', Dart: 'APP' };
const SETUP_HEADING = /install|getting started|set ?up|quick ?start|usage|how to (?:use|build)|build(?:ing)?\b|flash(?:ing)?\b/i;
const BADGE = /shields\.io|badgen|badge|travis-ci|circleci|codecov|codacy|coveralls|sonarcloud|star-history|contrib\.rocks/i;
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
// Three-# lines are reserved for issue form fields, so they never reach the submission body.
const formSafe = s => s.replace(/^#{3,}\s+/gm, '').trim();

export function repoPath(value) {
  try {
    const u = new URL(String(value).trim().replace(/^(?:https?:\/\/)?/i, 'https://'));
    const [owner, name = ''] = u.pathname.split('/').filter(Boolean), repo = name.replace(/\.git$/, '');
    const valid = ['github.com', 'www.github.com'].includes(u.hostname) && !u.username && !u.password && /^[\w.-]+$/.test(owner || '') && /^[\w.-]+$/.test(repo);
    return valid ? `/${owner}/${repo}` : '';
  } catch { return ''; }
}
function plain(line, keepUrls = false) {
  return line.replace(/<!--[\s\S]*?-->/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\((https:[^)\s]+)[^)]*\)/g, keepUrls ? '$1 ($2)' : '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '').replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, e => ENTITIES[e])
    .replace(/^\s*(?:>\s*)+/, '').replace(/\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/gi, '')
    .replace(/^\s*(?:[-*+]\s+|\d+[.)](?:\s+|(?=[A-Za-z])))(?:\[[ x]\]\s+)?/i, '').replace(/^#{1,6}\s+/, '').replace(/\*\*|__|`/g, '')
    .replace(/^\|(.*)\|$/, (_, cells) => cells.split('|').map(c => c.trim()).filter(Boolean).join(' · ')).trim();
}
function blocks(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n'), out = [];
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(?:```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence) { out.push({ type: 'code', text: line.trim() }); continue; }
    const atx = /^(#{1,6})\s+(.*?)[\s#]*$/.exec(line), html = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/i.exec(line);
    const setext = line.trim() && !/^\s*(?:[-*+]|\d+[.)])\s/.test(line) && /^\s*(?:=+|-+)\s*$/.test(lines[i + 1] || '');
    if (atx || html) out.push({ type: 'heading', level: Number(atx ? atx[1].length : html[1]), text: plain(atx ? atx[2] : html[2]) });
    else if (setext) { out.push({ type: 'heading', level: lines[++i].includes('=') ? 1 : 2, text: plain(line) }); }
    else out.push({ type: line.trim() ? 'text' : 'blank', text: line, list: /^\s*(?:[-*+]|\d+[.)])\s/.test(line) });
  }
  return out;
}
function firstParagraph(list) {
  let words = [];
  for (const b of list) {
    if (b.type === 'text' && !b.list && !/^\s*\|/.test(b.text)) { const t = plain(b.text); if (t) words.push(t); continue; }
    if (words.join(' ').length >= 30) break;
    words = [];
  }
  const text = words.join(' ');
  return text.length > 1000 ? text.slice(0, text.lastIndexOf('. ', 1000) + 1 || 1000) : text;
}
function setupSteps(list, title) {
  const start = list.findIndex(b => b.type === 'heading' && b !== title && SETUP_HEADING.test(b.text));
  if (start < 0) return [];
  const steps = [];
  let joinable = false;
  for (const b of list.slice(start + 1)) {
    if (b.type === 'heading' && b.level <= list[start].level) break;
    const text = b.type === 'code' ? b.text : b.type === 'blank' || /^\s*\|?\s*:?-{3,}/.test(b.text) ? '' : plain(b.text, true);
    if (!text) { joinable = false; continue; }
    if (joinable && b.type === 'text' && !b.list) steps[steps.length - 1] += ' ' + text;
    else steps.push(text);
    joinable = b.type === 'text' && !b.list;
  }
  const kept = [];
  for (const step of steps.map(formSafe).filter(Boolean).slice(0, 40)) { if ([...kept, step].join('\n').length > 6000) break; kept.push(step); }
  return kept;
}
function coverImage(markdown, path, branch) {
  const text = markdown.replace(/```[\s\S]*?```/g, '');
  for (const [, md, html] of text.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)|<img[^>]+src=["']([^"']+)/gi)) {
    const src = (md || html).trim();
    if (BADGE.test(src) || /^data:/i.test(src)) continue;
    try {
      const u = new URL(/^[a-z]+:/i.test(src) ? src : src.replace(/^\.?\//, ''), `https://raw.githubusercontent.com${path}/${branch}/`);
      if (u.hostname === 'github.com' && u.pathname.includes('/blob/')) return `https://raw.githubusercontent.com${u.pathname.replace('/blob/', '/')}`;
      if (u.protocol === 'https:' && !u.username && !u.password) return u.href;
    } catch { /* Skip malformed image references. */ }
  }
  return '';
}
function categories(repo, readme) {
  const meta = [repo.name, repo.description, ...(repo.topics || [])].join(' ');
  const scores = Object.entries(CATEGORY_RULES).map(([name, rule]) => [name, (meta.match(rule) || []).length * 3 + (readme.match(rule) || []).length]);
  if (LANGUAGE_CATEGORY[repo.language]) scores.find(([name]) => name === LANGUAGE_CATEGORY[repo.language])[1] += 2;
  const ranked = scores.filter(([name, score]) => score >= 2 && CATEGORIES.includes(name)).sort((a, b) => b[1] - a[1]);
  // A second category must be nearly as strong as the first, so passing mentions do not add noise.
  return ranked.filter(([, score], i) => i === 0 || (i === 1 && score * 2 >= ranked[0][1])).map(([name]) => name);
}

export function extractProject(repo, readme, path) {
  const list = blocks(readme), heading = list.find(b => b.type === 'heading' && b.level === 1 && b.text);
  const summary = plain(String(repo.description || '')), paragraph = firstParagraph(list);
  const readmeImage = coverImage(readme, path, repo.default_branch || 'HEAD');
  const haystack = [repo.name, repo.description, ...(repo.topics || []), readme].join(' ');
  const resources = [repo.html_url || `https://github.com${path}`];
  if (/^https:\/\//.test(repo.homepage || '') && !resources.includes(repo.homepage)) resources.push(repo.homepage);
  return {
    title: formSafe(heading && heading.text.length <= 120 ? heading.text : String(repo.name || '')).slice(0, 120),
    author: String(repo.owner?.login || '').slice(0, 100),
    description: formSafe(summary.length >= 30 || !paragraph ? summary : paragraph).slice(0, 3000),
    image: readmeImage || `https://opengraph.githubassets.com/1${path}`,
    imageFromReadme: Boolean(readmeImage),
    hardware: PRODUCTS.filter(p => HARDWARE[p]?.test(haystack)),
    categories: categories(repo, readme),
    setup: setupSteps(list, heading),
    resources,
    license: repo.license?.spdx_id && repo.license.spdx_id !== 'NOASSERTION' ? repo.license.spdx_id : 'No recognized license',
  };
}
