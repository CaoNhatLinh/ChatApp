import { spawn } from 'child_process';
import { chromium } from 'playwright';

const projectDir = 'E:/WORKSPACE/ChatApp/chatapp_frontend';
const server = spawn('npm run dev -- --host 127.0.0.1 --port 4173', { cwd: projectDir, shell: true, stdio: ['ignore','ignore','ignore'] });

const wait = async () => {
  for (let i=0;i<120;i++) {
    try { const r = await fetch('http://127.0.0.1:4173/'); if (r.status===200) return true; } catch {}
    await new Promise(r=>setTimeout(r,500));
  }
  return false;
};

(async() => {
  const ok = await wait();
  console.log('ready', ok);
  if (!ok) process.exit(0);
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  for (const route of ['/', '/about', '/help', '/app']) {
    const url = `http://127.0.0.1:4173${route}`;
    await page.goto(url, { waitUntil:'domcontentloaded' });
    await page.waitForTimeout(800);
    const title = await page.title();
    const html = await page.content();
    const txt = await page.textContent('body');
    console.log(route, 'title=', title, 'htmlLen=', html.length, 'txtLen=', (txt||'').length);
  }
  await browser.close();
  server.kill('SIGINT');
})();
