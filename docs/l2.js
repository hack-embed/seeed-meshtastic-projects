import { mountProjectForm } from './project-form.js';
import { L2, MILESTONES, validPostUrl } from './l2-config.js';
import { issueDraft, issueNumberFromUrl } from './form-utils.js';
const $ = id => document.getElementById(id);
let projectFormPromise;
for (const button of document.querySelectorAll('[data-open-project]')) button.addEventListener('click',async()=>{
  $('l2-submit-dialog').showModal();
  if(!projectFormPromise)projectFormPromise=mountProjectForm({activity:L2.activity});
  const ready=await projectFormPromise;
  if(!ready)projectFormPromise=null;
});
for(const button of document.querySelectorAll('[data-open-share]'))button.addEventListener('click',()=>$('share-dialog').showModal());
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
const concepts={play:'<div class="pixel-game" aria-hidden="true"><span class="pixel-ball"></span><span class="pixel-paddle"></span><span class="pixel-blocks"></span></div><div><strong>One more level?</strong><p>Imagine a game that fits in your pocket.</p></div>',ui:'<div class="mini-ui" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div><strong>Your screen. Your rules.</strong><p>Build an interface around your everyday tools.</p></div>',hardware:'<div class="mini-chip" aria-hidden="true"></div><div><strong>A new connection.</strong><p>Add a sensor, a peripheral, or a new power setup.</p></div>'};
document.querySelectorAll('[data-concept]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-concept]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$('concept-preview').innerHTML=concepts[button.dataset.concept];}));
for(const m of MILESTONES){const option=document.createElement('option');option.value=m.id;option.textContent=m.name;$('share-platform').append(option);}
$('share-platform').addEventListener('change',()=>{const rule=MILESTONES.find(m=>m.id===$('share-platform').value);$('share-threshold').textContent=rule?`${rule.threshold.toLocaleString('en')} ${rule.metric} ${rule.detail}.`:'Choose a platform to see its milestone.';});
$('share-form').addEventListener('input',()=>{$('share-ready').hidden=true;$('share-error').hidden=true;});
function shareError(message){$('share-error').textContent=message;$('share-error').hidden=false;}
$('share-form').addEventListener('submit',event=>{
  event.preventDefault();const form=new FormData(event.currentTarget);const platform=MILESTONES.find(m=>m.id===form.get('platform'));
  if(!issueNumberFromUrl(form.get('project')))return shareError('Use the GitHub issue URL of your approved project in the Mesh Lab repository.');
  if(!platform || !validPostUrl(form.get('post'),platform.id))return shareError('Add a direct HTTPS post or video link from the selected platform.');
  const count=Number(form.get('count'));if(!Number.isSafeInteger(count) || count<platform.threshold || count>1000000000)return shareError(`This platform requires at least ${platform.threshold.toLocaleString('en')} ${platform.metric}. Submit your link after reaching the milestone.`);
  const fields={'Approved Project Submission':String(form.get('project')).trim(),'Platform':platform.name,'Public Post or Video Link':String(form.get('post')).trim(),'Reported Metric Count':String(count),'Confirmation':'- [x] This is my approved project and public post. Metrics are genuine and YouTube views are organic.'};
  const draft=issueDraft(`[L2 Share Reward] ${platform.name} · Project #${issueNumberFromUrl(form.get('project'))}`,fields);
  $('share-github').href=draft.url;$('share-ready').hidden=false;$('share-error').hidden=true;
  const email=String(form.get('email')).trim();$('share-private-email').hidden=!email;
  if(email)$('share-private-email').href=`mailto:${L2.contact}?subject=${encodeURIComponent('L2 Pro Share Reward contact')}&body=${encodeURIComponent(`Approved project: ${form.get('project')}\nPublic post: ${form.get('post')}\nReward contact email: ${email}\n\nPlease use this address only for activity reward follow-up.`)}`;
  $('share-github').focus();
});
// A decorative network, bounded in size and paused when hidden or motion is reduced.
const canvas=$('mesh-background'),ctx=canvas.getContext('2d'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
let width=0,height=0,points=[],frame=0,last=0,paused=reduce.matches,inView=true;
const pointer={x:-1000,y:-1000};
function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;const scale=Math.min(devicePixelRatio,2);canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);ctx?.setTransform(scale,0,0,scale,0,0);points=Array.from({length:width<600?25:46},(_,i)=>({x:((i*137.5+67)%1000)/1000*width,y:((i*193.7+111)%1000)/1000*height,vx:Math.sin(i*2.3)*.12,vy:Math.cos(i*3.7)*.12}));draw(false);}
function draw(move){if(!ctx)return;ctx.clearRect(0,0,width,height);for(const p of points){if(move){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>width)p.vx*=-1;if(p.y<0||p.y>height)p.vy*=-1;}for(const q of points){const d=Math.hypot(p.x-q.x,p.y-q.y);if(d>0&&d<180){ctx.strokeStyle=`rgba(142,181,87,${(1-d/180)*.18})`;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}}const near=Math.hypot(p.x-pointer.x,p.y-pointer.y)<160;ctx.fillStyle=near?'#d9f5a5':'#799e48';ctx.beginPath();ctx.arc(p.x,p.y,near?2.4:1.4,0,Math.PI*2);ctx.fill();if(near){ctx.strokeStyle='#b6d77c44';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(pointer.x,pointer.y);ctx.stroke();}}}
function animate(time){if(paused||document.hidden||!inView||reduce.matches){frame=0;return;}if(time-last>32){draw(true);last=time;}frame=requestAnimationFrame(animate);}
function sync(){cancelAnimationFrame(frame);frame=0;const effective=paused||reduce.matches;$('motion-toggle').setAttribute('aria-pressed',String(effective));$('motion-toggle').textContent=reduce.matches?'Reduced motion enabled':paused?'Resume background ▷':'Pause background Ⅱ';$('motion-toggle').disabled=reduce.matches;if(!effective&&!document.hidden&&inView)frame=requestAnimationFrame(animate);else draw(false);}
$('motion-toggle').addEventListener('click',()=>{paused=!paused;sync();});reduce.addEventListener('change',()=>{paused=reduce.matches;sync();});document.addEventListener('visibilitychange',sync);
new ResizeObserver(resize).observe(canvas);new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();}).observe(canvas);
canvas.parentElement.addEventListener('pointermove',e=>{if(paused||reduce.matches)return;const r=canvas.getBoundingClientRect();pointer.x=e.clientX-r.left;pointer.y=e.clientY-r.top;});canvas.parentElement.addEventListener('pointerleave',()=>{pointer.x=-1000;pointer.y=-1000;});resize();sync();
