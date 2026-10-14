import { test, expect } from '@playwright/test';
test('catalog filtering, local hearts, sorting, deep links and history',async({page})=>{
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/#projects'); await expect(page.locator('.project-card')).toHaveCount(15);
  await page.getByRole('button',{name:'Firmware',exact:true}).click(); await expect(page.locator('.project-card')).toHaveCount(1);
  await page.locator('[data-device="Wio Tracker L2 Pro"]').click(); await expect(page.locator('#empty')).toBeVisible();
  await page.getByRole('button',{name:'Clear filters'}).click();
  await page.locator('#search').fill('skysense'); await expect(page.locator('.project-card')).toHaveCount(1);
  await page.getByRole('button',{name:'View Project ↗',exact:true}).click(); await expect(page.getByRole('dialog')).toBeVisible();
  for (const name of ['Project Description','Products Used','Setup Instructions','Resources & Links','Related Activity']) await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  await page.locator('#detail-like').click(); await expect(page.locator('#detail-like')).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeHidden(); await expect(page).not.toHaveURL(/project=/); await page.locator('#search').fill(''); await page.locator('[data-sort=likes]').click();
  await expect(page.locator('.project-card').first()).toContainText('SkySense');
  await page.reload(); await expect(page.locator('.project-card').first()).toContainText('SkySense');
  await page.locator('.project-card').first().getByRole('button',{name:'View Project ↗',exact:true}).click();
  const shared = page.url(); await page.reload(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('#detail-like').click(); await expect(page.locator('#detail-like')).toHaveAttribute('aria-pressed','false');
  await page.keyboard.press('Escape'); await page.goBack();
  expect(errors).toEqual([]); expect(shared).toContain('project=skysense');
});
test('submission validates selections, hides email, includes only L2 social links',async({page})=>{
  await page.goto('/#submit');
  await page.locator('[name=title]').fill('Test build'); await page.locator('[name=author]').fill('Maker');
  await page.locator('textarea[name=description]').fill('This is a community test build using a Seeed radio and a printed enclosure.');
  await page.locator('[name=image]').fill('https://example.com/image.jpg'); await page.locator('[name=resources]').fill('https://example.com/build');
  await page.locator('[name=email]').fill('private@example.com'); await page.locator('[name=consent]').check();
  await page.getByRole('button',{name:'Continue with GitHub'}).click(); await expect(page.locator('#form-error')).toContainText('Select at least');
  await page.getByRole('checkbox',{name:'Wio Tracker L1 Pro',exact:true}).check(); await page.getByRole('checkbox',{name:'Hardware',exact:true}).check();
  await expect(page.locator('#social-field')).toBeHidden(); await page.locator('#related-activity').selectOption('l2-pro'); await expect(page.locator('#social-field')).toBeVisible();
  await page.locator('[name=social]').fill('https://example.com/social');
  await page.getByRole('button',{name:'Continue with GitHub'}).click(); await expect(page.locator('#submission-ready')).toBeVisible();
  let href=await page.locator('#github-submit').getAttribute('href'); let body=new URL(href).searchParams.get('body');
  expect(body).toContain('https://example.com/social'); expect(body).not.toContain('private@example.com');
  expect(await page.locator('#private-email').getAttribute('href')).toContain('private%40example.com');
  await page.locator('#related-activity').selectOption(''); await page.getByRole('button',{name:'Continue with GitHub'}).click();
  href=await page.locator('#github-submit').getAttribute('href'); body=new URL(href).searchParams.get('body'); expect(body).not.toContain('https://example.com/social');
});
test('failed catalog fetch can be retried and hostile descriptions remain plain text',async({page})=>{
  let fail=true;
  await page.route('**/data/projects.json',async route=>{if(fail) await route.fulfill({status:503,body:'unavailable'}); else { const response=await route.fetch(); const data=await response.json(); data[0].title='<img src=x onerror=alert(1)>'; await route.fulfill({json:data}); }});
  await page.goto('/#projects'); await expect(page.locator('#load-error')).toBeVisible(); fail=false; await page.locator('#retry').click();
  await expect(page.locator('.project-card')).toHaveCount(15); await expect(page.locator('.card-title').first()).toHaveText('<img src=x onerror=alert(1)>'); await expect(page.locator('.card-title img')).toHaveCount(0);
});
test('desktop and mobile pages remain English and fit the viewport',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:1050});
    for (const route of ['home','projects','activities','submit','contact']) {
      await page.goto(`/#${route}`); if(route==='projects') await expect(page.locator('.project-card')).toHaveCount(15);
      const metrics=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,text:document.body.innerText}));
      expect(metrics.scroll,`${route} at ${width}px`).toBeLessThanOrEqual(metrics.width); expect(metrics.text).not.toMatch(/[\u3400-\u9fff]/);
      await page.screenshot({path:`test-results/${route}-${width}.png`,fullPage:true});
    }
    if(width===390){await page.locator('#menu-toggle').click();await expect(page.locator('#main-nav')).toBeVisible();await page.locator('#main-nav a[href="#projects"]').click();await expect(page.locator('#main-nav')).toBeHidden();}
  }
  expect(errors).toEqual([]);
});

