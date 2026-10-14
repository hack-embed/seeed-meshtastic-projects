import { test,expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const approvedProject={id:'community-42',title:'L2 pocket game',author:'A Maker',categories:['APP'],products:['Wio Tracker L2 Pro'],image:'https://example.com/l2-cover.png',imageAlt:'A game running on the L2 screen.',activity:'l2-pro',addedAt:'2026-10-14',issueNumber:42};
const mockApproved=page=>page.route('**/data/projects.json',route=>route.fulfill({json:[
 approvedProject,{...approvedProject,id:'seeded-example',issueNumber:undefined},
 {...approvedProject,id:'other-activity',activity:null,issueNumber:43},
 {...approvedProject,id:'other-device',products:['T1000-E'],issueNumber:44},
]}));

test('L2 project modal preserves drafts and clears back to activity defaults',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/l2.html');
 await expect(page.locator('#project-submission')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Build with Wio Tracker L2 Pro'})).toBeVisible();
 await expect(page.locator('[data-purchase]').first()).toBeDisabled();
 await page.locator('[data-open-project]').first().click();await expect(page.locator('#l2-submit-dialog')).toBeVisible();
 await expect(page.locator('[name=hardware][value="Wio Tracker L2 Pro"]')).toBeChecked();
 await expect(page.locator('#related-activity')).toHaveValue('l2-pro');await expect(page.locator('#social-field')).toBeVisible();
 await page.locator('[name=title]').fill('Keep my draft');await page.keyboard.press('Escape');
 await page.locator('[data-open-project]').first().click();await expect(page.locator('[name=title]')).toHaveValue('Keep my draft');
 await page.locator('[name=categories][value="APP"]').check();
 await page.locator('[name=hardware][value="T1000-E"]').check();
 await page.locator('#repository-url').fill('https://github.com/example/project');
 await page.getByRole('button',{name:'Clear form',exact:true}).click();
 await expect(page.locator('[name=title]')).toHaveValue('');await expect(page.locator('#repository-url')).toHaveValue('');
 await expect(page.locator('[name=categories]:checked')).toHaveCount(0);
 await expect(page.locator('[name=hardware]:checked')).toHaveCount(1);
 await expect(page.locator('[name=hardware][value="Wio Tracker L2 Pro"]')).toBeChecked();
 await expect(page.locator('#related-activity')).toHaveValue('l2-pro');
 await page.keyboard.press('Escape');await page.locator('summary').first().click();await expect(page.locator('details').first()).toHaveAttribute('open','');
 expect(errors).toEqual([]);
});

test('local photo selection includes a caption and an explicit GitHub attachment step',async({page})=>{
 await page.goto('/l2.html');await page.locator('[data-open-project]').first().click();
 await page.locator('[name=title]').fill('Photo upload test');await page.locator('[name=author]').fill('A Maker');
 await page.locator('[name=description]').fill('A working L2 project shown with an original photo for the community.');
 await page.getByRole('radio',{name:'Upload a photo',exact:true}).check();
 await expect(page.locator('#cover-url-field')).toBeHidden();await expect(page.locator('[name=image]')).toBeDisabled();
 await page.locator('#project-photo').setInputFiles(fileURLToPath(new URL('../docs/assets/l2-pro.webp',import.meta.url)));
 await expect(page.locator('#photo-preview')).toBeVisible();await expect(page.locator('#photo-status')).toContainText('Attach it on GitHub');
 await page.locator('[name="image-description"]').fill('My working L2 Pro with its screen switched on.');
 await page.locator('[name=categories][value="Hardware"]').check();
 await page.locator('[name=resources]').fill('https://example.com/project');await page.locator('[name=consent]').check();
 await page.locator('#prepare-project').click();await expect(page.locator('#submission-ready')).toBeVisible();
 await expect(page.locator('#photo-handoff')).toContainText('still needs to be uploaded');
 await expect(page.getByRole('button',{name:'Copy photo',exact:true})).toBeVisible();
 const draft=new URL(await page.locator('#github-submit').getAttribute('href')), body=draft.searchParams.get('body');
 expect(body).toContain('[ATTACH YOUR PHOTO HERE');expect(body).toContain('### Cover Image Description\n\nMy working L2 Pro with its screen switched on.');
 expect(body).not.toContain('blob:');expect(body).not.toContain('data:image');
 await page.getByRole('button',{name:'Clear form',exact:true}).click();
 await expect(page.locator('#photo-preview')).toBeHidden();await expect(page.locator('#submission-ready')).toBeHidden();
 await expect(page.locator('#project-photo')).toHaveValue('');await expect(page.locator('[name="image-description"]')).toHaveValue('');
 await expect(page.getByRole('radio',{name:'Image link',exact:true})).toBeChecked();
 await expect(page.locator('[name=image]')).toBeEnabled();await expect(page.locator('[name=image]')).toHaveAttribute('required','');
});

test('social form selects approved projects, requires private email, and removes metric entry',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await mockApproved(page);
 await page.goto('/l2.html#submit-social');await expect(page.locator('#share-dialog')).toBeVisible();
 await expect(page.locator('#share-project option')).toHaveCount(2);
 await expect(page.locator('#share-project option[value="42"]')).toHaveText('L2 pocket game — A Maker (#42)');
 await expect(page.locator('#share-form [name=count]')).toHaveCount(0);await expect(page.locator('#share-threshold')).toHaveCount(0);
 await expect(page.locator('#share-form [name=email]')).toHaveAttribute('required','');
 await page.locator('#share-project').selectOption('42');await page.locator('#share-platform').selectOption('x');
 await page.locator('#share-form [name=post]').fill('https://x.com/maker/status/123456');
 await page.locator('#share-form [name=consent]').check();await page.locator('#prepare-share').click();
 await expect(page.locator('#share-ready')).toBeHidden();
 expect(await page.locator('#share-form [name=email]').evaluate(el=>el.validity.valueMissing)).toBe(true);
 await page.locator('#share-form [name=email]').fill('private@example.com');
 await page.locator('#share-form [name=post]').fill('https://x.com.evil.test/maker/status/123456');
 await page.locator('#prepare-share').click();await expect(page.locator('#share-error')).toContainText('selected platform');
 await page.locator('#share-form [name=post]').fill('https://x.com/maker/status/123456');await page.locator('#prepare-share').click();
 await expect(page.locator('#share-ready')).toBeVisible();
 const draft=new URL(await page.locator('#share-github').getAttribute('href')),body=draft.searchParams.get('body');
 expect(body).toContain('https://github.com/hack-embed/seeed-meshtastic-projects/issues/42');
 expect(body).toContain('https://x.com/maker/status/123456');expect(body).not.toContain('Reported Metric Count');expect(draft.href).not.toContain('private');
 expect(await page.locator('#share-private-email').getAttribute('href')).toContain('private%40example.com');
 await page.locator('#share-form [name=post]').fill('https://x.com/maker/status/999');await expect(page.locator('#share-ready')).toBeHidden();
 expect(errors).toEqual([]);
});

