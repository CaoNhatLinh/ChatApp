import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDirectory, '..');
const copyFiles = [
  'src/shared/constants/ui-copy.ts',
  'src/features/messenger/constants/messengerCopy.ts',
  'src/features/settings/constants/chat-theme.constants.ts',
];
const localizedErrorFiles = [
  'src/shared/lib/user-facing-error.ts',
  'src/features/calls/hooks/useWebRtcCall.ts',
  'src/features/profile/components/user/ReportUserModal.tsx',
  'src/features/messenger/components/chat/ReportMessageModal.tsx',
  'src/app/providers/PresenceManager.tsx',
];
const resourceFile = path.join(frontendRoot, 'src/shared/i18n/resources.ts');
const quotedVietnamese = /(?<![A-Za-z0-9])"([^"\r\n]*[À-ỹ][^"\r\n]*)"/g;
const staticLocalizedText = /localizeText\(\s*(['"])([^'"\r\n]*[À-ỹ][^'"\r\n]*)\1\s*\)/g;
const resourceText = fs.readFileSync(resourceFile, 'utf8');
const copyKeys = new Set();

for (const relativeFile of copyFiles) {
  const source = fs.readFileSync(path.join(frontendRoot, relativeFile), 'utf8');
  for (const match of source.matchAll(quotedVietnamese)) {
    copyKeys.add(match[1]);
  }
}

for (const relativeFile of localizedErrorFiles) {
  const source = fs.readFileSync(path.join(frontendRoot, relativeFile), 'utf8');
  for (const match of source.matchAll(staticLocalizedText)) {
    copyKeys.add(match[2]);
  }
}

const sourceFiles = [];
const collectSourceFiles = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectSourceFiles(absolutePath);
    else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(absolutePath);
  }
};
collectSourceFiles(path.join(frontendRoot, 'src'));
for (const absolutePath of sourceFiles) {
  const source = fs.readFileSync(absolutePath, 'utf8');
  for (const match of source.matchAll(staticLocalizedText)) {
    copyKeys.add(match[2]);
  }
}

const missing = [...copyKeys]
  .filter((key) => !resourceText.includes(`'${key}':`))
  .sort();

const report = { checkedFiles: [...copyFiles, ...localizedErrorFiles, 'src/**/*.ts(x) static localizeText calls'], checkedKeys: copyKeys.size, missing };
console.log(JSON.stringify(report, null, 2));

if (missing.length > 0) {
  process.exitCode = 1;
}
