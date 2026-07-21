import { spawn } from 'child_process';
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const projectDir = 'E:/WORKSPACE/ChatApp/chatapp_frontend';
const outDir = join(projectDir, '.ui-captures');

const server = spawn('npm run dev -- --host 127.0.0.1 --port 4173', {
  cwd: projectDir,
  shell: true,
  stdio: ['ignore', 'ignore', 'ignore'],
});

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
  await mkdir(outDir, { recursive: true });
  await waitServerReady();

  const browser = await chromium.launch({
    headless: true,
  });
  const page = await browser.newPage();

  const routes = [
    ['home', '/'],
    ['home-alt', '/home'],
    ['not-found', '/404'],
    ['not-found-alt', '/not-found'],
    ['about', '/about'],
    ['help', '/help'],
    ['privacy', '/privacy'],
    ['terms', '/terms'],
    ['login', '/login'],
    ['register', '/register'],
    ['app', '/app'],
    ['messages', '/messages'],
    ['friends', '/friends'],
    ['settings', '/settings'],
    ['search', '/search'],
    ['activity', '/activity'],
    ['profile', '/profile'],
  ];

  for (const [name, route] of routes) {
    const url = `http://127.0.0.1:4173${route}`;

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(outDir, `${name}-mobile.png`), fullPage: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(outDir, `${name}-desktop.png`), fullPage: true });
  }

  await browser.close();
} finally {
  server.kill('SIGINT');
}