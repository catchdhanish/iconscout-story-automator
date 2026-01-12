// components/FilterBar.tsx
'use client';

import { useState } from 'react';

interface FilterBarProps {
  onSearch: (query: string) => void;
  onStatusFilter: (status: string) => void;
  onSort?: (sortBy: string) => void;
  selectedCount?: number;
  onBulkAction?: (action: string) => void;
}

export default function FilterBar({
  onSearch,
  onStatusFilter,
  onSort,
  selectedCount = 0,
  onBulkAction,
}: FilterBarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-4">
      {/* Main Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              onSearch(e.target.value);
            }}
            placeholder="Search by description..."
            className="w-full h-11 pl-11 pr-4 bg-bg-secondary border border-border-primary rounded-lg text-sm text-fg-primary placeholder:text-fg-tertiary focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Status Filter */}
        <select
          onChange={(e) => onStatusFilter(e.target.value)}
          className="h-11 px-4 bg-bg-secondary border border-border-primary rounded-lg text-sm text-fg-primary focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="ready">Ready</option>
          <option value="scheduled">Scheduled</option>
          <option value="published">Published</option>
          <option value="failed">Failed</option>
          <option value="archived">Archived</option>
        </select>

        {/* Sort Control */}
        {onSort && (
          <select
            onChange={(e) => onSort(e.target.value)}
            className="h-11 px-4 bg-bg-secondary border border-border-primary rounded-lg text-sm text-fg-primary focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all cursor-pointer"
          >
            <option value="date-desc">Date (Newest First)</option>
            <option value="date-asc">Date (Oldest First)</option>
            <option value="status">Status</option>
            <option value="created">Recently Created</option>
          </select>
        )}
      </div>

      {/* Bulk Actions Bar (slides up when items selected) */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="bg-bg-secondary border border-border-secondary rounded-xl shadow-xl backdrop-blur-xl px-6 py-4 flex items-center gap-6">
            <span className="text-sm font-medium text-fg-primary">
              {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
            </span>
            <div className="w-px h-6 bg-border-primary" />
            <div className="flex gap-2">
              <button
                onClick={() => onBulkAction?.('approve')}
                className="px-4 py-2 bg-status-ready-bg hover:bg-status-ready-border/20 text-status-ready-fg border border-status-ready-border text-sm font-medium rounded-lg transition-colors"
              >
                Approve Selected
              </button>
              <button
                onClick={() => onBulkAction?.('schedule')}
                className="px-4 py-2 bg-status-scheduled-bg hover:bg-status-scheduled-border/20 text-status-scheduled-fg border border-status-scheduled-border text-sm font-medium rounded-lg transition-colors"
              >
                Schedule
              </button>
              <button
                onClick={() => onBulkAction?.('delete')}
                className="px-4 py-2 bg-status-failed-bg hover:bg-status-failed-border/20 text-status-failed-fg border border-status-failed-border text-sm font-medium rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
