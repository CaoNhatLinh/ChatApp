import { CircleUserRound } from "lucide-react";

export const ProfileAccessNote = () => {
  return (
    <section className="product-surface p-6">
      <p className="page-kicker">
        Vai trò cấu hình
      </p>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <CircleUserRound size={16} />
        Avatar, tên hiển thị và trạng thái có thể chỉnh sửa trong phần cài đặt.
      </p>
    </section>
  );
};

export default ProfileAccessNote;
