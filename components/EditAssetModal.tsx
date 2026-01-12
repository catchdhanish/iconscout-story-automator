'use client';

import { useState } from 'react';
import { AssetMetadata } from '@/lib/types';
import Modal from './Modal';
import Button from './Button';
import toast from 'react-hot-toast';

interface EditAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetMetadata | null;
  onRegenerateBackground?: (id: string, refinementPrompt?: string) => Promise<void>;
  onSchedule?: (id: string) => void;
  onDelete?: (id: string) => void;
  onVersionChange?: (id: string, version: number) => void;
}

export default function EditAssetModal({
  isOpen,
  onClose,
  asset,
  onRegenerateBackground,
  onSchedule,
  onDelete,
  onVersionChange,
}: EditAssetModalProps) {
  const [selectedVersion, setSelectedVersion] = useState(asset?.active_version || 1);
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(false);

  if (!asset) return null;

  const currentVersion = asset.versions.find(v => v.version === selectedVersion);
  const previewUrl = currentVersion?.file_path || asset.asset_url;

  const handleRegenerateBackground = async () => {
    if (!refinementPrompt.trim()) {
      toast.error('Please enter a refinement prompt');
      return;
    }

    setRegenerating(true);
    try {
      await onRegenerateBackground?.(asset.id, refinementPrompt);
      toast.success('Background regeneration started');
      setRefinementPrompt('');
    } catch (error) {
      toast.error('Failed to regenerate background');
      console.error('Regenerate error:', error);
    } finally {
      setRegenerating(false);
    }
  };

  const handleVersionChange = (version: number) => {
    setSelectedVersion(version);
    onVersionChange?.(asset.id, version);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = `story-${asset.id}-v${selectedVersion}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Download started');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Asset Details" size="full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        {/* Left Side: Preview */}
        <div className="space-y-4">
          {/* Preview Container */}
          <div className="bg-bg-tertiary rounded-xl p-6 flex items-center justify-center min-h-[600px] relative">
            {/* Story Preview with Safe Zones */}
            <div className="relative" style={{ width: '360px', height: '640px' }}>
              <img
                src={previewUrl}
                alt={asset.meta_description}
                className="w-full h-full object-cover rounded-lg shadow-2xl"
              />

              {/* Safe Zone Overlay */}
              {showSafeZones && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Top Safe Zone (250px at full size = ~44px at preview) */}
                  <div className="absolute top-0 left-0 right-0 h-[44px] bg-red-500/30 border-b-2 border-red-500 flex items-center justify-center">
                    <span className="text-xs font-mono text-white bg-red-500 px-2 py-1 rounded">
                      Top UI Zone (250px)
                    </span>
                  </div>

                  {/* Bottom Safe Zone (180px at full size = ~32px at preview) */}
                  <div className="absolute bottom-0 left-0 right-0 h-[32px] bg-red-500/30 border-t-2 border-red-500 flex items-center justify-center">
                    <span className="text-xs font-mono text-white bg-red-500 px-2 py-1 rounded">
                      Bottom UI Zone (180px)
                    </span>
                  </div>

                  {/* Center Safe Zone for Asset (70% = 252px wide) */}
                  <div
                    className="absolute border-2 border-green-500 bg-green-500/10"
                    style={{
                      top: '51px',
                      left: '54px',
                      width: '252px',
                      height: '538px',
                    }}
                  >
                    <span className="absolute top-2 left-2 text-xs font-mono text-white bg-green-500 px-2 py-1 rounded">
                      Asset Safe Zone (70%)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Safe Zone Toggle */}
            <button
              onClick={() => setShowSafeZones(!showSafeZones)}
              className="absolute top-4 right-4 px-3 py-1.5 bg-bg-secondary hover:bg-bg-secondary/80 border border-border-primary rounded-lg text-xs font-medium text-fg-primary transition-colors"
            >
              {showSafeZones ? 'Hide' : 'Show'} Safe Zones
            </button>
          </div>

          {/* Version History Carousel */}
          {asset.versions.length > 1 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-fg-primary">Version History</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {asset.versions.map((version) => (
                  <button
                    key={version.version}
                    onClick={() => handleVersionChange(version.version)}
                    className={`flex-shrink-0 w-24 h-32 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedVersion === version.version
                        ? 'border-brand-500 ring-2 ring-brand-500/20'
                        : 'border-border-primary hover:border-border-secondary'
                    }`}
                  >
                    <img
                      src={version.file_path}
                      alt={`Version ${version.version}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
              <p className="text-xs text-fg-tertiary">
                Viewing version {selectedVersion} of {asset.versions.length}
                {currentVersion?.created_at && (
                  <> • Created {new Date(currentVersion.created_at).toLocaleString()}</>
                )}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleDownload} className="flex-1">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </Button>
            {asset.status === 'Ready' && (
              <Button variant="primary" onClick={() => onSchedule?.(asset.id)} className="flex-1">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Schedule
              </Button>
            )}
            <Button variant="danger" onClick={() => onDelete?.(asset.id)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </Button>
          </div>
        </div>

        {/* Right Side: Details & Refinement */}
        <div className="space-y-6">
          {/* Metadata */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-fg-tertiary mb-1">Status</h3>
              <StatusBadge status={asset.status} />
            </div>

            <div>
              <h3 className="text-sm font-medium text-fg-tertiary mb-1">Scheduled Date</h3>
              <p className="text-base text-fg-primary">
                {new Date(asset.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-fg-tertiary mb-1">Description</h3>
              <p className="text-sm text-fg-secondary leading-relaxed">{asset.meta_description}</p>
            </div>

            {asset.asset_vision_description && (
              <div>
                <h3 className="text-sm font-medium text-fg-tertiary mb-1">AI Vision Analysis</h3>
                <p className="text-sm text-fg-secondary leading-relaxed bg-bg-tertiary p-3 rounded-lg">
                  {asset.asset_vision_description}
                </p>
              </div>
            )}

            {/* Dominant Colors */}
            {asset.dominant_colors && asset.dominant_colors.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-fg-tertiary mb-2">Dominant Colors</h3>
                <div className="flex gap-2 flex-wrap">
                  {asset.dominant_colors.map((color, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary rounded-lg border border-border-primary"
                    >
                      <div
                        className="w-6 h-6 rounded-full border-2 border-white/20 shadow"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs font-mono text-fg-secondary">{color}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Current Prompt (if available) */}
            {currentVersion?.prompt_used && (
              <div>
                <h3 className="text-sm font-medium text-fg-tertiary mb-1">Generation Prompt</h3>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(currentVersion.prompt_used);
                    toast.success('Prompt copied to clipboard');
                  }}
                  className="w-full text-left text-xs text-fg-secondary bg-bg-tertiary p-3 rounded-lg hover:bg-bg-tertiary/70 transition-colors border border-border-primary"
                >
                  {currentVersion.prompt_used}
                  <div className="mt-2 text-xs text-fg-tertiary">Click to copy</div>
                </button>
              </div>
            )}
          </div>

          {/* Refinement Section */}
          <div className="pt-6 border-t border-border-primary space-y-4">
            <div>
              <h3 className="text-base font-semibold text-fg-primary mb-1">Refine Background</h3>
              <p className="text-sm text-fg-secondary">
                Describe how you'd like to improve the background. The AI will regenerate it based on your feedback.
              </p>
            </div>

            <div>
              <label htmlFor="refinementPrompt" className="block text-sm font-medium text-fg-primary mb-2">
                Refinement Instructions
              </label>
              <textarea
                id="refinementPrompt"
                value={refinementPrompt}
                onChange={(e) => setRefinementPrompt(e.target.value)}
                placeholder="E.g., 'Make the background more vibrant', 'Add more geometric patterns', 'Use cooler colors'..."
                rows={4}
                disabled={regenerating}
                className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-sm text-fg-primary placeholder:text-fg-tertiary focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all resize-none disabled:opacity-50"
              />
              <p className="text-xs text-fg-tertiary mt-2">
                The original asset and colors will be preserved. Only the background will be regenerated.
              </p>
            </div>

            <Button
              variant="primary"
              onClick={handleRegenerateBackground}
              disabled={regenerating || !refinementPrompt.trim()}
              className="w-full"
            >
              {regenerating ? (
                <>
                  <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Regenerating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate Background
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
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
    <div className={`inline-flex px-3 py-1.5 ${config.bg} ${config.fg} border ${config.border} rounded-lg text-sm font-medium`}>
      {status}
    </div>
  );
}
