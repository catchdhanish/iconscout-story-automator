// components/Modal.tsx
'use client';

import { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export default function Modal({ isOpen, onClose, title, children, size = 'lg' }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[95vw]',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full ${sizeClasses[size]} bg-bg-secondary border border-border-primary rounded-2xl shadow-2xl max-h-[90vh] flex flex-col animate-scale-in`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border-primary">
          <h2 className="text-xl font-bold text-fg-primary">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-bg-tertiary hover:bg-bg-tertiary/70 rounded-lg flex items-center justify-center transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5 text-fg-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}
