interface ProfileInfoGridProps {
  userId: string;
  userName: string;
}

export const ProfileInfoGrid = ({
  userId,
  userName,
}: ProfileInfoGridProps) => {
  return (
    <section className="surface p-6 border border-border/65">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Thông tin tài khoản</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 p-4">
          <p className="text-xs text-muted-foreground mb-1">Mã người dùng</p>
          <p className="font-medium break-all">{userId}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <p className="text-xs text-muted-foreground mb-1">Tên đăng nhập</p>
          <p className="font-medium">{userName}</p>
        </div>
      </div>
    </section>
  );
};

export default ProfileInfoGrid;
