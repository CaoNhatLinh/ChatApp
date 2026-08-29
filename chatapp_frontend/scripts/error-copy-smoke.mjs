import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardedFiles = [
  'src/features/messenger/model/useMessenger.ts',
  'src/features/relationships/model/friend.store.ts',
  'src/features/profile/components/user/ReportUserModal.tsx',
  'src/features/messenger/components/chat/ReportMessageModal.tsx',
  'src/features/calls/hooks/useWebRtcCall.ts',
  'src/app/providers/PresenceManager.tsx',
];

const forbidden = [
  /err\s+instanceof\s+Error\s*\?\s*err\.message/,
  /error\s+instanceof\s+Error\s*\?\s*error\.message/,
  /response\?\.data\?\.message/,
  /data\?\.message/,
];

const violations = [];
for (const relativePath of guardedFiles) {
  const absolutePath = path.join(root, relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  for (const [lineNumber, line] of source.split(/\r?\n/).entries()) {
    // Diagnostic logs may retain a native exception for operators; only
    // user-facing state/markup must be protected by this check.
    if (line.includes('logger.') || line.includes('console.')) continue;
    for (const pattern of forbidden) {
      if (pattern.test(line)) violations.push(`${relativePath}:${lineNumber + 1}: ${pattern}`);
    }
  }
}

if (violations.length > 0) {
  console.error(JSON.stringify({ violations }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ guardedFiles: guardedFiles.length, violations: [] }, null, 2));
