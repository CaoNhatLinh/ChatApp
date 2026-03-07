interface Member {
  id: string;
  name: string;
  avatar?: string;
  status: "online" | "offline";
  activity?: string;
  
  
}

export const MemberItem = ({ member }: { member: Member }) => {
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-gray-700 rounded cursor-pointer">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-sm font-bold text-white">
        {member.avatar || member.name.charAt(0)}
      </div>

      {/* Info */}
      <div className="flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          {member.name}
        </div>
        {member.activity && (
          <div className="text-xs text-gray-400 truncate">{member.activity}</div>
        )}
      </div>
    </div>
  );
};
