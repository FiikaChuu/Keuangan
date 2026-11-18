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
 page.on('request',r=>{ if(!['GET','HEAD','OPTIONS'].includes(r.method()) && !r.url().startsWith('https://settings-fixture.invalid/')) mutations.push(r.method()+' '+r.url()); });
 if (process.env.QA_REMOTE_FIXTURE === 'true') {
   // A synthetic session and intercepted RPCs only; never contact a service.
   const user={id:'00000000-0000-4000-8000-000000000001',email:'settings@example.invalid',role:'authenticated',aud:'authenticated',app_metadata:{},user_metadata:{}};
   const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
   const token=`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})}.fixture`;
   await page.route('https://settings-fixture.invalid/**',route=>{
     const path=new URL(route.request().url()).pathname;
     let body=null;
     if(path==='/auth/v1/token') body={access_token:token,refresh_token:'fixture',expires_in:3600,token_type:'bearer',user};
     else if(path==='/auth/v1/user') body=user;
     else if(path.endsWith('/rpc/finance_snapshot')) body={allowed:true,revision:'1',wallets:[],transactions:[],goals:[],plan:{reserve:0,saving:50,fun:30,together:20,version:1}};
     else if(path.endsWith('/rpc/finance_revision')) body={allowed:true,revision:'1'};
     else if(!path.endsWith('/rpc/bootstrap_finance')) throw Error('Unexpected fixture request '+path);
     return route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
   });
   await page.goto((process.env.QA_BASE_URL || 'http://localhost:5182') + '/settings');
   await page.getByLabel('Email',{exact:true}).fill(user.email);
   await page.getByLabel('Kata sandi',{exact:true}).fill('synthetic-fixture-only');
   await page.getByRole('button',{name:'Masuk',exact:true}).click();
   // Auth and read-only RPC POSTs are fixture setup, not financial mutations.
   mutations.length=0;
 } else await page.goto((process.env.QA_BASE_URL || 'http://localhost:5182') + '/settings');
 await page.waitForLoadState('networkidle');
 await expect(page.getByRole('heading',{name:'Pengaturan',exact:true})).toBeVisible();
 // Exclude the development-only Next indicator from visual evidence.
 await page.addStyleTag({content:'nextjs-portal { display:none !important; }'});
 await page.screenshot({path:`${dir}/${width}-top.png`});
 await page.screenshot({path:`${dir}/${width}-full.png`,fullPage:true});
 const geometry=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,viewportWidth:visualViewport.width,rows:[...document.querySelectorAll('.settings-action')].map(e=>({width:e.clientWidth,label:e.querySelector(':scope > span:not(.mesh-icon) strong')?.textContent,textWidth:e.querySelector(':scope > span:not(.mesh-icon)')?.getBoundingClientRect().width,icons:[...e.querySelectorAll(':scope > .mesh-icon, :scope > span[aria-hidden=true]')].map(i=>i.getBoundingClientRect().width)}))}));
 expect(geometry.rows).toHaveLength(5);
 for (const row of geometry.rows) {
   expect(row.label).toBeTruthy();
   expect(row.textWidth).toBeGreaterThanOrEqual(row.width * .65);
   expect(row.icons).toHaveLength(row.label.startsWith('Tentang ') ? 1 : 2);
   for (const icon of row.icons) expect(icon).toBeLessThanOrEqual(19);
 }
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
