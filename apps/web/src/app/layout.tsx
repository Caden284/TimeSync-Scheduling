import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/context/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { ConfirmHost } from '@/components/ui/confirm-dialog';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'TimeSync Scheduling',
  description: 'AI workforce scheduling',
  // Browser and home-screen icons come from app/icon.svg, app/favicon.ico,
  // and app/apple-icon.png (Next.js file conventions).
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-gray-50 text-gray-900">
        <AuthProvider>
          {children}
          <Toaster />
          <ConfirmHost />
        </AuthProvider>
      </body>
    </html>
  );
}
