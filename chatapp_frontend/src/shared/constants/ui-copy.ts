import { localizedCopy } from '@/shared/i18n';

const rawUICopy = {
  brand: "Nối",

  status: {
    loading: "Đang tải...",
    searching: "Đang tìm...",
    loadingProfile: "Đang tải thông tin...",
    notFound: "Không có kết quả",
    openProfileFailed: "Không thể tải thông tin người dùng.",
    loadingDataHint: "Đang tải dữ liệu...",
  },

  shell: {
    appTitle: "Nối",
    publicTitle: "Nối",
    navPublic: [
      { to: "/", label: "Trang chủ" },
      { to: "/about", label: "Giới thiệu" },
      { to: "/help", label: "Trợ giúp" },
    ],
    navApp: [
      { to: "/app", label: "Chat", icon: "MessageCircle" },
      { to: "/friends", label: "Bạn bè", icon: "Users" },
      { to: "/communities", label: "Cộng đồng", icon: "Compass" },
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
      unfriend: "Hủy kết bạn",
      unfriendConfirm: "Bạn có chắc muốn hủy kết bạn với người này?",
      accept: "Chấp nhận",
      reject: "Từ chối",
      sentSuccess: "Đã gửi lời mời kết bạn.",
      sentFailed: "Không thể gửi lời mời.",
      cancel: "Hủy lời mời",
      cancelSuccess: "Đã hủy lời mời kết bạn.",
      cancelFailed: "Không thể hủy lời mời kết bạn.",
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

  about: {
    title: "Cuộc trò chuyện cần một nhịp để sống.",
    description:
      "Tôi xây Nối như một xưởng thực hành: tin nhắn, trạng thái và quyền truy cập cùng đi trên một mạch rõ ràng.",
    principlesTitle: "Nối được xây quanh những quyết định nhỏ nhưng quan trọng.",
    principles: [
      {
        title: "Ngữ cảnh không bị đứt",
        description:
          "Tin nhắn, tệp và trạng thái ở ngay trong cuộc trò chuyện liên quan. Không cần ghép lại từ nhiều nơi.",
      },
      {
        title: "Kết nối có trọng lượng",
        description:
          "Lời mời, quyền tham gia và trạng thái hiện rõ để mỗi người biết trước bước tiếp theo.",
      },
      {
        title: "Con người ở tiền cảnh",
        description:
          "Giao diện ưu tiên người đang trò chuyện và hành động cần thiết, không biến cuộc trò chuyện thành một bảng điều khiển.",
      },
    ],
    flowTitle: "Một tín hiệu trở thành cuộc trò chuyện",
    flow: [
      {
        title: "Mời",
        description: "Chọn người bạn muốn kết nối và gửi lời mời rõ ràng.",
      },
      {
        title: "Gặp",
        description: "Mở một phòng phù hợp cho cuộc trò chuyện hoặc nhóm nhỏ.",
      },
      {
        title: "Tiếp nhịp",
        description: "Giữ lại tin nhắn, tệp và tín hiệu để lần sau quay lại thật nhanh.",
      },
    ],
    boundaryTitle: "Nối chỉ dọn đường",
    boundary:
      "Nối không quyết định bạn phải nói gì. Nó chỉ làm rõ cách một cuộc trò chuyện được bắt đầu, theo dõi và mở lại.",
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
    title: "Bạn đang ở đâu trong mạch trò chuyện?",
    description:
      "Chọn tín hiệu gần nhất với chỗ bạn đang mắc. Nối sẽ đưa bạn về đúng bước tiếp theo.",
    faqTitle: "Câu hỏi thường gặp",
    tipsTitle: "Bắt đầu nhanh",
    tasksTitle: "Bạn đang muốn làm gì?",
    tasks: [
      {
        title: "Tạo tài khoản",
        description: "Đăng ký, xác nhận thông tin và vào không gian của bạn.",
        href: "/register",
        action: "Đăng ký",
      },
      {
        title: "Mở một cuộc trò chuyện",
        description: "Chọn bạn bè hoặc tạo phòng mới sau khi đăng nhập.",
        href: "/app",
        action: "Mở Nối",
      },
      {
        title: "Xử lý sự cố đăng nhập",
        description: "Kiểm tra thông tin, phiên đăng nhập và thử lại an toàn.",
        href: "/login",
        action: "Đăng nhập",
      },
    ],
    quickStartButton: "Mở Nối",
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
      {
        question: "Tôi có thể tìm tin nhắn trong một phòng không?",
        answer:
          "Mở phòng cần tìm, chọn biểu tượng tìm kiếm ở phần đầu cuộc trò chuyện, nhập từ khóa rồi chọn kết quả để quay về đúng tin nhắn.",
      },
      {
        question: "Làm sao kiểm soát thông báo?",
        answer:
          "Mở Cài đặt để chọn ngôn ngữ, giao diện và cách nhận thông báo. Các thay đổi chỉ áp dụng sau khi bạn lưu.",
      },
      {
        question: "Tôi cần báo cáo nội dung hoặc người dùng ở đâu?",
        answer:
          "Mở menu hành động ngay tại tin nhắn hoặc hồ sơ cần báo cáo, chọn Báo cáo và gửi thông tin cần thiết để đội ngũ xử lý.",
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
    overviewTitle: "Bạn luôn biết dữ liệu đi đâu",
    overview:
      "Nối chỉ xử lý dữ liệu cần cho tài khoản, cuộc trò chuyện và các tính năng bạn chủ động sử dụng. Phần dưới đây giải thích theo vòng đời dễ kiểm tra.",
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
    lifecycle: [
      {
        title: "Khi bạn tạo tài khoản",
        description:
          "Nối lưu thông tin hồ sơ và thông tin xác thực cần thiết để tạo, bảo vệ và mở lại tài khoản.",
      },
      {
        title: "Khi bạn trò chuyện",
        description:
          "Tin nhắn, tệp và trạng thái được dùng để hiển thị đúng phòng, đúng người và đồng bộ theo thời gian thực.",
      },
      {
        title: "Khi bạn thay đổi cài đặt",
        description:
          "Lựa chọn giao diện, ngôn ngữ và thông báo được áp dụng cho trải nghiệm của bạn và có thể chỉnh lại trong Cài đặt.",
      },
    ],
    controlsTitle: "Bạn có thể kiểm soát",
    controls: [
      "Xem và cập nhật thông tin hồ sơ trong Cài đặt.",
      "Đổi ngôn ngữ và giao diện theo thiết bị của bạn.",
      "Đăng xuất để kết thúc phiên trên thiết bị hiện tại.",
    ],
    actions: {
      support: "Mở trợ giúp",
      settings: "Mở Cài đặt",
    },
  },

  terms: {
    title: "Điều khoản sử dụng",
    description:
      "Khi sử dụng nền tảng Nối, bạn đồng ý các điều khoản dưới đây. Các quy định có thể cập nhật theo yêu cầu bảo mật, vận hành dịch vụ và điều kiện pháp lý.",
    summaryTitle: "Tóm tắt trước khi bắt đầu",
    summary: [
      "Dùng tài khoản của bạn và giữ thông tin đăng nhập an toàn.",
      "Tôn trọng người khác và chỉ chia sẻ nội dung bạn có quyền chia sẻ.",
      "Bạn có thể quản lý hồ sơ, phiên đăng nhập và cài đặt trong ứng dụng.",
      "Nếu gặp vấn đề, hãy báo cáo ngay trong ngữ cảnh tin nhắn hoặc hồ sơ.",
    ],
    items: [
      {
        title: "1. Quyền dùng",
        body: "Bạn được phép sử dụng Nối để trao đổi thông tin cá nhân, công việc và cộng tác nhóm trong phạm vi hợp lệ theo luật hiện hành.",
      },
      {
        title: "2. Tài khoản",
        body: "Thông tin tài khoản phải phản ánh đúng người dùng. Không chia sẻ mật khẩu cho người khác và giữ bí mật toàn bộ yếu tố bảo mật.",
      },
      {
        title: "3. Nội dung",
        body: "Không phát tán nội dung vi phạm pháp luật, quấy rối người khác hoặc có mục đích gây hại trong khu vực chat.",
      },
      {
        title: "4. Hạn chế trách nhiệm",
        body: "Nối hỗ trợ giao tiếp realtime và công cụ cộng tác; dữ liệu người dùng chấp nhận rủi ro kỹ thuật theo điều kiện vận hành thông thường và được xử lý minh bạch theo Chính sách.",
      },
      {
        title: "5. Báo cáo và xử lý vi phạm",
        body: "Bạn có thể báo cáo nội dung hoặc tài khoản ngay trong ứng dụng. Nối có thể giới hạn hoặc tạm ngưng quyền truy cập khi cần để bảo vệ người dùng và vận hành dịch vụ.",
      },
    ],
    buttonHome: "Về trang chủ",
  },

  profile: {
    loading: "Đang tải thông tin...",
    quickLinksTitle: "Truy cập nhanh",
    quickLinkItems: {
      app: "Chat",
      friends: "Bạn bè",
    },
  },

  settings: {
    closeButton: "Đóng cài đặt",
    profileTitle: "Tài khoản",
    profileDescription: "Cập nhật tên hiển thị và ảnh đại diện.",
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
    markAll: "Đánh dấu đã đọc tất cả",
    empty: "Không có thông báo nào.",
  },
} as const;

export const UI_COPY = localizedCopy(rawUICopy);
