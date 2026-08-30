import { Bell, Bookmark, MessageCircle, Menu, PencilLine, Settings, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { CreateRoomModal } from "@/features/messenger/components/Modals/CreateRoomModal";
import { useMessenger } from "@/features/messenger/model/useMessenger";
import { Button } from "@/shared/ui/Button";
import { localizeText } from "@/shared/i18n";

const railButtonClassName = "h-11 w-11 rounded-[var(--radius-md)] text-slate-400 hover:bg-white/8 hover:text-slate-100 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground";

export const WorkspaceNavigationRail = () => {
  const router = useRouter();
  const { activeView, setActiveView, setSidebarOpen } = useMessenger();
  const user = useAuthStore((state) => state.user);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);

  const openChats = () => {
    setActiveView("chat");
    setSidebarOpen(true);
  };

  const openContacts = () => {
    setActiveView("contacts");
    setSidebarOpen(true);
  };

  return (
    <>
      <nav aria-label={localizeText("Điều hướng không gian")} className="hidden h-full w-20 shrink-0 flex-col items-center border-r border-white/10 bg-[#0b141c] py-4 md:flex">
        <div className="flex flex-col items-center gap-3">
          <Button type="button" variant="ghost" size="icon" className={railButtonClassName} aria-label={localizeText("Tạo phòng mới")} title={localizeText("Tạo phòng mới")} onClick={() => setIsCreateRoomOpen(true)}>
            <PencilLine size={20} />
          </Button>
          <Button type="button" variant="ghost" size="icon" className={railButtonClassName} data-active={activeView === "chat"} aria-label={localizeText("Hội thoại")} title={localizeText("Hội thoại")} onClick={openChats}>
            <MessageCircle size={20} />
          </Button>
          <Button type="button" variant="ghost" size="icon" className={railButtonClassName} data-active={activeView === "contacts"} aria-label={localizeText("Bạn bè")} title={localizeText("Bạn bè")} onClick={openContacts}>
            <Users size={20} />
          </Button>
          <Button type="button" variant="ghost" size="icon" className={railButtonClassName} aria-label={localizeText("Thông báo")} title={localizeText("Thông báo")} onClick={() => router.push("/settings?tab=notifications")}>
            <Bell size={20} />
          </Button>
          <Button type="button" variant="ghost" size="icon" className={railButtonClassName} aria-label={localizeText("Tìm kiếm")} title={localizeText("Tìm kiếm")} onClick={() => router.push("/search")}>
            <Bookmark size={20} />
          </Button>
        </div>
        <div className="mt-auto flex flex-col items-center gap-3">
          <Button type="button" variant="ghost" size="icon" className={railButtonClassName} aria-label={localizeText("Cài đặt")} title={localizeText("Cài đặt")} onClick={() => router.push("/settings")}>
            <Settings size={20} />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 overflow-hidden rounded-full border border-white/10 p-0" aria-label={localizeText("Hồ sơ và cài đặt")} title={localizeText("Hồ sơ và cài đặt")} onClick={() => router.push("/settings?tab=profile")}>
            <img src={user?.avatarUrl || "/noi-default-avatar.webp"} alt="" className="h-full w-full object-cover" />
          </Button>
        </div>
      </nav>

      <nav aria-label={localizeText("Điều hướng di động")} className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-white/10 bg-[#0b141c]/95 px-4 backdrop-blur md:hidden">
        <Button type="button" variant="ghost" size="icon" className={railButtonClassName} data-active={activeView === "chat"} aria-label={localizeText("Hội thoại")} onClick={openChats}>
          <MessageCircle size={20} />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={railButtonClassName} data-active={activeView === "contacts"} aria-label={localizeText("Bạn bè")} onClick={openContacts}>
          <Users size={20} />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={railButtonClassName} aria-label={localizeText("Thông báo")} onClick={() => router.push("/settings?tab=notifications")}>
          <Bell size={20} />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={railButtonClassName} aria-label={localizeText("Cài đặt")} onClick={() => router.push("/settings")}>
          <Menu size={20} />
        </Button>
      </nav>

      <CreateRoomModal isOpen={isCreateRoomOpen} onClose={() => setIsCreateRoomOpen(false)} />
    </>
  );
};
