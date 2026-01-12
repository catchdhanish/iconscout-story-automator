import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'IconScout Story Automator',
  description: 'Internal dashboard for automating Instagram Stories - AI-powered background generation and scheduling',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Navigation />
        <main>{children}</main>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#141414',
              color: '#fafafa',
              border: '1px solid #262626',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fafafa',
              },
            },
            error: {
              iconTheme: {
                primary: '#f43f5e',
                secondary: '#fafafa',
              },
            },
          }}
        />
      </body>
    </html>
  )
}
