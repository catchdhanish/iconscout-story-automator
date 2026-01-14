'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';

interface Shortcut {
  key: string;
  description: string;
  category: 'Navigation' | 'Actions' | 'Selection' | 'General';
}

const shortcuts: Shortcut[] = [
  // General
  { key: '?', description: 'Show this help dialog', category: 'General' },
  { key: 'Esc', description: 'Close modal or dialog', category: 'General' },

  // Navigation
  { key: '←/→', description: 'Navigate between assets', category: 'Navigation' },
  { key: '↑/↓', description: 'Navigate up/down in grid', category: 'Navigation' },
  { key: 'Tab', description: 'Move focus to next element', category: 'Navigation' },
  { key: 'Shift + Tab', description: 'Move focus to previous element', category: 'Navigation' },

  // Actions
  { key: 'Enter', description: 'Open asset details', category: 'Actions' },
  { key: 'G', description: 'Generate background (Draft assets)', category: 'Actions' },
  { key: 'S', description: 'Schedule asset (Ready assets)', category: 'Actions' },
  { key: 'E', description: 'Edit asset', category: 'Actions' },
  { key: 'Del', description: 'Delete selected asset', category: 'Actions' },

  // Selection
  { key: 'Space', description: 'Select/deselect focused asset', category: 'Selection' },
  { key: 'Ctrl/Cmd + A', description: 'Select all visible assets', category: 'Selection' },
  { key: 'Ctrl/Cmd + D', description: 'Deselect all', category: 'Selection' },
];

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  const categories = ['General', 'Navigation', 'Actions', 'Selection'] as const;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts" size="lg">
      <div className="space-y-6">
        <p className="text-fg-secondary">
          Use these keyboard shortcuts to navigate and interact with the dashboard more efficiently.
        </p>

        {categories.map((category) => (
          <div key={category}>
            <h3 className="text-lg font-semibold text-fg-primary mb-3">{category}</h3>
            <div className="space-y-2">
              {shortcuts
                .filter((shortcut) => shortcut.category === category)
                .map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 bg-bg-tertiary rounded-lg hover:bg-bg-tertiary/70 transition-colors"
                  >
                    <span className="text-sm text-fg-secondary">{shortcut.description}</span>
                    <kbd className="px-3 py-1 bg-bg-primary border border-border-primary rounded text-xs font-mono text-fg-primary">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
            </div>
          </div>
        ))}

        <div className="pt-4 border-t border-border-primary">
          <p className="text-xs text-fg-tertiary">
            Press <kbd className="px-2 py-0.5 bg-bg-tertiary border border-border-primary rounded text-xs font-mono">?</kbd> anytime to show this dialog
          </p>
        </div>
      </div>
    </Modal>
  );
}

// Hook for using keyboard shortcuts in components
export function useKeyboardShortcuts(callbacks: {
  onHelp?: () => void;
  onSelect?: () => void;
  onOpen?: () => void;
  onGenerateBackground?: () => void;
  onSchedule?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onNavigateLeft?: () => void;
  onNavigateRight?: () => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape to work even in inputs
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      // Help modal
      if (e.key === '?' && callbacks.onHelp) {
        e.preventDefault();
        callbacks.onHelp();
      }

      // Selection
      if (e.key === ' ' && callbacks.onSelect) {
        e.preventDefault();
        callbacks.onSelect();
      }

      // Select/Deselect all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && callbacks.onSelectAll) {
        e.preventDefault();
        callbacks.onSelectAll();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && callbacks.onDeselectAll) {
        e.preventDefault();
        callbacks.onDeselectAll();
      }

      // Actions
      if (e.key === 'Enter' && callbacks.onOpen) {
        e.preventDefault();
        callbacks.onOpen();
      }

      if (e.key === 'g' && callbacks.onGenerateBackground) {
        e.preventDefault();
        callbacks.onGenerateBackground();
      }

      if (e.key === 's' && callbacks.onSchedule) {
        e.preventDefault();
        callbacks.onSchedule();
      }

      if (e.key === 'e' && callbacks.onEdit) {
        e.preventDefault();
        callbacks.onEdit();
      }

      if (e.key === 'Delete' && callbacks.onDelete) {
        e.preventDefault();
        callbacks.onDelete();
      }

      // Navigation
      if (e.key === 'ArrowLeft' && callbacks.onNavigateLeft) {
        e.preventDefault();
        callbacks.onNavigateLeft();
      }

      if (e.key === 'ArrowRight' && callbacks.onNavigateRight) {
        e.preventDefault();
        callbacks.onNavigateRight();
      }

      if (e.key === 'ArrowUp' && callbacks.onNavigateUp) {
        e.preventDefault();
        callbacks.onNavigateUp();
      }

      if (e.key === 'ArrowDown' && callbacks.onNavigateDown) {
        e.preventDefault();
        callbacks.onNavigateDown();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    callbacks.onHelp,
    callbacks.onSelect,
    callbacks.onOpen,
    callbacks.onGenerateBackground,
    callbacks.onSchedule,
    callbacks.onEdit,
    callbacks.onDelete,
    callbacks.onSelectAll,
    callbacks.onDeselectAll,
    callbacks.onNavigateLeft,
    callbacks.onNavigateRight,
    callbacks.onNavigateUp,
    callbacks.onNavigateDown,
  ]);
}
