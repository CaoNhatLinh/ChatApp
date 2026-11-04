import { createContext, useContext, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export type SystemSettingsExitState = 'clear' | 'draft' | 'busy' | 'uncertain';

export const SystemSettingsExitContext = createContext<Dispatch<SetStateAction<SystemSettingsExitState>> | null>(null);

export function combineSettingsExitStates(states: Iterable<SystemSettingsExitState>): SystemSettingsExitState {
  const pending = new Set(states);
  return pending.has('busy') ? 'busy' : pending.has('uncertain') ? 'uncertain' : pending.has('draft') ? 'draft' : 'clear';
}

export function useSystemSettingsExitState(state: SystemSettingsExitState) {
  const report = useContext(SystemSettingsExitContext);
  if (!report) throw new Error('System settings require an exit boundary');
  useEffect(() => {
    report(state);
    return () => report('clear');
  }, [report, state]);
}
