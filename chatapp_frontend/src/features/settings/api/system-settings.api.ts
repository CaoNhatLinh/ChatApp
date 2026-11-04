import apiClient from '@/shared/api/apiClient';

export const PRISTINE_SETTING_REVISION = '00000000-0000-0000-0000-000000000000';
export type SystemSettingKey = 'community.creationEnabled' | 'community.defaultMaxMembers';
type Metadata = { revision: string; updatedBy: string | null; updatedAt: string | null };
export type SystemSetting = Metadata & (
  { key: 'community.creationEnabled'; type: 'BOOLEAN'; value: boolean; defaultValue: true; min: null; max: null }
  | { key: 'community.defaultMaxMembers'; type: 'INTEGER'; value: number; defaultValue: 10000; min: 2; max: 100000 }
);
export interface SystemSettingCommand { commandId: string; expectedRevision: string; value: boolean | number; reason: string }
export interface SystemSettingResult { commandId: string; setting: SystemSetting; auditPending: boolean }
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === 'string' && uuidPattern.test(value);
const invalid = (): never => { throw new Error('Invalid system setting contract'); };
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
};
const validMaximum = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 2 && value <= 100000;

function metadata(row: Record<string, unknown>): Metadata {
  const { revision, updatedBy, updatedAt } = row;
  if (!isUuid(revision)) return invalid();
  if (revision === PRISTINE_SETTING_REVISION) {
    if (updatedBy !== null || updatedAt !== null) return invalid();
    return { revision, updatedBy: null, updatedAt: null };
  }
  if (!isUuid(updatedBy) || typeof updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(updatedAt)
    || !Number.isFinite(Date.parse(updatedAt))) return invalid();
  return { revision: revision.toLowerCase(), updatedBy: updatedBy.toLowerCase(), updatedAt };
}

function parseSetting(value: unknown): SystemSetting {
  const row = record(value), meta = metadata(row);
  if (meta.revision === PRISTINE_SETTING_REVISION && row.value !== row.defaultValue) return invalid();
  if (row.key === 'community.creationEnabled' && row.type === 'BOOLEAN' && typeof row.value === 'boolean'
    && row.defaultValue === true && row.min === null && row.max === null) {
    return { ...meta, key: row.key, type: row.type, value: row.value, defaultValue: true, min: null, max: null };
  }
  if (row.key === 'community.defaultMaxMembers' && row.type === 'INTEGER' && validMaximum(row.value)
    && row.defaultValue === 10000 && row.min === 2 && row.max === 100000) {
    return { ...meta, key: row.key, type: row.type, value: row.value, defaultValue: 10000, min: 2, max: 100000 };
  }
  return invalid();
}

export async function listSystemSettings(signal?: AbortSignal): Promise<SystemSetting[]> {
  const { data } = await apiClient.get('/admin/system-settings', { signal });
  if (!Array.isArray(data) || data.length !== 2) return invalid();
  const settings = data.map(parseSetting);
  if (new Set(settings.map(setting => setting.key)).size !== 2) return invalid();
  return settings;
}

export async function saveSystemSetting(key: SystemSettingKey, command: SystemSettingCommand, signal?: AbortSignal): Promise<SystemSettingResult> {
  if (!isUuid(command.commandId) || command.commandId === PRISTINE_SETTING_REVISION || !isUuid(command.expectedRevision)
    || typeof command.reason !== 'string' || !command.reason.trim() || command.reason.length > 500
    || !(key === 'community.creationEnabled' && typeof command.value === 'boolean'
      || key === 'community.defaultMaxMembers' && validMaximum(command.value))) return invalid();
  const { data } = await apiClient.put(`/admin/system-settings/${key}`, command, { signal });
  const result = record(data), setting = parseSetting(result.setting);
  if (result.commandId !== command.commandId || typeof result.auditPending !== 'boolean'
    || setting.key !== key || setting.revision === PRISTINE_SETTING_REVISION) return invalid();
  return { commandId: command.commandId, setting, auditPending: result.auditPending };
}
