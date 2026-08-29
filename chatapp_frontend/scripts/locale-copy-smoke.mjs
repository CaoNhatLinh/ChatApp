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
const resourceFile = path.join(frontendRoot, 'src/shared/i18n/resources.ts');
const quotedVietnamese = /(?<![A-Za-z0-9])"([^"\r\n]*[À-ỹ][^"\r\n]*)"/g;
const resourceText = fs.readFileSync(resourceFile, 'utf8');
const copyKeys = new Set();

for (const relativeFile of copyFiles) {
  const source = fs.readFileSync(path.join(frontendRoot, relativeFile), 'utf8');
  for (const match of source.matchAll(quotedVietnamese)) {
    copyKeys.add(match[1]);
  }
}

const missing = [...copyKeys]
  .filter((key) => !resourceText.includes(`'${key}':`))
  .sort();

const report = { checkedFiles: copyFiles, checkedKeys: copyKeys.size, missing };
console.log(JSON.stringify(report, null, 2));

if (missing.length > 0) {
  process.exitCode = 1;
}
