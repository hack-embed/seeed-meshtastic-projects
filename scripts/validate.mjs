import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { validateCatalog } from './catalog.mjs';
const projects = validateCatalog(JSON.parse(await readFile(new URL('../docs/data/projects.json',import.meta.url),'utf8')));
for (const file of ['docs/index.html','docs/app.js','docs/config.js','docs/l2.html','docs/l2.js','docs/l2-config.js','docs/project-form.js','docs/partials/project-form.html','docs/data/projects.json','.github/ISSUE_TEMPLATE/project.yml']) {
  const content = await readFile(new URL(`../${file}`,import.meta.url),'utf8');
  assert(!/[\u3400-\u9fff]/.test(content),`Non-English content remains in ${file}`);
}
const engagement = JSON.parse(await readFile(new URL('../docs/data/engagement.json',import.meta.url),'utf8'));
for (const [id, stats] of Object.entries(engagement.projects)) {
  assert(projects.some(p => p.id === id),`Unknown engagement project: ${id}`);
  for (const field of ['hearts','comments']) assert(Number.isSafeInteger(stats[field]) && stats[field] >= 0,`Invalid ${field}`);
  assert(Number.isSafeInteger(stats.issueNumber) && stats.issueNumber > 0,'Invalid discussion issue');
}
console.log(`Validated ${projects.length} English projects, taxonomy, URLs, dates, and engagement data.`);
