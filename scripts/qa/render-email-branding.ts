/** Local email rendering only: intercepts the official logo and aborts every external request. Never imports a sender, database, queue, or credentials. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { brandedEmail } from '../../server/utils/emailLayout';

const fixturePacket = JSON.parse(readFileSync('docs/qa/transactional-email-branding-2026-10-07/fixtures.json','utf8'));
const fixtures = fixturePacket.fixtures as Array<{name:string;subject:string;body:string}>;
const output = 'output/qa/email-branding/latest';
mkdirSync(output,{recursive:true});
const logo = readFileSync('client/public/brand/email-mark.png');
const browser = await chromium.launch({headless:true,...(process.env.EMAIL_QA_CHROMIUM ? {executablePath:process.env.EMAIL_QA_CHROMIUM} : {})});
const proof: unknown[] = [];
try {
  for (const fixture of fixtures) {
    const message = brandedEmail({subject:fixture.subject,text:fixture.body});
    writeFileSync(`${output}/${fixture.name}.html`,message.html);
    writeFileSync(`${output}/${fixture.name}.txt`,message.text);
    for (const mode of ['desktop','mobile','dark','blocked','no-css','long-link']) {
      const width = mode === 'desktop' ? 900 : ['no-css','long-link'].includes(mode) ? 320 : 375;
      const page = await browser.newPage({viewport:{width,height:1000},colorScheme:mode === 'dark' ? 'dark' : 'light'});
      await page.route('**/*', route => route.request().url().endsWith('/brand/email-mark.png') && mode !== 'blocked'
        ? route.fulfill({status:200,contentType:'image/png',body:logo}) : route.abort());
      let html = mode === 'long-link'
        ? brandedEmail({subject:fixture.subject,text:fixture.body.replace('local-preview-token','synthetic_signed_token_'.repeat(24))}).html : message.html;
      if (mode === 'no-css') html = html.replace(/<style>[\s\S]*?<\/style>/,'');
      await page.setContent(html);
      await page.waitForFunction(() => [...document.images].every(image => image.complete));
      const measurements = await page.evaluate(() => {
        const heading = document.querySelector('h1')!;
        const button = document.querySelector('.email-button-link')!;
        return {
          width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
          heading:heading.textContent,buttonHeight:button.getBoundingClientRect().height,
          buttonHref:button.getAttribute('href'),
          fallbackHref:document.querySelector('.email-link')?.getAttribute('href'),
          background:getComputedStyle(document.body).backgroundColor,
          logoLoaded:document.images[0].naturalWidth > 0,
        };
      });
      if (measurements.scrollWidth > width) throw new Error(`Horizontal overflow: ${fixture.name}/${mode}`);
      if (measurements.buttonHeight < 44) throw new Error(`Small touch target: ${fixture.name}/${mode}`);
      if (measurements.buttonHref !== measurements.fallbackHref) throw new Error('Destination changed');
      if (mode === 'blocked' && measurements.logoLoaded) throw new Error('Blocked-image case unexpectedly loaded the logo');
      if (mode !== 'blocked' && !measurements.logoLoaded) throw new Error(`Logo did not load: ${fixture.name}/${mode}`);
      proof.push({fixture:fixture.name,mode,...measurements});
      await page.screenshot({path:`${output}/${fixture.name}-${mode}.png`,fullPage:true});
      await page.close();
    }
  }
} finally {await browser.close();}
writeFileSync(`${output}/browser-proof.json`,JSON.stringify(proof,null,2));
console.log(`Passed ${proof.length} source-backed local renders: desktop, mobile, dark, blocked-image, stripped stylesheet, long signed-link; no external requests or sends.`);
