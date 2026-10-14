import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSubmission, validateCatalog, validateProject, httpsUrl } from '../scripts/catalog.mjs';
import { CATEGORIES, PRODUCTS } from '../docs/config.js';
const fields = {
  'Project Title':'Example Mesh Build', 'Author / Maker':'A Maker',
  'Project Description':'A practical off-grid communication project using Seeed hardware.',
  'Project Cover Image':'https://example.com/cover.jpg',
  'Hardware':'Wio Tracker L1 Pro, XIAO ESP32S3 Kit', 'Category':'Hardware, Integrations',
  'Setup Instructions':'Connect the radio.\nConfigure your region.',
  'Resources & Links':'https://example.com/build\nhttps://github.com/example/project',
  'Related Activity':'No related activity', 'Social Links':'_No response_',
  'Attribution':'- [x] I have credited the original maker and have permission to share this content and its images.',
};
function issue(overrides = {}) { return {number:42,body:Object.entries({...fields,...overrides}).map(([k,v])=>`### ${k}\n\n${v}\n\n`).join('')}; }
test('GitHub form submission preserves multi-select values and optional fields',()=>{
  const p = parseSubmission(issue({'Setup Instructions':'_No response_'}),'2026-09-24');
  assert.equal(p.id,'community-42'); assert.deepEqual(p.products,['Wio Tracker L1 Pro','XIAO ESP32S3 Kit']);
  assert.deepEqual(p.categories,['Hardware','IOT']); assert.deepEqual(p.setup,[]); assert.equal(p.activity,null);
  assert.equal(p.issueNumber,42); assert.equal(p.resources.length,2);
});
test('GitHub image uploads and CRLF submissions are accepted',()=>{
  const item = issue({'Project Cover Image':'![cover](https://github.com/user-attachments/assets/image-id)'});
  item.body = item.body.replace(/\n/g,'\r\n');
  assert.equal(parseSubmission(item).image,'https://github.com/user-attachments/assets/image-id');
});
test('legacy Integration labels map to IOT and X1 submissions preserve image descriptions',()=>{
  const caption='SenseCAP MeshTracker X1 showing the garden sensor dashboard.';
  for(const legacy of ['Integration','Integrations','IOT']) {
    const project=parseSubmission(issue({'Hardware':'SenseCAP MeshTracker X1','Category':`Hardware, ${legacy}`,'Cover Image Description':caption}));
    assert.deepEqual(project.categories,['Hardware','IOT']);
    assert.deepEqual(project.products,['SenseCAP MeshTracker X1']);
    assert.equal(project.imageAlt,caption);
  }
  assert.equal(parseSubmission(issue()).imageAlt,'');
});
test('unuploaded photo placeholders are rejected and malformed caption data cannot enter the catalog',()=>{
  assert.throws(()=>parseSubmission(issue({'Project Cover Image':'[ATTACH YOUR PHOTO HERE — replace this line with the image uploaded on GitHub]'})));
  const project=parseSubmission(issue({'Cover Image Description':'An outdoor node.'}));
  for(const imageAlt of [42,{},'x'.repeat(301)]) assert.throws(()=>validateProject({...project,imageAlt}),/cover image description/);
  assert.equal(parseSubmission(issue({'Cover Image Description':' x '.repeat(150)})).imageAlt.length,300);
});
test('public data never includes reward email; L2 social links are exported only for L2',()=>{
  let p = parseSubmission(issue({'Email':'private@example.com','Social Links':'https://example.com/social'}));
  assert.equal('email' in p,false); assert.equal(JSON.stringify(p).includes('private@example.com'),false); assert.deepEqual(p.socialLinks,[]);
  p = parseSubmission(issue({'Related Activity':'Build With Wio Tracker L2 Pro','Social Links':'https://example.com/social'}));
  assert.deepEqual(p.socialLinks,['https://example.com/social']);
});
test('unsafe links, unknown taxonomy, unchecked consent and duplicate headings are rejected',()=>{
  for (const url of ['javascript:alert(1)','http://example.com','https://user:pass@example.com']) assert.throws(()=>httpsUrl(url));
  for (const override of [{'Hardware':'Unknown board'},{'Category':'Fake category'},{'Attribution':'- [ ] no'},{'Resources & Links':'javascript:alert(1)'},{'Related Activity':'Mystery event'},{'Project Cover Image':'data:image/png;base64,AAAA'}]) assert.throws(()=>parseSubmission(issue(override)));
  const item = issue(); item.body += '### Project Title\n\nInjected title'; assert.throws(()=>parseSubmission(item),/Duplicate heading/);
});
test('catalog rejects duplicate projects and impossible dates',()=>{
  const p = parseSubmission(issue(),'2026-09-24'); assert.throws(()=>validateCatalog([p,p]),/Duplicate ID/);
  assert.throws(()=>parseSubmission(issue(),'2026-02-30'),/Invalid catalog date/);
});
test('GitHub and website taxonomies remain identical',async()=>{
  const template = JSON.parse(await readFile(new URL('../.github/ISSUE_TEMPLATE/project.yml',import.meta.url),'utf8'));
  assert.deepEqual(template.body.find(f=>f.id==='hardware').attributes.options,PRODUCTS);
  assert.deepEqual(template.body.find(f=>f.id==='category').attributes.options,CATEGORIES);
});
