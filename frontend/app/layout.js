import './globals.css';
import { Toaster } from '@/components/ui/sonner';

export const metadata = {
  title: 'TRADING LITE — Online Trading Platform',
  description: 'Trade 400+ assets with low minimums. Real-time forex, gold and OTC markets. Demo & Live accounts.',
  applicationName: 'Trading Lite',
  keywords: ['trading', 'forex', 'binary options', 'gold', 'OTC', 'XAU/USD', 'online trading'],
  authors: [{ name: 'Trading Lite' }],
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'TRADING LITE — Online Trading Platform',
    description: 'Trade 400+ assets with low minimums. Real-time forex & gold markets.',
    siteName: 'Trading Lite',
    type: 'website',
    images: [{ url: '/icon.svg', width: 512, height: 512, alt: 'Trading Lite' }],
  },
  twitter: {
    card: 'summary',
    title: 'TRADING LITE — Online Trading Platform',
    description: 'Trade 400+ assets with low minimums. Real-time forex & gold markets.',
    images: ['/icon.svg'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0c1015',
};

const App = ({ children }) => {
  return (
    <html lang="en" className="dark">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-[#0c1015] text-foreground antialiased min-h-screen overscroll-none">
        {children}
        <Toaster richColors position="top-right" theme="dark" />
      </body>
    </html>
  );
};

export default App;
