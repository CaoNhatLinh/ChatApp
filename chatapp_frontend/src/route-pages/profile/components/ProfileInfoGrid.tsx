interface ProfileInfoGridProps {
  userId: string;
  userName: string;
}

export const ProfileInfoGrid = ({
  userId,
  userName,
}: ProfileInfoGridProps) => {
  return (
    <section className="product-surface p-6">
      <p className="page-kicker">Thông tin tài khoản</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Mã người dùng</p>
          <p className="font-medium break-all">{userId}</p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Tên đăng nhập</p>
          <p className="font-medium">{userName}</p>
        </div>
      </div>
    </section>
  );
};

export default ProfileInfoGrid;
