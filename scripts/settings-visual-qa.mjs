import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const phase = process.argv[2] || 'after';
const dir = `artifacts/settings-${phase}`;
fs.mkdirSync(dir,{recursive:true});
const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || process.env.HOME+'/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'});
const results=[];
for(const [width,height] of [[375,619],[440,956],[1440,1000]]) {
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
 const errors=[],mutations=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{ if(!['GET','HEAD','OPTIONS'].includes(r.method())) mutations.push(r.method()+' '+r.url()); });
 await page.goto('http://localhost:5182/settings'); await page.waitForLoadState('networkidle');
 await expect(page.getByRole('heading',{name:'Pengaturan',exact:true})).toBeVisible();
 // Exclude the development-only Next indicator from visual evidence.
 await page.addStyleTag({content:'nextjs-portal { display:none !important; }'});
 await page.screenshot({path:`${dir}/${width}-top.png`});
 await page.screenshot({path:`${dir}/${width}-full.png`,fullPage:true});
 const geometry=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,viewportWidth:visualViewport.width,rows:[...document.querySelectorAll('.settings-action')].map(e=>({width:e.clientWidth,textWidth:e.querySelector('span')?.clientWidth}))}));
 expect(geometry.scrollWidth).toBeLessThanOrEqual(width);
 expect(geometry.viewportWidth).toBe(width);
 if(width<900) await expect(page.locator('.capture-button')).toBeHidden();
 const sw=page.getByRole('switch',{name:'Rencana dana pribadi'});
 const previous=await sw.getAttribute('aria-checked');
 await sw.click(); await expect(sw).toHaveAttribute('aria-checked',String(previous!=='true'));
 await page.reload(); await page.waitForLoadState('networkidle');
 await page.addStyleTag({content:'nextjs-portal { display:none !important; }'});
 await expect(sw).toHaveAttribute('aria-checked',String(previous!=='true'));
 await sw.click();
 const ledger=await page.evaluate(()=>localStorage.getItem('skysave.v1'));
 for(const [name,title,kind] of [['Tentang reset data','Reset data pribadi','reset'],['Tentang hapus akun','Hapus akun permanen','delete']]) {
   await page.getByRole('button',{name,exact:true}).click();
   const dialog=page.getByRole('dialog',{name:title,exact:true});
   await expect(dialog).toBeVisible();
   await expect(dialog.getByRole('status')).toContainText('Belum diaktifkan');
   await expect(dialog.locator('input')).toHaveCount(0);
   await dialog.locator('form').evaluate(f=>f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
   await page.screenshot({path:`${dir}/${width}-${kind}.png`});
   await dialog.getByRole('button',{name:'Tutup',exact:true}).click();
   await expect(dialog).toBeHidden();
 }
 await page.locator('.settings-account').scrollIntoViewIfNeeded();
 await page.screenshot({path:`${dir}/${width}-account.png`});
 await page.getByRole('button',{name:/^Unduh cadangan/}).scrollIntoViewIfNeeded();
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/^Unduh cadangan/}).click()]);
 expect(download.suggestedFilename()).toMatch(/skywallet-cadangan.*json/);
 await page.locator('input[type=file]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});
 await expect(page.locator('.settings-content [role=alert]')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('skysave.v1'))).toBe(ledger);
 expect(errors).toEqual([]); expect(mutations).toEqual([]);
 results.push({width,height,geometry,errors,mutations,preferencePersistence:true,dialogsGuarded:true,backupDownloaded:download.suggestedFilename(),invalidImportRejected:true,ledgerUnchanged:true});
 await page.close();
}
fs.writeFileSync(`${dir}/results.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
await browser.close();
