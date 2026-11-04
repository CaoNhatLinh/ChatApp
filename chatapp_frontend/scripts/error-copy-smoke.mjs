import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';
import axios from 'axios';
import assert from 'node:assert/strict';

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

const policyVi = 'Tạm dừng tạo cộng đồng mới. Bạn vẫn có thể trò chuyện trong các phòng hiện có. Thử lại sau nhé.';
const policyEn = 'New community creation is paused. You can still chat in existing rooms. Please try again later.';
const permissionVi = 'Bạn không có quyền thực hiện thao tác này.';
const permissionEn = 'You do not have permission to do this.';
let locale = 'vi';
const exports = {};
const source = ts.transpileModule(fs.readFileSync(path.join(root, 'src/shared/lib/user-facing-error.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
vm.runInNewContext(`(function(exports,require){${source}})`)(exports, name => {
  if (name === 'axios') return { __esModule: true, default: axios };
  if (name === '@/shared/i18n') return { localizeText: text => locale === 'vi' ? text : new Map([[policyVi, policyEn], [permissionVi, permissionEn]]).get(text) ?? text };
  throw new Error(`Unexpected module ${name}`);
});
for (locale of ['vi', 'en']) {
  const error = (status, code) => ({ isAxiosError: true, response: { status, data: { code, message: 'Internal details must stay private' } } });
  assert.equal(exports.getUserFacingErrorMessage(error(403, 'COMMUNITY_CREATION_DISABLED'), 'Fallback'), locale === 'vi' ? policyVi : policyEn);
  assert.equal(exports.getUserFacingErrorMessage(error(403, 'FORBIDDEN'), 'Fallback'), locale === 'vi' ? permissionVi : permissionEn);
  assert.equal(exports.getUserFacingErrorMessage(error(500, 'COMMUNITY_CREATION_DISABLED'), 'Fallback'), 'Fallback');
  assert.equal(exports.getUserFacingErrorMessage(error(403, 'UNRECOGNIZED'), 'Fallback'), locale === 'vi' ? permissionVi : permissionEn);
}
console.log(JSON.stringify({ policyCopyCases: 8, boundary: 'Actual user-facing error mapper with controlled locale/transport errors' }));
