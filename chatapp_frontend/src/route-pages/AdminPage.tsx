import { useEffect, useRef, useState } from "react";
import type { FormEvent } from 'react';
import { Activity, Eye, History, KeyRound, LayoutDashboard, RadioTower, RefreshCcw, Settings2, ShieldAlert, Sticker } from "lucide-react";
import { useRouter } from "next/navigation";
import { AdminPageShell } from "@/route-pages/shared/layout/AdminPageShell";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, ConfirmDialog, Input, LoadingSpinner, Select, Skeleton } from "@/shared/ui";
import { useAuthStore } from "@/features/auth/model/auth.store";
import {
  type AdminHealthSnapshot,
  type AdminAuditEvent,
  type AdminReport,
  type AdminSanction,
  type AdminConversationSummary,
  type AdminOverview,
  type AdminAnalyticsPoint,
  type AdminMessageInspection,
  getAdminHealth,
  getAdminConversation,
  getAdminOverview,
  listAdminConversations,
  listAdminAuditEvents,
  exportAdminAuditEvents,
  listAdminReports,
  resolveAdminReport,
  imposeAdminSanction,
  listAdminSanctions,
  revokeAdminSanction,
  archiveAdminConversation,
  restoreAdminConversation,
  listAdminAnalytics,
  updateAdminConversationPolicy,
  inspectAdminMessage,
} from "@/features/admin/api/admin.api";
import { localizeText, useAppLocale } from "@/shared/i18n";
import { logger } from "@/shared/lib/logger";
import { getUserFacingErrorMessage } from "@/shared/lib/user-facing-error";
import { StickerAdminPanel } from "@/features/stickers/components/StickerAdminPanel";
import { SystemSettingsPanel } from '@/features/settings/ui/SystemSettingsPanel';
import { AdminEmailDeliveryLookup } from '@/features/admin/ui/AdminEmailDeliveryLookup';
import { AdminRoomDirectory } from '@/features/admin/components/AdminRoomDirectory';
import { AdminAuditLog } from '@/features/admin/components/AdminAuditLog';
import { AdminActivityChart } from '@/features/admin/components/AdminActivityChart';
import { AdminToolSection } from '@/features/admin/components/AdminToolSection';
import { AdminOverviewPanel } from '@/features/admin/components/AdminOverviewPanel';
import { AdminWorkspaceArtwork } from '@/features/admin/components/AdminWorkspaceArtwork';
import { AdminReportInbox } from '@/features/admin/components/AdminReportInbox';
import type { ReportExitState } from '@/features/admin/components/AdminReportInbox';
import type { ReportDecisionDraft } from '@/features/admin/model/report-decision';
import { canDecideReport, decisionError, reportIdentity } from '@/features/admin/model/report-decision';
import { AdminUserWorkspace } from '@/features/admin/components/AdminUserWorkspace';
import type { UserExitState } from '@/features/admin/model/useAdminUsers';

const readStatus = (error: unknown): number | undefined => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { status?: number } }).response;
    return response?.status;
  }
  return undefined;
};

const getAdminErrorMessage = (error: unknown, fallback: string): string => {
  logger.warn("Admin request failed", error instanceof Error ? error.message : String(error));
  return getUserFacingErrorMessage(error, fallback);
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return localizeText("Không hết hạn");
  const locale = typeof document !== "undefined" && document.documentElement.lang === "en" ? "en-US" : "vi-VN";
  return new Date(value).toLocaleString(locale);
};

const strictLocalizedLabel = (kind: string, value: string, labels: Record<string, string>): string => {
  const label = labels[value];
  if (!label) throw new Error(`Unsupported ${kind}: ${value}`);
  return localizeText(label);
};

const sanctionStatusLabel = (status: AdminSanction["status"]) => strictLocalizedLabel("sanction status", status, {
  ACTIVE: "Đang hoạt động",
  REVOKED: "Đã thu hồi",
  EXPIRED: "Đã hết hạn",
});

const sanctionTypeLabel = (sanctionType: AdminSanction["sanctionType"]): string => strictLocalizedLabel("sanction type", sanctionType, {
  BAN: "Cấm",
  MUTE: "Tắt tiếng",
  SUSPEND: "Tạm ngưng",
  WARNING: "Cảnh cáo",
});

const sanctionScopeLabel = (scope: AdminSanction["scope"]): string => strictLocalizedLabel("sanction scope", scope, {
  APP: "Ứng dụng",
  CONVERSATION: "Cuộc trò chuyện",
});

const ANALYTICS_EVENT_OPTIONS = [
  { value: "ALL", label: "Tất cả sự kiện" },
  { value: "ROOM_CREATED", label: "Tạo phòng" },
  { value: "ROOM_JOINED", label: "Tham gia phòng" },
  { value: "MESSAGE_SENT", label: "Gửi tin nhắn" },
  { value: "POLLS_CREATED", label: "Đã tạo bình chọn" },
  { value: "POLL_VOTED", label: "Đã bình chọn" },
  { value: "CALL_STARTED", label: "Bắt đầu cuộc gọi" },
] as const;

const analyticsEventLabel = (eventType: string): string => {
  const option = ANALYTICS_EVENT_OPTIONS.find((candidate) => candidate.value === eventType);
  if (!option) throw new Error(`Unsupported analytics event type: ${eventType}`);
  return localizeText(option.label);
};

interface AdminPageProps {
  onBackToApp?: () => void;
}

type AdminWorkspace = 'overview' | 'rooms' | 'safety' | 'insights' | 'access' | 'stickers' | 'system-settings';

interface AdminConfirmation {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
}

