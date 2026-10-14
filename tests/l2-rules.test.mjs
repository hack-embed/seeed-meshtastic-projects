import test from 'node:test';
import assert from 'node:assert/strict';
import {MILESTONES,validPostUrl} from '../docs/l2-config.js';
import {issueNumberFromUrl,issueDraft,approvedL2Projects} from '../docs/form-utils.js';
test('social reward thresholds match the activity brief',()=>{
 assert.deepEqual(MILESTONES.map(m=>[m.id,m.threshold]),[['reddit',100],['facebook',50],['x',30],['youtube',500],['youtube-shorts',1000]]);
});
test('social project selector includes only published L2 activity submissions',()=>{
 const base={title:'L2 pocket game',author:'A Maker',activity:'l2-pro',products:['Wio Tracker L2 Pro'],issueNumber:42,addedAt:'2026-10-14'};
 const projects=[base,{...base,issueNumber:41,addedAt:'2026-10-13'},{...base},
  {...base,issueNumber:undefined},{...base,issueNumber:'42'},{...base,issueNumber:-1},
  {...base,issueNumber:43,activity:null},{...base,issueNumber:44,products:['T1000-E']},
  {...base,issueNumber:45,products:'Wio Tracker L2 Pro'},{...base,issueNumber:46,author:''},null];
 assert.deepEqual(approvedL2Projects(projects).map(p=>p.issueNumber),[42,41]);
 assert.deepEqual(approvedL2Projects(null),[]);
});
test('social forms reject unrelated sites, profiles, credentials and wrong video types',()=>{
 assert(validPostUrl('https://www.reddit.com/r/mesh/comments/abc123/my_build/','reddit'));
 assert(validPostUrl('https://www.facebook.com/maker/posts/123','facebook'));
 assert(validPostUrl('https://x.com/maker/status/123','x'));
 assert(validPostUrl('https://www.youtube.com/watch?v=abc-123','youtube'));
 assert(validPostUrl('https://youtube.com/shorts/abc_123','youtube-shorts'));
 for(const url of ['https://x.com/maker','https://x.com.evil.test/maker/status/123','https://user:pass@x.com/maker/status/123','javascript:alert(1)'])assert(!validPostUrl(url,'x'));
 assert(!validPostUrl('https://youtube.com/shorts/abc','youtube'));
 assert.equal(issueNumberFromUrl('https://github.com/hack-embed/seeed-meshtastic-projects/issues/42'),42);
 assert.equal(issueNumberFromUrl('https://github.com/other/repo/issues/42'),null);
 assert.equal(issueNumberFromUrl('https://github.com.evil.test/hack-embed/seeed-meshtastic-projects/issues/42'),null);
 const draft=issueDraft('Test',{'Public Link':'https://x.com/maker/status/123'});assert.equal(new URL(draft.url).searchParams.get('title'),'Test');
});
