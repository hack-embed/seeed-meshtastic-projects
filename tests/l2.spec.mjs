import { test,expect } from '@playwright/test';
test('L2 campaign form, rewards and private social submission',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/l2.html');
 await expect(page.getByRole('heading',{name:'Build with Wio Tracker L2 Pro'})).toBeVisible();
 await expect(page.locator('[data-purchase]').first()).toBeDisabled();
 await page.locator('[data-open-project]').first().click();await expect(page.locator('#l2-submit-dialog')).toBeVisible();
 await expect(page.locator('[name=hardware][value="Wio Tracker L2 Pro"]')).toBeChecked();
 await expect(page.locator('#related-activity')).toHaveValue('l2-pro');await expect(page.locator('#social-field')).toBeVisible();
 await page.locator('[name=title]').fill('Keep my draft');await page.keyboard.press('Escape');
 await page.locator('[data-open-project]').first().click();await expect(page.locator('[name=title]')).toHaveValue('Keep my draft');await page.keyboard.press('Escape');
 await page.locator('[data-open-share]').first().click();
 await page.locator('#share-form [name=project]').fill('https://github.com/hack-embed/seeed-meshtastic-projects/issues/42');
 await page.locator('#share-platform').selectOption('x');await page.locator('#share-form [name=post]').fill('https://x.com/maker/status/123456');
 await page.locator('#share-form [name=count]').fill('29');await page.locator('#share-form [name=consent]').check();
 await page.locator('#share-form button[type=submit]').click();await expect(page.locator('#share-error')).toContainText('at least 30');
 await page.locator('#share-form [name=count]').fill('30');await page.locator('#share-form [name=email]').fill('private@example.com');
 await page.locator('#share-form button[type=submit]').click();await expect(page.locator('#share-ready')).toBeVisible();
 const draft=new URL(await page.locator('#share-github').getAttribute('href'));expect(draft.searchParams.get('body')).toContain('https://x.com/maker/status/123456');expect(draft.href).not.toContain('private');
 expect(await page.locator('#share-private-email').getAttribute('href')).toContain('private%40example.com');
 await page.keyboard.press('Escape');await page.locator('summary').first().click();await expect(page.locator('details').first()).toHaveAttribute('open','');
 expect(errors).toEqual([]);
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
test('Hub links to activity and repository import keeps user edits',async({page})=>{
 await page.goto('/#projects');await expect(page.locator('#home .campaign-banner')).toHaveAttribute('href','./l2.html');
 await page.goto('/?activity=l2-pro#submit');await expect(page.locator('#related-activity')).toHaveValue('l2-pro');
 await page.route('https://api.github.com/repos/example/build',route=>route.fulfill({json:{name:'Repo build',description:'A useful imported project description for L2 Pro.',owner:{login:'example'},license:{spdx_id:'MIT'}}}));
 await page.route('https://api.github.com/repos/example/build/readme',route=>route.fulfill({body:'# Repo build\n\n![Photo](https://example.com/photo.jpg)\n\n## Installation\n\n1. Flash the firmware.\n2. Pair the Wio Tracker L2 Pro.\n'}));
 await page.locator('[name=title]').fill('My edited title');await page.locator('#repository-url').fill('https://github.com/example/build');await page.locator('#import-repo').click();
 await expect(page.locator('#repo-import-status')).toContainText('MIT');await expect(page.locator('[name=title]')).toHaveValue('My edited title');await expect(page.locator('textarea[name=description]')).toHaveValue(/imported/);
 await expect(page.locator('[name=image]')).toHaveValue('https://example.com/photo.jpg');await expect(page.locator('textarea[name=setup]')).toHaveValue('Flash the firmware.\nPair the Wio Tracker L2 Pro.');await expect(page.locator('[name=author]')).toHaveValue('example');
});
test('idea cards show catalog examples and invite the first build where none exist',async({page})=>{
 await page.route('**/data/projects.json',route=>route.fulfill({json:[
  {id:'case-a',title:'L2 Case',categories:['3D Prints & Enclosures'],image:'https://example.com/a.png',activity:'l2-pro',addedAt:'2026-01-01'},
  {id:'case-b',title:'Newer Case',categories:['3D Prints & Enclosures','Firmware'],image:'https://example.com/b.png',activity:null,addedAt:'2026-06-01'},
  {id:'unsafe',title:'Unsafe',categories:['APP'],image:'javascript:alert(1)',activity:null,addedAt:'2026-07-01'},
 ]}));
 await page.goto('/l2.html#ideas');
 const card=name=>page.locator(`[data-idea="${name}"] .idea-example`);
 await expect(card('3D Prints & Enclosures')).toContainText('L2 Case');await expect(card('3D Prints & Enclosures')).toHaveAttribute('href','./?project=case-a#projects');
 await expect(card('Firmware')).toContainText('Newer Case');
 await expect(card('APP')).toContainText('first example');await expect(page.locator('[data-idea="APP"] img')).toHaveCount(0);
 await card('Others').click();await expect(page.locator('#l2-submit-dialog')).toBeVisible();
 await expect(page.locator('#community-demos img')).toHaveCount(2);
});
