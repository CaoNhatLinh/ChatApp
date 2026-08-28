import apiClient from '@/shared/api/apiClient';

export type ReportTargetType = 'USER' | 'MESSAGE' | 'CONVERSATION';

export interface CreateMessageReportInput {
  targetType: 'MESSAGE';
  conversationId: string;
  messageBucket: string;
  messageId: string;
  reasonCode: string;
  description?: string;
}

export interface CreateUserReportInput {
  targetType: 'USER';
  targetUserId: string;
  reasonCode: string;
  description?: string;
}

export interface ReportRecord {
  reportId: string;
  createdAtKey: string;
  reportDay: string;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';
  reporterId: string;
  targetType: ReportTargetType;
  reasonCode: string;
  targetUserId?: string | null;
  conversationId?: string | null;
  messageBucket?: string | null;
  messageId?: string | null;
  description?: string | null;
}

export const submitMessageReport = async (
  input: CreateMessageReportInput,
): Promise<ReportRecord> => {
  const response = await apiClient.post<ReportRecord>('/reports', input);
  return response.data;
};

export const submitUserReport = async (
  input: CreateUserReportInput,
): Promise<ReportRecord> => {
  const response = await apiClient.post<ReportRecord>('/reports', input);
  return response.data;
};

export const listMyReports = async (limit = 50): Promise<ReportRecord[]> => {
  const response = await apiClient.get<ReportRecord[]>('/reports/mine', { params: { limit } });
  return response.data;
};
