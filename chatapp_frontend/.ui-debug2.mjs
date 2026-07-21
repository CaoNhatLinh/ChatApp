import { spawn } from 'child_process';
import { chromium } from 'playwright';

const work = 'E:/WORKSPACE/ChatApp/chatapp_frontend';
const server = spawn('npm.cmd', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173'], {
  cwd: work,
  shell: true,
  stdio: 'ignore',
});

const waitReady = async () => {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch('http://127.0.0.1:4173/');
      if (r.status === 200) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
};

(async () => {
  const ok = await waitReady();
  console.log('ready=', ok);
  if (!ok) { server.kill('SIGINT'); return; }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const routes = ['/','/about','/help','/friends','/app','/messages','/search','/activity','/settings','/profile'];

  for (const route of routes) {
    const url = `http://127.0.0.1:4173${route}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const txt = (await page.textContent('body')) || '';
    const title = await page.title();
    console.log(route, '|', title, '| txt=', txt.slice(0, 120).replace(/\s+/g, ' '));
    console.log(route + '-len=' + txt.length);
  }

  await browser.close();
  server.kill('SIGINT');
})();
