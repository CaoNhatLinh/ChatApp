import { MemberItem } from "./MemberItem";

// Đảm bảo bạn có type Member như sau (hoặc import từ nơi khác):
type Member = {
  id: string;
  name: string;
  status: "online" | "offline";
  activity: string;
};

const members: Member[] = [
  {
    id: "1",
    name: "KamLing",
    status: "online",
    activity: "Đang chơi Visual Studio Code",
  },
  {
    id: "2",
    name: "Kotoba",
    status: "online",
    activity: "@me for help!",
  },
  {
    id: "3",
    name: "Message Scheduler",
    status: "online",
    activity: "Xem @mentions",
  },
  {
    id: "4",
    name: "Mimu",
    status: "online",
    activity: "/help discord.gg/mimu",
  },
  {
    id: "5",
    name: "omachi babi",
    status: "offline",
    activity: "💗 사랑해",
  },
];

export const MemberListSidebar = () => {
  const onlineMembers = members.filter((m) => m.status === "online");
  const offlineMembers = members.filter((m) => m.status === "offline");

  return (
    <div className="w-72 bg-gray-900 border-l border-gray-800 text-white h-full flex flex-col">
      {/* Search bar */}

      {/* Online section */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="text-xs uppercase text-gray-400 px-2 py-1">
          Trực tuyến — {onlineMembers.length}
        </div>
        {onlineMembers.map((m) => (
          <MemberItem key={m.id} member={m} />
        ))}

        <div className="text-xs uppercase text-gray-400 px-2 pt-4 pb-1">
          Ngoại tuyến — {offlineMembers.length}
        </div>
        {offlineMembers.map((m) => (
          <MemberItem key={m.id} member={m} />
        ))}
      </div>
    </div>
  );
};