test('social form handles empty and unavailable catalogs without free-form project URLs',async({page})=>{
 let status='failed';
 await page.route('**/data/projects.json',route=>status==='failed' ? route.fulfill({status:503,body:'unavailable'}) : route.fulfill({json:status==='empty' ? [] : [approvedProject]}));
 await page.goto('/l2.html#submit-social');await expect(page.locator('#share-project-status')).toContainText('could not load');
 await expect(page.locator('#prepare-share')).toBeDisabled();await expect(page.locator('#share-project')).toBeDisabled();
 status='empty';await page.getByRole('button',{name:'Reload projects',exact:true}).click();
 await expect(page.locator('#share-project-status')).toContainText('No approved L2 projects');
 await expect(page.locator('#share-form input[name=project]')).toHaveCount(0);
 await page.locator('#share-project-status').getByRole('button',{name:'Submit a Project',exact:true}).click();
 await expect(page.locator('#share-dialog')).toBeHidden();await expect(page.locator('#l2-submit-dialog')).toBeVisible();
 await expect(page.locator('#related-activity')).toHaveValue('l2-pro');
 status='approved';await page.reload();await expect(page.locator('#share-project')).toBeEnabled();
 await expect(page.locator('#share-project option[value="42"]')).toBeAttached();
});

test('social drafts that exceed URL limits offer a copy handoff',async({page})=>{
 await mockApproved(page);await page.goto('/l2.html#submit-social');
 await page.locator('#share-project').selectOption('42');await page.locator('#share-platform').selectOption('x');
 await page.locator('#share-form [name=post]').fill('https://x.com/maker/status/123?description='+'界'.repeat(1000));
 await page.locator('#share-form [name=email]').fill('private@example.com');await page.locator('#share-form [name=consent]').check();await page.locator('#prepare-share').click();
 await expect(page.locator('#share-ready')).toBeVisible();await expect(page.locator('#share-copy')).toBeVisible();
 await expect(page.locator('#share-ready-help')).toContainText('too long to prefill');
 expect(new URL(await page.locator('#share-github').getAttribute('href')).searchParams.has('body')).toBe(false);
});

