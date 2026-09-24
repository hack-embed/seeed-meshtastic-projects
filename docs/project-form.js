import { CATEGORIES, PRODUCTS, ACTIVITIES, REPO_URL } from './config.js';
import { escapeHtml } from './form-utils.js';
const $ = id => document.getElementById(id);
const safeUrl = value => {try {const u=new URL(value);return u.protocol==='https:' && !u.username && !u.password ? u.href : '';}catch{return '';}};
let submissionBody = '';
function notify(message) { const status=$('form-message'); status.textContent=message; }
export async function mountProjectForm({activity = ''} = {}) {
  const mount=$('project-form-mount');
  try {const response=await fetch('./partials/project-form.html');if(!response.ok)throw new Error();mount.innerHTML=await response.text();}
  catch {mount.innerHTML='<p>The form could not be loaded. Please reload this page or <a class="text-link" href="'+REPO_URL+'/issues/new?template=project.yml" target="_blank" rel="noopener noreferrer">submit on GitHub ↗</a>.</p>';return false;}
  mount.insertAdjacentHTML('beforeend','<p id="form-message" role="status" class="form-footnote"></p>');
function checkboxes(values, name) { return values.map(v => `<label class="check-option"><input type="checkbox" name="${name}" value="${escapeHtml(v)}"><span>${escapeHtml(v)}</span></label>`).join(''); }
$('hardware-options').innerHTML = checkboxes(PRODUCTS,'hardware');
$('category-options').innerHTML = checkboxes(CATEGORIES,'categories');
$('related-activity').innerHTML += ACTIVITIES.map(a => `<option value="${a.id}">${escapeHtml(a.title)}</option>`).join('');
function updateActivity() { $('social-field').hidden = $('related-activity').value !== 'l2-pro'; $('activity-context').hidden = $('related-activity').value !== 'l2-pro'; }
$('related-activity').addEventListener('change', updateActivity);
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

  if (activity === 'l2-pro') {
    $('related-activity').value = activity;
    $('hardware-options').querySelector('[value="Wio Tracker L2 Pro"]').checked = true;
  }
  updateActivity();
  let repositoryRequest = 0;
  $('import-repo').addEventListener('click', async () => {
    const status=$('repo-import-status');let url;
    try {url=new URL($('repository-url').value);if(url.protocol!=='https:' || url.hostname!=='github.com' || url.username || url.password || !/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(url.pathname))throw new Error();}
    catch {status.textContent='Enter a public GitHub repository URL, such as https://github.com/owner/project.';return;}
    const request=++repositoryRequest;const path=url.pathname.replace(/\/$/,'').replace(/\.git$/,'');
    $('import-repo').disabled=true;status.textContent='Reading public repository details…';
    try {
      const response=await fetch('https://api.github.com/repos'+path,{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error(response.status===403 || response.status===429 ? 'GitHub is limiting requests. You can fill out the form manually.' : 'Repository unavailable. Check that it is public, or fill out the form manually.');
      const repo=await response.json();if(request!==repositoryRequest)return;
      const form=$('project-form');
      if(!form.elements.title.value)form.elements.title.value=String(repo.name || '').slice(0,120);
      if(!form.elements.description.value)form.elements.description.value=String(repo.description || '').slice(0,3000);
      if(!form.elements.resources.value)form.elements.resources.value='https://github.com'+path;
      const license=repo.license?.spdx_id && repo.license.spdx_id!=='NOASSERTION' ? repo.license.spdx_id : 'No recognized license';
      status.textContent='Details imported. License: '+license+'. Existing fields were kept; review all information before submitting.';
      $('submission-ready').hidden=true;
    } catch(error) {status.textContent=error.name==='TimeoutError' ? 'GitHub took too long to respond. Try again or fill out the form manually.' : error.message || 'Import unavailable. You can still fill out the form manually.';}
    finally {$('import-repo').disabled=false;}
  });
  return true;
}
