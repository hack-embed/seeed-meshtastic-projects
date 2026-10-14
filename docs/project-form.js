import { CATEGORIES, PRODUCTS, ACTIVITIES, REPO_URL } from './config.js';
import { escapeHtml, issueDraft } from './form-utils.js';
import { repoPath, extractProject } from './repo-import.js';
import { encryptApprovalContact, approvalContactAvailable } from './notification-contact.js';
const $ = id => document.getElementById(id);
const safeUrl = value => {try {const u=new URL(value);return u.protocol==='https:' && !u.username && !u.password ? u.href : '';}catch{return '';}};
const PHOTO_PLACEHOLDER = '[ATTACH YOUR PHOTO HERE — replace this line with the image uploaded on GitHub]';
const PHOTO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export async function mountProjectForm({activity = ''} = {}) {
  const mount=$('project-form-mount');
  try {const response=await fetch('./partials/project-form.html',{cache:'no-cache'});if(!response.ok)throw new Error();mount.innerHTML=await response.text();}
  catch {mount.innerHTML='<p>The form could not be loaded. Please reload this page or <a class="text-link" href="'+REPO_URL+'/issues/new?template=project.yml" target="_blank" rel="noopener noreferrer">submit on GitHub ↗</a>.</p>';return false;}
  mount.insertAdjacentHTML('beforeend','<p id="form-message" role="status" class="form-footnote"></p>');
  const formElement=$('project-form');
  let submissionBody='', repositoryRequest=0, submissionRequest=0, photoRequest=0, photoUrl='', selectedPhoto=null;
  const initialImportHelp=$('repo-import-status').textContent;
  const contactAvailable=approvalContactAvailable();
  const notify=message=>{$('form-message').textContent=message;};
  const checkboxes=(values,name)=>values.map(v=>`<label class="check-option"><input type="checkbox" name="${name}" value="${escapeHtml(v)}"><span>${escapeHtml(v)}</span></label>`).join('');
  $('hardware-options').innerHTML=checkboxes(PRODUCTS,'hardware');
  $('category-options').innerHTML=checkboxes(CATEGORIES,'categories');
  $('related-activity').innerHTML+=ACTIVITIES.map(a=>`<option value="${a.id}">${escapeHtml(a.title)}</option>`).join('');
  $('project-email-help').textContent=contactAvailable
    ? 'Receive an email when your project is approved. Your address is encrypted for the Seeed team and never displayed publicly.'
    : 'Your address stays out of the public submission. In the next step, send it privately with your GitHub issue link so the team can follow up.';
  function updateActivity() {
    const isL2=$('related-activity').value==='l2-pro';
    $('activity-context').hidden=!isL2;
  }
  function applyActivityDefault() {
    if(activity==='l2-pro') {
      $('related-activity').value=activity;
      $('hardware-options').querySelector('[value="Wio Tracker L2 Pro"]').checked=true;
    }
    updateActivity();
  }
  function clearDraft() {
    ++submissionRequest;submissionBody='';$('submission-ready').hidden=true;$('form-error').hidden=true;
    $('github-submit').removeAttribute('href');$('private-email').removeAttribute('href');$('private-email').hidden=true;
  }
  function formError(message) {
    $('form-error').textContent=message;$('form-error').hidden=false;$('form-error').scrollIntoView({block:'center'});
  }
  function updateCoverMethod() {
    const upload=formElement.elements['cover-method'].value==='upload';
    $('cover-url-field').hidden=upload;formElement.elements.image.required=!upload;formElement.elements.image.disabled=upload;
    $('cover-upload-field').hidden=!upload;$('project-photo').required=upload;$('project-photo').disabled=!upload;
  }
  function releasePhoto() {
    ++photoRequest;selectedPhoto=null;
    if(photoUrl)URL.revokeObjectURL(photoUrl);
    photoUrl='';$('photo-preview').hidden=true;$('photo-preview-image').removeAttribute('src');
    $('photo-status').textContent='';$('photo-copy-status').textContent='';$('project-photo').setCustomValidity('');
  }
  $('related-activity').addEventListener('change',updateActivity);
  for(const radio of formElement.querySelectorAll('[name="cover-method"]'))radio.addEventListener('change',updateCoverMethod);
  formElement.addEventListener('input',clearDraft);
  formElement.addEventListener('change',clearDraft);
  $('clear-project-form').addEventListener('click',event=>{
    // Reset synchronously before restoring the activity context. Native reset
    // events run before the browser resets the controls, including in WebKit.
    event.preventDefault();formElement.reset();
    clearDraft();++repositoryRequest;releasePhoto();$('import-repo').disabled=false;$('prepare-project').disabled=false;
    $('repo-import-status').textContent=initialImportHelp;
    applyActivityDefault();updateCoverMethod();notify('Form cleared. You can start a new submission.');formElement.elements.title.focus();
  });
  $('project-photo').addEventListener('change',async()=>{
    releasePhoto();const file=$('project-photo').files[0];if(!file)return;
    if(!PHOTO_TYPES.has(file.type) || file.size>10*1024*1024 || !file.size) {
      const message='Choose a PNG, JPG, WebP, or GIF image no larger than 10 MB.';
      $('project-photo').setCustomValidity(message);$('photo-status').textContent=message;return;
    }
    const request=photoRequest;photoUrl=URL.createObjectURL(file);
    const preview=$('photo-preview-image');preview.src=photoUrl;
    $('photo-status').textContent='Checking your photo…';
    try {
      await preview.decode();if(request!==photoRequest)return;
      if(preview.naturalWidth*preview.naturalHeight>40000000)throw new Error();
      selectedPhoto=file;$('photo-preview').hidden=false;
      const size=file.size<1024*1024 ? `${Math.max(1,Math.round(file.size/1024))} KB` : `${(file.size/1024/1024).toFixed(1)} MB`;
      $('photo-filename').textContent=`${file.name} · ${size}`;
      $('photo-status').textContent='Photo selected on your device. Attach it on GitHub in the final step to include it in your submission.';
    } catch {
      if(request!==photoRequest)return;
      releasePhoto();const message='This image could not be opened. Try another photo under 40 megapixels.';
      $('project-photo').setCustomValidity(message);$('photo-status').textContent=message;
    }
  });
  async function clipboardPhoto() {
    if(!selectedPhoto)throw new Error();
    if(selectedPhoto.type==='image/png')return selectedPhoto;
    const preview=$('photo-preview-image'), canvas=document.createElement('canvas');
    const scale=Math.min(1,2560/Math.max(preview.naturalWidth,preview.naturalHeight));
    canvas.width=Math.round(preview.naturalWidth*scale);canvas.height=Math.round(preview.naturalHeight*scale);
    canvas.getContext('2d').drawImage(preview,0,0,canvas.width,canvas.height);
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error()),'image/png'));
  }
  $('copy-project-photo').addEventListener('click',async()=>{
    try {
      if(!navigator.clipboard?.write || !globalThis.ClipboardItem)throw new Error();
      await navigator.clipboard.write([new ClipboardItem({'image/png':clipboardPhoto()})]);
      $('photo-copy-status').textContent='Photo copied as PNG. On GitHub, replace the cover placeholder by pasting the photo there; wait for the image upload to finish before creating your issue.';
    } catch {
      $('photo-copy-status').textContent='Your browser cannot copy this photo. On GitHub, remove the cover placeholder, then drag in the selected image or use the attachment button to upload it.';
    }
  });
  formElement.addEventListener('submit',async event=>{
    event.preventDefault();if(!formElement.reportValidity())return;
    const form=new FormData(formElement), upload=form.get('cover-method')==='upload';
    if(!form.getAll('hardware').length || !form.getAll('categories').length)return formError('Select at least one product and one category.');
    if(upload && !selectedPhoto)return formError('Choose a valid photo and wait for its preview before continuing.');
    if(!upload && !safeUrl(form.get('image')))return formError('Use a public HTTPS link for the cover image.');
    const resources=String(form.get('resources')).split(/\n/).map(s=>s.trim()).filter(Boolean);
    const social=String(form.get('social') || '').split(/\n/).map(s=>s.trim()).filter(Boolean);
    if(!resources.length || !resources.every(safeUrl) || !social.every(safeUrl))return formError('Add one valid HTTPS URL per line in Resources & Links and Social Media Links.');
    if(social.length>20)return formError('Add up to 20 Social Media Links.');
    const values={
      'Project Title':String(form.get('title')).trim(),'Author / Maker':String(form.get('author')).trim(),
      'Project Description':String(form.get('description')).trim(),'Project Cover Image':upload ? PHOTO_PLACEHOLDER : String(form.get('image')).trim(),
      'Cover Image Description':String(form.get('image-description')).trim(),
      'Hardware':form.getAll('hardware').join(', '),'Category':form.getAll('categories').join(', '),
      'Setup Instructions':String(form.get('setup')).trim(),'Resources & Links':resources.join('\n'),
      'Related Activity':ACTIVITIES.find(a=>a.id===form.get('activity'))?.title || 'No related activity',
      'Social Links':social.join('\n'),'Attribution':'- [x] I have credited the original maker and have permission to share this content and its images.',
    };
    if(!values['Project Title'] || !values['Author / Maker'] || values['Project Description'].length<30)return formError('Add a project title, maker, and a description of at least 30 characters.');
    if(Object.values(values).some(v=>/^### /m.test(v)))return formError('Use plain text or headings with two # characters in your submission. Three-# headings are reserved for form fields.');
    const email=String(form.get('email')).trim(), request=++submissionRequest;
    $('prepare-project').disabled=true;
    try {
      if(email && contactAvailable)values['Private Approval Contact']=await encryptApprovalContact(email,{title:values['Project Title'],author:values['Author / Maker']});
      if(request!==submissionRequest)return;
      const draft=issueDraft(`[Project] ${values['Project Title']}`,values);submissionBody=draft.body;
      $('github-submit').href=draft.url;
      $('submission-help').textContent=draft.needsCopy
        ? 'This submission is too long to prefill safely. Copy the submission, open GitHub, and paste it into the issue body before selecting Create.'
        : 'Sign in to GitHub, review the details, then select Create. Your project goes live only after AE approval.';
      $('photo-handoff').hidden=!upload;$('photo-copy-status').textContent='';
      $('photo-handoff-help').textContent=upload ? `Your photo “${selectedPhoto.name}” still needs to be uploaded. ${draft.needsCopy?'Paste the copied submission on GitHub first. ':''}Copy the photo below, open the GitHub submission, and replace the line under “Project Cover Image” by pasting the photo. Wait for the upload to finish before selecting Create. You can also drag the original file into that field.` : '';
      $('private-email').hidden=!email || contactAvailable;
      if(!$('private-email').hidden)$('private-email').href=`mailto:sensecap@seeed.cc?subject=${encodeURIComponent(`Mesh Lab contact: ${values['Project Title']}`)}&body=${encodeURIComponent(`Project: ${values['Project Title']}\nGitHub submission URL: [paste your issue URL here]\nContact email: ${email}\nRelated activity: ${values['Related Activity']}\n\nPlease use this address for approval updates and community activity reward follow-up.`)}`;
      $('submission-ready').hidden=false;$('form-error').hidden=true;
      $('submission-ready').scrollIntoView({block:'center',behavior:'smooth'});$('github-submit').focus({preventScroll:true});
    } catch {
      if(request===submissionRequest)formError('Your private email could not be secured. Please try again. You can also remove it and send your contact details privately after submitting.');
    } finally {$('prepare-project').disabled=false;}
  });
  $('copy-submission').addEventListener('click',async()=>{
    try {await navigator.clipboard.writeText(submissionBody);notify('Submission copied. Paste it into your GitHub issue.');}
    catch {formError('Clipboard access is unavailable. Use a browser that allows copying, or submit using the GitHub project form.');}
  });
  applyActivityDefault();updateCoverMethod();
  $('import-repo').addEventListener('click',async()=>{
    const status=$('repo-import-status'), path=repoPath($('repository-url').value);
    if(!path){status.textContent='Enter a public GitHub repository URL, such as https://github.com/owner/project.';return;}
    const request=++repositoryRequest, api='https://api.github.com/repos'+path;
    $('import-repo').disabled=true;status.textContent='Reading the repository and its README…';
    try {
      const response=await fetch(api,{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error(response.status===403 || response.status===429 ? 'GitHub is limiting requests. You can fill out the form manually.' : 'Repository unavailable. Check that it is public, or fill out the form manually.');
      const repo=await response.json();
      const readme=await fetch(api+'/readme',{headers:{Accept:'application/vnd.github.raw+json'},signal:AbortSignal.timeout(12000)}).then(r=>r.ok ? r.text() : '').catch(()=>'');
      if(request!==repositoryRequest)return;
      const data=extractProject(repo,readme,path), filled=[];
      const fill=(name,value,label)=>{if(value && !formElement.elements[name].value.trim()){formElement.elements[name].value=value;filled.push(label);}};
      const check=(name,values,label)=>{const boxes=[...formElement.querySelectorAll(`[name="${name}"]`)];if(values.length && !boxes.some(b=>b.checked)){boxes.forEach(b=>{b.checked=values.includes(b.value);});filled.push(label);}};
      fill('title',data.title,'title');fill('author',data.author,'maker');fill('description',data.description,'description');
      if(formElement.elements['cover-method'].value==='url')fill('image',data.image,data.imageFromReadme ? 'cover image' : 'cover image (GitHub preview card)');
      check('hardware',data.hardware,'hardware');check('categories',data.categories,'category');
      fill('setup',data.setup.join('\n'),'setup steps');fill('resources',data.resources.join('\n'),'links');
      status.textContent=`${filled.length ? 'Filled '+filled.join(', ')+'.' : 'No empty fields to fill.'} License: ${data.license}. ${readme ? '' : 'No README was found. '}Fields you had already filled were kept; review everything before submitting.`;
      clearDraft();
    } catch(error) {
      if(request!==repositoryRequest)return;
      status.textContent=error.name==='TimeoutError' ? 'GitHub took too long to respond. Try again or fill out the form manually.' : error.message || 'Import unavailable. You can still fill out the form manually.';
    } finally {if(request===repositoryRequest)$('import-repo').disabled=false;}
  });
  return true;
}
