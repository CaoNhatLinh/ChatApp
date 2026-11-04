import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { listSystemSettings, saveSystemSetting } from '../api/system-settings.api';
import type { SystemSetting, SystemSettingCommand } from '../api/system-settings.api';
import type { SystemSettingsExitState } from './system-settings-exit';

type Draft = boolean | string;
type Phase = 'idle' | 'saving' | 'saved' | 'superseded' | 'conflict' | 'error' | 'uncertain' | 'reloading' | 'reload-error';
const draftOf = (setting: SystemSetting): Draft => typeof setting.value === 'boolean' ? setting.value : String(setting.value);
function valueOf(setting: SystemSetting, draft: Draft): boolean | number | undefined {
  if (setting.type === 'BOOLEAN') return typeof draft === 'boolean' ? draft : undefined;
  if (typeof draft !== 'string' || !/^(0|[1-9]\d*)$/.test(draft)) return undefined;
  const number = Number(draft);
  return Number.isInteger(number) && number >= setting.min && number <= setting.max ? number : undefined;
}
const denied = (error: unknown) => axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0);

export function useSystemSettingEditor(initial: SystemSetting, onDenied: () => void, onCurrent: (setting: SystemSetting) => void) {
  const [setting, setSetting] = useState(initial);
  const [draft, setDraft] = useState<Draft>(() => draftOf(initial));
  const [reason, setReason] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [auditPending, setAuditPending] = useState(false);
  const command = useRef<SystemSettingCommand | null>(null);
  const lifetime = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    return () => controller.abort();
  }, []);
  const value = valueOf(setting, draft);
  const dirty = draft !== draftOf(setting);
  const busy = phase === 'saving' || phase === 'reloading';
  const conflicted = phase === 'conflict' || phase === 'reload-error';
  const locked = busy || phase === 'uncertain';
  const canSave = dirty && value !== undefined && reason.trim().length > 0 && reason.length <= 500 && !locked && !conflicted;
  const needsWarning = dirty || Boolean(reason.trim()) || locked;
  const exitState: SystemSettingsExitState = busy ? 'busy' : phase === 'uncertain' ? 'uncertain' : needsWarning ? 'draft' : 'clear';
  useEffect(() => {
    if (!needsWarning) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [needsWarning]);

  function accept(current: SystemSetting) {
    setSetting(current); setDraft(draftOf(current)); setReason(''); command.current = null;
    onCurrent(current);
  }
  function editDraft(next: Draft) {
    if (inFlight.current || phase === 'uncertain') return;
    setDraft(next); if (!conflicted) setPhase('idle');
  }
  function editReason(next: string) {
    if (inFlight.current || phase === 'uncertain') return;
    setReason(next); if (!conflicted) setPhase('idle');
  }
  function cancel() {
    if (locked || conflicted) return;
    accept(setting); setPhase('idle');
  }
  async function save() {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || inFlight.current || !command.current && !canSave) return;
    if (!command.current && value !== undefined) command.current = Object.freeze({
      commandId: crypto.randomUUID(), expectedRevision: setting.revision, value, reason: reason.trim(),
    });
    const attempt = command.current;
    if (!attempt) return;
    inFlight.current = true; setPhase('saving');
    try {
      const result = await saveSystemSetting(setting.key, attempt, signal);
      if (signal.aborted) return;
      accept(result.setting); setAuditPending(result.auditPending);
      setPhase(result.setting.revision === attempt.commandId ? 'saved' : 'superseded');
      return true;
    } catch (error) {
      if (signal.aborted) return;
      if (denied(error)) { onDenied(); return; }
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status === 409) { command.current = null; setPhase('conflict'); }
      else if (status === 400 || status === 404 || status === 422) { command.current = null; setPhase('error'); }
      else setPhase('uncertain'); // Preserve exact command; never fabricate a fresh retry intent.
    } finally { inFlight.current = false; }
  }
  async function reload() {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || inFlight.current || phase === 'uncertain') return;
    inFlight.current = true; setPhase('reloading');
    try {
      const settings = await listSystemSettings(signal);
      if (signal.aborted) return;
      const current = settings.find(item => item.key === setting.key);
      if (!current) throw new Error('Missing system setting');
      accept(current); setAuditPending(false); setPhase('idle');
    } catch (error) {
      if (signal.aborted) return;
      if (denied(error)) onDenied(); else setPhase('reload-error');
    } finally { inFlight.current = false; }
  }
  return { setting, draft, reason, phase, auditPending, value, dirty, busy, locked, conflicted, canSave, needsWarning, exitState,
    editDraft, editReason, cancel, save, reload };
}
