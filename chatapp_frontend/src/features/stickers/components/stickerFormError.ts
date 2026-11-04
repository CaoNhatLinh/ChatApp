import { isAxiosError } from 'axios';
import type { StickerCopy } from './StickerArtworkUpload';

export type StickerFormError = 'conflict' | 'invalid' | 'forbidden' | 'missing' | 'uncertain' | 'refresh';

export function classifyStickerFailure(failure: unknown): StickerFormError {
  const status = isAxiosError(failure) ? failure.response?.status : undefined;
  if (status === 409) return 'conflict';
  if (status === 400 || status === 422) return 'invalid';
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 404) return 'missing';
  return 'uncertain';
}

export function stickerErrorCopy(error: StickerFormError, copy: StickerCopy): string {
  switch (error) {
    case 'conflict': return copy('Bộ này đã thay đổi. Tải bản mới trước khi lưu; nội dung bạn nhập vẫn được giữ.', 'This pack changed. Load the latest version before saving; your draft is preserved.');
    case 'invalid': return copy('Chưa lưu được. Kiểm tra tên, lý do, xác nhận sử dụng ảnh và giới hạn ảnh 2 MB / 1024 px.', 'Could not save. Check the name, reason, artwork confirmation and 2 MB / 1024 px image limits.');
    case 'forbidden': return copy('Phiên đăng nhập hoặc quyền quản trị không còn hợp lệ. Kiểm tra tài khoản trước khi thử lại.', 'Your session or admin permission is no longer valid. Check your account before retrying.');
    case 'missing': return copy('Bộ hoặc sticker không còn tồn tại. Tải lại danh sách để kiểm tra.', 'This pack or sticker no longer exists. Reload the catalog to check.');
    case 'refresh': return copy('Thay đổi đã được lưu, nhưng chưa tải được bản mới. Tải lại trước khi sửa tiếp; không cần gửi lại thao tác lưu.', 'Changes were saved, but the latest version could not be loaded. Reload before editing; do not resend the save command.');
    case 'uncertain': return copy('Chưa xác nhận được kết quả lưu. Thử lưu lại cùng thao tác trước khi sửa tiếp.', 'Could not confirm the save. Retry the same command before editing further.');
  }
}