test('Hub contribution opens a modal, keeps drafts, and supports submission deep links', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('.project-card')).toHaveCount(15);
  await expect(page.locator('#submit-dialog')).toBeHidden();
  await expect(page.locator('#main-nav a[href="#submit"]')).toHaveCount(0);
  for (const id of ['home', 'projects', 'activities', 'contact']) await expect(page.locator(`#${id}`)).toBeVisible();
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.campaign-banner')).toHaveCount(1);
  await page.getByRole('button', {name:'Contribute a project',exact:true}).click();
  await expect(page.locator('#submit-dialog')).toBeVisible();
  await page.locator('[name=title]').fill('Keep this modal draft');
  await page.keyboard.press('Escape');
  await expect(page.locator('#submit-dialog')).toBeHidden();
  await page.getByRole('button', {name:'Contribute a project',exact:true}).click();
  await expect(page.locator('[name=title]')).toHaveValue('Keep this modal draft');
  await page.getByRole('button', {name:'Clear form',exact:true}).click();
  await expect(page.locator('[name=title]')).toHaveValue('');
  await expect(page.locator('#related-activity')).toHaveValue('');
  await expect(page.locator('[name=hardware]:checked')).toHaveCount(0);
  await expect(page.locator('#form-message')).toContainText('Form cleared');

  // A direct form link must work even while the project catalog is loading.
  await page.route('**/data/projects.json', async route => {
    const response = await route.fetch();
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({response});
  });
  await page.goto('/?activity=l2-pro#submit');
  await expect(page.locator('#submit-dialog')).toBeVisible();
  await expect(page.locator('#related-activity')).toHaveValue('l2-pro');
  await expect(page.locator('[name=hardware][value="Wio Tracker L2 Pro"]')).toBeChecked();
  await page.locator('[name=title]').fill('Keep this activity draft');
  await page.getByRole('button', {name:'Close project submission'}).click();
  await expect(page.locator('#submit-dialog')).toBeHidden();
  await expect(page).toHaveURL(/#projects$/);
  await page.getByRole('button', {name:'Contribute a project',exact:true}).click();
  await expect(page.locator('[name=title]')).toHaveValue('Keep this activity draft');
});

test('submission hash navigation closes the modal when going Back', async ({page}) => {
  await page.goto('/#projects');
  await page.evaluate(() => { location.hash = 'submit'; });
  await expect(page.locator('#submit-dialog')).toBeVisible();
  await page.locator('[name=title]').fill('Keep history draft');
  await page.goBack();
  await expect(page).toHaveURL(/#projects$/);
  await expect(page.locator('#submit-dialog')).toBeHidden();
  await page.goForward();
  await expect(page.locator('#submit-dialog')).toBeVisible();
  await expect(page.locator('[name=title]')).toHaveValue('Keep history draft');
});
