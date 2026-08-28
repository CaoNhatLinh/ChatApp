import { localizedCopy } from '@/shared/i18n';

const rawUICopy = {
  brand: "NovaChat",

  status: {
    loading: "Đang tải...",
    searching: "Đang tìm...",
    loadingProfile: "Đang tải thông tin...",
    notFound: "Không có kết quả",
    openProfileFailed: "Không thể tải thông tin người dùng.",
    loadingDataHint: "Đang tải dữ liệu...",
  },

  shell: {
    appTitle: "NovaChat",
    publicTitle: "NovaChat",
    navPublic: [
      { to: "/", label: "Trang chủ" },
      { to: "/about", label: "Giới thiệu" },
      { to: "/help", label: "Trợ giúp" },
    ],
    navApp: [
      { to: "/app", label: "Chat", icon: "MessageCircle" },
      { to: "/friends", label: "Bạn bè", icon: "Users" },
      { to: "/search", label: "Tìm kiếm", icon: "Search" },
      { to: "/profile", label: "Hồ sơ", icon: "UserRound" },
      { to: "/settings", label: "Cài đặt", icon: "Settings" },
    ],
    publicActions: {
      login: "Đăng nhập",
      register: "Đăng ký",
    },
  },

  friends: {
    tabs: {
      all: "Tất cả",
      friends: "Bạn bè",
      requests: "Lời mời",
      add: "Tìm bạn",
    },
    sectionTitle: {
      friends: "Danh sách bạn bè",
      requests: "Lời mời kết bạn",
      add: "Tìm bạn mới",
      friendsHeader: "Danh sách",
    },
    filters: {
      searchPlaceholder: "Nhập tên hoặc email",
      noFriendsHint: "Nhập tên để lọc danh sách.",
      noRequestsHint: "Đừng bỏ qua lời mời mới nhất hôm nay.",
      noSearchHint: "Nhập từ khóa để tìm bạn bè.",
      noFriendsEmpty: "Không có bạn bè.",
      noRequestsEmpty: "Không có lời mời nào.",
      noSearchEmpty: "Không tìm thấy kết quả.",
      noSearchResultText: "Không tìm thấy kết quả. Thử từ khóa khác hoặc tìm theo email.",
      friendCountSuffix: " người",
      requestCountSuffix: " yêu cầu",
    },
    row: {
      alreadyFriend: "Đã là bạn",
      requestSent: "Đã gửi",
      self: "Bạn thân",
      send: "Mời",
    },
    actions: {
      openChat: "Nhắn tin",
      unfriendConfirm: "Bạn có chắc muốn hủy kết bạn với người này?",
      accept: "Chấp nhận",
      reject: "Từ chối",
      sentSuccess: "Đã gửi lời mời kết bạn.",
      sentFailed: "Không thể gửi lời mời.",
      acceptSuccess: "Đã chấp nhận lời mời.",
      acceptFailed: "Lỗi khi chấp nhận lời mời.",
      rejectSuccess: "Đã từ chối lời mời.",
      rejectFailed: "Lỗi khi từ chối lời mời.",
      openChatSuccess: "Đã mở cuộc trò chuyện.",
      openChatFailed: "Không thể mở cuộc trò chuyện.",
      unfriendSuccess: "Đã hủy kết bạn.",
      unfriendFailed: "Không thể hủy kết bạn.",
    },
    searchResultLabel: "Kết quả",
  },

  search: {
    pageTitle: "Tìm kiếm nhanh",
    pageDescription: "Điều hướng nhanh giao diện theo nhu cầu của bạn.",
    queryLabel: "Nhập từ khóa tìm kiếm",
    queryPlaceholder: "Tìm trang, chức năng hoặc lời gợi ý...",
    scopes: [
      { value: "all", label: "Tất cả" },
      { value: "chat", label: "Chat" },
      { value: "friends", label: "Bạn bè" },
      { value: "settings", label: "Cài đặt" },
      { value: "public", label: "Chính sách & giới thiệu" },
    ],
    targets: [
      {
        category: "public",
        title: "Trang chủ",
        path: "/",
        description: "Tổng quan sản phẩm, CTA chat nhanh và giá trị cốt lõi.",
      },
      {
        category: "public",
        title: "Về NovaChat",
        path: "/about",
        description: "Tìm hiểu sâu hơn về sản phẩm, tầm nhìn và lợi ích cho làm việc nhóm.",
      },
      {
        category: "public",
        title: "Trợ giúp",
        path: "/help",
        description: "Hướng dẫn vận hành, giải đáp lỗi thường gặp và mẹo tăng hiệu suất.",
      },
      {
        category: "public",
        title: "Điều khoản",
        path: "/terms",
        description: "Chính sách sử dụng, quyền riêng tư và điều khoản trách nhiệm.",
      },
      {
        category: "chat",
        title: "Khu vực chat",
        path: "/app",
        description: "Mở giao diện nhận tin realtime với sidebar và bảng trò chuyện.",
      },
      {
        category: "friends",
        title: "Danh sách bạn bè",
        path: "/friends",
        description: "Quản lý bạn bè, lời mời kết nối và bắt đầu một cuộc trò chuyện.",
      },
      {
        category: "settings",
        title: "Cài đặt giao diện",
        path: "/settings?tab=appearance",
        description: "Thay đổi chủ đề nền, màu sắc và cách hiển thị của hệ thống.",
      },
      {
        category: "settings",
        title: "Hồ sơ cá nhân",
        path: "/profile",
        description: "Cập nhật thông tin và điều hướng nhanh đến các liên kết cần thiết.",
      },
    ],
    resultTitlePrefix: (count: number) => `Kết quả (${count})`,
    resultDescriptionWithQuery: (count: number, query: string) =>
      `Có ${count} mục phù hợp với: ${query}`,
    resultDescriptionDefault: "Lọc theo phân nhóm để tìm nhanh hơn.",
  },

  about: {
    values: [
      {
        title: "Thiết kế",
        description:
          "Giao diện gần gũi, điều hướng rõ ràng và thao tác bắt đầu cuộc trò chuyện nhanh.",
      },
      {
        title: "Kết nối theo thời gian thực",
        description:
          "Tin nhắn, trạng thái online và thông báo đồng bộ gần như tức thì trong mỗi phòng trò chuyện.",
      },
      {
        title: "Độ tin cậy cao",
        description:
          "Ưu tiên vận hành ổn định và trải nghiệm tốt trên nhiều thiết bị.",
      },
    ],
  },

  help: {
    eyebrow: "Trợ giúp",
    title: "Giải đáp để bạn quay lại cuộc trò chuyện",
    description:
      "Mọi thao tác quan trọng đều được gom trong giao diện thân thiện. Nếu cần hỗ trợ sâu hơn, xem nhanh các bước dưới đây.",
    faqTitle: "Câu hỏi thường gặp",
    tipsTitle: "Bắt đầu nhanh",
    quickStartButton: "Mở NovaChat",
    supportLine:
      "Bạn đang gặp lỗi kỹ thuật? Vào menu Cài đặt > Hỗ trợ trong app để gửi yêu cầu.",
    faqs: [
      {
        question: "Tôi có thể đăng ký và đăng nhập như thế nào?",
        answer:
          "Vào /register để tạo tài khoản mới, sau đó đăng nhập tại /login. Hãy đặt mật khẩu mạnh để bảo vệ tài khoản.",
      },
      {
        question: "Làm sao bắt đầu một cuộc trò chuyện?",
        answer:
          "Sau khi vào /app, chọn danh sách bên trái, nhấn Tạo cuộc trò chuyện hoặc chọn bạn bè hiện có để mở nhanh.",
      },
      {
        question: "Làm sao biết tin nhắn đã đọc?",
        answer:
          "Phần trạng thái tin nhắn trong cuộc trò chuyện sẽ hiển thị tiến trình đã đọc theo từng người và từng nhóm.",
      },
    ],
    tips: [
      "Mở danh sách bạn bè và cuộc trò chuyện trước khi bắt đầu nhận tin.",
      "Kiểm tra trạng thái trước khi nhắn để đón phản hồi nhanh hơn.",
      "Gửi file đính kèm trực tiếp trong luồng chat, tránh chuyển sang ứng dụng khác.",
      "Tìm tính năng trước khi giải quyết yêu cầu để xử lý nhanh hơn.",
    ],
  },

  privacy: {
    eyebrow: "Chính sách",
    title: "Quyền riêng tư và dữ liệu",
    description:
      "Chúng tôi tôn trọng quyền riêng tư của người dùng. Dữ liệu tài khoản và tin nhắn được dùng cho xác thực, đồng bộ phiên và truyền tin realtime trong phạm vi ứng dụng.",
    cards: [
      {
        title: "Dữ liệu thu thập",
        description:
          "Tên tài khoản, trạng thái hoạt động, tin nhắn và danh sách liên hệ để vận hành ứng dụng.",
      },
      {
        title: "Mục đích sử dụng",
        description:
          "Xác thực phiên đăng nhập, theo dõi thời gian thực và tối ưu trải nghiệm nhận tin.",
      },
      {
        title: "Bảo mật",
        description:
          "Dữ liệu được kiểm soát bởi token phiên, cơ chế xác thực và kết nối real-time theo chính sách ứng dụng.",
      },
    ],
    notesTitle: "Ghi chú vận hành",
    notes:
      "Dữ liệu của bạn được xử lý để vận hành đăng nhập, theo dõi phiên và truyền tin theo thời gian thực trong phạm vi ứng dụng.",
    actions: {
      support: "Mở trợ giúp",
    },
  },

  terms: {
    title: "Điều khoản sử dụng",
    description:
      "Khi sử dụng nền tảng NovaChat, bạn đồng ý các điều khoản dưới đây. Các quy định có thể cập nhật theo yêu cầu bảo mật, vận hành dịch vụ và điều kiện pháp lý.",
    items: [
      {
        title: "1. Quyền dùng",
        body: "Bạn được phép sử dụng NovaChat để trao đổi thông tin cá nhân, công việc và cộng tác nhóm trong phạm vi hợp lệ theo luật hiện hành.",
      },
      {
        title: "2. Tài khoản",
        body: "Thông tin tài khoản phải phản ánh đúng người dùng. Không chia sẻ mật khẩu cho người khác và giữ bí mật toàn bộ yếu tố bảo mật.",
      },
      {
        title: "3. Nội dung",
        body: "Không phát tán nội dung vi phạm pháp luật, quấy rối người khác hoặc có ý ác trong khu vực chat.",
      },
      {
        title: "4. Hạn chế trách nhiệm",
        body: "NovaChat hỗ trợ giao tiếp realtime và công cụ cộng tác; dữ liệu người dùng chấp nhận rủi ro kỹ thuật theo điều kiện vận hành thông thường và được xử lý minh bạch theo Chính sách.",
      },
    ],
    buttonHome: "Về trang chủ",
  },

  profile: {
    loading: "Đang tải thông tin...",
    quickLinksTitle: "Truy cập nhanh",
    quickLinkItems: {
      app: "Chat",
      search: "Tìm nhanh",
      friends: "Bạn bè",
      settings: "Cài đặt giao diện",
    },
  },

  settings: {
    closeButton: "Đóng cài đặt",
    profileTitle: "Tài khoản",
    profileDescription: "Cập nhật tên hiển thị, bí danh và ảnh đại diện.",
    themeLight: "Sáng",
    themeDark: "Tối",
    themeSystem: "Theo hệ thống",
    saveProfile: "Lưu thay đổi",
    saveProfileNoChanges: "Không có thay đổi nào để lưu.",
    saveProfileEmptyName: "Tên hiển thị không được để trống.",
    saveProfileSuccess: "Cập nhật hồ sơ thành công.",
    saveProfileError: "Cập nhật thất bại. Vui lòng thử lại.",
    logoutSuccess: "Đăng xuất thành công.",
    logoutWarning: "Không thể đăng xuất trên máy chủ ngay lúc này, tiếp tục đăng xuất local.",
    logoutError: "Lỗi đăng xuất. Đã đăng xuất phiên cục bộ để bảo vệ thiết bị.",
  },

  notifications: {
    title: "Thông báo",
    latest: "Cập nhật mới nhất",
    markAll: "Duyệt tất cả",
    empty: "Không có thông báo nào.",
  },
} as const;

export const UI_COPY = localizedCopy(rawUICopy);
