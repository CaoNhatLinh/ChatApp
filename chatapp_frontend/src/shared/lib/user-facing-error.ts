import axios from 'axios';
import { localizeText } from '@/shared/i18n';

/**
 * Converts transport failures into stable product copy.
 *
 * Server payloads and native exception messages are intentionally not exposed
 * to users: they can contain implementation details, identifiers, or English
 * text that is not covered by the app locale.
 */
export const getUserFacingErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401) return localizeText('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    if (status === 403) return localizeText('Bạn không có quyền thực hiện thao tác này.');
    if (status === 404) return localizeText('Dữ liệu không còn tồn tại hoặc đã bị xóa.');
    if (status === 409) return localizeText('Thao tác bị xung đột. Tải lại rồi thử lại.');
    if (status === 429) return localizeText('Bạn thao tác quá nhanh. Hãy đợi rồi thử lại.');
    if (!error.response) return localizeText('Không thể kết nối đến máy chủ. Kiểm tra kết nối và thử lại.');
  }

  return localizeText(fallback);
};
