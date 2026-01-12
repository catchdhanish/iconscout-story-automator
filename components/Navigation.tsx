// components/Navigation.tsx
'use client';

import Link from 'next/link';

export default function Navigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-bg-secondary/80 backdrop-blur-xl border-b border-border-primary">
      <div className="max-w-[1920px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">IS</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-fg-primary group-hover:text-brand-500 transition-colors">
              Story Automator
            </span>
          </Link>

          {/* Main Nav */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink href="/" active>Dashboard</NavLink>
            <NavLink href="/upload">Upload</NavLink>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Upload Button */}
          <Link
            href="/upload"
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Upload</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
        active
          ? 'bg-bg-tertiary text-fg-primary'
          : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-tertiary/50'
      }`}
    >
      {children}
    </Link>
  );
}
