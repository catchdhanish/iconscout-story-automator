import React from 'react';
import { BULK_APPROVAL_LIMIT } from '@/lib/config';

interface BulkActionToolbarProps {
  selectedCount: number;
  onApprove: () => void;
  onCancel: () => void;
  isApproving: boolean;
  progress?: {
    current: number;
    total: number;
  };
}

export default function BulkActionToolbar({
  selectedCount,
  onApprove,
  onCancel,
  isApproving,
  progress,
}: BulkActionToolbarProps) {
  const isOverLimit = selectedCount > BULK_APPROVAL_LIMIT;
  const assetText = selectedCount === 1 ? 'asset' : 'assets';

  // Show progress view when approving
  if (isApproving && progress) {
    const percentage = Math.round((progress.current / progress.total) * 100);

    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">
                Approving {progress.current} of {progress.total} assets...
              </p>
              <span className="text-sm font-semibold text-blue-600">{percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
                role="progressbar"
                aria-valuenow={percentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Approving ${progress.current} of ${progress.total} assets`}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show selection toolbar
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <p className="text-sm font-medium text-gray-900">
              {selectedCount} {assetText} selected
            </p>
            {isOverLimit && (
              <p className="text-sm text-red-600">
                Cannot approve more than {BULK_APPROVAL_LIMIT} assets at once
              </p>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onCancel}
              disabled={isApproving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Cancel selection"
            >
              Cancel
            </button>
            <button
              onClick={onApprove}
              disabled={isOverLimit || isApproving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Approve selected assets"
            >
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
