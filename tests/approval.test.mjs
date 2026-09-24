import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const fixture = {
 number:42,labels:[{name:'ae-approved'}],comments:2,reactions:{heart:3},
 body:`### Project Title\n\nTest community build\n\n### Author / Maker\n\nTest Maker\n\n### Project Description\n\nA practical mesh project built with Seeed hardware.\n\n### Project Cover Image\n\nhttps://example.com/image.png\n\n### Hardware\n\nWio Tracker L1 Pro\n\n### Category\n\nHardware\n\n### Resources & Links\n\nhttps://example.com/build\n\n### Related Activity\n\nNo related activity\n\n### Attribution\n\n- [x] I have credited the original maker and have permission to share this content and its images.\n`
};
async function runApproval({permission='write',reviewers='',approved=true,eventName='issues'}={}) {
 const dir=await mkdtemp(join(tmpdir(),'mesh-lab-review-'));
 try {
  for(const path of ['scripts','docs/data']) await mkdir(join(dir,path),{recursive:true});
  for(const file of ['scripts/update-catalog.mjs','scripts/catalog.mjs','docs/config.js','docs/data/projects.json','docs/data/engagement.json']) await copyFile(new URL(`../${file}`,import.meta.url),join(dir,file));
  await writeFile(join(dir,'package.json'),' {"type":"module"}');
  const issue=structuredClone(fixture); if(!approved) issue.labels=[];
  await writeFile(join(dir,'event.json'),JSON.stringify({action:'labeled',label:{name:'ae-approved'},sender:{login:'ae-reviewer'},issue:{number:42}}));
  const mock=`globalThis.fetch=async(url)=>{let body; if(url.includes('/collaborators/')) body=${JSON.stringify({permission})}; else if(url.endsWith('/issues/42')) body=${JSON.stringify(issue)}; else if(url.includes('/issues?')) body=[]; else throw new Error('Unexpected request '+url); return new Response(JSON.stringify(body),{status:200});};`;
  await writeFile(join(dir,'mock.mjs'),mock);
  const result=spawnSync(process.execPath,['--import',join(dir,'mock.mjs'),join(dir,'scripts/update-catalog.mjs')],{encoding:'utf8',env:{...process.env,GITHUB_REPOSITORY:'example/mesh-lab',GH_TOKEN:'test-only-placeholder',GITHUB_EVENT_NAME:eventName,GITHUB_EVENT_PATH:join(dir,'event.json'),AE_REVIEWERS:reviewers}});
  return {status:result.status,stderr:result.stderr,projects:JSON.parse(await readFile(join(dir,'docs/data/projects.json'),'utf8')),engagement:JSON.parse(await readFile(join(dir,'docs/data/engagement.json'),'utf8'))};
 } finally { await rm(dir,{recursive:true,force:true}); }
}
test('maintainer approval publishes a validated project and real issue counts',async()=>{
 const result=await runApproval(); assert.equal(result.status,0,result.stderr);
 assert.equal(result.projects[0].id,'community-42'); assert.deepEqual(result.engagement.projects['community-42'],{issueNumber:42,hearts:3,comments:2});
});
test('ordinary users and maintainers outside the AE allowlist cannot publish',async()=>{
 for(const options of [{permission:'read'},{reviewers:'different-reviewer'}]) {const r=await runApproval(options); assert.notEqual(r.status,0); assert(!r.projects.some(p=>p.id==='community-42'));}
});
test('removed approval and comment events do not publish new content',async()=>{
 const removed=await runApproval({approved:false}); assert.notEqual(removed.status,0); assert(!removed.projects.some(p=>p.id==='community-42'));
 const comment=await runApproval({eventName:'issue_comment'}); assert.equal(comment.status,0,comment.stderr); assert(!comment.projects.some(p=>p.id==='community-42'));
});
