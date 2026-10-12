import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Activity, Archive, ArrowLeft, BarChart3, Building2, ChevronDown, Download, Eye, History, KeyRound, LayoutDashboard, RadioTower, RefreshCcw, Search, ScrollText, Server, ShieldAlert, ShieldCheck, UserCog, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AdminPageShell } from "@/route-pages/shared/layout/AdminPageShell";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, ConfirmDialog, Input, LoadingSpinner, Select, SurfacePanel } from "@/shared/ui";
import { useAuthStore } from "@/features/auth/model/auth.store";
import type { UserDTO } from "@/entities/user/model/user.types";
import {
  type AdminHealthSnapshot,
  type AdminAuditEvent,
  type AdminReport,
  type AdminSanction,
  type AdminConversationSummary,
  type AdminOverview,
  type AdminRoleGrant,
  type AdminSession,
  type AdminDevice,
  type AdminAnalyticsPoint,
  type AdminMessageInspection,
  getAdminHealth,
  getAdminConversation,
  getAdminOverview,
  getAdminUserRoles,
  listAdminConversations,
  listAdminAuditEvents,
  exportAdminAuditEvents,
  listAdminReports,
  resolveAdminReport,
  imposeAdminSanction,
  listAdminSanctions,
  revokeAdminSanction,
  archiveAdminConversation,
  grantAdminRole,
  revokeAdminRole,
  searchAdminUsers,
  restoreAdminConversation,
  updateAdminUserStatus,
  listAdminSessions,
  revokeAdminSession,
  listAdminDevices,
  revokeAdminDevice,
  listAdminAnalytics,
  updateAdminConversationPolicy,
  inspectAdminMessage,
} from "@/features/admin/api/admin.api";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";
import { localizeText, useAppLocale } from "@/shared/i18n";
import { logger } from "@/shared/lib/logger";
import { getUserFacingErrorMessage } from "@/shared/lib/user-facing-error";
import { BrandText } from "@/shared/ui/BrandWord";

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

const roleBadgeVariant = (role: string): "default" | "destructive" | "secondary" =>
  role === "SUPER_ADMIN" ? "destructive" : role === "APP_ADMIN" ? "default" : "secondary";

const reportStatusLabel = (status: AdminReport["status"]) => strictLocalizedLabel("report status", status, {
  OPEN: "Mở",
  IN_REVIEW: "Đang xem xét",
  RESOLVED: "Đã giải quyết",
  DISMISSED: "Đã bỏ qua",
});

const sanctionStatusLabel = (status: AdminSanction["status"]) => strictLocalizedLabel("sanction status", status, {
  ACTIVE: "Đang hoạt động",
  REVOKED: "Đã thu hồi",
  EXPIRED: "Đã hết hạn",
});

const accountStatusLabel = (status: "ACTIVE" | "SUSPENDED" | "BANNED") => strictLocalizedLabel("account status", status, {
  ACTIVE: "Đang hoạt động",
  SUSPENDED: "Tạm khóa",
  BANNED: "Bị cấm",
});

const AUDIT_ACTION_LABELS: Record<string, string> = {
  FRIEND_REQUEST_SEND: "Gửi lời mời kết bạn",
  FRIEND_REQUEST_CANCEL: "Hủy lời mời kết bạn",
  FRIEND_REQUEST_ACCEPT: "Chấp nhận lời mời kết bạn",
  FRIEND_REQUEST_DECLINE: "Từ chối lời mời kết bạn",
  FRIEND_BLOCK: "Chặn bạn bè",
  FRIEND_UNBLOCK: "Bỏ chặn bạn bè",
  FRIEND_REMOVE: "Xóa bạn bè",
  USER_PROFILE_UPDATE: "Cập nhật hồ sơ",
  USER_ACCOUNT_STATUS_UPDATE: "Cập nhật trạng thái tài khoản",
  USER_SESSION_REVOKED: "Thu hồi phiên đăng nhập",
  USER_DEVICE_REVOKED: "Thu hồi thiết bị",
  APP_ROLE_GRANTED: "Cấp vai trò ứng dụng",
  APP_ROLE_REVOKED: "Thu hồi vai trò ứng dụng",
  ADMIN_MESSAGE_VIEW: "Xem tin nhắn điều tra",
  ADMIN_CONVERSATION_CHAT_POLICY_UPDATE: "Cập nhật chính sách trò chuyện toàn cục",
  ADMIN_CONVERSATION_ARCHIVE: "Lưu trữ phòng",
  ADMIN_CONVERSATION_RESTORE: "Khôi phục phòng",
  CONVERSATION_CREATE: "Tạo phòng",
  MEMBER_ADD: "Thêm thành viên",
  MEMBER_REMOVE: "Xóa thành viên",
  MEMBER_BAN: "Cấm thành viên",
  MEMBER_UNBAN: "Bỏ cấm thành viên",
  COMMUNITY_JOIN: "Tham gia cộng đồng",
  COMMUNITY_JOIN_REQUEST: "Yêu cầu tham gia cộng đồng",
  MEMBER_LEFT: "Rời phòng",
  CONVERSATION_PIN: "Ghim phòng",
  CONVERSATION_UNPIN: "Bỏ ghim phòng",
  CONVERSATION_CHAT_POLICY_UPDATE: "Cập nhật chính sách trò chuyện",
  CONVERSATION_NOTIFICATION_POLICY_UPDATE: "Cập nhật chính sách thông báo phòng",
  MEMBER_NOTIFICATION_POLICY_UPDATE: "Cập nhật chính sách thông báo thành viên",
  MEMBER_CHAT_POLICY_UPDATE: "Cập nhật chính sách trò chuyện thành viên",
  MESSAGE_SEND: "Gửi tin nhắn",
  MESSAGE_EDIT: "Chỉnh sửa tin nhắn",
  MESSAGE_DELETE: "Xóa tin nhắn",
  MESSAGE_REACTION_ADD: "Thêm cảm xúc tin nhắn",
  MESSAGE_REACTION_REMOVE: "Xóa cảm xúc tin nhắn",
  MESSAGE_PIN: "Ghim tin nhắn",
  MESSAGE_UNPIN: "Bỏ ghim tin nhắn",
  POLL_CREATE: "Tạo bình chọn",
  POLL_VOTE: "Bình chọn",
  POLL_VOTE_CHANGE: "Đổi lựa chọn bình chọn",
  POLL_VOTE_REMOVE: "Gỡ bình chọn",
  POLL_CLOSE: "Đóng bình chọn",
  INVITE_CREATE: "Tạo lời mời",
  JOIN_REQUEST_CREATE: "Tạo yêu cầu tham gia",
  JOIN_BY_INVITE: "Tham gia bằng lời mời",
  INVITE_REVOKE: "Thu hồi lời mời",
  INVITE_DECLINE: "Từ chối lời mời",
  JOIN_REQUEST_APPROVE: "Duyệt yêu cầu tham gia",
  JOIN_REQUEST_DECLINE: "Từ chối yêu cầu tham gia",
  ROLE_CREATED: "Tạo vai trò phòng",
  ROLE_DELETED: "Xóa vai trò phòng",
  ROLES_ASSIGNED: "Gán vai trò phòng",
  OWNERSHIP_TRANSFERRED: "Chuyển quyền sở hữu phòng",
  REPORT_CREATED: "Tạo báo cáo",
  REPORT_STATUS_UPDATE: "Cập nhật trạng thái báo cáo",
  SANCTION_IMPOSED: "Áp dụng chế tài",
  SANCTION_REVOKED: "Thu hồi chế tài",
  SANCTION_EXPIRED: "Chế tài hết hạn",
};

const auditActionLabel = (action: string): string => {
  const label = AUDIT_ACTION_LABELS[action];
  if (!label) throw new Error(`Unsupported audit action: ${action}`);
  return localizeText(label);
};

const auditOutcomeLabel = (outcome: string): string => {
  const label = ({ SUCCESS: "Thành công", FAILED: "Thất bại" } as Record<string, string>)[outcome];
  if (!label) throw new Error(`Unsupported audit outcome: ${outcome}`);
  return localizeText(label);
};

const reportTargetLabel = (targetType: AdminReport["targetType"]): string => {
  const label = ({
    USER: "Người dùng",
    MESSAGE: "Tin nhắn",
    CONVERSATION: "Cuộc trò chuyện",
  } as Record<string, string>)[targetType];
  if (!label) throw new Error(`Unsupported report target type: ${targetType}`);
  return localizeText(label);
};

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

