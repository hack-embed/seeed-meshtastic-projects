import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { parseSubmission, validateCatalog } from './catalog.mjs';
const repo = process.env.GITHUB_REPOSITORY;
assert(repo && /^[\w.-]+\/[\w.-]+$/.test(repo),'Missing repository');
assert(process.env.GH_TOKEN,'Missing GitHub token');
async function api(path) {
  const r = await fetch(`https://api.github.com/repos/${repo}/${path}`, {headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
  if (!r.ok) throw new Error(`GitHub API request failed: ${r.status}`);
  return r.json();
}
const dataFile = new URL('../docs/data/projects.json',import.meta.url);
const projects = JSON.parse(await readFile(dataFile,'utf8'));
const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
if (process.env.GITHUB_EVENT_NAME === 'issues' && event.action === 'labeled' && event.label?.name === 'ae-approved') {
  const actor = event.sender?.login;
  assert(actor && /^[\w-]+$/.test(actor),'Invalid reviewer');
  const permission = await api(`collaborators/${encodeURIComponent(actor)}/permission`);
  assert(['admin','maintain','write'].includes(permission.permission),'Only repository maintainers can approve submissions');
  const reviewers = (process.env.AE_REVIEWERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  assert(!reviewers.length || reviewers.includes(actor.toLowerCase()),'Reviewer is not listed in AE_REVIEWERS');
  const issue = await api(`issues/${event.issue.number}`);
  assert(!issue.pull_request && issue.labels.some(l => l.name === 'ae-approved'),'Approval has been removed');
  const existing = projects.find(p => p.issueNumber === issue.number);
  const project = parseSubmission(issue,existing?.addedAt);
  if (existing) Object.assign(existing,project); else projects.unshift(project);
  validateCatalog(projects);
  await writeFile(dataFile,JSON.stringify(projects,null,2)+'\n');
  console.log(`Published approved project ${project.id}.`);
}
const engagement = {};
// The original submission is the canonical discussion for approved community projects.
for (const p of projects.filter(p => p.issueNumber)) {
  const issue = await api(`issues/${p.issueNumber}`);
  engagement[p.id] = {issueNumber:issue.number,hearts:issue.reactions?.heart || 0,comments:issue.comments || 0};
}
// Curated projects can be linked to a maintainer-labeled discussion without inventing counters.
for (let page=1;;page++) {
  const issues = await api(`issues?state=all&labels=project-discussion&per_page=100&page=${page}`);
  for (const issue of issues) {
    if (issue.pull_request) continue;
    const id = /<!-- mesh-lab-project: ([a-z0-9-]+) -->/.exec(issue.body || '')?.[1];
    if (!id || !projects.some(p => p.id === id) || engagement[id]) continue;
    engagement[id] = {issueNumber:issue.number,hearts:issue.reactions?.heart || 0,comments:issue.comments || 0};
  }
  if (issues.length < 100) break;
}
const engagementFile = new URL('../docs/data/engagement.json',import.meta.url);
const previous = JSON.parse(await readFile(engagementFile,'utf8'));
if (JSON.stringify(previous.projects) !== JSON.stringify(engagement)) await writeFile(engagementFile,JSON.stringify({updatedAt:new Date().toISOString(),projects:engagement},null,2)+'\n');
// Useful to marketing; only public, voluntarily submitted social links are included.
const marketing = projects.filter(p => p.activity === 'l2-pro' && p.socialLinks?.length).map(p => ({project:p.title,author:p.author,projectUrl:p.url,submission:`https://github.com/${repo}/issues/${p.issueNumber}`,socialLinks:p.socialLinks}));
await writeFile(new URL('../docs/data/activity-social-links.json',import.meta.url),JSON.stringify(marketing,null,2)+'\n');
console.log(`Synced ${Object.keys(engagement).length} project discussions.`);
