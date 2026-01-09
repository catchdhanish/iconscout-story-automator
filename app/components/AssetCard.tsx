'use client';

import Image from 'next/image';
import { AssetMetadata } from '@/lib/types';

interface AssetCardProps {
  asset: AssetMetadata;
  onGenerateBackground?: (assetId: string) => void;
  onSchedule?: (assetId: string) => void;
  onEdit?: (assetId: string) => void;
  onDelete?: (assetId: string) => void;
}

interface StatusBadgeProps {
  status: AssetMetadata['status'];
}

function StatusBadge({ status }: StatusBadgeProps) {
  const statusColors = {
    Draft: 'bg-gray-200 text-gray-800',
    Ready: 'bg-blue-200 text-blue-800',
    Scheduled: 'bg-yellow-200 text-yellow-800',
    Published: 'bg-green-200 text-green-800',
    Failed: 'bg-red-200 text-red-800',
    Archived: 'bg-gray-300 text-gray-600',
  };

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColors[status]}`}>
      {status}
    </span>
  );
}

export default function AssetCard({
  asset,
  onGenerateBackground,
  onSchedule,
  onEdit,
  onDelete,
}: AssetCardProps) {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const handleGenerateBackground = () => {
    if (onGenerateBackground) {
      onGenerateBackground(asset.id);
    }
  };

  const handleSchedule = () => {
    if (onSchedule) {
      onSchedule(asset.id);
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(asset.id);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(asset.id);
    }
  };

  const handleViewDetails = () => {
    // View details for Scheduled/Published assets
    console.log('View details for asset:', asset.id);
  };

  const handleRetry = () => {
    // Retry for Failed assets
    if (onGenerateBackground) {
      onGenerateBackground(asset.id);
    }
  };

  const handleViewError = () => {
    // View error details for Failed assets
    if (asset.error) {
      alert(`Error: ${asset.error.message}\n\nDetails: ${asset.error.details}`);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full">
      {/* Thumbnail */}
      <div className="thumbnail relative w-full aspect-square bg-gray-100">
        {asset.asset_url ? (
          <Image
            src={asset.asset_url}
            alt={asset.meta_description}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg
              className="w-16 h-16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="content p-4 flex-1 flex flex-col">
        <div className="mb-2">
          <StatusBadge status={asset.status} />
        </div>

        <p className="description text-sm text-gray-700 mb-2 flex-1">
          {truncateText(asset.meta_description)}
        </p>

        <p className="date text-xs text-gray-500">
          {formatDate(asset.date)}
        </p>
      </div>

      {/* Actions */}
      <div className="actions p-4 pt-0 flex flex-wrap gap-2">
        {asset.status === 'Draft' && (
          <>
            {onGenerateBackground && (
              <button
                onClick={handleGenerateBackground}
                className="px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors flex-1 min-w-[120px]"
              >
                Generate Background
              </button>
            )}
            {onEdit && (
              <button
                onClick={handleEdit}
                className="px-3 py-2 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                className="px-3 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
              >
                Delete
              </button>
            )}
          </>
        )}

        {asset.status === 'Ready' && (
          <>
            {onSchedule && (
              <button
                onClick={handleSchedule}
                className="px-3 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded transition-colors flex-1 min-w-[120px]"
              >
                Schedule
              </button>
            )}
            {onEdit && (
              <button
                onClick={handleEdit}
                className="px-3 py-2 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                className="px-3 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
              >
                Delete
              </button>
            )}
          </>
        )}

        {asset.status === 'Scheduled' && (
          <button
            onClick={handleViewDetails}
            className="px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors flex-1"
          >
            View Details
          </button>
        )}

        {asset.status === 'Published' && (
          <button
            onClick={handleViewDetails}
            className="px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors flex-1"
          >
            View Details
          </button>
        )}

        {asset.status === 'Failed' && (
          <>
            <button
              onClick={handleRetry}
              className="px-3 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors flex-1"
            >
              Retry
            </button>
            <button
              onClick={handleViewError}
              className="px-3 py-2 text-sm bg-yellow-500 hover:bg-yellow-600 text-white rounded transition-colors"
            >
              View Error
            </button>
            {onDelete && (
              <button
                onClick={handleDelete}
                className="px-3 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
              >
                Delete
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
