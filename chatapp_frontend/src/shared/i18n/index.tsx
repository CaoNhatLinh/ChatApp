/* eslint-disable react-refresh/only-export-components -- this is a typed public barrel for split i18n runtime/provider modules. */
export { COPY_TRANSLATIONS } from './resources';
export { AppI18nProvider } from './AppI18nProvider';
export { useAppLocale, useAppTranslation } from './hooks';
export {
  getLocale,
  i18n,
  localizeText,
  localizedCopy,
} from './runtime';