test('L2 responsive layout and reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1050});await page.goto('/l2.html');
  await expect(page.locator('.steps li')).toHaveCount(3);await expect(page.locator('.milestones tbody tr')).toHaveCount(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect(await page.locator('body').innerText()).not.toMatch(/[\u3400-\u9fff]/);
  await page.screenshot({path:`test-results/l2-${width}.png`,fullPage:true});
 }
});

test('Hub activity link expands the inline submission and repository import keeps user edits',async({page})=>{
 await page.goto('/#projects');await expect(page.locator('#home .campaign-banner a[href="./l2.html"]')).toHaveCount(1);
 await page.goto('/?activity=l2-pro#submit');
 await expect(page.locator('section#submit > details#project-submission')).toHaveAttribute('open','');
 await expect(page.locator('#submit #project-form')).toBeVisible();await expect(page.locator('#submit-dialog')).toHaveCount(0);
 await expect(page.locator('#related-activity')).toHaveValue('l2-pro');
 await page.route('https://api.github.com/repos/example/build',route=>route.fulfill({json:{name:'Repo build',description:'A useful imported project description for L2 Pro.',owner:{login:'example'},license:{spdx_id:'MIT'}}}));
 await page.route('https://api.github.com/repos/example/build/readme',route=>route.fulfill({body:'# Repo build\n\n![Photo](https://example.com/photo.jpg)\n\n## Installation\n\n1. Flash the firmware.\n2. Pair the Wio Tracker L2 Pro.\n'}));
 await page.locator('[name=title]').fill('My edited title');await page.locator('#repository-url').fill('https://github.com/example/build');await page.locator('#import-repo').click();
 await expect(page.locator('#repo-import-status')).toContainText('MIT');await expect(page.locator('[name=title]')).toHaveValue('My edited title');await expect(page.locator('textarea[name=description]')).toHaveValue(/imported/);
 await expect(page.locator('[name=image]')).toHaveValue('https://example.com/photo.jpg');await expect(page.locator('textarea[name=setup]')).toHaveValue('Flash the firmware.\nPair the Wio Tracker L2 Pro.');await expect(page.locator('[name=author]')).toHaveValue('example');
});

test('idea cards show only L2 Pro examples, use photo descriptions, and invite new builds',async({page})=>{
 await page.route('**/data/projects.json',route=>route.fulfill({json:[
  {...approvedProject,id:'case-a',title:'L2 Case',categories:['3D Prints & Enclosures'],image:'https://example.com/a.png',imageAlt:'An L2 case on a workbench.',addedAt:'2026-01-01'},
  {id:'case-b',title:'Newer L1 Case',categories:['3D Prints & Enclosures','Firmware'],image:'https://example.com/b.png',activity:null,addedAt:'2026-06-01'},
  {id:'unsafe',title:'Unsafe',categories:['APP'],image:'javascript:alert(1)',activity:null,addedAt:'2026-07-01'},
 ]}));
 await page.goto('/l2.html#ideas');
 const card=name=>page.locator(`[data-idea="${name}"] .idea-example`);
 await expect(card('3D Prints & Enclosures')).toContainText('L2 Case');await expect(card('3D Prints & Enclosures')).toHaveAttribute('href','./?project=case-a#projects');
 await expect(card('3D Prints & Enclosures').locator('img')).toHaveAttribute('alt','An L2 case on a workbench.');
 await expect(card('Firmware')).toContainText('first example');await expect(page.locator('.idea-example',{hasText:'L1 Case'})).toHaveCount(0);
 await expect(card('APP')).toContainText('first example');await expect(page.locator('[data-idea="APP"] img')).toHaveCount(0);
 await card('Others').click();await expect(page.locator('#l2-submit-dialog')).toBeVisible();
 await expect(page.locator('#community-demos img')).toHaveCount(2);
});
