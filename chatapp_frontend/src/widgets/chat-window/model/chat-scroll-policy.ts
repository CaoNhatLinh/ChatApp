export interface HistoryPosition {
  conversationId: string | null;
  firstKey: string | null;
  lastKey: string | null;
}

export const isNearHistoryEnd = (height: number, viewport: number, top: number) =>
  height - viewport - top <= 80;

export const getChatScrollAction = (
  previous: HistoryPosition | null,
  current: HistoryPosition,
  nearEnd: boolean,
  ownAppend: boolean,
): 'latest' | 'anchor' | 'notify' | 'preserve' => {
  if (!previous || previous.conversationId !== current.conversationId || !previous.lastKey) return 'latest';
  if (previous.lastKey !== current.lastKey) return nearEnd || ownAppend ? 'latest' : 'notify';
  if (previous.firstKey !== current.firstKey) return 'anchor';
  return 'preserve';
};
