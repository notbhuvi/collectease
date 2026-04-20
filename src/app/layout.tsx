import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ToastContextProvider } from '@/components/ui/toast'
import { ThemeProvider } from '@/components/theme-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SIRPL – Payment Collection',
  description: 'Invoice reminders and receivables tracking for Samwha India Refractories Pvt. Ltd.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SIRPL',
  },
  icons: {
    icon: '/sirpl-logo.png',
    apple: '/sirpl-logo.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#2563eb',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50 antialiased`}>
        <ThemeProvider>
          <ToastContextProvider>
            {children}
          </ToastContextProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
