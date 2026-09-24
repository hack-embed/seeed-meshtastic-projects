import { test,expect } from '@playwright/test';
test('L2 campaign form, concept controls, rewards and private social submission',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/l2.html');
 await expect(page.getByRole('heading',{name:'Build with Wio Tracker L2 Pro.'})).toBeVisible();
 await expect(page.locator('[data-purchase]').first()).toBeDisabled();
 await page.locator('[data-concept=ui]').click();await expect(page.locator('#concept-preview')).toContainText('Your screen. Your rules.');
 await page.locator('#motion-toggle').click();await expect(page.locator('#motion-toggle')).toHaveAttribute('aria-pressed','true');
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
  await expect(page.locator('#motion-toggle')).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect(await page.locator('body').innerText()).not.toMatch(/[\u3400-\u9fff]/);
  await page.screenshot({path:`test-results/l2-${width}.png`,fullPage:true});
 }
});
test('Hub links to activity and repository import keeps user edits',async({page})=>{
 await page.goto('/#projects');await expect(page.locator('#projects .campaign-banner')).toHaveAttribute('href','./l2.html');
 await page.goto('/?activity=l2-pro#submit');await expect(page.locator('#related-activity')).toHaveValue('l2-pro');
 await page.route('https://api.github.com/repos/example/build',route=>route.fulfill({json:{name:'Repo build',description:'A useful imported project description for L2 Pro.',license:{spdx_id:'MIT'}}}));
 await page.locator('[name=title]').fill('My edited title');await page.locator('#repository-url').fill('https://github.com/example/build');await page.locator('#import-repo').click();
 await expect(page.locator('#repo-import-status')).toContainText('MIT');await expect(page.locator('[name=title]')).toHaveValue('My edited title');await expect(page.locator('textarea[name=description]')).toHaveValue(/imported/);
});
