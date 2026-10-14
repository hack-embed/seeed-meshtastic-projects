import { mountProjectForm } from './project-form.js';
import { L2, MILESTONES, validPostUrl } from './l2-config.js?v=20261014-purchase';
import { issueDraft, approvedL2Projects } from './form-utils.js';
import { REPO_URL } from './config.js';
import { encryptApprovalContact, approvalContactAvailable } from './notification-contact.js';
const $ = id => document.getElementById(id);
let projectFormPromise;
async function openProjectDialog() {
  if(!$('l2-submit-dialog').open)$('l2-submit-dialog').showModal();
  if(!projectFormPromise)projectFormPromise=mountProjectForm({activity:L2.activity});
  const ready=await projectFormPromise;
  if(!ready)projectFormPromise=null;
}
function openShareDialog() {if(!$('share-dialog').open)$('share-dialog').showModal();}
for(const button of document.querySelectorAll('[data-open-project]'))button.addEventListener('click',openProjectDialog);
for(const button of document.querySelectorAll('[data-open-share]'))button.addEventListener('click',openShareDialog);
for(const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelector('[data-close-dialog]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{const r=dialog.getBoundingClientRect();if(event.target===dialog && (event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom))dialog.close();});
}
if(L2.purchaseUrl) {
  for(const button of document.querySelectorAll('[data-purchase]')){const a=document.createElement('a');a.href=L2.purchaseUrl;a.className=button.className;a.textContent=button.textContent;a.target='_blank';a.rel='noopener noreferrer';button.replaceWith(a);}
  document.querySelectorAll('[data-purchase-note]').forEach(n=>n.hidden=true);
}
$('l2-menu').addEventListener('click',()=>{$('l2-menu').setAttribute('aria-expanded',String($('l2-nav').classList.toggle('is-open')));});
$('l2-nav').addEventListener('click',event=>{if(event.target.closest('a,button')){$('l2-nav').classList.remove('is-open');$('l2-menu').setAttribute('aria-expanded','false');}});
document.addEventListener('keydown',e=>{if(e.key==='Escape' && $('l2-nav').classList.contains('is-open')){$('l2-nav').classList.remove('is-open');$('l2-menu').setAttribute('aria-expanded','false');$('l2-menu').focus();}});
for(const m of MILESTONES){const option=document.createElement('option');option.value=m.id;option.textContent=m.name;$('share-platform').append(option);}
let shareProjects=[], shareSubmissionRequest=0, shareSubmissionBody='';
const contactAvailable=approvalContactAvailable();
$('share-email-help').textContent=contactAvailable
  ? 'Your email is required for reward follow-up. It is encrypted for the Seeed team and never displayed publicly.'
  : 'Your email is required for reward follow-up and stays out of the public issue. Send it privately using the contact link in the next step.';
function resetShareDraft() {
  ++shareSubmissionRequest;shareSubmissionBody='';$('share-ready').hidden=true;$('share-error').hidden=true;
  $('share-github').removeAttribute('href');$('share-private-email').removeAttribute('href');
}
$('share-form').addEventListener('input',resetShareDraft);
$('share-form').addEventListener('change',resetShareDraft);
function shareError(message){$('share-error').textContent=message;$('share-error').hidden=false;}
function renderShareProjects(projects) {
  const previous=$('share-project').value;shareProjects=approvedL2Projects(projects);
  const placeholder=new Option(shareProjects.length ? 'Select your approved project' : 'No approved L2 projects yet','');
  $('share-project').replaceChildren(placeholder,...shareProjects.map(p=>new Option(`${p.title} — ${p.author} (#${p.issueNumber})`,String(p.issueNumber))));
  if(shareProjects.some(p=>String(p.issueNumber)===previous))$('share-project').value=previous;
  $('share-project').disabled=!shareProjects.length;$('prepare-share').disabled=!shareProjects.length;
  const status=$('share-project-status');status.replaceChildren();status.hidden=Boolean(shareProjects.length);
  if(!shareProjects.length) {
    const hint=document.createElement('p');hint.className='form-footnote';hint.textContent='No approved L2 projects are available yet. Your project will appear here after review and publication.';
    const button=document.createElement('button');button.className='button outline';button.type='button';button.textContent='Submit a Project';
    button.addEventListener('click',()=>{$('share-dialog').close();openProjectDialog();});status.append(hint,button);
  }
  resetShareDraft();
}
$('share-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!event.currentTarget.reportValidity())return;
  const form=new FormData(event.currentTarget), platform=MILESTONES.find(m=>m.id===form.get('platform'));
  const project=shareProjects.find(p=>String(p.issueNumber)===form.get('project'));
  if(!project)return shareError('Select an approved L2 project from the list. Your project will be available after approval.');
  if(!platform || !validPostUrl(form.get('post'),platform.id))return shareError('Add a direct HTTPS post or video link from the selected platform.');
  const projectUrl=`${REPO_URL}/issues/${project.issueNumber}`, email=String(form.get('email')).trim();
  if(!email)return shareError('Add your email so the team can follow up about your reward.');
  const fields={'Approved Project Submission':projectUrl,'Platform':platform.name,'Public Post or Video Link':String(form.get('post')).trim(),'Confirmation':'- [x] This is my approved project and public post. Metrics are genuine and YouTube views are organic.'};
  const request=++shareSubmissionRequest;$('prepare-share').disabled=true;
  try {
    if(contactAvailable)fields['Private Approval Contact']=await encryptApprovalContact(email,{title:project.title,author:project.author});
    if(request!==shareSubmissionRequest)return;
    const draft=issueDraft(`[L2 Share Reward] ${platform.name} · Project #${project.issueNumber}`,fields);
    shareSubmissionBody=draft.body;$('share-copy').hidden=!draft.needsCopy;
    $('share-github').href=draft.url;$('share-ready').hidden=false;$('share-error').hidden=true;
    const contactHelp=contactAvailable
      ? 'Sign in with the same GitHub account used for your project, review the details, and create the submission. Your encrypted contact email is included for the Seeed team.'
      : 'Sign in with the same GitHub account used for your project, review the details, and create the submission. Then send your required contact email privately using the link below; add the new issue URL to your message.';
    $('share-ready-help').textContent=(draft.needsCopy ? 'This submission is too long to prefill safely. Copy the submission below, open GitHub, and paste it into the issue body. ' : '')+contactHelp;
    $('share-private-email').hidden=contactAvailable;
    if(!contactAvailable)$('share-private-email').href=`mailto:${L2.contact}?subject=${encodeURIComponent('L2 Pro Share Reward contact')}&body=${encodeURIComponent(`Approved project: ${projectUrl}\nShare submission URL: [paste your new issue URL here]\nPublic post: ${form.get('post')}\nReward contact email: ${email}\n\nPlease use this address only for activity reward follow-up.`)}`;
    $('share-github').focus();
  } catch {if(request===shareSubmissionRequest)shareError('Your private email could not be secured. Please try again before submitting your link.');}
  finally {$('prepare-share').disabled=!shareProjects.length;}
});
$('share-copy').addEventListener('click',async()=>{
  try {await navigator.clipboard.writeText(shareSubmissionBody);$('share-copy-status').textContent='Submission copied. Paste it into your GitHub issue before selecting Create.';}
  catch {shareError('Clipboard access is unavailable. Please allow copying in your browser and try again.');}
});
function openLinkedForm(){if(location.hash==='#submit-social')openShareDialog();}
window.addEventListener('hashchange',openLinkedForm);openLinkedForm();
// Idea cards show approved L2 Pro submissions only; the community card previews the whole Mesh Hub.
const coverUrl=value=>{try{const u=new URL(value);return u.protocol==='https:' && !u.username && !u.password ? u.href : '';}catch{return '';}};
const withCover=projects=>projects.filter(p=>coverUrl(p.image)).sort((a,b)=>b.addedAt.localeCompare(a.addedAt));
function renderExamples(projects) {
  const hub=withCover(projects), pool=hub.filter(p=>p.activity===L2.activity), used=new Set();
  for(const card of document.querySelectorAll('[data-idea]')) {
    const match=pool.find(p=>p.categories.includes(card.dataset.idea) && !used.has(p.id)) || pool.find(p=>p.categories.includes(card.dataset.idea));
    const example=document.createElement(match ? 'a' : 'button');example.className='idea-example';
    if(match){used.add(match.id);example.href=`./?project=${encodeURIComponent(match.id)}#projects`;const img=new Image();img.src=coverUrl(match.image);img.alt=match.imageAlt || match.title;img.loading='lazy';img.decoding='async';const caption=document.createElement('span');caption.textContent=`Example · ${match.title}`;example.append(img,caption);}
    else{example.type='button';example.dataset.openProject='';example.innerHTML='<span class="idea-empty">Your build could be the first example here.</span>';example.addEventListener('click',()=>document.querySelector('.hero-actions [data-open-project]').click());}
    card.append(example);
  }
  $('community-demos').replaceChildren(...hub.slice(0,3).map(p=>{const img=new Image();img.src=coverUrl(p.image);img.alt='';img.loading='lazy';img.decoding='async';return img;}));
}
async function loadProjectCatalog() {
  try {
    const response=await fetch('./data/projects.json',{cache:'no-cache'});
    if(!response.ok)throw new Error();
    const projects=await response.json();if(!Array.isArray(projects))throw new Error();
    renderShareProjects(projects);renderExamples(projects);
  } catch {
    const status=$('share-project-status');status.hidden=false;status.replaceChildren();
    const hint=document.createElement('p');hint.className='form-footnote';hint.textContent='We could not load approved projects. Please try again.';
    const retry=document.createElement('button');retry.type='button';retry.className='button outline';retry.textContent='Reload projects';
    retry.addEventListener('click',()=>{retry.disabled=true;loadProjectCatalog();});status.append(hint,retry);
    $('share-project').replaceChildren(new Option('Projects unavailable',''));$('share-project').disabled=true;$('prepare-share').disabled=true;
  }
}
loadProjectCatalog();
// Repeat the device wall on both sides of the visible group for a continuous loop.
const hero=document.querySelector('.l2-hero'),wallTrack=hero.querySelector('.wall-track'),wallGroup=wallTrack.querySelector('.wall-group');
wallTrack.append(wallGroup.cloneNode(true),wallGroup.cloneNode(true));
wallTrack.classList.add('is-loop-ready');
new IntersectionObserver(([entry])=>hero.classList.toggle('motion-idle',!entry.isIntersecting)).observe(hero);
// A viewport-sized network stays visible throughout the page without a full-page bitmap.
const canvas=$('mesh-background'),ctx=canvas.getContext('2d'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
let width=0,height=0,points=[],frame=0,last=0,phase=0,paused=false;
const pointer={x:-1000,y:-1000};
function resize(){
  const r=canvas.getBoundingClientRect();width=r.width;height=r.height;
  const scale=Math.min(devicePixelRatio,2);canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);ctx?.setTransform(scale,0,0,scale,0,0);
  points=Array.from({length:width<600?28:62},(_,i)=>({x:((i*137.5+67)%1000)/1000*width,y:((i*193.7+111)%1000)/1000*height,vx:Math.sin(i*2.3)*.14,vy:Math.cos(i*3.7)*.14}));draw(false);
}
function draw(move){
  if(!ctx)return;if(move)phase+=.018;ctx.clearRect(0,0,width,height);
  points.forEach((p,i)=>{
    if(move){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>width)p.vx*=-1;if(p.y<0||p.y>height)p.vy*=-1;}
    const glow=(Math.sin(phase+i*1.7)+1)/2;
    for(const q of points.slice(i+1)){
      const d=Math.hypot(p.x-q.x,p.y-q.y);
      if(d<190){ctx.strokeStyle=`rgba(143,195,65,${(1-d/190)*(.15+glow*.17)})`;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}
    }
    const near=Math.hypot(p.x-pointer.x,p.y-pointer.y)<160;
    ctx.fillStyle=near?'#d9f5a5':`rgba(158,208,92,${.35+glow*.5})`;ctx.beginPath();ctx.arc(p.x,p.y,near?2.5:1.3+glow*.5,0,Math.PI*2);ctx.fill();
    if(near){ctx.strokeStyle='#b6d77c44';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(pointer.x,pointer.y);ctx.stroke();}
  });
}
function animate(time){if(time-last>32){draw(true);last=time;}frame=requestAnimationFrame(animate);}
function sync(){
  cancelAnimationFrame(frame);frame=0;const stopped=paused||reduce.matches||document.hidden;
  document.body.classList.toggle('motion-paused',stopped);
  $('l2-motion').disabled=reduce.matches;$('l2-motion').setAttribute('aria-pressed',String(paused||reduce.matches));
  $('l2-motion').textContent=reduce.matches?'Reduced motion':paused?'Resume motion ▷':'Pause motion Ⅱ';
  if(!stopped)frame=requestAnimationFrame(animate);else draw(false);
}
$('l2-motion').addEventListener('click',()=>{paused=!paused;sync();});
reduce.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
new ResizeObserver(resize).observe(canvas);
document.addEventListener('pointermove',e=>{if(paused||reduce.matches)return;pointer.x=e.clientX;pointer.y=e.clientY;},{passive:true});
document.addEventListener('pointerleave',()=>{pointer.x=-1000;pointer.y=-1000;});resize();sync();
