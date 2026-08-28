import '../index.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NovaChat',
  description: 'Fast, readable conversations and friend connections in one place.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
