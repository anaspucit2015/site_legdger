import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from 'sonner';
import { SerwistProvider } from '@serwist/turbopack/react';
import { InstallPwaButton } from '@/components/install-pwa-button';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'SiteLedger',
  description: 'Construction site invoice management',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SiteLedger',
  },
};

export const viewport: Viewport = {
  themeColor: '#1B3A5C',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${ibmPlexMono.variable} h-full`}
    >
      <body className="h-full antialiased">
        <SerwistProvider
          swUrl="/serwist/sw.js"
          disable={process.env.NODE_ENV === 'development'}
        >
          <Providers>{children}</Providers>
          <InstallPwaButton />
          <Toaster position="top-right" richColors />
        </SerwistProvider>
      </body>
    </html>
  );
}
