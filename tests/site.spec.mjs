import { test, expect } from '@playwright/test';
test('catalog filtering, local hearts, sorting, deep links and history',async({page})=>{
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/#projects'); await expect(page.locator('.project-card')).toHaveCount(15);
  await page.getByRole('button',{name:'Firmware',exact:true}).click(); await expect(page.locator('.project-card')).toHaveCount(1);
  await page.locator('#device').selectOption('Wio Tracker L2 Pro'); await expect(page.locator('#empty')).toBeVisible();
  await page.getByRole('button',{name:'Clear filters'}).click();
  await page.locator('#search').fill('skysense'); await expect(page.locator('.project-card')).toHaveCount(1);
  await page.getByRole('button',{name:'View Project ↗',exact:true}).click(); await expect(page.getByRole('dialog')).toBeVisible();
  for (const name of ['Project Description','Products Used','Setup Instructions','Resources & Links','Related Activity']) await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  await page.locator('#detail-like').click(); await expect(page.locator('#detail-like')).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeHidden(); await expect(page).not.toHaveURL(/project=/); await page.locator('#search').fill(''); await page.locator('#sort').selectOption('likes');
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

test('Hub sections and submission form stay inline, with anchors and draft preservation', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('.project-card')).toHaveCount(15);
  await expect(page.locator('#project-form')).toBeVisible();
  const ids = ['home', 'projects', 'activities', 'submit', 'contact'];
  for (const id of ids) await expect(page.locator(`#${id}`)).toBeVisible();
  const positions = await page.evaluate(ids => ids.map(id => document.getElementById(id).getBoundingClientRect().top), ids);
  expect(positions).toEqual([...positions].sort((a,b) => a-b));
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.campaign-banner')).toHaveCount(1);
  await page.locator('#main-nav a[href="#submit"]').click();
  await expect.poll(() => page.locator('#submit').evaluate(el => Math.round(el.getBoundingClientRect().top))).toBeGreaterThanOrEqual(70);
  await expect.poll(() => page.locator('#submit').evaluate(el => Math.round(el.getBoundingClientRect().top))).toBeLessThan(150);
  await page.locator('[name=title]').fill('Keep this inline draft');
  await page.locator('#main-nav a[href="#projects"]').click();
  await page.locator('#main-nav a[href="#submit"]').click();
  await expect(page.locator('[name=title]')).toHaveValue('Keep this inline draft');
  await expect(page.locator('#activities')).toBeVisible();

  // A direct form link must land correctly even when the catalog above it arrives late.
  await page.route('**/data/projects.json', async route => {
    const response = await route.fetch();
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({response});
  });
  await page.goto('/?activity=l2-pro#submit');
  await expect(page.locator('.project-card')).toHaveCount(15);
  await expect(page.locator('#related-activity')).toHaveValue('l2-pro');
  await expect.poll(() => page.locator('#submit').evaluate(el => Math.round(el.getBoundingClientRect().top))).toBeGreaterThanOrEqual(70);
  await expect.poll(() => page.locator('#submit').evaluate(el => Math.round(el.getBoundingClientRect().top))).toBeLessThan(150);
});
