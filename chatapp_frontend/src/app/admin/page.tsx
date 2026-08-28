import AdminEntry from './AdminEntry';

export const metadata = {
  title: 'NovaChat | Quản trị toàn ứng dụng',
  description: 'Bảng điều hành toàn ứng dụng với quyền máy chủ và audit rõ ràng.',
};

export default function AdminRoute() {
  return <AdminEntry />;
}
