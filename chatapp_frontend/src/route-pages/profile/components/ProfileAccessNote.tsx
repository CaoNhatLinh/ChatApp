import { CircleUserRound } from "lucide-react";
import { localizeText } from "@/shared/i18n";

export const ProfileAccessNote = () => {
  return (
    <section className="py-6 md:pl-8">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CircleUserRound size={16} />
        {localizeText("Avatar, tên hiển thị và trạng thái có thể chỉnh sửa trong phần cài đặt.")}
      </p>
    </section>
  );
};

export default ProfileAccessNote;
