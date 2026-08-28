import i18next from 'i18next';
import type { AppLocale } from './resources';
import { COPY_TRANSLATIONS } from './resources';

const LOCALE_STORAGE_KEY = 'novachat_locale';
const LOCALE_COOKIE_KEY = 'novachat_locale';

export const i18n = i18next.createInstance();
void i18n.init({
  lng: 'vi',
  fallbackLng: 'vi',
  resources: {
    vi: { translation: {} },
    en: { translation: COPY_TRANSLATIONS },
  },
  interpolation: { escapeValue: false },
  returnNull: false,
});

let currentLocale: AppLocale = 'vi';

export const isLocale = (value: string | null | undefined): value is AppLocale => value === 'vi' || value === 'en';

export const getLocale = (): AppLocale => currentLocale;

export const setRuntimeLocale = (locale: AppLocale) => {
  currentLocale = locale;
  void i18n.changeLanguage(locale);
};

export const getStoredLocale = (): AppLocale => {
  if (typeof window === 'undefined') return 'vi';
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(`${LOCALE_COOKIE_KEY}=`))?.split('=')[1];
  return isLocale(stored) ? stored : isLocale(cookie) ? cookie : 'vi';
};

export const persistLocale = (locale: AppLocale) => {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  document.cookie = `${LOCALE_COOKIE_KEY}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
};

export const localizeText = (value: string): string => {
  if (currentLocale === 'vi') return value;
  const dynamicPatterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/^Kết quả \((\d+)\)$/, (match) => `Results (${match[1]})`],
    [/^Có (\d+) mục phù hợp với: (.*)$/, (match) => `Found ${match[1]} matching items for: ${match[2]}`],
    [/^Upload thiếu (\d+) file\.$/, (match) => `Missing ${match[1]} file(s).`],
    [/^Chỉ chấp nhận thêm (\d+) file cho lượt gửi này\.$/, (match) => `Only ${match[1]} more file(s) can be attached.`],
    [/^File "(.+)" không hợp lệ\.$/, (match) => `File "${match[1]}" is invalid.`],
    [/^File "(.+)" vượt quá 10MB\.$/, (match) => `File "${match[1]}" exceeds 10 MB.`],
    [/^File "(.+)" không đúng định dạng này\.$/, (match) => `File "${match[1]}" has an unsupported format.`],
    [/^Đã xem lúc (.+)$/, (match) => `Seen at ${match[1]}`],
    [/^Đang áp dụng cho: (.+)$/, (match) => `Applied to: ${match[1]}`],
    [/^Thu hồi session (.+) của (.+)\?$/, (match) => `Revoke session ${match[1]} for ${match[2]}?`],
    [/^Thu hồi thiết bị (.+)\?$/, (match) => `Revoke device ${match[1]}?`],
    [/^Đã cấp role (.+) cho (.+)\.$/, (match) => `Granted role ${match[1]} to ${match[2]}.`],
    [/^Thu hồi role (.+) của (.+)\?$/, (match) => `Revoke role ${match[1]} from ${match[2]}?`],
    [/^Đã thu hồi role (.+)\.$/, (match) => `Role ${match[1]} revoked.`],
    [/^Đổi trạng thái @(.+) thành (.+)\?$/, (match) => `Change @${match[1]} to ${match[2]}?`],
    [/^Đã cập nhật trạng thái tài khoản thành (.+)\.$/, (match) => `Account status updated to ${match[1]}.`],
    [/^Chuyển report (.+)… thành (.+)\?$/, (match) => `Move report ${match[1]}… to ${match[2]}?`],
    [/^Thu hồi sanction (.+)…\?$/, (match) => `Revoke sanction ${match[1]}…?`],
    [/^(\d+) phút trước$/, (match) => `${match[1]} min ago`],
    [/^(\d+) giờ trước$/, (match) => `${match[1]} hr ago`],
    [/^(\d+) ngày trước$/, (match) => `${match[1]} d ago`],
    [/^(\d+) phiếu$/, (match) => `${match[1]} ${match[1] === '1' ? 'vote' : 'votes'}`],
    [/^(?:khoảng )?(\d+) phút trước$/, (match) => `${match[1]} min ago`],
    [/^(?:khoảng )?(\d+) giờ trước$/, (match) => `${match[1]} hr ago`],
    [/^(?:khoảng )?(\d+) ngày trước$/, (match) => `${match[1]} d ago`],
    [/^Vừa mới$/, () => 'Just now'],
    [/^just now$/, () => 'Just now'],
    [/^offline$/, () => 'Offline'],
    [/^Tin nhắn từ (.+) trong cuộc trò chuyện$/, (match) => `Message from ${match[1]} in conversation`],
    [/^Đã gửi lời mời kết bạn tới (.+)$/, (match) => `Friend request sent to ${match[1]}`],
    [/^Không thể gửi lời mời tới (.+)$/, (match) => `Unable to send a friend request to ${match[1]}`],
    [/^Đã mở cuộc trò chuyện với (.+)$/, (match) => `Conversation opened with ${match[1]}`],
    [/^Không thể mở cuộc trò chuyện với (.+)$/, (match) => `Unable to open a conversation with ${match[1]}`],
    [/^Đã chấp nhận lời mời của (.+)$/, (match) => `Accepted ${match[1]}'s request`],
    [/^Không thể chấp nhận lời mời của (.+)$/, (match) => `Unable to accept ${match[1]}'s request`],
    [/^Đã từ chối lời mời của (.+)$/, (match) => `Declined ${match[1]}'s request`],
    [/^Không thể từ chối lời mời của (.+)$/, (match) => `Unable to decline ${match[1]}'s request`],
  ];
  const dynamic = dynamicPatterns.find(([pattern]) => pattern.test(value));
  if (dynamic) return dynamic[1](value.match(dynamic[0]) as RegExpMatchArray);
  return i18n.t(value, { defaultValue: COPY_TRANSLATIONS[value] ?? value });
};

const localizeValue = <T,>(value: T): T => {
  if (typeof value === 'string') return localizeText(value) as T;
  if (typeof value === 'function') {
    return ((...args: unknown[]) => localizeText(String((value as (...items: unknown[]) => unknown)(...args)))) as T;
  }
  if (Array.isArray(value)) return value.map((item: unknown) => localizeValue(item)) as T;
  if (value && typeof value === 'object') {
    return new Proxy(value as object, {
      get(target, property, receiver) {
        return localizeValue(Reflect.get(target, property, receiver) as unknown);
      },
    }) as T;
  }
  return value;
};

export const localizedCopy = <T,>(value: T): T => localizeValue(value);

export { LOCALE_STORAGE_KEY, LOCALE_COOKIE_KEY };
