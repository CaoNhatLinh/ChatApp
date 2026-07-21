import { spawn } from 'child_process';
import { chromium } from 'playwright';

const p = spawn('npm.cmd', ['run','dev','--','--host','127.0.0.1','--port','4173'], { cwd: 'E:/WORKSPACE/ChatApp/chatapp_frontend', shell: true, stdio: 'ignore' });

const wait = async () => {
  for (let i=0;i<80;i++) {
    try { const r=await fetch('http://127.0.0.1:4173/'); if(r.ok) return; } catch {}
    await new Promise(r=>setTimeout(r,500));
  }
};

(async()=>{
  await wait();
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror', e=>console.log('pageerror', e.message));
  page.on('console', m=>{if(['error','warning'].includes(m.type())) console.log('console-'+m.type(), m.text());});
  await page.goto('http://127.0.0.1:4173/app', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  console.log('done');
  await browser.close();
  p.kill('SIGINT');
})();
