import { spawn } from 'child_process';
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const projectDir = 'E:/WORKSPACE/ChatApp/chatapp_frontend';
const logPath = join(projectDir, '.tmp-capture.log');
const fs = await import('fs/promises');

const server = spawn('npm run dev -- --host 127.0.0.1 --port 4173', {
  cwd: projectDir,
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

server.stdout.on('data', async (d) => { await fs.appendFile(logPath, d.toString()); });
server.stderr.on('data', async (d) => { await fs.appendFile(logPath, d.toString()); });

const waitServerReady = async () => {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch('http://127.0.0.1:4173/');
      if (res.status === 200) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Server did not become ready');
};

try {
  await waitServerReady();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const routes = ['/about', '/help', '/app', '/friends', '/settings', '/search', '/activity', '/profile'];
  for (const route of routes) {
    const url = `http://127.0.0.1:4173${route}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const txt = await page.textContent('body');
    console.log(route + '::' + (txt ? txt.slice(0, 200).replace(/\s+/g,' ') : 'no-text'));
  }

  await browser.close();
} finally {
  server.kill('SIGINT');
}