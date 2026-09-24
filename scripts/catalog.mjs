import assert from 'node:assert/strict';
import { CATEGORIES, PRODUCTS, ACTIVITIES } from '../docs/config.js';

export function httpsUrl(value) {
  assert.equal(typeof value, 'string', 'A URL must be a string');
  const url = new URL(value);
  assert(url.protocol === 'https:' && !url.username && !url.password, `Expected a public HTTPS URL: ${value}`);
  return url.href;
}
function text(value, name, max = 10000) {
  assert(typeof value === 'string' && value.trim() && value.length <= max, `Invalid ${name}`);
}
function uniqueArray(values, name, allowed) {
  assert(Array.isArray(values) && values.length > 0 && values.length <= 30, `Invalid ${name}`);
  assert.equal(new Set(values).size, values.length, `Duplicate ${name}`);
  for (const v of values) { text(v, name, 200); if (allowed) assert(allowed.includes(v), `Unknown ${name}: ${v}`); }
}
export function validateProject(p) {
  assert(p && typeof p === 'object', 'Invalid project');
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id), 'Invalid project ID');
  text(p.title,'title',120); text(p.author,'author',100); text(p.description,'description',3000);
  uniqueArray(p.categories,'category',CATEGORIES); uniqueArray(p.products,'product',PRODUCTS);
  uniqueArray(p.devices,'devices'); uniqueArray(p.tags,'tags');
  httpsUrl(p.url); httpsUrl(p.image); if (p.source) httpsUrl(p.source);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(p.addedAt) && new Date(p.addedAt).toISOString().slice(0,10) === p.addedAt,'Invalid catalog date');
  assert(Array.isArray(p.setup) && p.setup.length <= 100,'Invalid setup instructions');
  for (const step of p.setup) text(step,'setup step',6000);
  assert(Array.isArray(p.resources) && p.resources.length > 0 && p.resources.length <= 30,'Invalid resources');
  for (const r of p.resources) { text(r.label,'resource label',200); httpsUrl(r.url); }
  assert(p.activity === null || ACTIVITIES.some(a => a.id === p.activity),'Unknown activity');
  if (p.socialLinks) { assert(Array.isArray(p.socialLinks) && p.socialLinks.length <= 20,'Invalid social links'); p.socialLinks.forEach(httpsUrl); }
  if (p.issueNumber !== undefined) assert(Number.isSafeInteger(p.issueNumber) && p.issueNumber > 0,'Invalid issue number');
  // Reward contact information must never enter the public catalog.
  assert(!Object.hasOwn(p,'email'),'Email must not be published');
  return p;
}
export function validateCatalog(projects) {
  assert(Array.isArray(projects) && projects.length > 0,'The catalog must contain projects');
  const ids = new Set(), urls = new Set();
  for (const p of projects) { validateProject(p); assert(!ids.has(p.id),`Duplicate ID: ${p.id}`); assert(!urls.has(p.url),`Duplicate project URL: ${p.url}`); ids.add(p.id); urls.add(p.url); }
  return projects;
}
export function parseSubmission(issue, date = new Date().toISOString().slice(0,10)) {
  assert(Number.isSafeInteger(issue.number) && issue.number > 0,'Invalid issue number');
  assert(typeof issue.body === 'string' && issue.body.length <= 25000,'Invalid submission');
  const sections = new Map();
  const chunks = issue.body.replace(/\r\n/g,'\n').split(/^### /m).slice(1);
  for (const chunk of chunks) {
    const newline = chunk.indexOf('\n'); assert(newline !== -1,'Malformed submission field');
    const heading = chunk.slice(0,newline).trim(); assert(!sections.has(heading),`Duplicate heading: ${heading}`);
    const value = chunk.slice(newline+1).trim(); sections.set(heading, value === '_No response_' ? '' : value);
  }
  const get = key => sections.get(key) || '';
  const split = key => get(key).split(',').map(s => s.trim()).filter(Boolean);
  const urls = key => get(key).split('\n').map(s => s.trim()).filter(Boolean).map(s => {
    const match = /^!?(?:\[[^\]]*\])\((https:\/\/[^\s)]+)\)$/.exec(s);
    return httpsUrl(match ? match[1] : s);
  });
  assert(/^- \[x\] I have credited the original maker and have permission to share this content and its images\./im.test(get('Attribution')),'Content permission confirmation is required');
  const resources = urls('Resources & Links'); assert(resources.length > 0,'At least one resource is required');
  const activityTitle = get('Related Activity');
  const activity = !activityTitle || activityTitle === 'No related activity' ? null : ACTIVITIES.find(a => a.title === activityTitle)?.id;
  assert(activity !== undefined,'Unknown activity');
  const p = {
    id:`community-${issue.number}`, title:get('Project Title'), author:get('Author / Maker'), description:get('Project Description'),
    image:urls('Project Cover Image')[0], categories:split('Category'), products:split('Hardware'), devices:split('Hardware'),
    tags:['Community build'], addedAt:date, url:resources[0],
    setup:get('Setup Instructions').split(/\n+/).map(s => s.trim()).filter(Boolean),
    resources:resources.map((url,index) => ({label:index === 0 ? 'Project resources' : `Resource ${index+1}`,url})),
    activity, socialLinks:activity === 'l2-pro' ? urls('Social Links') : [], issueNumber:issue.number,
  };
  return validateProject(p);
}
