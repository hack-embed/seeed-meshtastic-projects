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
