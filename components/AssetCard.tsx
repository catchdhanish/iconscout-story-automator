'use client';

import { AssetMetadata } from '@/lib/types';
import { format } from 'date-fns';
import Image from 'next/image';
import { useState } from 'react';

interface AssetCardProps {
  asset: AssetMetadata;
  onGenerateBackground: (id: string) => void;
  onSchedule: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onViewError?: (id: string) => void;
  onViewPrompt?: (id: string) => void;
  loading?: boolean;
  // Selection props
  isSelectable?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
}

export function AssetCard({
  asset,
  onGenerateBackground,
  onSchedule,
  onEdit,
  onDelete,
  onViewError,
  onViewPrompt,
  loading = false,
  isSelectable = false,
  isSelected = false,
  onToggleSelection,
}: AssetCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Get the active version or the asset URL for the thumbnail
  const activeVersion = asset.versions.find(v => v.version === asset.active_version);
  const thumbnailUrl = activeVersion?.file_path || asset.asset_url;

  return (
    <div
      className="group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Checkbox for Draft assets */}
      {isSelectable && asset.status === 'Draft' && (
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelection?.(asset.id);
            }}
            className="w-5 h-5 rounded border-2 border-gray-300 bg-gray-700 checked:bg-blue-500 cursor-pointer focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-800"
            aria-label={`Select ${asset.meta_description}`}
          />
        </div>
      )}

      {/* Card Container */}
      <div className={`relative bg-bg-secondary border border-border-primary rounded-xl overflow-hidden transition-all duration-300 hover:border-border-secondary hover:shadow-lg ${
        isSelected ? 'ring-2 ring-blue-500 bg-blue-900/20' : ''
      }`}>
        {/* Story Preview (9:16 aspect ratio) */}
        <div className="relative aspect-[9/16] bg-gradient-to-br from-bg-tertiary to-bg-secondary overflow-hidden">
          <img
            src={thumbnailUrl}
            alt={asset.meta_description}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <div className="text-white text-sm animate-pulse">Processing...</div>
            </div>
          )}

          {/* Gradient Overlay on Hover */}
          <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`} />

          {/* Status Badge */}
          <div className="absolute top-3 right-3">
            <StatusBadge status={asset.status} />
          </div>

          {/* Color Palette Preview (if available) */}
          {asset.dominant_colors && asset.dominant_colors.length > 0 && (
            <div className="absolute bottom-3 left-3 flex gap-1.5">
              {asset.dominant_colors.slice(0, 4).map((color, idx) => (
                <div
                  key={idx}
                  className="w-6 h-6 rounded-full border-2 border-white/20 shadow-lg"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          )}

          {/* Quick Actions Overlay */}
          <div className={`absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            <ActionButton icon="eye" label="Preview" onClick={() => onEdit(asset.id)} />
            <ActionButton icon="edit" label="Edit" onClick={() => onEdit(asset.id)} />
            {/* Show prompt button if asset has generated background */}
            {asset.versions.length > 0 && asset.versions[0].prompt_used && onViewPrompt && (
              <ActionButton icon="code" label="View Prompt" onClick={() => onViewPrompt(asset.id)} />
            )}
          </div>
        </div>

        {/* Card Footer */}
        <div className="p-4 space-y-3">
          {/* Date */}
          <div className="flex items-center gap-2 text-xs text-fg-tertiary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{format(new Date(asset.date), 'MMM dd, yyyy')}</span>
          </div>

          {/* Description */}
          <p className="text-sm text-fg-secondary line-clamp-2 leading-relaxed">
            {asset.meta_description}
          </p>

          {/* Action Buttons (status-based) */}
          <div className="pt-2 flex gap-2">
            {asset.status === 'Draft' && (
              <button
                onClick={() => onGenerateBackground(asset.id)}
                disabled={loading}
                className="flex-1 px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate Background
              </button>
            )}
            {asset.status === 'Ready' && (
              <>
                <button
                  onClick={() => onSchedule(asset.id)}
                  disabled={loading}
                  className="flex-1 px-3 py-2 bg-status-scheduled-bg hover:bg-status-scheduled-border/20 text-status-scheduled-fg border border-status-scheduled-border text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  Schedule
                </button>
                <button
                  onClick={() => onEdit(asset.id)}
                  disabled={loading}
                  className="px-3 py-2 bg-bg-tertiary hover:bg-bg-tertiary/70 text-fg-secondary text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  Edit
                </button>
              </>
            )}
            {(asset.status === 'Scheduled' || asset.status === 'Published') && (
              <button
                onClick={() => onEdit(asset.id)}
                disabled={loading}
                className="flex-1 px-3 py-2 bg-bg-tertiary hover:bg-bg-tertiary/70 text-fg-secondary text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                View Details
              </button>
            )}
            {asset.status === 'Failed' && (
              <>
                {asset.error && onViewError && (
                  <button
                    onClick={() => onViewError(asset.id)}
                    disabled={loading}
                    className="flex-1 px-3 py-2 bg-bg-tertiary hover:bg-bg-tertiary/70 text-fg-primary text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    View Error
                  </button>
                )}
                <button
                  onClick={() => onGenerateBackground(asset.id)}
                  disabled={loading}
                  className="flex-1 px-3 py-2 bg-status-failed-bg hover:bg-status-failed-border/20 text-status-failed-fg border border-status-failed-border text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  Retry
                </button>
              </>
            )}
          </div>

          {/* Error Display */}
          {asset.error && (
            <div className="mt-2 p-2 bg-status-failed-bg border border-status-failed-border rounded-lg text-xs text-status-failed-fg">
              <strong>Error:</strong> {asset.error.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    Draft: { bg: 'bg-status-draft-bg', fg: 'text-status-draft-fg', border: 'border-status-draft-border' },
    Ready: { bg: 'bg-status-ready-bg', fg: 'text-status-ready-fg', border: 'border-status-ready-border' },
    Scheduled: { bg: 'bg-status-scheduled-bg', fg: 'text-status-scheduled-fg', border: 'border-status-scheduled-border' },
    Published: { bg: 'bg-status-published-bg', fg: 'text-status-published-fg', border: 'border-status-published-border' },
    Failed: { bg: 'bg-status-failed-bg', fg: 'text-status-failed-fg', border: 'border-status-failed-border' },
    Archived: { bg: 'bg-status-archived-bg', fg: 'text-status-archived-fg', border: 'border-status-archived-border' },
  }[status] || { bg: 'bg-status-draft-bg', fg: 'text-status-draft-fg', border: 'border-status-draft-border' };

  return (
    <div className={`px-2.5 py-1 ${config.bg} ${config.fg} border ${config.border} rounded-md backdrop-blur-sm text-xs font-medium`}>
      {status}
    </div>
  );
}

function ActionButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  const icons = {
    eye: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    edit: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    code: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  };

  return (
    <button
      onClick={onClick}
      className="w-12 h-12 bg-bg-secondary/90 backdrop-blur-md hover:bg-brand-500 text-fg-primary hover:text-white rounded-lg transition-all flex items-center justify-center shadow-lg"
      aria-label={label}
    >
      {icons[icon as keyof typeof icons]}
    </button>
  );
}
