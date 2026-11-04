import { useEffect, useRef, useState } from 'react';
import type { UserDTO } from '@/entities/user/model/user.types';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { getAdminUserRoles, listAdminDevices, listAdminSessions, searchAdminUsers } from '../api/admin.api';
import type { AdminDevice, AdminRoleGrant, AdminSession } from '../api/admin.api';

export type UserAction = { kind: 'grant' | 'status' } | { kind: 'role'; role: AdminRoleGrant }
  | { kind: 'session'; session: AdminSession } | { kind: 'device'; device: AdminDevice };
export interface UserExitState { draft: boolean; busy: boolean; uncertain: boolean }
export interface UserResources {
  loading: boolean; roles: AdminRoleGrant[] | null;
  sessions: AdminSession[] | null; devices: AdminDevice[] | null;
}
const emptyResources: UserResources = { loading: false, roles: null, sessions: null, devices: null };
export const userStatusLabel = (status: string, locale: string) => ({ ACTIVE: locale === 'vi' ? 'Đang hoạt động' : 'Active',
  SUSPENDED: locale === 'vi' ? 'Tạm khóa' : 'Suspended', BANNED: locale === 'vi' ? 'Bị cấm' : 'Banned' }[status] ?? status);
export const userRoleLabel = (role: string, locale: string) => ({
  SUPER_ADMIN: locale === 'vi' ? 'Quản trị cấp cao' : 'Super administrator', APP_ADMIN: locale === 'vi' ? 'Quản trị ứng dụng' : 'Application administrator',
  TRUST_SAFETY: locale === 'vi' ? 'Kiểm duyệt' : 'Trust and safety', SUPPORT: locale === 'vi' ? 'Hỗ trợ' : 'Support',
  ANALYST: locale === 'vi' ? 'Phân tích' : 'Analyst', AUDITOR: locale === 'vi' ? 'Kiểm toán' : 'Auditor',
}[role] ?? role);

export function useAdminUsers(actorId: string) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [selected, setSelected] = useState<UserDTO | null>(null);
  const [resources, setResources] = useState<UserResources>(emptyResources);
  const searchRequest = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  const selectedId = useRef<string | null>(null);
  const alive = useRef(false);
  const currentActor = () => alive.current && useAuthStore.getState().user?.userId === actorId;
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; searchRequest.current?.abort(); detailRequest.current?.abort(); };
  }, [actorId]);

  async function search() {
    const value = query.trim();
    if (value.length < 2) return;
    searchRequest.current?.abort();
    const controller = new AbortController(); searchRequest.current = controller;
    setSearchState('loading'); setSearchedQuery(value); setUsers([]);
    try {
      const result = await searchAdminUsers(value, controller.signal);
      if (!controller.signal.aborted && currentActor()) { setUsers(result); setSearchState('ready'); }
    } catch {
      if (!controller.signal.aborted && currentActor()) setSearchState('error');
    }
  }

  async function load(candidate: UserDTO) {
    detailRequest.current?.abort();
    const controller = new AbortController(); detailRequest.current = controller;
    setResources({ ...emptyResources, loading: true });
    const result = await Promise.allSettled([
      getAdminUserRoles(candidate.userId, controller.signal),
      listAdminSessions(candidate.userId, 100, controller.signal),
      listAdminDevices(candidate.userId, 100, controller.signal),
    ]);
    if (controller.signal.aborted || !currentActor() || selectedId.current !== candidate.userId) return;
    setResources({ loading: false,
      roles: result[0].status === 'fulfilled' ? result[0].value : null,
      sessions: result[1].status === 'fulfilled' ? result[1].value : null,
      devices: result[2].status === 'fulfilled' ? result[2].value : null });
  }
  function select(candidate: UserDTO | null) {
    detailRequest.current?.abort(); selectedId.current = candidate?.userId ?? null;
    setSelected(candidate); setResources(emptyResources);
    if (candidate) void load(candidate);
  }
  function reset() {
    searchRequest.current?.abort(); select(null);
    setUsers([]); setQuery(''); setSearchedQuery(''); setSearchState('idle');
  }
  function updateStatus(status: string) {
    if (!selected || !currentActor()) return;
    setSelected({ ...selected, status });
    setUsers(items => items.map(item => item.userId === selected.userId ? { ...item, status } : item));
  }
  async function inspect() {
    if (!selected) return;
    detailRequest.current?.abort();
    const controller = new AbortController(); detailRequest.current = controller;
    const candidates = await searchAdminUsers(selected.userName, controller.signal);
    if (controller.signal.aborted || !currentActor() || selectedId.current !== selected.userId) return;
    const current = candidates.find(candidate => candidate.userId === selected.userId);
    if (!current) throw new Error('Selected user was not returned; current status is unverified');
    setSelected(current); await load(current);
  }
  return { query, setQuery, users, searchState, searchedQuery, search, selected, select, resources,
    reload: () => selected ? load(selected) : Promise.resolve(), currentActor, updateStatus, inspect, reset };
}
