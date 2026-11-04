import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile('src/features/admin/model/room-directory.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { filterAdminRooms, roomInitials } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const rooms = [
  { conversationId: 'alpha', name: 'Đà Nẵng hôm nay', deleted: false },
  { conversationId: 'beta', name: 'Nối mọi người', deleted: true },
  { conversationId: 'gamma', name: null, deleted: false },
];
assert.equal(filterAdminRooms(rooms, '', 'all').length, 3);
assert.equal(filterAdminRooms(rooms, '  da nang ', 'all')[0]?.conversationId, 'alpha');
assert.equal(filterAdminRooms(rooms, 'BETA', 'archived')[0]?.conversationId, 'beta');
assert.equal(filterAdminRooms(rooms, 'Nối', 'active').length, 0);
assert.deepEqual(filterAdminRooms(rooms, '', 'active').map(room => room.conversationId), ['alpha', 'gamma']);
assert.equal(roomInitials(rooms[0]), 'ĐÀ');
assert.equal(roomInitials(rooms[2]), '#');
assert.equal(rooms.length, 3, 'filtering never mutates the loaded directory');
console.log('PASS: 8 admin room directory checks');
