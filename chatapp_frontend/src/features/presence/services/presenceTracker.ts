// Presence tracker - tracks which userIds are being watched for presence changes
export const presenceTracker = {
  watch: (_userIds: string[]) => {},
  unwatch: (_userIds: string[]) => {},
  resync: () => {},
  clear: () => {},
};
