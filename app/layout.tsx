import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'IconScout Story Automator',
  description: 'Internal dashboard for automating Instagram Stories',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
