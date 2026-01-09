import { AssetMetadata } from '@/lib/types';
import { format } from 'date-fns';

interface AssetCardProps {
  asset: AssetMetadata;
  onGenerateBackground: (id: string) => void;
  onSchedule: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

export function AssetCard({
  asset,
  onGenerateBackground,
  onSchedule,
  onEdit,
  onDelete,
  loading = false
}: AssetCardProps) {
  const statusColors = {
    Draft: 'bg-gray-100 text-gray-800',
    Ready: 'bg-blue-100 text-blue-800',
    Scheduled: 'bg-green-100 text-green-800',
    Published: 'bg-purple-100 text-purple-800',
    Failed: 'bg-red-100 text-red-800',
    Archived: 'bg-gray-100 text-gray-500'
  };

  // Get the active version or the asset URL for the thumbnail
  const activeVersion = asset.versions.find(v => v.version === asset.active_version);
  const thumbnailUrl = activeVersion?.file_path || asset.asset_url;

  return (
    <div className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow bg-white">
      {/* Thumbnail */}
      <div className="relative mb-3">
        <img
          src={thumbnailUrl}
          alt={asset.meta_description}
          className="w-full aspect-[9/16] object-cover rounded-md"
        />
        {loading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-md flex items-center justify-center">
            <div className="text-white text-sm">Loading...</div>
          </div>
        )}
      </div>

      {/* Date Badge */}
      <div className="text-sm text-gray-600 mb-2">
        {format(new Date(asset.date), 'MMM dd, yyyy')}
      </div>

      {/* Status Badge */}
      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mb-3 ${statusColors[asset.status]}`}>
        {asset.status}
      </span>

      {/* Meta Description */}
      <p className="text-sm text-gray-700 mb-4 line-clamp-2">
        {asset.meta_description}
      </p>

      {/* Version Info */}
      {asset.versions.length > 0 && (
        <p className="text-xs text-gray-500 mb-3">
          Version {asset.active_version || 1} of {asset.versions.length}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {asset.status === 'Draft' && (
          <button
            onClick={() => onGenerateBackground(asset.id)}
            disabled={loading}
            className="w-full px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Generate Background
          </button>
        )}
        {asset.status === 'Ready' && (
          <button
            onClick={() => onSchedule(asset.id)}
            disabled={loading}
            className="w-full px-3 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Schedule
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(asset.id)}
            disabled={loading}
            className="flex-1 px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(asset.id)}
            disabled={loading}
            className="flex-1 px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Error Display */}
      {asset.error && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <strong>Error:</strong> {asset.error.message}
        </div>
      )}
    </div>
  );
}
