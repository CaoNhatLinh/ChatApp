import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Archive, ArrowLeft, BarChart3, Building2, Eye, History, RefreshCcw, Search, ScrollText, Server, ShieldCheck, UserCog, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AppPageShell } from "@/route-pages/shared/AppPageShell";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, LoadingSpinner, SurfacePanel } from "@/shared/ui";
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

const readStatus = (error: unknown): number | undefined => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { status?: number } }).response;
    return response?.status;
  }
  return undefined;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return localizeText("Không hết hạn");
  const locale = typeof document !== "undefined" && document.documentElement.lang === "en" ? "en-US" : "vi-VN";
  return new Date(value).toLocaleString(locale);
};

const roleBadgeVariant = (role: string): "default" | "destructive" | "secondary" =>
  role === "SUPER_ADMIN" ? "destructive" : role === "APP_ADMIN" ? "default" : "secondary";

interface AdminPageProps {
  onBackToApp?: () => void;
}

const AdminPage = ({ onBackToApp }: AdminPageProps) => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthStore();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
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
  useAppLocale();
  const setFeedback = (message: string | null) => setFeedbackState(message === null ? null : localizeText(message));

  const loadOverview = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);
    try {
      const overviewResult = await getAdminOverview();
      setOverview(overviewResult);
      setRoleCode((current) => current || overviewResult.availableRoleCodes[0] || "");
      try {
        setHealth(await getAdminHealth());
      } catch {
        setHealth(null);
      }
    } catch (error) {
      setOverview(null);
      setErrorStatus(readStatus(error));
      setErrorMessage(localizeText("Không thể tải quyền quản trị. Kiểm tra tài khoản và phiên đăng nhập."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) void loadOverview();
  }, [authLoading, user]);

  useEffect(() => {
    if (!overview?.permissions.includes("ROOM_READ")) return;
    setRoomsLoading(true);
    void listAdminConversations(roomMonth, 100)
      .then(setRooms)
      .catch(() => setFeedback("Không thể tải danh sách room của tháng này."))
      .finally(() => setRoomsLoading(false));
  }, [overview, roomMonth]);

  useEffect(() => {
    if (!overview?.permissions.includes("AUDIT_READ")) return;
    setAuditLoading(true);
    void listAdminAuditEvents(auditMonth, 50)
      .then(setAuditEvents)
      .catch(() => setFeedback("Không thể tải audit timeline của tháng này."))
      .finally(() => setAuditLoading(false));
  }, [overview, auditMonth]);

  useEffect(() => {
    if (!overview?.permissions.includes("ANALYTICS_READ")) return;
    setAnalyticsLoading(true);
    void listAdminAnalytics({ from: analyticsFrom, to: analyticsTo, eventType: analyticsType, limit: 200 })
      .then(setAnalyticsPoints)
      .catch(() => setFeedback("Không thể tải analytics trong khoảng thời gian này."))
      .finally(() => setAnalyticsLoading(false));
  }, [overview, analyticsFrom, analyticsTo, analyticsType]);

  useEffect(() => {
    if (!overview?.permissions.includes("REPORT_MANAGE")) return;
    setReportsLoading(true);
    void listAdminReports(reportStatusFilter, reportDay, 50)
      .then(setReports)
      .catch(() => setFeedback("Không thể tải hàng đợi report của ngày này."))
      .finally(() => setReportsLoading(false));
  }, [overview, reportStatusFilter, reportDay]);

  const assignedRoleCodes = useMemo(
    () => new Set(selectedRoles.map((role) => role.roleCode)),
    [selectedRoles],
  );
  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 2) {
      setFeedback("Nhập ít nhất 2 ký tự để tìm người dùng.");
      return;
    }
    setSearching(true);
    setFeedback(null);
    try {
      setUsers(await searchAdminUsers(normalized));
    } catch {
      setFeedback("Không thể tìm người dùng trong lúc này.");
    } finally {
      setSearching(false);
    }
  };

  const selectUser = async (candidate: UserDTO) => {
    setSelectedUser(candidate);
    setSanctionTargetUserId(candidate.userId);
    setUserStatus(candidate.status === "BANNED" ? "BANNED" : candidate.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE");
    setRolesLoading(true);
    setFeedback(null);
    try {
      setSelectedRoles(await getAdminUserRoles(candidate.userId));
    } catch {
      setSelectedRoles([]);
      setFeedback("Không thể đọc role của người dùng này.");
    } finally {
      setRolesLoading(false);
    }
    if (overview?.permissions.includes("REPORT_MANAGE")) {
      setSanctionsLoading(true);
      void listAdminSanctions(candidate.userId, 50)
        .then(setSanctions)
        .catch(() => setFeedback("Không thể đọc sanctions của người dùng này."))
        .finally(() => setSanctionsLoading(false));
    }
    if (overview?.permissions.includes("USER_READ")) {
      setSecurityLoading(true);
      const [sessionResult, deviceResult] = await Promise.allSettled([
        listAdminSessions(candidate.userId, 100),
        listAdminDevices(candidate.userId, 100),
      ]);
      setUserSessions(sessionResult.status === "fulfilled" ? sessionResult.value : []);
      setUserDevices(deviceResult.status === "fulfilled" ? deviceResult.value : []);
      if (sessionResult.status === "rejected" || deviceResult.status === "rejected") {
        setFeedback("Không thể đọc đầy đủ session/device của người dùng này.");
      }
      setSecurityLoading(false);
    }
  };

  const handleRevokeSession = async (session: AdminSession) => {
    if (!selectedUser || !overview?.permissions.includes("SESSION_REVOKE")) return;
    if (!reason.trim()) {
      setFeedback("Cần ghi lý do khi thu hồi session.");
      return;
    }
    if (!window.confirm(`Thu hồi session ${session.tokenId.slice(0, 8)}… của ${selectedUser.userName}?`)) return;
    setMutating(true);
    try {
      await revokeAdminSession(selectedUser.userId, session.tokenId, reason);
      setUserSessions((current) => current.map((item) => item.tokenId === session.tokenId
        ? { ...item, revokedAt: new Date().toISOString() }
        : item));
      setReason("");
      setFeedback("Đã thu hồi session.");
    } catch {
      setFeedback("Không thể thu hồi session hoặc session đã không còn active.");
    } finally {
      setMutating(false);
    }
  };

  const handleRevokeDevice = async (device: AdminDevice) => {
    if (!selectedUser || !overview?.permissions.includes("SESSION_REVOKE")) return;
    if (!reason.trim()) {
      setFeedback("Cần ghi lý do khi thu hồi thiết bị.");
      return;
    }
    if (!window.confirm(`Thu hồi thiết bị ${device.deviceName ?? device.deviceId}…?`)) return;
    setMutating(true);
    try {
      await revokeAdminDevice(selectedUser.userId, device.deviceId, reason);
      setUserDevices((current) => current.map((item) => item.deviceId === device.deviceId ? { ...item, active: false } : item));
      setUserSessions((current) => current.map((item) => item.deviceId === device.deviceId && !item.revokedAt
        ? { ...item, revokedAt: new Date().toISOString() }
        : item));
      setReason("");
      setFeedback("Đã vô hiệu hóa thiết bị và các session được liên kết.");
    } catch {
      setFeedback("Không thể thu hồi thiết bị hoặc thiết bị đã không còn active.");
    } finally {
      setMutating(false);
    }
  };

  const handleGrant = async () => {
    if (!selectedUser || !roleCode) return;
    if (!reason.trim()) {
      setFeedback("Cần ghi lý do để tạo audit record.");
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
      setFeedback(`Đã cấp role ${roleCode} cho ${selectedUser.userName}.`);
    } catch {
      setFeedback("Không thể cấp role. Backend sẽ từ chối nếu bạn thiếu quyền hoặc role đã tồn tại.");
    } finally {
      setMutating(false);
    }
  };

  const handleRevoke = async (role: AdminRoleGrant) => {
    if (!selectedUser) return;
    const confirmed = window.confirm(`Thu hồi role ${role.roleCode} của ${selectedUser.userName}?`);
    if (!confirmed) return;
    setMutating(true);
    setFeedback(null);
    try {
      await revokeAdminRole(selectedUser.userId, role.roleCode, reason);
      setSelectedRoles(await getAdminUserRoles(selectedUser.userId));
      setFeedback(`Đã thu hồi role ${role.roleCode}.`);
    } catch {
      setFeedback("Không thể thu hồi role. Kiểm tra hierarchy và quyền quản trị.");
    } finally {
      setMutating(false);
    }
  };

  const handleUserStatus = async () => {
    if (!selectedUser || !reason.trim()) {
      setFeedback("Cần ghi lý do cho thay đổi trạng thái tài khoản.");
      return;
    }
    if (userStatus !== "ACTIVE" && !window.confirm(`Đổi trạng thái @${selectedUser.userName} thành ${userStatus}?`)) return;
    setMutating(true);
    setFeedback(null);
    try {
      await updateAdminUserStatus(selectedUser.userId, userStatus, reason);
      setSelectedUser((current) => current ? { ...current, status: userStatus } : current);
      setUsers((current) => current.map((candidate) => candidate.userId === selectedUser.userId ? { ...candidate, status: userStatus } : candidate));
      setReason("");
      setFeedback(`Đã cập nhật trạng thái tài khoản thành ${userStatus}.`);
    } catch {
      setFeedback("Không thể cập nhật trạng thái. Backend sẽ kiểm tra quyền USER_SUSPEND/USER_RESTORE.");
    } finally {
      setMutating(false);
    }
  };

  const selectRoom = async (room: AdminConversationSummary) => {
    setRoomMutating(false);
    setFeedback(null);
    try {
      const detail = await getAdminConversation(room.conversationId);
      setSelectedRoom(detail);
      setRoomPolicy(detail.chatMode);
      setRoomSlowMode(detail.slowModeSeconds);
    } catch {
      setFeedback("Không thể đọc chi tiết room này.");
    }
  };

  const handleRoomPolicy = async () => {
    if (!selectedRoom || !roomReason.trim()) {
      setFeedback("Cần ghi lý do cho thay đổi moderation room.");
      return;
    }
    setRoomMutating(true);
    try {
      const updated = await updateAdminConversationPolicy(selectedRoom.conversationId, roomPolicy, roomSlowMode, roomReason);
      setSelectedRoom(updated);
      setRooms((current) => current.map((room) => room.conversationId === updated.conversationId ? { ...room, ...updated } : room));
      setFeedback("Đã cập nhật policy room toàn cục.");
      setRoomReason("");
    } catch {
      setFeedback("Không thể cập nhật policy. Kiểm tra ROOM_MODERATE và reason.");
    } finally {
      setRoomMutating(false);
    }
  };

  const handleRoomArchive = async () => {
    if (!selectedRoom || !roomReason.trim()) {
      setFeedback("Cần ghi lý do trước khi archive/restore room.");
      return;
    }
    const action = selectedRoom.deleted ? "restore" : "archive";
    if (!window.confirm(`${action === "archive" ? "Archive" : "Khôi phục"} room này trên toàn ứng dụng?`)) return;
    setRoomMutating(true);
    try {
      const updated = selectedRoom.deleted
        ? await restoreAdminConversation(selectedRoom.conversationId, roomReason)
        : await archiveAdminConversation(selectedRoom.conversationId, roomReason);
      setSelectedRoom(updated);
      setRooms((current) => current.map((room) => room.conversationId === updated.conversationId ? { ...room, ...updated } : room));
      setRoomReason("");
      setFeedback(selectedRoom.deleted ? "Đã khôi phục room." : "Đã archive room.");
    } catch {
      setFeedback("Không thể thay đổi trạng thái room.");
    } finally {
      setRoomMutating(false);
    }
  };

  const handleMessageInspection = async (event: FormEvent) => {
    event.preventDefault();
    if (!messageConversationId.trim() || !messageBucket.trim() || !messageId.trim() || !messageReason.trim()) {
      setFeedback("Cần đủ conversation ID, bucket, message ID và lý do điều tra.");
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
      setFeedback("Đã ghi nhận lượt xem message vào audit timeline.");
    } catch {
      setFeedback("Không thể đọc message. Kiểm tra UUID, bucket, quyền AUDIT_READ và reason.");
    } finally {
      setMessageLoading(false);
    }
  };

  const handleReportResolution = async (report: AdminReport, nextStatus: AdminReport['status']) => {
    if (!moderationReason.trim()) {
      setFeedback("Cần ghi lý do cho quyết định moderation.");
      return;
    }
    if ((nextStatus === "RESOLVED" || nextStatus === "DISMISSED") && !resolutionCode.trim()) {
      setFeedback("Cần resolution code khi đóng report.");
      return;
    }
    if (!window.confirm(`Chuyển report ${report.reportId.slice(0, 8)}… thành ${nextStatus}?`)) return;
    setModerationMutating(true);
    setFeedback(null);
    try {
      const updated = await resolveAdminReport(report, nextStatus, resolutionCode, moderationReason);
      setReports((current) => current.filter((item) => item.reportId !== updated.reportId));
      setModerationReason("");
      setResolutionCode("");
      setFeedback(`Đã cập nhật report thành ${nextStatus}.`);
    } catch {
      setFeedback("Không thể cập nhật report. Kiểm tra REPORT_MANAGE và trạng thái hiện tại.");
    } finally {
      setModerationMutating(false);
    }
  };

  const handleImposeSanction = async () => {
    if (!sanctionTargetUserId.trim() || !moderationReason.trim()) {
      setFeedback("Cần user ID và lý do trước khi áp dụng sanction.");
      return;
    }
    if (sanctionScope === "CONVERSATION" && !sanctionConversationId.trim()) {
      setFeedback("Sanction theo room cần conversation ID.");
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
      setFeedback("Đã áp dụng sanction và ghi audit.");
    } catch {
      setFeedback("Không thể áp dụng sanction. Kiểm tra user ID, quyền và thời hạn.");
    } finally {
      setModerationMutating(false);
    }
  };

  const handleRevokeSanction = async (sanction: AdminSanction) => {
    if (!moderationReason.trim()) {
      setFeedback("Cần ghi lý do khi thu hồi sanction.");
      return;
    }
    if (!window.confirm(`Thu hồi sanction ${sanction.sanctionId.slice(0, 8)}…?`)) return;
    setModerationMutating(true);
    try {
      await revokeAdminSanction(sanction, moderationReason);
      setSanctions((current) => current.map((item) => item.sanctionId === sanction.sanctionId ? { ...item, status: "REVOKED", revokedAt: new Date().toISOString() } : item));
      setModerationReason("");
      setFeedback("Đã thu hồi sanction.");
    } catch {
      setFeedback("Không thể thu hồi sanction hoặc sanction đã hết hiệu lực.");
    } finally {
      setModerationMutating(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppPageShell title={localizeText("Quản trị")}>
        <div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner size="lg" /></div>
      </AppPageShell>
    );
  }

  if (!user) return null;

  if (!overview) {
    const denied = errorStatus === 403;
    return (
      <AppPageShell title={localizeText("Quản trị")}>
        <Card className="mx-auto mt-12 max-w-xl">
          <CardHeader>
            <CardTitle>{localizeText(denied ? "Bạn không có quyền truy cập" : "Không tải được khu vực quản trị")}</CardTitle>
            <CardDescription>{errorMessage ?? localizeText("Vui lòng thử lại sau.")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => (onBackToApp ? onBackToApp() : router.push("/app"))}><ArrowLeft size={16} /> {localizeText("Về ứng dụng")}</Button>
            <Button onClick={() => void loadOverview(true)} loading={refreshing}><RefreshCcw size={16} /> {localizeText("Thử lại")}</Button>
          </CardContent>
        </Card>
      </AppPageShell>
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

  return (
    <AppPageShell title={localizeText("Quản trị")}>
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
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{localizeText("Quản lý user, room và policy ở cấp NovaChat. Mọi thao tác global đều đi qua authorization và audit của máy chủ.")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => (onBackToApp ? onBackToApp() : router.push("/app"))}><ArrowLeft size={16} /> {localizeText("Về ứng dụng")}</Button>
            <Button variant="outline" onClick={() => void loadOverview(true)} loading={refreshing}><RefreshCcw size={16} /> {localizeText("Làm mới")}</Button>
          </div>
        </div>

        <div className="grid gap-0 border-y border-border md:grid-cols-3">
          <Card>
            <CardContent className="flex items-start justify-between gap-3 border-0 p-5 md:border-r md:border-border"><div><p className="text-xs font-semibold text-muted-foreground">{localizeText("Role của bạn")}</p><p className="mt-2 text-2xl font-bold">{overview.roles.length}</p></div><ShieldCheck className="text-primary" /></CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start justify-between gap-3 border-0 p-5 md:border-r md:border-border"><div><p className="text-xs font-semibold text-muted-foreground">{localizeText("Permission hiệu lực")}</p><p className="mt-2 text-2xl font-bold">{overview.permissions.length}</p></div><UserCog className="text-primary" /></CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start justify-between gap-3 border-0 p-5"><div><p className="text-xs font-semibold text-muted-foreground">{localizeText("Runtime")}</p><p className="mt-2 text-2xl font-bold">{healthState}</p></div><Server className="text-primary" /></CardContent>
          </Card>
        </div>

          <SurfacePanel title={localizeText("Quản lý toàn bộ room")}>
          {!canReadRooms ? <p className="text-sm leading-6 text-muted-foreground">{localizeText("Role hiện tại chưa có ROOM_READ. Đây là quyền app-level, khác hoàn toàn với role admin trong từng room.")}</p> : <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[170px] flex-1"><label className="block text-xs font-semibold text-muted-foreground">{localizeText("Tháng tạo room (UTC)")}</label><Input className="mt-1" type="month" value={roomMonth} onChange={(event) => setRoomMonth(event.target.value)} /></div>
              <p className="pb-2 text-xs text-muted-foreground">{localizeText("Danh sách được phân vùng theo tháng để không scan Cassandra vô hạn.")}</p>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
              <div className="max-h-[360px] space-y-2 overflow-auto pr-1" aria-live="polite">
                {roomsLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : rooms.length ? rooms.map((room) => <button key={room.conversationId} type="button" onClick={() => void selectRoom(room)} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-[color,background-color,border-color,box-shadow,transform,opacity] ${selectedRoom?.conversationId === room.conversationId ? "border-primary/50 bg-primary/10" : "border-border/60 bg-background/55 hover:border-primary/35"}`}><span className="flex min-w-0 items-center gap-3"><Building2 size={17} className="shrink-0 text-primary" /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{room.name ?? room.conversationId}</span><span className="block truncate text-xs text-muted-foreground">{room.conversationType} · {room.memberCount} {localizeText("thành viên")} · {room.chatMode}</span></span></span><Badge variant={room.deleted ? "destructive" : "outline"}>{room.deleted ? "ARCHIVED" : room.visibility}</Badge></button>) : <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">{localizeText("Không có room trong tháng này hoặc projection chưa được backfill.")}</p>}
              </div>
              {selectedRoom ? <div className="rounded-xl border border-border/60 bg-background/45 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{selectedRoom.name ?? selectedRoom.conversationId}</p><p className="mt-1 text-xs text-muted-foreground">{selectedRoom.conversationId}</p></div><Badge variant={selectedRoom.deleted ? "destructive" : "secondary"}>{selectedRoom.deleted ? "ARCHIVED" : "ACTIVE"}</Badge></div><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-muted-foreground">{localizeText("Type")}</dt><dd className="mt-1 font-semibold">{selectedRoom.conversationType}</dd></div><div><dt className="text-muted-foreground">{localizeText("Members")}</dt><dd className="mt-1 font-semibold">{selectedRoom.memberCount}</dd></div><div><dt className="text-muted-foreground">{localizeText("Owner")}</dt><dd className="mt-1 truncate font-semibold">{selectedRoom.ownerId ?? localizeText("Chưa có owner")}</dd></div><div><dt className="text-muted-foreground">{localizeText("Created")}</dt><dd className="mt-1 font-semibold">{formatDate(selectedRoom.createdAt)}</dd></div></dl><div className="mt-5"><p className="text-xs font-semibold text-muted-foreground">{localizeText("Member snapshot")}</p><div className="mt-2 flex max-h-20 flex-wrap gap-1.5 overflow-auto">{selectedRoom.members.map((member) => <Badge key={member.userId} variant="outline">{member.userId.slice(0, 8)}…</Badge>)}</div></div><label className="mt-5 block text-xs font-semibold text-muted-foreground">{localizeText("Global chat policy")}</label><select value={roomPolicy} onChange={(event) => setRoomPolicy(event.target.value)} disabled={!canModerateRooms} className="mt-1 h-10 w-full rounded-[0.85rem] border border-border/70 bg-background px-3 text-sm"><option value="OPEN">OPEN</option><option value="READ_ONLY">READ_ONLY</option><option value="MANAGERS_ONLY">MANAGERS_ONLY</option></select><label className="mt-3 block text-xs font-semibold text-muted-foreground">{localizeText("Slow mode (giây)")}</label><Input className="mt-1" type="number" min={0} max={86400} value={roomSlowMode} onChange={(event) => setRoomSlowMode(Math.max(0, Number(event.target.value) || 0))} disabled={!canModerateRooms} /><label className="mt-3 block text-xs font-semibold text-muted-foreground">{localizeText("Lý do audit")}</label><Input className="mt-1" value={roomReason} onChange={(event) => setRoomReason(event.target.value)} placeholder={localizeText("Ví dụ: xử lý report spam")} disabled={!canModerateRooms} /><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => void handleRoomPolicy()} loading={roomMutating} disabled={!canModerateRooms || !roomReason.trim()}>{localizeText("Lưu policy")}</Button><Button variant={selectedRoom.deleted ? "outline" : "destructive"} onClick={() => void handleRoomArchive()} loading={roomMutating} disabled={!canModerateRooms || !roomReason.trim()}><Archive size={16} />{selectedRoom.deleted ? localizeText("Khôi phục") : localizeText("Archive room")}</Button></div></div> : <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-border/70 px-4 text-center text-sm text-muted-foreground">{localizeText("Chọn một room để xem members và thao tác moderation toàn cục.")}</div>}
            </div>
          </>}
        </SurfacePanel>

        <SurfacePanel title={localizeText("Audit timeline toàn ứng dụng")}>
          {!canReadAudit ? <p className="text-sm leading-6 text-muted-foreground">{localizeText("Role hiện tại chưa có AUDIT_READ. Audit chỉ hiển thị cho operator được cấp quyền điều tra.")}</p> : <><div className="flex flex-wrap items-end gap-3"><div className="min-w-[170px] flex-1"><label className="block text-xs font-semibold text-muted-foreground">{localizeText("Tháng audit (UTC)")}</label><Input className="mt-1" type="month" value={auditMonth} onChange={(event) => setAuditMonth(event.target.value)} /></div><p className="pb-2 text-xs text-muted-foreground">{localizeText("Chỉ đọc tối đa 50 event trong partition tháng.")}</p></div>{auditLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : auditEvents.length ? <div className="mt-4 max-h-[360px] space-y-2 overflow-auto pr-1" aria-live="polite">{auditEvents.map((event) => <div key={event.eventId} className="rounded-xl border border-border/60 bg-background/45 px-3 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><ScrollText size={15} className="text-primary" /><span className="text-sm font-semibold">{event.action}</span><Badge variant={event.outcome === "SUCCESS" ? "outline" : "destructive"}>{event.outcome}</Badge></div><span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span></div><p className="mt-1 text-xs text-muted-foreground">{event.resourceType}:{event.resourceId}{event.actorId ? ` · actor ${event.actorId.slice(0, 8)}…` : ""}</p>{event.reasonCode ? <p className="mt-1 text-xs leading-5">{localizeText("Lý do:")} {event.reasonCode}</p> : null}</div>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">{localizeText("Chưa có audit event trong tháng này.")}</p>}</>}
        </SurfacePanel>

        <SurfacePanel title={localizeText("Điều tra message") }>
          {!canReadAudit ? <p className="text-sm leading-6 text-muted-foreground">{localizeText("Role hiện tại chưa có AUDIT_READ. Nội dung message chỉ hiển thị cho operator được cấp quyền điều tra.")}</p> : <>
            <p className="text-sm leading-6 text-muted-foreground">{localizeText("Đọc một message cụ thể bằng conversation ID, bucket và message ID. Mỗi lượt xem phải có lý do và được ghi vào audit; không scan toàn bộ lịch sử.")}</p>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleMessageInspection}>
              <div><label className="block text-xs font-semibold text-muted-foreground">{localizeText("Conversation ID")}</label><Input className="mt-1" value={messageConversationId} onChange={(event) => setMessageConversationId(event.target.value)} placeholder="UUID" /></div>
              <div><label className="block text-xs font-semibold text-muted-foreground">{localizeText("Message ID")}</label><Input className="mt-1" value={messageId} onChange={(event) => setMessageId(event.target.value)} placeholder="UUID" /></div>
              <div><label className="block text-xs font-semibold text-muted-foreground">{localizeText("Message bucket")}</label><Input className="mt-1" value={messageBucket} onChange={(event) => setMessageBucket(event.target.value)} placeholder="YYYY-MM-DD-HH:NN" /></div>
              <div><label className="block text-xs font-semibold text-muted-foreground">{localizeText("Lý do điều tra (bắt buộc)")}</label><Input className="mt-1" value={messageReason} onChange={(event) => setMessageReason(event.target.value)} placeholder={localizeText("Ví dụ: xử lý report message")}/></div>
              <div className="md:col-span-2"><Button type="submit" loading={messageLoading} disabled={!messageConversationId.trim() || !messageBucket.trim() || !messageId.trim() || !messageReason.trim()}><Eye size={16} />{localizeText("Đọc message")}</Button></div>
            </form>
            {messageInspection ? <div className="mt-5 rounded-xl border border-border/60 bg-background/45 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><History size={16} className="text-primary" /><span className="text-sm font-semibold">{messageInspection.message.messageType}</span><Badge variant={messageInspection.message.isDeleted ? "destructive" : "outline"}>{messageInspection.message.isDeleted ? localizeText("Đã xoá (tombstone)") : localizeText("Đang hiển thị")}</Badge>{messageInspection.message.isPinned ? <Badge variant="secondary">{localizeText("Đã ghim")}</Badge> : null}</div><p className="mt-2 break-all text-xs text-muted-foreground">{messageInspection.message.messageId} · {messageInspection.message.messageBucket}</p></div><span className="text-xs text-muted-foreground">{formatDate(messageInspection.message.createdAt)}</span></div><div className="mt-4 rounded-lg border border-border/60 bg-background px-3 py-3 text-sm leading-6 whitespace-pre-wrap break-words">{messageInspection.message.content || localizeText("Message không có nội dung text.")}</div><dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div><dt className="text-muted-foreground">{localizeText("Sender")}</dt><dd className="mt-1 break-all font-semibold">{messageInspection.message.senderId}</dd></div><div><dt className="text-muted-foreground">{localizeText("Edited")}</dt><dd className="mt-1 font-semibold">{formatDate(messageInspection.message.editedAt)}</dd></div><div><dt className="text-muted-foreground">{localizeText("Deleted by")}</dt><dd className="mt-1 break-all font-semibold">{messageInspection.message.deletedBy ?? localizeText("Không có")}</dd></div><div><dt className="text-muted-foreground">{localizeText("Deleted at")}</dt><dd className="mt-1 font-semibold">{formatDate(messageInspection.message.deletedAt)}</dd></div></dl><div className="mt-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{localizeText("Revision history")}</p>{messageInspection.revisions.length ? <div className="mt-2 space-y-2">{messageInspection.revisions.map((revision) => <div key={`${revision.revisionNumber}-${revision.editedAt}`} className="rounded-lg border border-border/60 px-3 py-2"><div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="outline">#{revision.revisionNumber} · {revision.action}</Badge><span className="text-xs text-muted-foreground">{formatDate(revision.editedAt)}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5">{revision.content || localizeText("Không có nội dung text.")}</p><p className="mt-1 break-all text-[11px] text-muted-foreground">{revision.editedBy ?? localizeText("Không xác định")}</p></div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">{localizeText("Message chưa có revision.")}</p>}</div></div> : null}
          </>}
        </SurfacePanel>

        <SurfacePanel title={localizeText("Analytics vận hành")}>
          {!canReadAnalytics ? <p className="text-sm leading-6 text-muted-foreground">{localizeText("Role hiện tại chưa có ANALYTICS_READ. Dữ liệu aggregate chỉ dành cho operator được cấp quyền.")}</p> : <><div className="flex flex-wrap items-end gap-3"><div className="min-w-[150px] flex-1"><label className="block text-xs font-semibold text-muted-foreground">{localizeText("Từ ngày (UTC)")}</label><Input className="mt-1" type="date" value={analyticsFrom} onChange={(event) => setAnalyticsFrom(event.target.value)} /></div><div className="min-w-[150px] flex-1"><label className="block text-xs font-semibold text-muted-foreground">{localizeText("Đến ngày (UTC)")}</label><Input className="mt-1" type="date" value={analyticsTo} onChange={(event) => setAnalyticsTo(event.target.value)} /></div><div className="min-w-[180px] flex-1"><label className="block text-xs font-semibold text-muted-foreground">{localizeText("Event type")}</label><select value={analyticsType} onChange={(event) => setAnalyticsType(event.target.value)} className="mt-1 h-10 w-full rounded-[0.85rem] border border-border/70 bg-background px-3 text-sm"><option value="ALL">ALL</option><option value="ROOM_CREATED">ROOM_CREATED</option><option value="ROOM_JOINED">ROOM_JOINED</option><option value="MESSAGE_SENT">MESSAGE_SENT</option><option value="POLLS_CREATED">POLLS_CREATED</option><option value="POLL_VOTED">POLL_VOTED</option><option value="CALL_STARTED">CALL_STARTED</option></select></div><p className="pb-2 text-xs text-muted-foreground">{localizeText("Tối đa 31 ngày / 200 điểm hiển thị.")}</p></div>{analyticsLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : analyticsPoints.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(analyticsPoints.reduce<Record<string, number>>((counts, point) => { counts[point.eventType] = (counts[point.eventType] ?? 0) + 1; return counts; }, {})).map(([type, count]) => <div key={type} className="rounded-xl border border-border/60 bg-background/45 p-3"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-semibold"><BarChart3 size={15} className="text-primary" />{type}</span><span className="text-lg font-black">{count}</span></div><p className="mt-1 text-xs text-muted-foreground">{localizeText("aggregate events trong khoảng đã chọn")}</p></div>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">{localizeText("Chưa có analytics trong khoảng này.")}</p>}</>}
        </SurfacePanel>

        <SurfacePanel title={localizeText("Reports & sanctions")}>
          {!canManageReports ? <p className="text-sm leading-6 text-muted-foreground">{localizeText("Role hiện tại chưa có REPORT_MANAGE. Các quyết định moderation chỉ dành cho trust & safety operator.")}</p> : <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[170px] flex-1"><label className="block text-xs font-semibold text-muted-foreground">{localizeText("Ngày report (UTC)")}</label><Input className="mt-1" type="date" value={reportDay} onChange={(event) => setReportDay(event.target.value)} /></div>
              <div className="min-w-[170px] flex-1"><label className="block text-xs font-semibold text-muted-foreground">{localizeText("Trạng thái")}</label><select value={reportStatusFilter} onChange={(event) => setReportStatusFilter(event.target.value as AdminReport['status'])} className="mt-1 h-10 w-full rounded-[0.85rem] border border-border/70 bg-background px-3 text-sm"><option value="OPEN">OPEN</option><option value="IN_REVIEW">IN_REVIEW</option><option value="RESOLVED">RESOLVED</option><option value="DISMISSED">DISMISSED</option></select></div>
              <p className="pb-2 text-xs text-muted-foreground">{localizeText("Hàng đợi được phân vùng theo ngày để giữ truy vấn bounded.")}</p>
            </div>
            <div className="mt-4 space-y-2" aria-live="polite">
              {reportsLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : reports.length ? reports.map((report) => <div key={report.reportId} className="rounded-xl border border-border/60 bg-background/45 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{report.targetType}</Badge><Badge variant={report.status === "OPEN" ? "destructive" : "secondary"}>{report.status}</Badge><span className="text-xs text-muted-foreground">{report.reportId}</span></div><p className="mt-2 text-sm font-semibold">{report.reasonCode}</p>{report.description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{report.description}</p> : null}<p className="mt-1 text-xs text-muted-foreground">Reporter: {report.reporterId}{report.targetUserId ? ` · target: ${report.targetUserId}` : ""}</p></div><div className="flex flex-wrap gap-2">{report.targetUserId ? <Button size="sm" variant="outline" onClick={() => { setSanctionTargetUserId(report.targetUserId as string); setSanctions([]); setFeedback("Đã chọn target user cho form sanction."); }}>{localizeText("Chọn target")}</Button> : null}{report.status === "OPEN" ? <Button size="sm" variant="outline" onClick={() => void handleReportResolution(report, "IN_REVIEW")} loading={moderationMutating}>{localizeText("Nhận xử lý")}</Button> : null}{report.status === "OPEN" || report.status === "IN_REVIEW" ? <><Button size="sm" onClick={() => void handleReportResolution(report, "RESOLVED")} loading={moderationMutating}>{localizeText("Resolve")}</Button><Button size="sm" variant="destructive" onClick={() => void handleReportResolution(report, "DISMISSED")} loading={moderationMutating}>{localizeText("Dismiss")}</Button></> : null}</div></div></div>) : <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">{localizeText("Không có report trong filter hiện tại.")}</p>}
            </div>
            <div className="mt-5 rounded-xl border border-border/60 bg-background/45 p-4"><p className="text-sm font-bold">{localizeText("Áp dụng user sanction")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{localizeText("Sanction APP BAN/SUSPEND cập nhật account status; sanction CONVERSATION chỉ áp dụng trong room được chỉ định.")}</p><div className="mt-3 grid gap-3 md:grid-cols-2"><div><label className="block text-xs font-semibold text-muted-foreground">{localizeText("Target user ID")}</label><Input className="mt-1" value={sanctionTargetUserId} onChange={(event) => setSanctionTargetUserId(event.target.value)} placeholder={localizeText("UUID của user")} /></div><div><label className="block text-xs font-semibold text-muted-foreground">{localizeText("Scope")}</label><select value={sanctionScope} onChange={(event) => setSanctionScope(event.target.value as AdminSanction['scope'])} className="mt-1 h-10 w-full rounded-[0.85rem] border border-border/70 bg-background px-3 text-sm"><option value="APP">APP</option><option value="CONVERSATION">CONVERSATION</option></select></div><div><label className="block text-xs font-semibold text-muted-foreground">{localizeText("Loại sanction")}</label><select value={sanctionType} onChange={(event) => setSanctionType(event.target.value as AdminSanction['sanctionType'])} className="mt-1 h-10 w-full rounded-[0.85rem] border border-border/70 bg-background px-3 text-sm"><option value="BAN">BAN</option><option value="SUSPEND">SUSPEND</option><option value="MUTE">MUTE</option><option value="WARNING">WARNING</option></select></div>{sanctionScope === "CONVERSATION" ? <div><label className="block text-xs font-semibold text-muted-foreground">{localizeText("Conversation ID")}</label><Input className="mt-1" value={sanctionConversationId} onChange={(event) => setSanctionConversationId(event.target.value)} placeholder={localizeText("UUID của room")} /></div> : null}<div><label className="block text-xs font-semibold text-muted-foreground">{localizeText("Hết hạn (tuỳ chọn)")}</label><Input className="mt-1" type="datetime-local" value={sanctionExpiresAt} onChange={(event) => setSanctionExpiresAt(event.target.value)} /></div><div><label className="block text-xs font-semibold text-muted-foreground">{localizeText("Reason code")}</label><Input className="mt-1" value={resolutionCode} onChange={(event) => setResolutionCode(event.target.value)} placeholder={localizeText("SPAM, ABUSE...")} /></div></div><label className="mt-3 block text-xs font-semibold text-muted-foreground">{localizeText("Lý do chi tiết (bắt buộc)")}</label><Input className="mt-1" value={moderationReason} onChange={(event) => setModerationReason(event.target.value)} placeholder={localizeText("Ghi rõ căn cứ quyết định")} /><Button className="mt-4" onClick={() => void handleImposeSanction()} loading={moderationMutating}>{localizeText("Áp dụng sanction")}</Button></div>
            {sanctionsLoading ? <div className="mt-5 flex justify-center py-4"><LoadingSpinner /></div> : sanctionTargetUserId && sanctions.length ? <div className="mt-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{localizeText("Sanction của target đang chọn")}</p><div className="mt-3 space-y-2">{sanctions.map((sanction) => <div key={sanction.sanctionId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2"><div><Badge variant={sanction.status === "ACTIVE" ? "destructive" : "outline"}>{sanction.sanctionType} · {sanction.status}</Badge><p className="mt-1 text-xs text-muted-foreground">{sanction.scope} · {sanction.reasonText}</p></div>{sanction.status === "ACTIVE" ? <Button size="sm" variant="outline" onClick={() => void handleRevokeSanction(sanction)} loading={moderationMutating}>{localizeText("Thu hồi")}</Button> : null}</div>)}</div></div> : null}
          </>}
        </SurfacePanel>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
          <SurfacePanel title={localizeText("Quyền quản trị hiện tại")}>
            <div className="flex flex-wrap gap-2">{overview.roles.map((role) => <Badge key={role} variant={roleBadgeVariant(role)}>{role}</Badge>)}</div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{localizeText("Permission")}</p>
            <div className="mt-3 flex max-h-44 flex-wrap gap-2 overflow-auto">{overview.permissions.map((permission) => <Badge key={permission} variant="outline">{permission}</Badge>)}</div>
            {health ? <p className="mt-5 text-xs text-muted-foreground">{localizeText("Cassandra:")} <span className="font-semibold text-foreground">{health.cassandra}</span> · {localizeText("kiểm tra lúc")} {formatDate(health.timestamp)}</p> : <p className="mt-5 text-xs text-muted-foreground">{localizeText("Health endpoint chưa phản hồi; số liệu trên không được thay bằng dữ liệu giả.")}</p>}
          </SurfacePanel>

          <SurfacePanel title={localizeText("Tìm người dùng")}>
            {!canReadUsers ? <p className="text-sm leading-6 text-muted-foreground">{localizeText("Role hiện tại không có USER_READ. Khu vực này chỉ hiển thị cho operator được cấp quyền đọc user.")}</p> : null}
            {canReadUsers ? <>
            <form className="flex gap-2" onSubmit={handleSearch}>
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={localizeText("username hoặc tên hiển thị")} aria-label={localizeText("Tìm người dùng quản trị")} />
              <Button type="submit" loading={searching} aria-label={localizeText("Tìm kiếm")}><Search size={16} /></Button>
            </form>
            <div className="mt-4 space-y-2" aria-live="polite">
              {users.map((candidate) => <button key={candidate.userId} type="button" onClick={() => void selectUser(candidate)} className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-background/55 px-3 py-2 text-left transition-[color,background-color,border-color,box-shadow,transform,opacity] hover:border-primary/40 hover:bg-primary/5"><span className="flex min-w-0 items-center gap-3"><UserRound size={16} className="shrink-0 text-primary" /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{candidate.displayName}</span><span className="block truncate text-xs text-muted-foreground">@{candidate.userName} · {candidate.status}</span></span></span><span className="text-xs text-muted-foreground">{localizeText("Chọn")}</span></button>)}
              {!users.length ? <p className="py-5 text-center text-sm text-muted-foreground">{localizeText("Tìm theo username để bắt đầu.")}</p> : null}
            </div>
            </> : null}
          </SurfacePanel>
        </div>

        {selectedUser && canReadUsers ? <SurfacePanel title={`${localizeText("Quản lý role")} · @${selectedUser.userName}`}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
            <div>
              <div className="rounded-xl border border-border/60 bg-background/55 p-4"><p className="font-semibold">{selectedUser.displayName}</p><p className="mt-1 text-xs text-muted-foreground">{selectedUser.userId} · trạng thái {selectedUser.status}</p></div>
              <div className="mt-4 rounded-xl border border-border/60 bg-background/45 p-4"><p className="text-sm font-bold">{localizeText("Trạng thái tài khoản toàn cục")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{localizeText("Suspend/ban sẽ chặn phiên mới sau khi security version tăng. Không thể tự khóa tài khoản operator hiện tại.")}</p><div className="mt-3 flex flex-wrap items-end gap-2"><div className="min-w-[170px] flex-1"><label className="block text-xs font-semibold text-muted-foreground">{localizeText("Status")}</label><select value={userStatus} onChange={(event) => setUserStatus(event.target.value as 'ACTIVE' | 'SUSPENDED' | 'BANNED')} disabled={!canManageUserStatus} className="mt-1 h-10 w-full rounded-[0.85rem] border border-border/70 bg-background px-3 text-sm"><option value="ACTIVE">ACTIVE</option><option value="SUSPENDED">SUSPENDED</option><option value="BANNED">BANNED</option></select></div><Button variant="outline" onClick={() => void handleUserStatus()} loading={mutating} disabled={!canManageUserStatus || !reason.trim()}>{localizeText("Cập nhật status")}</Button></div></div>
              <div className="mt-4 rounded-xl border border-border/60 bg-background/45 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-bold">{localizeText("Session & thiết bị")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{localizeText("Danh sách bounded tối đa 100 mục; thu hồi sẽ vô hiệu hóa token/device ở backend.")}</p></div><Badge variant={canRevokeSessions ? "outline" : "secondary"}>{canRevokeSessions ? localizeText("Có quyền thu hồi") : localizeText("Chỉ xem")}</Badge></div>{securityLoading ? <div className="flex justify-center py-5"><LoadingSpinner /></div> : <div className="mt-4 space-y-4"><div><p className="text-xs font-bold text-muted-foreground">{localizeText("Thiết bị")}</p>{userDevices.length ? <div className="mt-2 space-y-2">{userDevices.map((device) => <div key={device.deviceId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2"><div><p className="text-sm font-semibold">{device.deviceName ?? device.deviceId}</p><p className="text-xs text-muted-foreground">{device.platform ?? localizeText("Chưa có nền tảng")} / {device.appVersion ?? localizeText("Chưa có phiên bản")} / {device.active ? "ACTIVE" : "REVOKED"}</p></div>{device.active && canRevokeSessions ? <Button size="sm" variant="outline" onClick={() => void handleRevokeDevice(device)} loading={mutating}>{localizeText("Thu hồi")}</Button> : null}</div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">{localizeText("Chưa có device projection.")}</p>}</div><div><p className="text-xs font-bold text-muted-foreground">{localizeText("Refresh sessions")}</p>{userSessions.length ? <div className="mt-2 space-y-2">{userSessions.map((session) => <div key={session.tokenId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2"><div><p className="text-xs font-semibold">{session.tokenId.slice(0, 12)}…</p><p className="text-xs text-muted-foreground">Issued key: {session.issuedAt.slice(0, 12)}… / hết hạn: {formatDate(session.expiresAt)}{session.revokedAt ? " / REVOKED" : ""}</p></div>{!session.revokedAt && canRevokeSessions ? <Button size="sm" variant="outline" onClick={() => void handleRevokeSession(session)} loading={mutating}>{localizeText("Thu hồi")}</Button> : null}</div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">{localizeText("Chưa có refresh session.")}</p>}</div></div>}</div>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{localizeText("Role đang gán")}</p>
              <div className="mt-3 space-y-2">{rolesLoading ? <LoadingSpinner /> : selectedRoles.length ? selectedRoles.map((role) => <div key={role.grantId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2"><div><Badge variant={roleBadgeVariant(role.roleCode)}>{role.roleCode}</Badge><p className="mt-1 text-xs text-muted-foreground">{localizeText("Cấp lúc")} {formatDate(role.grantedAt)} · {formatDate(role.expiresAt)}</p></div>{canManageRoles ? <Button size="sm" variant="destructive" onClick={() => void handleRevoke(role)} loading={mutating}>{localizeText("Thu hồi")}</Button> : null}</div>) : <p className="text-sm text-muted-foreground">{localizeText("Chưa có role ứng dụng.")}</p>}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/45 p-4">
              {!canManageRoles ? <p className="mb-4 rounded-lg border border-border/60 bg-background/60 p-3 text-xs leading-5 text-muted-foreground">{localizeText("Bạn có thể xem role nhưng không có APP_ROLE_MANAGE để thay đổi.")}</p> : null}
              <p className="text-sm font-bold">{localizeText("Cấp role")}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{localizeText("Chỉ chọn role bạn được phép cấp. SUPER_ADMIN luôn bị backend bảo vệ riêng.")}</p>
              <label className="mt-4 block text-xs font-semibold text-muted-foreground">{localizeText("Role")}</label>
              <select value={roleCode} onChange={(event) => setRoleCode(event.target.value)} className="mt-1 h-10 w-full rounded-[0.85rem] border border-border/70 bg-background px-3 text-sm" disabled={!canManageRoles || !availableToGrant.length}><option value="">{availableToGrant.length ? localizeText("Chọn role") : localizeText("Đã gán toàn bộ role")}</option>{availableToGrant.map((code) => <option key={code} value={code}>{code}</option>)}</select>
              <label className="mt-3 block text-xs font-semibold text-muted-foreground">{localizeText("Lý do (bắt buộc)")}</label>
              <Input className="mt-1" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={localizeText("Ví dụ: phân công hỗ trợ cộng đồng")} disabled={!canManageRoles} />
              <label className="mt-3 block text-xs font-semibold text-muted-foreground">{localizeText("Hết hạn (tuỳ chọn)")}</label>
              <Input className="mt-1" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} disabled={!canManageRoles} />
              <Button className="mt-4 w-full" onClick={() => void handleGrant()} loading={mutating} disabled={!canManageRoles || !availableToGrant.length || !roleCode}>{localizeText("Cấp role")}</Button>
            </div>
          </div>
        </SurfacePanel> : null}

        {feedback ? <p role="status" className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">{feedback}</p> : null}
      </motion.div>
    </AppPageShell>
  );
};

export default AdminPage;
