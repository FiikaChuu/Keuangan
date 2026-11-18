import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const base = process.env.QA_BASE_URL || 'http://localhost:5184';
const dir = 'artifacts/update-awareness'; fs.mkdirSync(dir, {recursive:true});
const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || process.env.HOME+'/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'});
const results=[];
for (const width of [375,440,1440]) {
 const context=await browser.newContext({viewport:{width,height:956},serviceWorkers:'block'});
 const page=await context.newPage();
 let mode='same', requests=0, navigations=0;
 const actual=await (await fetch(base+'/api/version')).json();
 await context.route('**/api/version', route=>{
   requests++;
   return mode==='offline'?route.abort():route.fulfill({json:{build:mode==='same'?actual.build:'abcdef1234567890abcdef1234567890abcdef12'}});
 });
 await page.goto(base+'/settings'); await page.waitForLoadState('networkidle');
 const notice=page.getByRole('complementary',{name:'Pembaruan aplikasi'});
 await expect(notice).toHaveCount(0);
 await expect(page.locator('.settings-version')).toContainText(actual.build.slice(0,12));
 const before=await page.evaluate(()=>localStorage.getItem('skysave.v1'));
 mode='offline'; await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForTimeout(250); await expect(notice).toHaveCount(0);
 mode='different'; await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(notice).toBeVisible();
 page.on('framenavigated',()=>navigations++);
 await page.waitForTimeout(500); expect(navigations).toBe(0);
 await page.screenshot({path:`${dir}/${width}-notice.png`,fullPage:true});
 // Real non-modal dirty planning form survives cancelling refresh.
 await page.goto(base+'/rencana-uang'); await page.waitForLoadState('networkidle');
 await page.locator('#reserve').fill('123456');
 page.once('dialog',async dialog=>{expect(dialog.message()).toContain('belum disimpan akan hilang');await dialog.dismiss();});
 await notice.getByRole('button',{name:'Muat ulang'}).click();
 await expect(page.locator('#reserve')).toHaveValue('123456');
 expect(await page.evaluate(()=>localStorage.getItem('skysave.v1'))).toBe(before);
 // Confirming refresh is explicit, and same build after navigation hides notice.
 mode='same'; page.once('dialog',dialog=>dialog.accept());
 await Promise.all([page.waitForEvent('load'),notice.getByRole('button',{name:'Muat ulang'}).click()]);
 await page.waitForLoadState('networkidle'); await expect(notice).toHaveCount(0);
 expect(await page.evaluate(()=>localStorage.getItem('skysave.v1'))).toBe(before);
 results.push({width,requests,sameBuildSilent:true,offlineSilent:true,noAutoReload:true,dirtyCancelPreserved:true,explicitRefresh:true,ledgerUnchanged:true});
 await context.close();
}
fs.writeFileSync(`${dir}/results.json`,JSON.stringify(results,null,2));console.log(results);await browser.close();