type AdminWorkspace = 'overview' | 'rooms' | 'safety' | 'insights' | 'access';

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
  const [mobileWorkspaceMenuOpen, setMobileWorkspaceMenuOpen] = useState(false);
  const [health, setHealth] = useState<AdminHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDTO | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<AdminRoleGrant[]>([]);
  const [userSessions, setUserSessions] = useState<AdminSession[]>([]);
  const [userDevices, setUserDevices] = useState<AdminDevice[]>([]);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleCode, setRoleCode] = useState("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [mutating, setMutating] = useState(false);
  const [feedback, setFeedbackState] = useState<string | null>(null);
  const [roomMonth, setRoomMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rooms, setRooms] = useState<AdminConversationSummary[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<AdminConversationSummary | null>(null);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [auditMonth, setAuditMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [auditEvents, setAuditEvents] = useState<AdminAuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditExporting, setAuditExporting] = useState(false);
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
  const [reportDay, setReportDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportStatusFilter, setReportStatusFilter] = useState<AdminReport['status']>('OPEN');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
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
  const [userStatus, setUserStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'BANNED'>('ACTIVE');
  const [confirmation, setConfirmation] = useState<AdminConfirmation | null>(null);
  const confirmationResolver = useRef<((accepted: boolean) => void) | null>(null);
  const overviewRequestRef = useRef(0);
  const userSelectionRequestRef = useRef(0);
  const roomSelectionRequestRef = useRef(0);
  useAppLocale();
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
      setRoleCode((current) => current || overviewResult.availableRoleCodes[0] || "");
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
    void listAdminConversations(roomMonth, 100)
      .then((result) => {
        if (active) setRooms(result);
      })
      .catch((error: unknown) => {
        if (active) setFeedback(getAdminErrorMessage(error, localizeText("Không thể tải danh sách phòng của tháng này.")));
      })
      .finally(() => {
        if (active) setRoomsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [overview, roomMonth]);

  useEffect(() => {
    if (!overview?.permissions.includes("AUDIT_READ")) return;
    let active = true;
    setAuditLoading(true);
    void listAdminAuditEvents(auditMonth, 50)
      .then((result) => {
        if (active) setAuditEvents(result);
      })
      .catch((error: unknown) => {
        if (active) setFeedback(getAdminErrorMessage(error, localizeText("Không thể tải nhật ký kiểm toán của tháng này.")));
      })
      .finally(() => {
        if (active) setAuditLoading(false);
      });
    return () => {
      active = false;
    };
  }, [overview, auditMonth]);

  const handleAuditExport = async () => {
    setAuditExporting(true);
    setFeedback(null);
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
      setFeedback(localizeText("Đã xuất tệp CSV nhật ký kiểm toán cho tháng đã chọn."));
    } catch (error: unknown) {
      setFeedback(getAdminErrorMessage(error, localizeText("Không thể xuất tệp CSV nhật ký kiểm toán. Kiểm tra quyền AUDIT_READ và tháng đã chọn.")));
    } finally {
      setAuditExporting(false);
    }
  };

  useEffect(() => {
    if (!overview?.permissions.includes("ANALYTICS_READ")) return;
    let active = true;
    setAnalyticsLoading(true);
    void listAdminAnalytics({ from: analyticsFrom, to: analyticsTo, eventType: analyticsType, limit: 200 })
      .then((result) => {
        if (active) setAnalyticsPoints(result);
      })
      .catch((error: unknown) => {
        if (active) setFeedback(getAdminErrorMessage(error, localizeText("Không thể tải số liệu tổng hợp trong khoảng thời gian này.")));
      })
      .finally(() => {
        if (active) setAnalyticsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [overview, analyticsFrom, analyticsTo, analyticsType]);

  useEffect(() => {
    if (!overview?.permissions.includes("REPORT_MANAGE")) return;
    let active = true;
    setReportsLoading(true);
    void listAdminReports(reportStatusFilter, reportDay, 50)
      .then((result) => {
        if (active) setReports(result);
      })
      .catch((error: unknown) => {
        if (active) setFeedback(getAdminErrorMessage(error, localizeText("Không thể tải hàng đợi báo cáo của ngày này.")));
      })
      .finally(() => {
        if (active) setReportsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [overview, reportStatusFilter, reportDay]);

  const assignedRoleCodes = useMemo(
    () => new Set(selectedRoles.map((role) => role.roleCode)),
    [selectedRoles],
  );
  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 2) {
      setFeedback(localizeText("Nhập ít nhất 2 ký tự để tìm người dùng."));
      return;
    }
    setSearching(true);
    setFeedback(null);
    try {
      setUsers(await searchAdminUsers(normalized));
    } catch (error: unknown) {
      setFeedback(getAdminErrorMessage(error, localizeText("Không thể tìm người dùng trong lúc này.")));
    } finally {
      setSearching(false);
    }
  };

  const selectUser = async (candidate: UserDTO) => {
    const requestId = ++userSelectionRequestRef.current;
    setSelectedUser(candidate);
    setSanctionTargetUserId(candidate.userId);
    setUserStatus(candidate.status === "BANNED" ? "BANNED" : candidate.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE");
    setSelectedRoles([]);
    setSanctions([]);
    setUserSessions([]);
    setUserDevices([]);
    setRolesLoading(true);
    setFeedback(null);
    try {
      const roles = await getAdminUserRoles(candidate.userId);
      if (requestId !== userSelectionRequestRef.current) return;
      setSelectedRoles(roles);
    } catch (error: unknown) {
      if (requestId !== userSelectionRequestRef.current) return;
      setSelectedRoles([]);
      setFeedback(getAdminErrorMessage(error, localizeText("Không thể đọc vai trò của người dùng này.")));
    } finally {
      if (requestId === userSelectionRequestRef.current) setRolesLoading(false);
    }
    if (overview?.permissions.includes("REPORT_MANAGE")) {
      setSanctionsLoading(true);
      void listAdminSanctions(candidate.userId, 50)
        .then((result) => {
          if (requestId === userSelectionRequestRef.current) setSanctions(result);
        })
        .catch((error: unknown) => {
          if (requestId === userSelectionRequestRef.current) {
            setFeedback(getAdminErrorMessage(error, localizeText("Không thể đọc chế tài của người dùng này.")));
          }
        })
        .finally(() => {
          if (requestId === userSelectionRequestRef.current) setSanctionsLoading(false);
        });
    }
    if (overview?.permissions.includes("USER_READ")) {
      setSecurityLoading(true);
      const [sessionResult, deviceResult] = await Promise.allSettled([
        listAdminSessions(candidate.userId, 100),
        listAdminDevices(candidate.userId, 100),
      ]);
      if (requestId !== userSelectionRequestRef.current) return;
      setUserSessions(sessionResult.status === "fulfilled" ? sessionResult.value : []);
      setUserDevices(deviceResult.status === "fulfilled" ? deviceResult.value : []);
      if (sessionResult.status === "rejected" || deviceResult.status === "rejected") {
        const firstError: unknown = sessionResult.status === "rejected"
          ? sessionResult.reason as unknown
          : deviceResult.status === "rejected" ? deviceResult.reason as unknown : undefined;
      setFeedback(getAdminErrorMessage(firstError, localizeText("Không thể đọc đầy đủ phiên đăng nhập và thiết bị của người dùng này.")));
      }
      setSecurityLoading(false);
    }
  };

  const handleRevokeSession = async (session: AdminSession) => {
    if (!selectedUser || !overview?.permissions.includes("SESSION_REVOKE")) return;
    if (!reason.trim()) {
      setFeedback(localizeText("Cần ghi lý do khi thu hồi phiên đăng nhập."));
      return;
    }
    if (!(await askConfirmation({
      title: localizeText("Thu hồi phiên đăng nhập"),
      description: localizeText(`Thu hồi phiên đăng nhập ${session.tokenId.slice(0, 8)}… của ${selectedUser.userName}?`),
      confirmLabel: localizeText("Thu hồi"),
      destructive: true,
    }))) return;
    setMutating(true);
    try {
      await revokeAdminSession(selectedUser.userId, session.tokenId, reason);
      setUserSessions((current) => current.map((item) => item.tokenId === session.tokenId
        ? { ...item, revokedAt: new Date().toISOString() }
        : item));
      setReason("");
      setFeedback(localizeText("Đã thu hồi phiên đăng nhập."));
    } catch (error: unknown) {
      setFeedback(getAdminErrorMessage(error, localizeText("Không thể thu hồi phiên đăng nhập hoặc phiên này không còn hoạt động.")));
    } finally {
      setMutating(false);
    }
  };

  const handleRevokeDevice = async (device: AdminDevice) => {
    if (!selectedUser || !overview?.permissions.includes("SESSION_REVOKE")) return;
    if (!reason.trim()) {
      setFeedback(localizeText("Cần ghi lý do khi thu hồi thiết bị."));
      return;
    }
    if (!(await askConfirmation({
      title: localizeText("Thu hồi thiết bị"),
      description: localizeText(`Thu hồi thiết bị ${device.deviceName ?? device.deviceId}…?`),
      confirmLabel: localizeText("Thu hồi"),
      destructive: true,
    }))) return;
    setMutating(true);
    try {
      await revokeAdminDevice(selectedUser.userId, device.deviceId, reason);
      setUserDevices((current) => current.map((item) => item.deviceId === device.deviceId ? { ...item, active: false } : item));
      setUserSessions((current) => current.map((item) => item.deviceId === device.deviceId && !item.revokedAt
        ? { ...item, revokedAt: new Date().toISOString() }
        : item));
      setReason("");
      setFeedback(localizeText("Đã vô hiệu hóa thiết bị và các phiên liên quan."));
    } catch (error: unknown) {
      setFeedback(getAdminErrorMessage(error, localizeText("Không thể thu hồi thiết bị hoặc thiết bị đã không còn hoạt động.")));
    } finally {
      setMutating(false);
    }
  };

  const handleGrant = async () => {
    if (!selectedUser || !roleCode) return;
    if (!reason.trim()) {
      setFeedback(localizeText("Cần ghi lý do để ghi nhật ký kiểm toán."));
      return;
    }
    setMutating(true);
    setFeedback(null);
    try {
      await grantAdminRole(
        selectedUser.userId,
        roleCode,
        reason,
        expiresAt ? new Date(expiresAt).toISOString() : undefined,
      );
      setSelectedRoles(await getAdminUserRoles(selectedUser.userId));
      setReason("");
      setExpiresAt("");
      setFeedback(`Đã cấp vai trò ${roleCode} cho ${selectedUser.userName}.`);
    } catch (error: unknown) {
      setFeedback(getAdminErrorMessage(error, localizeText("Không thể cấp vai trò. Máy chủ sẽ từ chối nếu bạn thiếu quyền hoặc vai trò đã tồn tại.")));
    } finally {
      setMutating(false);
    }
  };

  const handleRevoke = async (role: AdminRoleGrant) => {
    if (!selectedUser) return;
    if (!(await askConfirmation({
      title: localizeText("Thu hồi vai trò"),
      description: localizeText(`Thu hồi vai trò ${role.roleCode} của ${selectedUser.userName}?`),
      confirmLabel: localizeText("Thu hồi"),
      destructive: true,
    }))) return;
    setMutating(true);
    setFeedback(null);
    try {
      await revokeAdminRole(selectedUser.userId, role.roleCode, reason);
      setSelectedRoles(await getAdminUserRoles(selectedUser.userId));
      setFeedback(`Đã thu hồi vai trò ${role.roleCode}.`);
    } catch (error: unknown) {
      setFeedback(getAdminErrorMessage(error, localizeText("Không thể thu hồi vai trò. Kiểm tra cấp bậc và quyền quản trị.")));
    } finally {
      setMutating(false);
    }
  };

  const handleUserStatus = async () => {
    if (!selectedUser || !reason.trim()) {
      setFeedback(localizeText("Cần ghi lý do cho thay đổi trạng thái tài khoản."));
      return;
    }
    if (userStatus !== "ACTIVE" && !(await askConfirmation({
      title: localizeText("Đổi trạng thái tài khoản"),
      description: localizeText(`Đổi trạng thái @${selectedUser.userName} thành ${accountStatusLabel(userStatus)}?`),
      confirmLabel: localizeText("Xác nhận"),
      destructive: true,
    }))) return;
    setMutating(true);
    setFeedback(null);
    try {
      await updateAdminUserStatus(selectedUser.userId, userStatus, reason);
      setSelectedUser((current) => current ? { ...current, status: userStatus } : current);
      setUsers((current) => current.map((candidate) => candidate.userId === selectedUser.userId ? { ...candidate, status: userStatus } : candidate));
      setReason("");
      setFeedback(`Đã cập nhật trạng thái tài khoản thành ${accountStatusLabel(userStatus)}.`);
    } catch (error: unknown) {
      setFeedback(getAdminErrorMessage(error, localizeText("Không thể cập nhật trạng thái. Máy chủ sẽ kiểm tra quyền USER_SUSPEND/USER_RESTORE.")));
    } finally {
      setMutating(false);
    }
  };

  const selectRoom = async (room: AdminConversationSummary) => {
    const requestId = ++roomSelectionRequestRef.current;
    setRoomMutating(false);
    setFeedback(null);
    try {
      const detail = await getAdminConversation(room.conversationId);
      if (requestId !== roomSelectionRequestRef.current) return;
      setSelectedRoom(detail);
      setRoomPolicy(detail.chatMode);
      setRoomSlowMode(detail.slowModeSeconds);
    } catch (error: unknown) {
      if (requestId === roomSelectionRequestRef.current) {
        setFeedback(getAdminErrorMessage(error, localizeText("Không thể đọc chi tiết phòng này.")));
      }
    }
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

  const handleReportResolution = async (report: AdminReport, nextStatus: AdminReport['status']) => {
    if (!moderationReason.trim()) {
      setFeedback(localizeText("Cần ghi lý do cho quyết định kiểm duyệt."));
      return;
    }
    if ((nextStatus === "RESOLVED" || nextStatus === "DISMISSED") && !resolutionCode.trim()) {
      setFeedback(localizeText("Cần mã kết quả khi đóng báo cáo."));
      return;
    }
    if (!(await askConfirmation({
      title: localizeText("Xác nhận cập nhật báo cáo"),
      description: localizeText(`Chuyển báo cáo ${report.reportId.slice(0, 8)}… thành ${reportStatusLabel(nextStatus)}?`),
      confirmLabel: localizeText("Xác nhận"),
      destructive: nextStatus === "DISMISSED",
    }))) return;
    setModerationMutating(true);
    setFeedback(null);
    try {
      const updated = await resolveAdminReport(report, nextStatus, resolutionCode, moderationReason);
      setReports((current) => current.filter((item) => item.reportId !== updated.reportId));
      setModerationReason("");
      setResolutionCode("");
      setFeedback(`Đã cập nhật báo cáo thành ${reportStatusLabel(nextStatus)}.`);
    } catch (error: unknown) {
      setFeedback(getAdminErrorMessage(error, localizeText("Không thể cập nhật báo cáo. Kiểm tra REPORT_MANAGE và trạng thái hiện tại.")));
    } finally {
      setModerationMutating(false);
    }
  };

  const handleImposeSanction = async () => {
    if (!sanctionTargetUserId.trim() || !moderationReason.trim()) {
      setFeedback(localizeText("Cần ID người dùng và lý do trước khi áp dụng chế tài."));
      return;
    }
    if (sanctionScope === "CONVERSATION" && !sanctionConversationId.trim()) {
      setFeedback(localizeText("Chế tài theo phòng cần ID cuộc trò chuyện."));
      return;
    }
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

  const canReadUsers = overview.permissions.includes("USER_READ");
  const canManageRoles = overview.permissions.includes("APP_ROLE_MANAGE");
  const canRevokeSessions = overview.permissions.includes("SESSION_REVOKE");
  const canManageUserStatus = overview.permissions.includes("USER_SUSPEND") || overview.permissions.includes("USER_RESTORE");
  const canReadRooms = overview.permissions.includes("ROOM_READ");
  const canModerateRooms = overview.permissions.includes("ROOM_MODERATE");
  const canReadAudit = overview.permissions.includes("AUDIT_READ");
  const canReadAnalytics = overview.permissions.includes("ANALYTICS_READ");
  const canManageReports = overview.permissions.includes("REPORT_MANAGE");
  const availableToGrant = overview.availableRoleCodes.filter((code) => !assignedRoleCodes.has(code));
  const healthState = health?.cassandra?.startsWith("UP") ? localizeText("Ổn định") : health ? localizeText("Cần kiểm tra") : localizeText("Chưa đọc được");
  const adminWorkspaces: Array<{ id: AdminWorkspace; label: string; hint: string; icon: typeof LayoutDashboard; tone: string }> = [
    { id: 'overview', label: localizeText('Tổng quan'), hint: localizeText('Nhịp vận hành'), icon: LayoutDashboard, tone: 'oklch(0.68 0.18 42)' },
    { id: 'rooms', label: localizeText('Không gian'), hint: localizeText('Phòng toàn hệ thống'), icon: RadioTower, tone: 'oklch(0.68 0.14 226)' },
    { id: 'safety', label: localizeText('An toàn'), hint: localizeText('Báo cáo và điều tra'), icon: ShieldAlert, tone: 'oklch(0.64 0.2 25)' },
    { id: 'insights', label: localizeText('Dòng sự kiện'), hint: localizeText('Nhật ký và số liệu'), icon: Activity, tone: 'oklch(0.66 0.16 302)' },
    { id: 'access', label: localizeText('Truy cập'), hint: localizeText('Người dùng và quyền'), icon: KeyRound, tone: 'oklch(0.62 0.13 166)' },
  ];
  const currentAdminWorkspace = adminWorkspaces.find((workspace) => workspace.id === activeWorkspace) ?? adminWorkspaces[0];
  const CurrentAdminWorkspaceIcon = currentAdminWorkspace.icon;

  return (
    <AdminPageShell onBackToApp={() => (onBackToApp ? onBackToApp() : router.push('/app'))}>
      <motion.div
        className="space-y-8"
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.panelReveal}
      >
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
          <div>
            <p className="page-kicker">{localizeText("Quản trị toàn cục")}</p>
            <h1 className="max-w-[14ch] text-4xl font-bold leading-[1.05] tracking-[-0.04em] sm:text-5xl">{localizeText("Điều hành toàn ứng dụng")}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground"><BrandText text={localizeText("Quản lý người dùng, phòng và chính sách ở cấp Nối. Mọi thao tác toàn cục đều qua phân quyền và nhật ký kiểm toán của máy chủ.")} /></p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadOverview(true)} loading={refreshing}><RefreshCcw size={16} /> {localizeText("Làm mới")}</Button>
          </div>
        </div>

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
                style={{ '--admin-tone': workspace.tone } as CSSProperties}
                onClick={() => setActiveWorkspace(workspace.id)}
              >
                <Icon size={17} aria-hidden="true" />
                <span><strong>{workspace.label}</strong><small>{workspace.hint}</small></span>
              </button>
            );
          })}
        </nav>

        <div className="admin-mobile-workspace-switcher">
          <button
            type="button"
            className="admin-mobile-workspace-trigger"
            aria-expanded={mobileWorkspaceMenuOpen}
            aria-controls="admin-mobile-workspace-menu"
            onClick={() => setMobileWorkspaceMenuOpen((open) => !open)}
            style={{ '--admin-tone': currentAdminWorkspace.tone } as CSSProperties}
          >
            <span className="admin-mobile-workspace-icon"><CurrentAdminWorkspaceIcon size={18} aria-hidden="true" /></span>
            <span><small>{localizeText('Khu vực đang mở')}</small><strong>{currentAdminWorkspace.label}</strong><em>{currentAdminWorkspace.hint}</em></span>
            <ChevronDown size={18} aria-hidden="true" className={mobileWorkspaceMenuOpen ? 'rotate-180' : ''} />
          </button>
          {mobileWorkspaceMenuOpen ? (
            <div id="admin-mobile-workspace-menu" className="admin-mobile-workspace-menu">
              {adminWorkspaces.map((workspace, index) => {
                const Icon = workspace.icon;
                const active = workspace.id === activeWorkspace;
                return (
                  <button
                    key={workspace.id}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    style={{ '--admin-tone': workspace.tone } as CSSProperties}
                    onClick={() => {
                      setActiveWorkspace(workspace.id);
                      setMobileWorkspaceMenuOpen(false);
                    }}
                  >
                    <span className="admin-mobile-workspace-index">0{index + 1}</span>
                    <Icon size={17} aria-hidden="true" />
                    <span><strong>{workspace.label}</strong><small>{workspace.hint}</small></span>
                    {active ? <span className="admin-mobile-workspace-live">{localizeText('Đang mở')}</span> : <span aria-hidden="true">→</span>}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="admin-signal-strip grid gap-3 md:grid-cols-3">
          <Card className="admin-signal-stat" style={{ '--admin-tone': 'oklch(0.66 0.16 302)' } as CSSProperties}>
            <CardContent className="flex items-start justify-between gap-3 p-5"><div><p className="text-xs font-semibold text-muted-foreground">{localizeText("Vai trò của bạn")}</p><p className="mt-2 text-2xl font-bold">{overview.roles.length}</p></div><ShieldCheck /></CardContent>
          </Card>
          <Card className="admin-signal-stat" style={{ '--admin-tone': 'oklch(0.68 0.14 226)' } as CSSProperties}>
            <CardContent className="flex items-start justify-between gap-3 p-5"><div><p className="text-xs font-semibold text-muted-foreground">{localizeText("Quyền hiệu lực")}</p><p className="mt-2 text-2xl font-bold">{overview.permissions.length}</p></div><UserCog /></CardContent>
          </Card>
          <Card className="admin-signal-stat" style={{ '--admin-tone': health?.cassandra?.startsWith('UP') ? 'oklch(0.62 0.13 166)' : 'oklch(0.64 0.2 25)' } as CSSProperties}>
            <CardContent className="flex items-start justify-between gap-3 border-0 p-5"><div><p className="text-xs font-semibold text-muted-foreground">{localizeText("Trạng thái hệ thống")}</p><p className="mt-2 text-2xl font-bold">{healthState}</p></div><Server /></CardContent>
          </Card>
        </div>

        {activeWorkspace !== 'overview' ? (
          <div className="admin-workspace-context" style={{ '--admin-tone': currentAdminWorkspace.tone } as CSSProperties}>
            <button type="button" onClick={() => setActiveWorkspace('overview')}><ArrowLeft size={15} aria-hidden="true" />{localizeText('Tổng quan')}</button>
            <span aria-hidden="true">/</span>
            <CurrentAdminWorkspaceIcon size={15} aria-hidden="true" />
            <strong>{currentAdminWorkspace.label}</strong>
            <small>{currentAdminWorkspace.hint}</small>
          </div>
        ) : null}

        {activeWorkspace === 'overview' ? (
          <section className="admin-command-map" aria-labelledby="admin-command-map-title">
            <div className="admin-command-copy">
              <p className="page-kicker">{localizeText('Bắt đầu từ tín hiệu')}</p>
              <h2 id="admin-command-map-title">{localizeText('Chọn đúng nơi để can thiệp.')}</h2>
              <p>{localizeText('Mỗi khu vực chỉ mở những công cụ cần cho một loại công việc. Quyền thiếu sẽ được nói rõ, không biến mất im lặng.')}</p>
            </div>
            <div className="admin-command-actions">
              {adminWorkspaces.slice(1).map((workspace, index) => {
                const Icon = workspace.icon;
                return (
                  <button key={workspace.id} type="button" style={{ '--admin-tone': workspace.tone } as CSSProperties} onClick={() => setActiveWorkspace(workspace.id)}>
                    <span className="admin-command-index">0{index + 1}</span>
                    <Icon size={18} aria-hidden="true" />
                    <span><strong>{workspace.label}</strong><small>{workspace.hint}</small></span>
                    <span aria-hidden="true">→</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {activeWorkspace === 'rooms' ? <SurfacePanel title={localizeText("Quản lý toàn bộ phòng")}>
          {!canReadRooms ? <p className="text-sm leading-6 text-muted-foreground">{localizeText("Vai trò hiện tại chưa có ROOM_READ. Đây là quyền cấp ứng dụng, hoàn toàn khác với quyền quản trị trong từng phòng.")}</p> : <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[170px] flex-1"><label htmlFor="admin-room-month" className="block text-xs font-semibold text-muted-foreground">{localizeText("Tháng tạo phòng (UTC)")}</label><Input id="admin-room-month" className="mt-1" type="month" value={roomMonth} onChange={(event) => setRoomMonth(event.target.value)} /></div>
              <p className="pb-2 text-xs text-muted-foreground">{localizeText("Chọn tháng để giới hạn kết quả.")}</p>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
              <div className="max-h-[360px] space-y-2 overflow-auto pr-1" aria-live="polite">
                {roomsLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : rooms.length ? rooms.map((room) => <button key={room.conversationId} type="button" onClick={() => void selectRoom(room)} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-[color,background-color,border-color,box-shadow,transform,opacity] ${selectedRoom?.conversationId === room.conversationId ? "border-primary/50 bg-primary/10" : "border-border/60 bg-background/55 hover:border-primary/35"}`}><span className="flex min-w-0 items-center gap-3"><Building2 size={17} className="shrink-0 text-primary" /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{room.name ?? room.conversationId}</span><span className="block truncate text-xs text-muted-foreground">{room.conversationType} · {room.memberCount} {localizeText("thành viên")} · {room.chatMode}</span></span></span><Badge variant={room.deleted ? "destructive" : "outline"}>{room.deleted ? localizeText("Đã lưu trữ") : room.visibility}</Badge></button>) : <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">{localizeText("Không có phòng trong tháng này.")}</p>}
              </div>
              {selectedRoom ? (
                <div className="rounded-xl border border-border/60 bg-background/45 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-semibold">{selectedRoom.name ?? selectedRoom.conversationId}</p><p className="mt-1 text-xs text-muted-foreground">{selectedRoom.conversationId}</p></div>
                    <Badge variant={selectedRoom.deleted ? "destructive" : "secondary"}>{selectedRoom.deleted ? localizeText("Đã lưu trữ") : localizeText("Đang hoạt động")}</Badge>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="text-muted-foreground">{localizeText("Loại phòng")}</dt><dd className="mt-1 font-semibold">{selectedRoom.conversationType}</dd></div>
                    <div><dt className="text-muted-foreground">{localizeText("Thành viên")}</dt><dd className="mt-1 font-semibold">{selectedRoom.memberCount}</dd></div>
                    <div><dt className="text-muted-foreground">{localizeText("Chủ phòng")}</dt><dd className="mt-1 truncate font-semibold">{selectedRoom.ownerId ?? localizeText("Chưa có chủ phòng")}</dd></div>
                    <div><dt className="text-muted-foreground">{localizeText("Ngày tạo")}</dt><dd className="mt-1 font-semibold">{formatDate(selectedRoom.createdAt)}</dd></div>
                  </dl>
                  <div className="mt-5"><p className="text-xs font-semibold text-muted-foreground">{localizeText("Tổng quan thành viên")}</p><div className="mt-2 flex max-h-20 flex-wrap gap-1.5 overflow-auto">{selectedRoom.members.map((member) => <Badge key={member.userId} variant="outline">{member.userId.slice(0, 8)}…</Badge>)}</div></div>
                  <label htmlFor="admin-room-policy" className="mt-5 block text-xs font-semibold text-muted-foreground">{localizeText("Chính sách trò chuyện toàn cục")}</label>
                  <Select id="admin-room-policy" value={roomPolicy} onChange={(event) => setRoomPolicy(event.target.value)} disabled={!canModerateRooms} className="mt-1"><option value="OPEN">{localizeText("Mở")}</option><option value="READ_ONLY">{localizeText("Chỉ đọc")}</option><option value="MANAGERS_ONLY">{localizeText("Chỉ quản lý")}</option></Select>
                  <label htmlFor="admin-room-slow-mode" className="mt-3 block text-xs font-semibold text-muted-foreground">{localizeText("Chế độ chậm (giây)")}</label>
                  <Input id="admin-room-slow-mode" className="mt-1" type="number" min={0} max={86400} value={roomSlowMode} onChange={(event) => setRoomSlowMode(Math.max(0, Number(event.target.value) || 0))} disabled={!canModerateRooms} />
                  <label htmlFor="admin-room-reason" className="mt-3 block text-xs font-semibold text-muted-foreground">{localizeText("Lý do kiểm toán")}</label>
                  <Input id="admin-room-reason" className="mt-1" value={roomReason} onChange={(event) => setRoomReason(event.target.value)} placeholder={localizeText("Ví dụ: xử lý báo cáo spam")} disabled={!canModerateRooms} />
                  <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => void handleRoomPolicy()} loading={roomMutating} disabled={!canModerateRooms || !roomReason.trim()}>{localizeText("Lưu chính sách")}</Button><Button variant={selectedRoom.deleted ? "outline" : "destructive"} onClick={() => void handleRoomArchive()} loading={roomMutating} disabled={!canModerateRooms || !roomReason.trim()}><Archive size={16} />{selectedRoom.deleted ? localizeText("Khôi phục") : localizeText("Lưu trữ phòng")}</Button></div>
                </div>
              ) : <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-border/70 px-4 text-center text-sm text-muted-foreground">{localizeText("Chọn một phòng để xem thành viên và thao tác kiểm duyệt toàn cục.")}</div>}
            </div>
          </>}
        </SurfacePanel> : null}

        {activeWorkspace === 'insights' ? <SurfacePanel title={localizeText("Nhật ký kiểm toán toàn ứng dụng")} collapsible defaultOpen>
              {!canReadAudit ? <p className="text-sm leading-6 text-muted-foreground">{localizeText("Vai trò hiện tại chưa có AUDIT_READ. Nhật ký kiểm toán chỉ hiển thị cho người vận hành được cấp quyền điều tra.")}</p> : <><div className="flex flex-wrap items-end gap-3"><div className="min-w-[170px] flex-1"><label htmlFor="admin-audit-month" className="block text-xs font-semibold text-muted-foreground">{localizeText("Tháng kiểm toán (UTC)")}</label><Input id="admin-audit-month" className="mt-1" type="month" value={auditMonth} onChange={(event) => setAuditMonth(event.target.value)} /></div><Button size="sm" variant="outline" onClick={() => void handleAuditExport()} loading={auditExporting}><Download size={15} />{localizeText("Xuất tệp CSV kiểm toán")}</Button><p className="pb-2 text-xs text-muted-foreground">{localizeText("Hiển thị tối đa 50 sự kiện trong tháng.")}</p></div>{auditLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : auditEvents.length ? <div className="mt-4 max-h-[360px] space-y-2 overflow-auto pr-1" aria-live="polite">{auditEvents.map((event) => <div key={event.eventId} className="rounded-xl border border-border/60 bg-background/45 px-3 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><ScrollText size={15} className="text-primary" /><span className="text-sm font-semibold">{auditActionLabel(event.action)}</span><Badge variant={event.outcome === "SUCCESS" ? "outline" : "destructive"}>{auditOutcomeLabel(event.outcome)}</Badge></div><span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span></div><p className="mt-1 text-xs text-muted-foreground">{event.resourceType}:{event.resourceId}{event.actorId ? ` · ${localizeText("người thao tác")} ${event.actorId.slice(0, 8)}…` : ""}</p>{event.reasonCode ? <p className="mt-1 text-xs leading-5">{localizeText("Lý do:")} {event.reasonCode}</p> : null}</div>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">{localizeText("Chưa có sự kiện kiểm toán trong tháng này.")}</p>}</>}
        </SurfacePanel> : null}

        {activeWorkspace === 'safety' ? <SurfacePanel title={localizeText("Điều tra tin nhắn") } collapsible defaultOpen={false}>
          {!canReadAudit ? <p className="text-sm leading-6 text-muted-foreground">{localizeText("Vai trò hiện tại chưa có AUDIT_READ. Nội dung tin nhắn chỉ hiển thị cho người vận hành được cấp quyền điều tra.")}</p> : <>
            <p className="text-sm leading-6 text-muted-foreground">{localizeText("Đọc một tin nhắn cụ thể bằng ID cuộc trò chuyện, bucket và ID tin nhắn. Mỗi lượt xem phải có lý do và được ghi vào nhật ký kiểm toán; không quét toàn bộ lịch sử.")}</p>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleMessageInspection}>
              <div><label htmlFor="admin-message-conversation-id" className="block text-xs font-semibold text-muted-foreground">{localizeText("ID cuộc trò chuyện")}</label><Input id="admin-message-conversation-id" className="mt-1" value={messageConversationId} onChange={(event) => setMessageConversationId(event.target.value)} placeholder="UUID" /></div>
              <div><label htmlFor="admin-message-id" className="block text-xs font-semibold text-muted-foreground">{localizeText("ID tin nhắn")}</label><Input id="admin-message-id" className="mt-1" value={messageId} onChange={(event) => setMessageId(event.target.value)} placeholder="UUID" /></div>
              <div><label htmlFor="admin-message-bucket" className="block text-xs font-semibold text-muted-foreground">{localizeText("Khoảng tin nhắn")}</label><Input id="admin-message-bucket" className="mt-1" value={messageBucket} onChange={(event) => setMessageBucket(event.target.value)} placeholder="YYYY-MM-DD-HH:NN" /></div>
              <div><label htmlFor="admin-message-reason" className="block text-xs font-semibold text-muted-foreground">{localizeText("Lý do điều tra (bắt buộc)")}</label><Input id="admin-message-reason" className="mt-1" value={messageReason} onChange={(event) => setMessageReason(event.target.value)} placeholder={localizeText("Ví dụ: xử lý báo cáo tin nhắn")}/></div>
              <div className="md:col-span-2"><Button type="submit" loading={messageLoading} disabled={!messageConversationId.trim() || !messageBucket.trim() || !messageId.trim() || !messageReason.trim()}><Eye size={16} />{localizeText("Đọc tin nhắn")}</Button></div>
            </form>
            {messageInspection ? <div className="mt-5 rounded-xl border border-border/60 bg-background/45 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><History size={16} className="text-primary" /><span className="text-sm font-semibold">{messageInspection.message.messageType}</span><Badge variant={messageInspection.message.isDeleted ? "destructive" : "outline"}>{messageInspection.message.isDeleted ? localizeText("Đã xoá (tombstone)") : localizeText("Đang hiển thị")}</Badge>{messageInspection.message.isPinned ? <Badge variant="secondary">{localizeText("Đã ghim")}</Badge> : null}</div><p className="mt-2 break-all text-xs text-muted-foreground">{messageInspection.message.messageId} · {messageInspection.message.messageBucket}</p></div><span className="text-xs text-muted-foreground">{formatDate(messageInspection.message.createdAt)}</span></div><div className="mt-4 rounded-lg border border-border/60 bg-background px-3 py-3 text-sm leading-6 whitespace-pre-wrap break-words">{messageInspection.message.content || localizeText("Tin nhắn không có nội dung văn bản.")}</div><dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div><dt className="text-muted-foreground">{localizeText("Người gửi")}</dt><dd className="mt-1 break-all font-semibold">{messageInspection.message.senderId}</dd></div><div><dt className="text-muted-foreground">{localizeText("Đã chỉnh sửa")}</dt><dd className="mt-1 font-semibold">{formatDate(messageInspection.message.editedAt)}</dd></div><div><dt className="text-muted-foreground">{localizeText("Người xoá")}</dt><dd className="mt-1 break-all font-semibold">{messageInspection.message.deletedBy ?? localizeText("Không có")}</dd></div><div><dt className="text-muted-foreground">{localizeText("Thời điểm xoá")}</dt><dd className="mt-1 font-semibold">{formatDate(messageInspection.message.deletedAt)}</dd></div></dl><div className="mt-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{localizeText("Lịch sử chỉnh sửa")}</p>{messageInspection.revisions.length ? <div className="mt-2 space-y-2">{messageInspection.revisions.map((revision) => <div key={`${revision.revisionNumber}-${revision.editedAt}`} className="rounded-lg border border-border/60 px-3 py-2"><div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="outline">#{revision.revisionNumber} · {revision.action}</Badge><span className="text-xs text-muted-foreground">{formatDate(revision.editedAt)}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5">{revision.content || localizeText("Không có nội dung text.")}</p><p className="mt-1 break-all text-[11px] text-muted-foreground">{revision.editedBy ?? localizeText("Không xác định")}</p></div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">{localizeText("Tin nhắn chưa có lịch sử chỉnh sửa.")}</p>}</div></div> : null}
          </>}
        </SurfacePanel> : null}

        {activeWorkspace === 'insights' ? <SurfacePanel title={localizeText("Số liệu vận hành")} collapsible defaultOpen>
          {!canReadAnalytics ? <p className="text-sm leading-6 text-muted-foreground">{localizeText("Vai trò hiện tại chưa có ANALYTICS_READ. Dữ liệu tổng hợp chỉ dành cho người vận hành được cấp quyền.")}</p> : <><div className="flex flex-wrap items-end gap-3"><div className="min-w-[150px] flex-1"><label htmlFor="admin-analytics-from" className="block text-xs font-semibold text-muted-foreground">{localizeText("Từ ngày (UTC)")}</label><Input id="admin-analytics-from" className="mt-1" type="date" value={analyticsFrom} onChange={(event) => setAnalyticsFrom(event.target.value)} /></div><div className="min-w-[150px] flex-1"><label htmlFor="admin-analytics-to" className="block text-xs font-semibold text-muted-foreground">{localizeText("Đến ngày (UTC)")}</label><Input id="admin-analytics-to" className="mt-1" type="date" value={analyticsTo} onChange={(event) => setAnalyticsTo(event.target.value)} /></div><div className="min-w-[180px] flex-1"><label htmlFor="admin-analytics-type" className="block text-xs font-semibold text-muted-foreground">{localizeText("Loại sự kiện")}</label><select id="admin-analytics-type" value={analyticsType} onChange={(event) => setAnalyticsType(event.target.value)} className="mt-1 h-10 w-full rounded-[0.85rem] border border-border/70 bg-background px-3 text-sm">{ANALYTICS_EVENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{localizeText(option.label)}</option>)}</select></div><p className="pb-2 text-xs text-muted-foreground">{localizeText("Tối đa 31 ngày / 200 điểm được hiển thị.")}</p></div>{analyticsLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : analyticsPoints.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(analyticsPoints.reduce<Record<string, number>>((counts, point) => { counts[point.eventType] = (counts[point.eventType] ?? 0) + 1; return counts; }, {})).map(([type, count]) => <div key={type} className="rounded-xl border border-border/60 bg-background/45 p-3"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-semibold"><BarChart3 size={15} className="text-primary" />{analyticsEventLabel(type)}</span><span className="text-lg font-black">{count}</span></div><p className="mt-1 text-xs text-muted-foreground">{localizeText("sự kiện tổng hợp trong khoảng đã chọn")}</p></div>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">{localizeText("Chưa có số liệu trong khoảng này.")}</p>}</>}
        </SurfacePanel> : null}

        {activeWorkspace === 'safety' ? <SurfacePanel title={localizeText("Báo cáo & chế tài")} collapsible defaultOpen>
          {!canManageReports ? <p className="text-sm leading-6 text-muted-foreground">{localizeText("Vai trò hiện tại chưa có REPORT_MANAGE. Quyết định kiểm duyệt chỉ dành cho người vận hành an toàn.")}</p> : <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[170px] flex-1"><label htmlFor="admin-report-day" className="block text-xs font-semibold text-muted-foreground">{localizeText("Ngày báo cáo (UTC)")}</label><Input id="admin-report-day" className="mt-1" type="date" value={reportDay} onChange={(event) => setReportDay(event.target.value)} /></div>
              <div className="min-w-[170px] flex-1"><label htmlFor="admin-report-status" className="block text-xs font-semibold text-muted-foreground">{localizeText("Trạng thái")}</label><Select id="admin-report-status" value={reportStatusFilter} onChange={(event) => setReportStatusFilter(event.target.value as AdminReport['status'])} className="mt-1"><option value="OPEN">{reportStatusLabel("OPEN")}</option><option value="IN_REVIEW">{reportStatusLabel("IN_REVIEW")}</option><option value="RESOLVED">{reportStatusLabel("RESOLVED")}</option><option value="DISMISSED">{reportStatusLabel("DISMISSED")}</option></Select></div>
              <p className="pb-2 text-xs text-muted-foreground">{localizeText("Chọn ngày để xem hàng đợi tương ứng.")}</p>
            </div>
            <div className="mt-4 space-y-2" aria-live="polite">
              {reportsLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : reports.length ? reports.map((report) => <div key={report.reportId} className="rounded-xl border border-border/60 bg-background/45 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{reportTargetLabel(report.targetType)}</Badge><Badge variant={report.status === "OPEN" ? "destructive" : "secondary"}>{reportStatusLabel(report.status)}</Badge><span className="text-xs text-muted-foreground">{report.reportId}</span></div><p className="mt-2 text-sm font-semibold">{report.reasonCode}</p>{report.description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{report.description}</p> : null}<p className="mt-1 text-xs text-muted-foreground">{localizeText("Người báo cáo")}: {report.reporterId}{report.targetUserId ? ` · ${localizeText("mục tiêu")}: ${report.targetUserId}` : ""}</p></div><div className="flex flex-wrap gap-2">{report.targetUserId ? <Button size="sm" variant="outline" onClick={() => { setSanctionTargetUserId(report.targetUserId as string); setSanctions([]); setFeedback(localizeText("Đã chọn người dùng mục tiêu cho biểu mẫu chế tài.")); }}>{localizeText("Chọn người dùng mục tiêu")}</Button> : null}{report.status === "OPEN" ? <Button size="sm" variant="outline" onClick={() => void handleReportResolution(report, "IN_REVIEW")} loading={moderationMutating}>{localizeText("Nhận xử lý")}</Button> : null}{report.status === "OPEN" || report.status === "IN_REVIEW" ? <><Button size="sm" onClick={() => void handleReportResolution(report, "RESOLVED")} loading={moderationMutating}>{localizeText("Giải quyết")}</Button><Button size="sm" variant="destructive" onClick={() => void handleReportResolution(report, "DISMISSED")} loading={moderationMutating}>{localizeText("Bỏ qua")}</Button></> : null}</div></div></div>) : <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">{localizeText("Không có báo cáo nào khớp bộ lọc hiện tại.")}</p>}
            </div>
            <details className="group mt-5 border-y border-border py-4">
              <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 rounded-[var(--radius-sm)] text-sm font-bold marker:hidden">
                <span>{localizeText("Áp dụng chế tài người dùng")}</span>
                <ChevronDown size={17} aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{localizeText("Cấm hoặc tạm ngưng trên toàn ứng dụng sẽ cập nhật trạng thái tài khoản. Chế tài theo cuộc trò chuyện chỉ áp dụng cho phòng được chỉ định.")}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div><label htmlFor="admin-sanction-user" className="block text-xs font-semibold text-muted-foreground">{localizeText("ID người dùng mục tiêu")}</label><Input id="admin-sanction-user" className="mt-1" value={sanctionTargetUserId} onChange={(event) => setSanctionTargetUserId(event.target.value)} placeholder={localizeText("UUID của người dùng")} /></div>
                <div><label htmlFor="admin-sanction-scope" className="block text-xs font-semibold text-muted-foreground">{localizeText("Phạm vi")}</label><Select id="admin-sanction-scope" value={sanctionScope} onChange={(event) => setSanctionScope(event.target.value as AdminSanction['scope'])} className="mt-1"><option value="APP">{localizeText("Ứng dụng")}</option><option value="CONVERSATION">{localizeText("Cuộc trò chuyện")}</option></Select></div>
                <div><label htmlFor="admin-sanction-type" className="block text-xs font-semibold text-muted-foreground">{localizeText("Loại chế tài")}</label><Select id="admin-sanction-type" value={sanctionType} onChange={(event) => setSanctionType(event.target.value as AdminSanction['sanctionType'])} className="mt-1"><option value="BAN">{localizeText("Cấm")}</option><option value="SUSPEND">{localizeText("Tạm ngưng")}</option><option value="MUTE">{localizeText("Tắt tiếng")}</option><option value="WARNING">{localizeText("Cảnh cáo")}</option></Select></div>
                {sanctionScope === "CONVERSATION" ? <div><label htmlFor="admin-sanction-conversation" className="block text-xs font-semibold text-muted-foreground">{localizeText("ID cuộc trò chuyện")}</label><Input id="admin-sanction-conversation" className="mt-1" value={sanctionConversationId} onChange={(event) => setSanctionConversationId(event.target.value)} placeholder={localizeText("UUID của phòng")} /></div> : null}
                <div><label htmlFor="admin-sanction-expiry" className="block text-xs font-semibold text-muted-foreground">{localizeText("Hết hạn (tuỳ chọn)")}</label><Input id="admin-sanction-expiry" className="mt-1" type="datetime-local" value={sanctionExpiresAt} onChange={(event) => setSanctionExpiresAt(event.target.value)} /></div>
                <div><label htmlFor="admin-resolution-code" className="block text-xs font-semibold text-muted-foreground">{localizeText("Mã lý do")}</label><Input id="admin-resolution-code" className="mt-1" value={resolutionCode} onChange={(event) => setResolutionCode(event.target.value)} placeholder={localizeText("SPAM, ABUSE...")} /></div>
              </div>
              <label htmlFor="admin-moderation-reason" className="mt-3 block text-xs font-semibold text-muted-foreground">{localizeText("Lý do chi tiết (bắt buộc)")}</label>
              <Input id="admin-moderation-reason" className="mt-1" value={moderationReason} onChange={(event) => setModerationReason(event.target.value)} placeholder={localizeText("Ghi rõ căn cứ quyết định")} />
              <Button className="mt-4" onClick={() => void handleImposeSanction()} loading={moderationMutating}>{localizeText("Áp dụng chế tài")}</Button>
            </details>
            {sanctionsLoading ? <div className="mt-5 flex justify-center py-4"><LoadingSpinner /></div> : sanctionTargetUserId && sanctions.length ? <div className="mt-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{localizeText("Chế tài của người dùng mục tiêu đang chọn")}</p><div className="mt-3 space-y-2">{sanctions.map((sanction) => <div key={sanction.sanctionId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2"><div><Badge variant={sanction.status === "ACTIVE" ? "destructive" : "outline"}>{sanctionTypeLabel(sanction.sanctionType)} · {sanctionStatusLabel(sanction.status)}</Badge><p className="mt-1 text-xs text-muted-foreground">{sanctionScopeLabel(sanction.scope)} · {sanction.reasonText}</p></div>{sanction.status === "ACTIVE" ? <Button size="sm" variant="outline" onClick={() => void handleRevokeSanction(sanction)} loading={moderationMutating}>{localizeText("Thu hồi")}</Button> : null}</div>)}</div></div> : null}
          </>}
        </SurfacePanel> : null}

        {activeWorkspace === 'access' ? <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
          <SurfacePanel title={localizeText("Quyền quản trị hiện tại")} collapsible defaultOpen={false}>
            <div className="flex flex-wrap gap-2">{overview.roles.map((role) => <Badge key={role} variant={roleBadgeVariant(role)}>{role}</Badge>)}</div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{localizeText("Quyền")}</p>
            <div className="mt-3 flex max-h-44 flex-wrap gap-2 overflow-auto">{overview.permissions.map((permission) => <Badge key={permission} variant="outline">{permission}</Badge>)}</div>
            {health ? <p className="mt-5 text-xs text-muted-foreground">{localizeText("Cassandra:")} <span className="font-semibold text-foreground">{health.cassandra}</span> · {localizeText("kiểm tra lúc")} {formatDate(health.timestamp)}</p> : <p className="mt-5 text-xs text-muted-foreground">{localizeText("Health endpoint chưa phản hồi; số liệu trên không được thay bằng dữ liệu giả.")}</p>}
          </SurfacePanel>

          <SurfacePanel title={localizeText("Tìm người dùng")} collapsible defaultOpen>
            {!canReadUsers ? <p className="text-sm leading-6 text-muted-foreground">{localizeText("Vai trò hiện tại không có USER_READ. Khu vực này chỉ hiển thị cho người vận hành được cấp quyền đọc người dùng.")}</p> : null}
            {canReadUsers ? <>
            <form className="flex gap-2" onSubmit={handleSearch}>
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={localizeText("tên người dùng hoặc tên hiển thị")} aria-label={localizeText("Tìm người dùng quản trị")} />
              <Button type="submit" loading={searching} aria-label={localizeText("Tìm kiếm")}><Search size={16} /></Button>
            </form>
            <div className="mt-4 space-y-2" aria-live="polite">
              {users.map((candidate) => <button key={candidate.userId} type="button" onClick={() => void selectUser(candidate)} className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-background/55 px-3 py-2 text-left transition-[color,background-color,border-color,box-shadow,transform,opacity] hover:border-primary/40 hover:bg-primary/5"><span className="flex min-w-0 items-center gap-3"><UserRound size={16} className="shrink-0 text-primary" /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{candidate.displayName}</span><span className="block truncate text-xs text-muted-foreground">@{candidate.userName} · {accountStatusLabel(candidate.status === "BANNED" ? "BANNED" : candidate.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE")}</span></span></span><span className="text-xs text-muted-foreground">{localizeText("Chọn")}</span></button>)}
              {!users.length ? <p className="py-5 text-center text-sm text-muted-foreground">{localizeText("Nhập tên người dùng để bắt đầu.")}</p> : null}
            </div>
            </> : null}
          </SurfacePanel>
        </div> : null}

        {activeWorkspace === 'access' && selectedUser && canReadUsers ? <SurfacePanel title={`${localizeText("Quản lý vai trò")} · @${selectedUser.userName}`} collapsible defaultOpen>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
            <div>
              <div className="rounded-xl border border-border/60 bg-background/55 p-4"><p className="font-semibold">{selectedUser.displayName}</p><p className="mt-1 text-xs text-muted-foreground">{selectedUser.userId} · {localizeText("Trạng thái")}: {accountStatusLabel(selectedUser.status === "BANNED" ? "BANNED" : selectedUser.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE")}</p></div>
              <div className="mt-4 rounded-xl border border-border/60 bg-background/45 p-4"><p className="text-sm font-bold">{localizeText("Trạng thái tài khoản toàn cục")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{localizeText("Tạm khóa hoặc cấm sẽ chặn các phiên đăng nhập mới. Bạn không thể tự khóa tài khoản đang sử dụng.")}</p><div className="mt-3 flex flex-wrap items-end gap-2"><div className="min-w-[170px] flex-1"><label htmlFor="admin-user-status" className="block text-xs font-semibold text-muted-foreground">{localizeText("Trạng thái tài khoản")}</label><select id="admin-user-status" value={userStatus} onChange={(event) => setUserStatus(event.target.value as 'ACTIVE' | 'SUSPENDED' | 'BANNED')} disabled={!canManageUserStatus} className="mt-1 h-10 w-full rounded-[0.85rem] border border-border/70 bg-background px-3 text-sm"><option value="ACTIVE">{localizeText("Đang hoạt động")}</option><option value="SUSPENDED">{localizeText("Tạm khóa")}</option><option value="BANNED">{localizeText("Bị cấm")}</option></select></div><Button variant="outline" onClick={() => void handleUserStatus()} loading={mutating} disabled={!canManageUserStatus || !reason.trim()}>{localizeText("Cập nhật trạng thái")}</Button></div></div>
              <div className="mt-4 rounded-xl border border-border/60 bg-background/45 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="text-sm font-bold">{localizeText("Phiên & thiết bị")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{localizeText("Hiển thị tối đa 100 mục. Thu hồi thiết bị cũng kết thúc các phiên liên quan.")}</p></div>
                  <Badge variant={canRevokeSessions ? "outline" : "secondary"}>{canRevokeSessions ? localizeText("Có quyền thu hồi") : localizeText("Chỉ xem")}</Badge>
                </div>
                {securityLoading ? <div className="flex justify-center py-5"><LoadingSpinner /></div> : (
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-xs font-bold text-muted-foreground">{localizeText("Thiết bị")}</p>
                      {userDevices.length ? <div className="mt-2 space-y-2">{userDevices.map((device) => <div key={device.deviceId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2"><div><p className="text-sm font-semibold">{device.deviceName ?? device.deviceId}</p><p className="text-xs text-muted-foreground">{device.platform ?? localizeText("Chưa có nền tảng")} / {device.appVersion ?? localizeText("Chưa có phiên bản")} / {device.active ? localizeText("Đang hoạt động") : localizeText("Đã thu hồi")}</p></div>{device.active && canRevokeSessions ? <Button size="sm" variant="outline" aria-label={`${localizeText("Thu hồi thiết bị")}: ${device.deviceName ?? device.deviceId}`} onClick={() => void handleRevokeDevice(device)} loading={mutating}>{localizeText("Thu hồi")}</Button> : null}</div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">{localizeText("Chưa có dữ liệu thiết bị.")}</p>}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-muted-foreground">{localizeText("Phiên làm mới")}</p>
                      {userSessions.length ? <div className="mt-2 space-y-2">{userSessions.map((session) => <div key={session.tokenId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2"><div><p className="text-xs font-semibold">{session.tokenId.slice(0, 12)}…</p><p className="text-xs text-muted-foreground">{localizeText("Cấp lúc")}: {session.issuedAt.slice(0, 12)}… / {localizeText("hết hạn")}: {formatDate(session.expiresAt)}{session.revokedAt ? ` / ${localizeText("Đã thu hồi")}` : ""}</p></div>{!session.revokedAt && canRevokeSessions ? <Button size="sm" variant="outline" aria-label={`${localizeText("Thu hồi phiên đăng nhập")}: ${session.tokenId.slice(0, 12)}…`} onClick={() => void handleRevokeSession(session)} loading={mutating}>{localizeText("Thu hồi")}</Button> : null}</div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">{localizeText("Chưa có phiên làm mới.")}</p>}
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{localizeText("Vai trò đang gán")}</p>
              <div className="mt-3 space-y-2">{rolesLoading ? <LoadingSpinner /> : selectedRoles.length ? selectedRoles.map((role) => <div key={role.grantId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2"><div><Badge variant={roleBadgeVariant(role.roleCode)}>{role.roleCode}</Badge><p className="mt-1 text-xs text-muted-foreground">{localizeText("Cấp lúc")} {formatDate(role.grantedAt)} · {formatDate(role.expiresAt)}</p></div>{canManageRoles ? <Button size="sm" variant="destructive" onClick={() => void handleRevoke(role)} loading={mutating}>{localizeText("Thu hồi")}</Button> : null}</div>) : <p className="text-sm text-muted-foreground">{localizeText("Chưa có vai trò ứng dụng.")}</p>}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/45 p-4">
              {!canManageRoles ? <p className="mb-4 rounded-lg border border-border/60 bg-background/60 p-3 text-xs leading-5 text-muted-foreground">{localizeText("Bạn có thể xem vai trò nhưng không có APP_ROLE_MANAGE để thay đổi.")}</p> : null}
              <p className="text-sm font-bold">{localizeText("Cấp vai trò")}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{localizeText("Chỉ chọn vai trò bạn được phép cấp. SUPER_ADMIN luôn được máy chủ bảo vệ riêng.")}</p>
              <label htmlFor="admin-role-code" className="mt-4 block text-xs font-semibold text-muted-foreground">{localizeText("Vai trò")}</label>
              <Select id="admin-role-code" value={roleCode} onChange={(event) => setRoleCode(event.target.value)} className="mt-1" disabled={!canManageRoles || !availableToGrant.length}><option value="">{availableToGrant.length ? localizeText("Chọn vai trò") : localizeText("Đã gán đủ vai trò")}</option>{availableToGrant.map((code) => <option key={code} value={code}>{code}</option>)}</Select>
              <label htmlFor="admin-role-reason" className="mt-3 block text-xs font-semibold text-muted-foreground">{localizeText("Lý do (bắt buộc)")}</label>
              <Input id="admin-role-reason" className="mt-1" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={localizeText("Ví dụ: phân công hỗ trợ cộng đồng")} disabled={!canManageRoles} />
              <label htmlFor="admin-role-expiry" className="mt-3 block text-xs font-semibold text-muted-foreground">{localizeText("Hết hạn (tuỳ chọn)")}</label>
              <Input id="admin-role-expiry" className="mt-1" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} disabled={!canManageRoles} />
              <Button className="mt-4 w-full" onClick={() => void handleGrant()} loading={mutating} disabled={!canManageRoles || !availableToGrant.length || !roleCode}>{localizeText("Cấp vai trò")}</Button>
            </div>
          </div>
        </SurfacePanel> : null}

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
      </motion.div>
    </AdminPageShell>
  );
};

export default AdminPage;
