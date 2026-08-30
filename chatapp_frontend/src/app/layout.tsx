import '../index.css';
import type { Metadata } from 'next';
import { AppI18nProvider } from '@/shared/i18n';

export const metadata: Metadata = {
  title: {
    default: 'Nối',
    template: '%s | Nối',
  },
  description: 'Private, readable conversations with the context that matters.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body><AppI18nProvider>{children}</AppI18nProvider></body>
    </html>
  );
}