const AdminPage = ({ onBackToApp }: AdminPageProps) => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthStore();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<AdminWorkspace>('overview');
  const workspaceHeading = useRef<HTMLHeadingElement>(null);
  const focusWorkspaceHeading = useRef(false);
  useEffect(() => {
    if (!focusWorkspaceHeading.current) return;
    focusWorkspaceHeading.current = false;
    workspaceHeading.current?.focus();
  }, [activeWorkspace]);
  const openWorkspaceFromOverview = (workspace: 'rooms' | 'safety') => {
    focusWorkspaceHeading.current = true;
    setActiveWorkspace(workspace);
  };
  const [stickerWorkspaceOpened, setStickerWorkspaceOpened] = useState(false);
  useEffect(() => { if (activeWorkspace === 'stickers') setStickerWorkspaceOpened(true); }, [activeWorkspace]);
  const [settingsWorkspaceOpened, setSettingsWorkspaceOpened] = useState(false);
  useEffect(() => { if (activeWorkspace === 'system-settings') setSettingsWorkspaceOpened(true); }, [activeWorkspace]);
  const canOperateSystem = Boolean(overview?.permissions.includes('SYSTEM_OPERATE'));
  useEffect(() => {
    if (!overview) return;
    const permissions = overview.permissions;
    setActiveWorkspace(current => {
      if (current === 'rooms' && !permissions.includes('ROOM_READ')) return 'overview';
      if (current === 'safety' && !permissions.includes('REPORT_MANAGE') && !permissions.includes('AUDIT_READ')) return 'overview';
      if (current === 'insights' && !permissions.includes('ANALYTICS_READ') && !permissions.includes('AUDIT_READ')) return 'overview';
      if ((current === 'system-settings' || current === 'stickers') && !canOperateSystem) return 'overview';
      return current;
    });
  }, [canOperateSystem, overview]);
  const [health, setHealth] = useState<AdminHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedback, setFeedbackState] = useState<string | null>(null);
  const [roomMonth, setRoomMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rooms, setRooms] = useState<AdminConversationSummary[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<AdminConversationSummary | null>(null);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [roomReload, setRoomReload] = useState(0);
  const [openingRoomId, setOpeningRoomId] = useState<string | null>(null);
  const [roomReadError, setRoomReadError] = useState<string | null>(null);
  const [auditMonth, setAuditMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [auditEvents, setAuditEvents] = useState<AdminAuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditReload, setAuditReload] = useState(0);
  const [auditExporting, setAuditExporting] = useState(false);
  const [auditExportError, setAuditExportError] = useState<{ month: string; message: string } | null>(null);
  const [messageConversationId, setMessageConversationId] = useState("");
  const [messageBucket, setMessageBucket] = useState("");
  const [messageId, setMessageId] = useState("");
  const [messageReason, setMessageReason] = useState("");
  const [messageInspection, setMessageInspection] = useState<AdminMessageInspection | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [analyticsFrom, setAnalyticsFrom] = useState(() => new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [analyticsTo, setAnalyticsTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [analyticsType, setAnalyticsType] = useState("ALL");
  const [analyticsPoints, setAnalyticsPoints] = useState<AdminAnalyticsPoint[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsReload, setAnalyticsReload] = useState(0);
  const [reportDay, setReportDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportStatusFilter, setReportStatusFilter] = useState<AdminReport['status']>('OPEN');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportReload, setReportReload] = useState(0);
  const [reportOpenRequest, setReportOpenRequest] = useState<{ identity: string }>();
  const [reportExitState, setReportExitState] = useState<ReportExitState>({ draft: false, busy: false });
  const [userExitState, setUserExitState] = useState<UserExitState>({ draft: false, busy: false, uncertain: false });
  const [sanctionOpen, setSanctionOpen] = useState(false);
  const [resolutionCode, setResolutionCode] = useState("");
  const [moderationReason, setModerationReason] = useState("");
  const [moderationMutating, setModerationMutating] = useState(false);
  const [sanctionTargetUserId, setSanctionTargetUserId] = useState("");
  const [sanctionType, setSanctionType] = useState<AdminSanction['sanctionType']>('BAN');
  const [sanctionScope, setSanctionScope] = useState<AdminSanction['scope']>('APP');
  const [sanctionConversationId, setSanctionConversationId] = useState("");
  const [sanctionExpiresAt, setSanctionExpiresAt] = useState("");
  const [sanctions, setSanctions] = useState<AdminSanction[]>([]);
  const [sanctionsLoading, setSanctionsLoading] = useState(false);
  const [roomPolicy, setRoomPolicy] = useState("OPEN");
  const [roomSlowMode, setRoomSlowMode] = useState(0);
  const [roomReason, setRoomReason] = useState("");
  const [roomMutating, setRoomMutating] = useState(false);
  const [confirmation, setConfirmation] = useState<AdminConfirmation | null>(null);
  const confirmationResolver = useRef<((accepted: boolean) => void) | null>(null);
  const overviewRequestRef = useRef(0);
  const sanctionTargetRequestRef = useRef(0);
  const roomSelectionRequestRef = useRef(0);
  const { locale } = useAppLocale();
  const setFeedback = (message: string | null) => setFeedbackState(message === null ? null : localizeText(message));

  const askConfirmation = (nextConfirmation: AdminConfirmation): Promise<boolean> => new Promise((resolve) => {
    confirmationResolver.current = resolve;
    setConfirmation(nextConfirmation);
  });

  const resolveConfirmation = (accepted: boolean) => {
    confirmationResolver.current?.(accepted);
    confirmationResolver.current = null;
    setConfirmation(null);
  };

  const loadOverview = async (isRefresh = false) => {
    const requestId = ++overviewRequestRef.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);
    try {
      const overviewResult = await getAdminOverview();
      if (requestId !== overviewRequestRef.current) return;
      setOverview(overviewResult);
      try {
        const healthResult = await getAdminHealth();
        if (requestId === overviewRequestRef.current) setHealth(healthResult);
      } catch (error: unknown) {
        if (requestId === overviewRequestRef.current) {
          logger.warn("Admin health request failed", error instanceof Error ? error.message : String(error));
        }
      }
    } catch (error: unknown) {
      if (requestId !== overviewRequestRef.current) return;
      setOverview(null);
      setErrorStatus(readStatus(error));
      setErrorMessage(getAdminErrorMessage(error, "Không thể tải quyền quản trị. Kiểm tra tài khoản và phiên đăng nhập."));
    } finally {
      if (requestId === overviewRequestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (!authLoading && user) void loadOverview();
  }, [authLoading, user]);

  useEffect(() => {
    if (!overview?.permissions.includes("ROOM_READ")) return;
    let active = true;
    setRoomsLoading(true);
    setRooms([]); setRoomsError(null);
    void listAdminConversations(roomMonth, 100)
      .then((result) => {
        if (active) setRooms(result);
      })
      .catch((error: unknown) => {
        if (active) setRoomsError(getAdminErrorMessage(error, localizeText("Không thể tải danh sách phòng của tháng này.")));
      })
      .finally(() => {
        if (active) setRoomsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [overview, roomMonth, roomReload]);

  useEffect(() => {
    if (!overview?.permissions.includes("AUDIT_READ")) return;
    let active = true;
    setAuditLoading(true);
    setAuditEvents([]);
    setAuditError(null);
    void listAdminAuditEvents(auditMonth, 50)
      .then((result) => {
        if (active) setAuditEvents(result);
      })
      .catch((error: unknown) => {
        if (active) setAuditError(getAdminErrorMessage(error, localizeText("Không thể tải nhật ký kiểm toán của tháng này.")));
      })
      .finally(() => {
        if (active) setAuditLoading(false);
      });
    return () => {
      active = false;
    };
  }, [overview, auditMonth, auditReload]);

  const handleAuditExport = async () => {
    setAuditExporting(true);
    setAuditExportError(null);
    try {
      const blob = await exportAdminAuditEvents(auditMonth, 200);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `noi-audit-${auditMonth}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error: unknown) {
      setAuditExportError({ month: auditMonth, message: getAdminErrorMessage(error, locale === 'vi' ? 'Chưa xuất được CSV. Hãy thử lại.' : 'Could not export CSV. Try again.') });
    } finally {
      setAuditExporting(false);
    }
  };

  useEffect(() => {
    if (!overview?.permissions.includes("ANALYTICS_READ")) return;
    let active = true;
    setAnalyticsLoading(true);
    setAnalyticsPoints([]); setAnalyticsError(null);
    void listAdminAnalytics({ from: analyticsFrom, to: analyticsTo, eventType: analyticsType, limit: 200 })
      .then((result) => {
        if (active) setAnalyticsPoints(result);
      })
      .catch((error: unknown) => {
        if (active) setAnalyticsError(getAdminErrorMessage(error, localizeText('Không thể tải số liệu tổng hợp trong khoảng thời gian này.')));
      })
      .finally(() => {
        if (active) setAnalyticsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [overview, analyticsFrom, analyticsTo, analyticsType, analyticsReload]);

  useEffect(() => {
    if (!overview?.permissions.includes("REPORT_MANAGE")) return;
    let active = true;
    setReportsLoading(true);
    setReports([]); setReportsError(null);
    void listAdminReports(reportStatusFilter, reportDay, 50)
      .then((result) => {
        if (active) setReports(result);
      })
      .catch((error: unknown) => {
        if (active) {
          const message = getAdminErrorMessage(error, localizeText('Không thể tải hàng đợi báo cáo của ngày này.'));
          setReportsError(message);
        }
      })
      .finally(() => {
        if (active) setReportsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [overview, reportStatusFilter, reportDay, reportReload]);

  const confirmRoomDraftDiscard = async () => {
    if (!selectedRoom || (!roomReason.trim() && roomPolicy === selectedRoom.chatMode && roomSlowMode === selectedRoom.slowModeSeconds)) return true;
    return askConfirmation({
      title: localizeText('Bỏ thay đổi của phòng?'),
      description: localizeText('Thay đổi này chưa được lưu. Rời phần chi tiết sẽ bỏ bản nháp.'),
      confirmLabel: localizeText('Bỏ thay đổi'),
      destructive: true,
    });
  };

  const selectRoom = async (room: AdminConversationSummary) => {
    if (roomMutating) return;
    if (!(await confirmRoomDraftDiscard())) return;
    const requestId = ++roomSelectionRequestRef.current;
    setOpeningRoomId(room.conversationId);
    setSelectedRoom(null);
    setRoomReason('');
    setRoomReadError(null);
    setFeedback(null);
    try {
      const detail = await getAdminConversation(room.conversationId);
      if (requestId !== roomSelectionRequestRef.current) return;
      setSelectedRoom(detail);
      setRooms(items => items.map(item => item.conversationId === detail.conversationId ? { ...item, avatarUrl: detail.avatarUrl } : item));
      setRoomPolicy(detail.chatMode);
      setRoomSlowMode(detail.slowModeSeconds);
    } catch (error: unknown) {
      if (requestId === roomSelectionRequestRef.current) {
        setRoomReadError(getAdminErrorMessage(error, localizeText("Không thể đọc chi tiết phòng này.")));
      }
    } finally {
      if (requestId === roomSelectionRequestRef.current) setOpeningRoomId(null);
    }
  };

  const clearRoomSelection = async () => {
    if (roomMutating || !(await confirmRoomDraftDiscard())) return false;
    roomSelectionRequestRef.current++;
    setSelectedRoom(null); setOpeningRoomId(null); setRoomReadError(null); setRoomReason('');
    return true;
  };

  const handleRoomPolicy = async () => {
    if (!selectedRoom || !roomReason.trim()) {
      setFeedback(localizeText("Cần ghi lý do cho thay đổi kiểm duyệt phòng."));
      return;
    }
    setRoomMutating(true);
    try {
      const updated = await updateAdminConversationPolicy(selectedRoom.conversationId, roomPolicy, roomSlowMode, roomReason);
      setSelectedRoom(updated);
      setRooms((current) => current.map((room) => room.conversationId === updated.conversationId ? { ...room, ...updated } : room));
      setFeedback(localizeText("Đã cập nhật chính sách phòng trên toàn ứng dụng."));
      setRoomReason("");
    } catch (error: unknown) {
      setFeedback(getAdminErrorMessage(error, localizeText("Không thể cập nhật chính sách. Kiểm tra quyền ROOM_MODERATE và lý do.")));
    } finally {
      setRoomMutating(false);
    }
  };

  const handleRoomArchive = async () => {
    if (!selectedRoom || !roomReason.trim()) {
      setFeedback(localizeText("Cần ghi lý do trước khi lưu trữ hoặc khôi phục phòng."));
      return;
    }
    const action = selectedRoom.deleted ? "restore" : "archive";
    if (!(await askConfirmation({
      title: localizeText(action === "archive" ? "Lưu trữ phòng" : "Khôi phục phòng"),
      description: localizeText(`${action === "archive" ? "Lưu trữ" : "Khôi phục"} phòng này trên toàn ứng dụng?`),
      confirmLabel: localizeText(action === "archive" ? "Lưu trữ" : "Khôi phục"),
      destructive: action === "archive",
    }))) return;
    setRoomMutating(true);
    try {
      const updated = selectedRoom.deleted
        ? await restoreAdminConversation(selectedRoom.conversationId, roomReason)
        : await archiveAdminConversation(selectedRoom.conversationId, roomReason);
      setSelectedRoom(updated);
      setRooms((current) => current.map((room) => room.conversationId === updated.conversationId ? { ...room, ...updated } : room));
      setRoomReason("");
      setFeedback(localizeText(selectedRoom.deleted ? "Đã khôi phục phòng." : "Đã lưu trữ phòng."));
    } catch (error: unknown) {
      setFeedback(getAdminErrorMessage(error, localizeText("Không thể thay đổi trạng thái phòng.")));
    } finally {
      setRoomMutating(false);
    }
  };

  const handleMessageInspection = async (event: FormEvent) => {
    event.preventDefault();
    if (!messageConversationId.trim() || !messageBucket.trim() || !messageId.trim() || !messageReason.trim()) {
      setFeedback(localizeText("Cần đủ ID cuộc trò chuyện, bucket, ID tin nhắn và lý do điều tra."));
      return;
    }
    setMessageLoading(true);
    setMessageInspection(null);
    setFeedback(null);
    try {
      setMessageInspection(await inspectAdminMessage(
        messageConversationId.trim(),
        messageId.trim(),
        messageBucket.trim(),
        messageReason,
      ));
      setFeedback(localizeText("Đã ghi nhận lượt xem tin nhắn vào nhật ký kiểm toán."));
    } catch (error: unknown) {
      setFeedback(getAdminErrorMessage(error, localizeText("Không thể đọc tin nhắn. Kiểm tra UUID, bucket, quyền AUDIT_READ và lý do.")));
    } finally {
      setMessageLoading(false);
    }
  };

  const handleReportResolution = async (draft: ReportDecisionDraft): Promise<AdminReport> => {
    if (decisionError(draft) || !canDecideReport(draft.report, draft.nextStatus)) throw new Error('Invalid report decision');
    const actorId = overview?.actorId;
    const updated = await resolveAdminReport(draft.report, draft.nextStatus, draft.resolutionCode, draft.reason);
    if (useAuthStore.getState().user?.userId !== actorId) throw new Error('Admin session changed');
    if (reportIdentity(updated) !== reportIdentity(draft.report) || updated.status !== draft.nextStatus) throw new Error('Unexpected report result');
    setReports(current => current.filter(item => reportIdentity(item) !== reportIdentity(updated)));
    return updated;
  };

  const loadSanctionHistory = async (userId: string) => {
    const requestId = ++sanctionTargetRequestRef.current, actorId = user?.userId;
    setSanctions([]); setSanctionsLoading(true);
    const ownsRequest = () => requestId === sanctionTargetRequestRef.current && useAuthStore.getState().user?.userId === actorId;
    try {
      const history = await listAdminSanctions(userId, 50);
      if (ownsRequest()) setSanctions(history);
    } catch (error: unknown) {
      if (ownsRequest()) setFeedback(getAdminErrorMessage(error, locale === 'vi' ? 'Chưa tải được chế tài.' : 'Could not load sanctions.'));
    } finally { if (ownsRequest()) setSanctionsLoading(false); }
  };

  const handleImposeSanction = async () => {
    if (moderationMutating) return;
    if (!sanctionTargetUserId.trim() || !moderationReason.trim()) {
      setFeedback(localizeText("Cần ID người dùng và lý do trước khi áp dụng chế tài."));
      return;
    }
    if (sanctionScope === "CONVERSATION" && !sanctionConversationId.trim()) {
      setFeedback(localizeText("Chế tài theo phòng cần ID cuộc trò chuyện."));
      return;
    }
    if (!(await askConfirmation({
      title: locale === 'vi' ? 'Xác nhận áp dụng chế tài' : 'Confirm user sanction',
      description: `${sanctionTypeLabel(sanctionType)} · ${sanctionScopeLabel(sanctionScope)} · ${sanctionTargetUserId.trim()}`,
      confirmLabel: locale === 'vi' ? 'Áp dụng chế tài' : 'Apply sanction',
      destructive: sanctionType !== 'WARNING',
    }))) return;
    setModerationMutating(true);
    setFeedback(null);
    try {
      await imposeAdminSanction({
        userId: sanctionTargetUserId.trim(),
        scope: sanctionScope,
        conversationId: sanctionScope === "CONVERSATION" ? sanctionConversationId.trim() : undefined,
        sanctionType,
        expiresAt: sanctionExpiresAt ? new Date(sanctionExpiresAt).toISOString() : undefined,
        reasonCode: resolutionCode.trim() || undefined,
        reasonText: moderationReason,
      });
      setSanctions(await listAdminSanctions(sanctionTargetUserId.trim(), 50));
      setModerationReason("");
      setResolutionCode("");
      setSanctionExpiresAt("");
      setFeedback(localizeText("Đã áp dụng chế tài và ghi nhật ký kiểm toán."));
    } catch (error: unknown) {
      setFeedback(getAdminErrorMessage(error, localizeText("Không thể áp dụng chế tài. Kiểm tra ID người dùng, quyền và thời hạn.")));
    } finally {
      setModerationMutating(false);
    }
  };

  const handleRevokeSanction = async (sanction: AdminSanction) => {
    if (!moderationReason.trim()) {
      setFeedback(localizeText("Cần ghi lý do khi thu hồi chế tài."));
      return;
    }
    if (!(await askConfirmation({
      title: localizeText("Thu hồi chế tài"),
      description: localizeText(`Thu hồi chế tài ${sanction.sanctionId.slice(0, 8)}…?`),
      confirmLabel: localizeText("Thu hồi"),
      destructive: true,
    }))) return;
    setModerationMutating(true);
    try {
      await revokeAdminSanction(sanction, moderationReason);
      setSanctions((current) => current.map((item) => item.sanctionId === sanction.sanctionId ? { ...item, status: "REVOKED", revokedAt: new Date().toISOString() } : item));
      setModerationReason("");
      setFeedback(localizeText("Đã thu hồi chế tài."));
    } catch (error: unknown) {
      setFeedback(getAdminErrorMessage(error, localizeText("Không thể thu hồi chế tài hoặc chế tài đã hết hiệu lực.")));
    } finally {
      setModerationMutating(false);
    }
  };

  const exitAdmin = async () => {
    if (reportExitState.busy || userExitState.busy) return;
    if (userExitState.draft && !(await askConfirmation({
      title: locale === "vi" ? "Rời thao tác người dùng?" : "Leave the user action?",
      description: userExitState.uncertain
        ? locale === "vi" ? "Máy chủ có thể đã thực hiện. Rời trang không hủy yêu cầu hoặc gửi lại." : "The server may have completed it. Leaving neither cancels nor resubmits the request."
        : locale === "vi" ? "Bản nháp chưa gửi sẽ bị bỏ." : "The unsent draft will be discarded.",
      confirmLabel: locale === "vi" ? "Rời trang" : "Leave page", destructive: true,
    }))) return;
    if (reportExitState.draft && !(await askConfirmation({
      title: locale === 'vi' ? 'Rời bản nháp báo cáo?' : 'Leave the report draft?',
      description: locale === 'vi' ? 'Rời trang sẽ bỏ bản nháp trong bộ nhớ. Không gửi thêm quyết định.' : 'Leaving discards the in-memory draft. No further decision will be submitted.',
      confirmLabel: locale === 'vi' ? 'Rời trang' : 'Leave',
      destructive: true,
    }))) return;
    if (onBackToApp) onBackToApp(); else router.push('/app');
  };

  if (authLoading || loading) {
    return (
      <AdminPageShell onBackToApp={() => (onBackToApp ? onBackToApp() : router.push('/app'))}>
        <div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner size="lg" /></div>
      </AdminPageShell>
    );
  }

  if (!user) return null;

  if (!overview) {
    const denied = errorStatus === 403;
    return (
      <AdminPageShell onBackToApp={() => (onBackToApp ? onBackToApp() : router.push('/app'))}>
        <Card className="mx-auto mt-12 max-w-xl">
          <CardHeader>
            <CardTitle>{localizeText(denied ? "Bạn không có quyền truy cập" : "Không tải được khu vực quản trị")}</CardTitle>
            <CardDescription>{errorMessage ?? localizeText("Vui lòng thử lại sau.")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => void loadOverview(true)} loading={refreshing}><RefreshCcw size={16} /> {localizeText("Thử lại")}</Button>
          </CardContent>
        </Card>
      </AdminPageShell>
    );
  }

  const canReadRooms = overview.permissions.includes("ROOM_READ");
  const canModerateRooms = overview.permissions.includes("ROOM_MODERATE");
  const canReadAudit = overview.permissions.includes("AUDIT_READ");
  const canReadAnalytics = overview.permissions.includes("ANALYTICS_READ");
  const canManageReports = overview.permissions.includes("REPORT_MANAGE");
  const canManageStickers = overview.permissions.includes("SYSTEM_OPERATE");
  const adminWorkspaces: Array<{ id: AdminWorkspace; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'overview', label: localizeText('Tổng quan'), icon: LayoutDashboard },
    ...(canReadRooms ? [{ id: 'rooms' as const, label: localizeText('Phòng'), icon: RadioTower }] : []),
    ...(canManageReports || canReadAudit ? [{ id: 'safety' as const, label: localizeText('Báo cáo'), icon: ShieldAlert }] : []),
    ...(canReadAudit || canReadAnalytics ? [{ id: 'insights' as const, label: localizeText('Nhật ký'), icon: Activity }] : []),
    { id: 'access', label: localizeText('Quản lý người dùng'), icon: KeyRound },
    ...(canManageStickers ? [{ id: 'stickers' as const, label: 'Sticker', icon: Sticker }] : []),
    ...(canOperateSystem ? [{ id: 'system-settings' as const, label: localizeText('Cài đặt ứng dụng'), icon: Settings2 }] : []),
  ];
  const currentAdminWorkspace = adminWorkspaces.find((workspace) => workspace.id === activeWorkspace) ?? adminWorkspaces[0];
  const CurrentWorkspaceIcon = currentAdminWorkspace.icon;

  return (
    <AdminPageShell onBackToApp={() => void exitAdmin()}>
      <div className="admin-workbench">
        <nav className="admin-workspace-nav" aria-label={localizeText('Khu vực quản trị')}>
          {adminWorkspaces.map((workspace) => {
            const Icon = workspace.icon;
            const active = activeWorkspace === workspace.id;
            return (
              <button
                key={workspace.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                className="admin-workspace-tab"
                data-active={active || undefined}
                onClick={() => setActiveWorkspace(workspace.id)}
              >
                <span className="admin-workspace-symbol" data-workspace={workspace.id}><Icon size={17} aria-hidden="true" /></span>
                <span>{workspace.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="admin-workbench-main">
        <div className="admin-pagebar" data-workspace={currentAdminWorkspace.id}>
          <h1 ref={workspaceHeading} tabIndex={-1} className="sr-only text-2xl font-semibold tracking-tight md:not-sr-only">{currentAdminWorkspace.label}</h1>
          <div className="admin-workspace-picker md:hidden">
            <span className="admin-workspace-symbol" data-workspace={currentAdminWorkspace.id}><CurrentWorkspaceIcon size={17} aria-hidden="true" /></span>
            <Select aria-label={localizeText('Khu vực quản trị')} value={currentAdminWorkspace.id}
              onChange={event => setActiveWorkspace(event.target.value as AdminWorkspace)}>
              {adminWorkspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.label}</option>)}
            </Select>
          </div>
          <AdminWorkspaceArtwork key={currentAdminWorkspace.id} workspace={currentAdminWorkspace.id} />
          {activeWorkspace === 'overview' ? <Button variant="ghost" size="icon" aria-label={localizeText('Làm mới')} title={localizeText('Làm mới')}
            onClick={() => void loadOverview(true)} loading={refreshing}><RefreshCcw size={17} /></Button> : null}
        </div>

        {activeWorkspace === 'overview' ? <AdminOverviewPanel rooms={rooms} reports={reports} health={health} roomsLoading={roomsLoading} reportsLoading={reportsLoading} roomsError={roomsError} reportsError={reportsError}
          month={roomMonth} reportDay={reportDay} reportFilter={reportStatusFilter} canReadRooms={canReadRooms} canReadReports={canManageReports}
          onRetryRooms={() => setRoomReload(value => value + 1)}
          onRooms={() => openWorkspaceFromOverview('rooms')} onReports={() => openWorkspaceFromOverview('safety')}
          onRoom={room => { setActiveWorkspace('rooms'); void selectRoom(room); }}
          onReport={report => { setReportOpenRequest({ identity: reportIdentity(report) }); setActiveWorkspace('safety'); }} /> : null}

        {canManageStickers && (activeWorkspace === 'stickers' || stickerWorkspaceOpened) ? <div hidden={activeWorkspace !== 'stickers'}><StickerAdminPanel key={overview.actorId} /></div> : null}
        {canOperateSystem && (activeWorkspace === 'system-settings' || settingsWorkspaceOpened) ? (
          <div hidden={activeWorkspace !== 'system-settings'}>
            <SystemSettingsPanel key={overview.actorId}
              supplementaryTools={activeWorkspace === 'system-settings' ? <AdminEmailDeliveryLookup /> : null} />
          </div>
        ) : null}
        {activeWorkspace === 'rooms' ? !canReadRooms
          ? <p className="text-sm text-muted-foreground">{localizeText('Bạn không có quyền xem phòng.')}</p>
          : <AdminRoomDirectory rooms={rooms} month={roomMonth} loading={roomsLoading} directoryError={roomsError} onReload={() => setRoomReload(value => value + 1)} openingRoomId={openingRoomId} readError={roomReadError}
            selectedRoom={selectedRoom} canModerate={canModerateRooms} busy={roomMutating} policy={roomPolicy} slowMode={roomSlowMode} reason={roomReason}
            onMonth={value => { void clearRoomSelection().then(cleared => { if (cleared) setRoomMonth(value); }); }} onSelect={room => void selectRoom(room)} onBack={clearRoomSelection}
            onPolicy={setRoomPolicy} onSlowMode={setRoomSlowMode} onReason={setRoomReason} onSave={() => void handleRoomPolicy()} onArchive={() => void handleRoomArchive()} /> : null}

        {activeWorkspace === 'insights' && canReadAudit ? (
          <AdminAuditLog open={!canReadAnalytics} month={auditMonth} events={auditEvents}
            loading={auditLoading} error={auditError} exporting={auditExporting}
            exportError={auditExportError?.month === auditMonth ? auditExportError.message : null}
            onMonthChange={setAuditMonth} onRetry={() => setAuditReload(value => value + 1)}
            onExport={() => void handleAuditExport()} />
        ) : null}

        {canManageReports ? <div hidden={activeWorkspace !== 'safety'}><AdminReportInbox key={overview.actorId}
          reports={reports} loading={reportsLoading} error={reportsError} day={reportDay} status={reportStatusFilter}
          onDay={setReportDay} onStatus={setReportStatusFilter} onReload={() => setReportReload(value => value + 1)}
          onResolve={handleReportResolution} onExitState={setReportExitState} openRequest={reportOpenRequest}
          onTarget={userId => { if (moderationMutating) return; ++sanctionTargetRequestRef.current; setSanctionsLoading(false); setSanctionTargetUserId(userId); setSanctions([]); setSanctionOpen(true); requestAnimationFrame(() => document.getElementById('admin-sanction-user')?.focus()); }} /></div> : null}

        {activeWorkspace === 'safety' && canReadAudit ? <AdminToolSection kind="message" title={localizeText("Điều tra tin nhắn")}>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleMessageInspection}>
              <div><label htmlFor="admin-message-conversation-id" className="block text-xs font-semibold text-muted-foreground">{localizeText("ID cuộc trò chuyện")}</label><Input id="admin-message-conversation-id" className="mt-1" value={messageConversationId} onChange={(event) => setMessageConversationId(event.target.value)} placeholder="UUID" /></div>
              <div><label htmlFor="admin-message-id" className="block text-xs font-semibold text-muted-foreground">{localizeText("ID tin nhắn")}</label><Input id="admin-message-id" className="mt-1" value={messageId} onChange={(event) => setMessageId(event.target.value)} placeholder="UUID" /></div>
              <div><label htmlFor="admin-message-bucket" className="block text-xs font-semibold text-muted-foreground">{localizeText("Khoảng tin nhắn")}</label><Input id="admin-message-bucket" className="mt-1" value={messageBucket} onChange={(event) => setMessageBucket(event.target.value)} placeholder="YYYY-MM-DD-HH:NN" /></div>
              <div><label htmlFor="admin-message-reason" className="block text-xs font-semibold text-muted-foreground">{localizeText("Lý do điều tra (bắt buộc)")}</label><Input id="admin-message-reason" className="mt-1" value={messageReason} onChange={(event) => setMessageReason(event.target.value)} placeholder={localizeText("Ví dụ: xử lý báo cáo tin nhắn")}/></div>
              <div className="md:col-span-2"><Button type="submit" loading={messageLoading} disabled={!messageConversationId.trim() || !messageBucket.trim() || !messageId.trim() || !messageReason.trim()}><Eye size={16} />{localizeText("Đọc tin nhắn")}</Button></div>
            </form>
            {messageInspection ? <div className="mt-5 rounded-xl border border-border/60 bg-background/45 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><History size={16} className="text-primary" /><span className="text-sm font-semibold">{messageInspection.message.messageType}</span><Badge variant={messageInspection.message.isDeleted ? "destructive" : "outline"}>{messageInspection.message.isDeleted ? localizeText("Đã xoá (tombstone)") : localizeText("Đang hiển thị")}</Badge>{messageInspection.message.isPinned ? <Badge variant="secondary">{localizeText("Đã ghim")}</Badge> : null}</div><p className="mt-2 break-all text-xs text-muted-foreground">{messageInspection.message.messageId} · {messageInspection.message.messageBucket}</p></div><span className="text-xs text-muted-foreground">{formatDate(messageInspection.message.createdAt)}</span></div><div className="mt-4 rounded-lg border border-border/60 bg-background px-3 py-3 text-sm leading-6 whitespace-pre-wrap break-words">{messageInspection.message.content || localizeText("Tin nhắn không có nội dung văn bản.")}</div><dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div><dt className="text-muted-foreground">{localizeText("Người gửi")}</dt><dd className="mt-1 break-all font-semibold">{messageInspection.message.senderId}</dd></div><div><dt className="text-muted-foreground">{localizeText("Đã chỉnh sửa")}</dt><dd className="mt-1 font-semibold">{formatDate(messageInspection.message.editedAt)}</dd></div><div><dt className="text-muted-foreground">{localizeText("Người xoá")}</dt><dd className="mt-1 break-all font-semibold">{messageInspection.message.deletedBy ?? localizeText("Không có")}</dd></div><div><dt className="text-muted-foreground">{localizeText("Thời điểm xoá")}</dt><dd className="mt-1 font-semibold">{formatDate(messageInspection.message.deletedAt)}</dd></div></dl><div className="mt-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{localizeText("Lịch sử chỉnh sửa")}</p>{messageInspection.revisions.length ? <div className="mt-2 space-y-2">{messageInspection.revisions.map((revision) => <div key={`${revision.revisionNumber}-${revision.editedAt}`} className="rounded-lg border border-border/60 px-3 py-2"><div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="outline">#{revision.revisionNumber} · {revision.action}</Badge><span className="text-xs text-muted-foreground">{formatDate(revision.editedAt)}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5">{revision.content || localizeText("Không có nội dung text.")}</p><p className="mt-1 break-all text-[11px] text-muted-foreground">{revision.editedBy ?? localizeText("Không xác định")}</p></div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">{localizeText("Tin nhắn chưa có lịch sử chỉnh sửa.")}</p>}</div></div> : null}
        </AdminToolSection> : null}

        {activeWorkspace === 'insights' && canReadAnalytics ? <AdminToolSection kind="activity" title={localizeText("Số liệu vận hành")} open>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[150px] flex-1"><label htmlFor="admin-analytics-from" className="block text-xs text-muted-foreground">{localizeText('Từ ngày (UTC)')}</label><Input id="admin-analytics-from" className="mt-2" type="date" value={analyticsFrom} onChange={event => setAnalyticsFrom(event.target.value)} /></div>
              <div className="min-w-[150px] flex-1"><label htmlFor="admin-analytics-to" className="block text-xs text-muted-foreground">{localizeText('Đến ngày (UTC)')}</label><Input id="admin-analytics-to" className="mt-2" type="date" value={analyticsTo} onChange={event => setAnalyticsTo(event.target.value)} /></div>
              <div className="min-w-[180px] flex-1"><label htmlFor="admin-analytics-type" className="block text-xs text-muted-foreground">{localizeText('Loại sự kiện')}</label><Select id="admin-analytics-type" className="mt-2" value={analyticsType} onChange={event => setAnalyticsType(event.target.value)}>{ANALYTICS_EVENT_OPTIONS.map(option => <option key={option.value} value={option.value}>{localizeText(option.label)}</option>)}</Select></div>
            </div>
            {analyticsError ? <div role="alert" className="space-y-3 py-6 text-sm"><p>{analyticsError}</p><Button type="button" variant="outline" onClick={() => setAnalyticsReload(value => value + 1)}>{localizeText('Thử lại')}</Button></div>
              : analyticsLoading ? <div className="space-y-3 py-6" role="status" aria-label={localizeText('Đang tải số liệu')}><Skeleton className="h-36 w-full" /><Skeleton className="h-6 w-2/3" /></div>
              : analyticsPoints.length ? <AdminActivityChart key={`${analyticsFrom}:${analyticsTo}:${analyticsType}`} points={analyticsPoints} labelForType={analyticsEventLabel} />
              : <p className="py-8 text-center text-sm text-muted-foreground">{localizeText('Chưa có số liệu trong khoảng này.')}</p>}
        </AdminToolSection> : null}

        {activeWorkspace === 'safety' && canManageReports ? (
          <AdminToolSection kind="sanction" title={localizeText("Áp dụng chế tài người dùng")} open={sanctionOpen} onOpenChange={setSanctionOpen}>
              <div className="grid gap-3 md:grid-cols-2">
                <div><label htmlFor="admin-sanction-user" className="block text-xs font-semibold text-muted-foreground">{localizeText("ID người dùng mục tiêu")}</label><Input id="admin-sanction-user" className="mt-1" value={sanctionTargetUserId} disabled={moderationMutating} onChange={(event) => { ++sanctionTargetRequestRef.current; setSanctionsLoading(false); setSanctions([]); setSanctionTargetUserId(event.target.value); }} placeholder={localizeText("UUID của người dùng")} /></div>
                <div><label htmlFor="admin-sanction-scope" className="block text-xs font-semibold text-muted-foreground">{localizeText("Phạm vi")}</label><Select id="admin-sanction-scope" value={sanctionScope} onChange={(event) => setSanctionScope(event.target.value as AdminSanction['scope'])} className="mt-1"><option value="APP">{localizeText("Ứng dụng")}</option><option value="CONVERSATION">{localizeText("Cuộc trò chuyện")}</option></Select></div>
                <div><label htmlFor="admin-sanction-type" className="block text-xs font-semibold text-muted-foreground">{localizeText("Loại chế tài")}</label><Select id="admin-sanction-type" value={sanctionType} onChange={(event) => setSanctionType(event.target.value as AdminSanction['sanctionType'])} className="mt-1"><option value="BAN">{localizeText("Cấm")}</option><option value="SUSPEND">{localizeText("Tạm ngưng")}</option><option value="MUTE">{localizeText("Tắt tiếng")}</option><option value="WARNING">{localizeText("Cảnh cáo")}</option></Select></div>
                {sanctionScope === "CONVERSATION" ? <div><label htmlFor="admin-sanction-conversation" className="block text-xs font-semibold text-muted-foreground">{localizeText("ID cuộc trò chuyện")}</label><Input id="admin-sanction-conversation" className="mt-1" value={sanctionConversationId} onChange={(event) => setSanctionConversationId(event.target.value)} placeholder={localizeText("UUID của phòng")} /></div> : null}
                <div><label htmlFor="admin-sanction-expiry" className="block text-xs font-semibold text-muted-foreground">{localizeText("Hết hạn (tuỳ chọn)")}</label><Input id="admin-sanction-expiry" className="mt-1" type="datetime-local" value={sanctionExpiresAt} onChange={(event) => setSanctionExpiresAt(event.target.value)} /></div>
                <div><label htmlFor="admin-resolution-code" className="block text-xs font-semibold text-muted-foreground">{localizeText("Mã lý do")}</label><Input id="admin-resolution-code" className="mt-1" value={resolutionCode} onChange={(event) => setResolutionCode(event.target.value)} placeholder={localizeText("SPAM, ABUSE...")} /></div>
              </div>
              <label htmlFor="admin-moderation-reason" className="mt-3 block text-xs font-semibold text-muted-foreground">{localizeText("Lý do chi tiết (bắt buộc)")}</label>
              <Input id="admin-moderation-reason" className="mt-1" value={moderationReason} onChange={(event) => setModerationReason(event.target.value)} placeholder={localizeText("Ghi rõ căn cứ quyết định")} />
              <Button className="mt-4" onClick={() => void handleImposeSanction()} loading={moderationMutating}>{localizeText("Áp dụng chế tài")}</Button>
            {sanctionsLoading ? <div className="mt-5 flex justify-center py-4"><LoadingSpinner /></div> : sanctionTargetUserId && sanctions.length ? <div className="mt-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{localizeText("Chế tài của người dùng mục tiêu đang chọn")}</p><div className="mt-3 space-y-2">{sanctions.map((sanction) => <div key={sanction.sanctionId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2"><div><Badge variant={sanction.status === "ACTIVE" ? "destructive" : "outline"}>{sanctionTypeLabel(sanction.sanctionType)} · {sanctionStatusLabel(sanction.status)}</Badge><p className="mt-1 text-xs text-muted-foreground">{sanctionScopeLabel(sanction.scope)} · {sanction.reasonText}</p></div>{sanction.status === "ACTIVE" ? <Button size="sm" variant="outline" onClick={() => void handleRevokeSanction(sanction)} loading={moderationMutating}>{localizeText("Thu hồi")}</Button> : null}</div>)}</div></div> : null}
          </AdminToolSection>
        ) : null}

        <div hidden={activeWorkspace !== 'access'}>
          <AdminUserWorkspace key={`${overview.actorId}:${overview.permissions.join('|')}`} overview={overview} onExitState={setUserExitState}
            onSanctions={userId => {
              if (moderationMutating) return;
              setSanctionTargetUserId(userId); setSanctionOpen(true); setActiveWorkspace('safety');
              void loadSanctionHistory(userId);
              requestAnimationFrame(() => document.getElementById('admin-sanction-user')?.focus());
            }} />
        </div>

        {feedback ? <p role="status" className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">{feedback}</p> : null}
        {confirmation ? (
          <ConfirmDialog
            open
            onOpenChange={(open) => {
              if (!open) resolveConfirmation(false);
            }}
            title={confirmation.title}
            description={confirmation.description}
            confirmLabel={confirmation.confirmLabel}
            destructive={confirmation.destructive}
            onConfirm={() => resolveConfirmation(true)}
          />
        ) : null}
        </div>
      </div>
    </AdminPageShell>
  );
};

export default AdminPage;
