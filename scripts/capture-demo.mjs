/**
 * Capture synthetic-only product B-roll. Run against an isolated API/UI (never the user database).
 * DEMO_BASE_URL=http://127.0.0.1:3001 node scripts/capture-demo.mjs
 * Produces ignored artifacts/demo/*.webm and screenshots. No provider calls or generated verdicts.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base=process.env.DEMO_BASE_URL;
if(!base)throw Error('Set DEMO_BASE_URL to an isolated demo server.');
const output=new URL('../artifacts/demo/',import.meta.url).pathname;
await mkdir(output,{recursive:true});
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1920,height:1080},recordVideo:{dir:output,size:{width:1920,height:1080}},reducedMotion:'reduce'});
const page=await context.newPage();
const pause=ms=>page.waitForTimeout(ms);
await page.goto(base+'/release-check');
await page.getByRole('heading',{name:'Release check',level:1}).waitFor();
await page.addStyleTag({content:'nextjs-portal{display:none}'});
// Start an explicitly offline run so the capture never depends on external services.
await page.getByRole('button',{name:'Run release check'}).click();
await page.getByText('Rehearsal passed',{exact:true}).waitFor({timeout:30000});
await page.evaluate(()=>document.querySelector('.studio').scrollTo(0,0));
await page.screenshot({path:output+'01-studio.png'});
await pause(4000);
await page.locator('.studio-panel').scrollIntoViewIfNeeded();
await pause(1000);
await page.screenshot({path:output+'02-release-check.png'});
await pause(5000);
await page.locator('.studio-table tbody tr').first().getByRole('button',{name:'Inspect Needs review evidence'}).click();
await page.getByRole('dialog',{name:'Release check evidence'}).waitFor();
await pause(1000);
await page.screenshot({path:output+'03-blocked-tool.png'});
await pause(6000);
await page.getByRole('button',{name:'Close evidence'}).click();
await page.locator('.studio-table tbody tr').first().getByRole('button',{name:'Inspect Passed evidence'}).click();
await pause(5000);
await page.getByRole('button',{name:'Close evidence'}).click();
const hindi=page.locator('.studio-table tbody tr').filter({hasText:'हिन्दी'}).first();
await hindi.getByRole('button',{name:'Inspect Passed evidence'}).click();
await pause(5000);
await page.getByRole('button',{name:'Close evidence'}).click();
await page.locator('.studio-table tbody tr').first().getByRole('button',{name:'Inspect Needs review evidence'}).click();
await page.getByRole('link',{name:'Open workflow trace'}).click();
await page.locator('.react-flow__node').first().waitFor();
await page.addStyleTag({content:'nextjs-portal{display:none}'});
await pause(2000);
await page.screenshot({path:output+'04-workflow.png'});
await pause(5000);
await page.getByRole('button',{name:'Expand Tool authorization',exact:true}).click();
await page.getByRole('dialog',{name:'Expanded node details'}).waitFor();
await pause(6000);
await page.screenshot({path:output+'05-node-evidence.png'});
const video=page.video();
await context.close();
console.log('Recorded synthetic B-roll:',await video.path());
await browser.close();
