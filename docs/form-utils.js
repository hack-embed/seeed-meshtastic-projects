import { REPO, REPO_URL } from './config.js';
export const escapeHtml = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function issueNumberFromUrl(value) {
  try {const u=new URL(value);const match=new RegExp(`^/${REPO}/issues/(\\d+)/?$`).exec(u.pathname);return u.protocol==='https:' && u.hostname==='github.com' && !u.username && !u.password && match ? Number(match[1]) : null;} catch {return null;}
}
export function issueDraft(title, fields) {
  const body = Object.entries(fields).map(([label,value])=>`### ${label}\n\n${value || '_No response_'}\n\n`).join('');
  const url = new URL(`${REPO_URL}/issues/new`);url.searchParams.set('title',title);url.searchParams.set('body',body);
  return {body,url:url.href.length<7500 ? url.href : `${REPO_URL}/issues/new?title=${encodeURIComponent(title)}`,needsCopy:url.href.length>=7500};
}
// Only approved, published L2 activity submissions have a catalog issue number.
// Seeded examples and projects from other activities cannot be used for rewards.
export function approvedL2Projects(projects) {
  if(!Array.isArray(projects))return [];
  const seen=new Set();
  return projects.filter(project=>{
    if(!project || project.activity!=='l2-pro' || !Array.isArray(project.products) || !project.products.includes('Wio Tracker L2 Pro') || !Number.isSafeInteger(project.issueNumber) || project.issueNumber<1 || typeof project.title!=='string' || !project.title.trim() || typeof project.author!=='string' || !project.author.trim() || seen.has(project.issueNumber))return false;
    seen.add(project.issueNumber);return true;
  }).sort((a,b)=>String(b.addedAt || '').localeCompare(String(a.addedAt || '')) || a.title.localeCompare(b.title));
}
