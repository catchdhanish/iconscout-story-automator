import React, { useEffect, useRef } from 'react';
import { BULK_APPROVAL_LIMIT } from '@/lib/config';

interface BulkActionToolbarProps {
  selectedCount: number;
  onApprove: () => void;
  onCancel: () => void;
  isApproving: boolean;
}

export default function BulkActionToolbar({
  selectedCount,
  onApprove,
  onCancel,
  isApproving,
}: BulkActionToolbarProps) {
  const approveButtonRef = useRef<HTMLButtonElement>(null);
  const isOverLimit = selectedCount > BULK_APPROVAL_LIMIT;
  const assetText = selectedCount === 1 ? 'asset' : 'assets';

  // Focus approve button when toolbar appears
  useEffect(() => {
    if (!isApproving && selectedCount > 0) {
      approveButtonRef.current?.focus();
    }
  }, [selectedCount, isApproving]);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50" role="region" aria-label="Bulk actions">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {isApproving ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                <p className="text-sm font-medium text-gray-900">
                  Approving {selectedCount} {assetText}...
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-900">
                  {selectedCount} {assetText} selected
                </p>
                {isOverLimit && (
                  <p className="text-sm text-red-600">
                    Cannot approve more than {BULK_APPROVAL_LIMIT} assets at once
                  </p>
                )}
              </>
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
              ref={approveButtonRef}
              onClick={onApprove}
              disabled={isOverLimit || isApproving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`Approve ${selectedCount} selected assets`}
              aria-disabled={isOverLimit || isApproving}
            >
              {isApproving ? 'Approving...' : 'Approve'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
