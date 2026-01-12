'use client';

import { AssetMetadata } from '@/lib/types';
import Modal from './Modal';
import Button from './Button';
import toast from 'react-hot-toast';

interface PromptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetMetadata | null;
  version?: number;
}

export default function PromptPreviewModal({
  isOpen,
  onClose,
  asset,
  version,
}: PromptPreviewModalProps) {
  if (!asset) return null;

  // Get the version to display (either specified or active version)
  const displayVersion = version || asset.active_version;
  const versionData = asset.versions.find(v => v.version === displayVersion);

  if (!versionData?.prompt_used) {
    return null;
  }

  const prompt = versionData.prompt_used;
  const refinementPrompt = versionData.refinement_prompt;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    toast.success('Prompt copied to clipboard');
  };

  const handleCopyRefinement = () => {
    if (refinementPrompt) {
      navigator.clipboard.writeText(refinementPrompt);
      toast.success('Refinement prompt copied to clipboard');
    }
  };

  const handleCopyAll = () => {
    const fullPrompt = refinementPrompt
      ? `Original Prompt:\n${prompt}\n\nRefinement Prompt:\n${refinementPrompt}`
      : prompt;
    navigator.clipboard.writeText(fullPrompt);
    toast.success('All prompts copied to clipboard');
  };

  // Extract system and user prompts if structured
  const parsePrompt = (promptText: string) => {
    const systemMatch = promptText.match(/System:\s*([\s\S]*?)(?=User:|$)/i);
    const userMatch = promptText.match(/User:\s*([\s\S]*?)$/i);

    return {
      system: systemMatch ? systemMatch[1].trim() : null,
      user: userMatch ? userMatch[1].trim() : null,
      full: !systemMatch && !userMatch ? promptText : null,
    };
  };

  const parsedPrompt = parsePrompt(prompt);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Prompt Preview" size="lg">
      <div className="space-y-6">
        {/* Asset Context */}
        <div className="flex items-center gap-3 p-3 bg-bg-tertiary rounded-lg border border-border-primary">
          {versionData.file_path && (
            <img
              src={versionData.file_path}
              alt={`Version ${displayVersion}`}
              className="w-16 h-20 object-cover rounded border border-border-primary"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-fg-primary truncate">
              {asset.meta_description}
            </p>
            <p className="text-xs text-fg-tertiary">
              Version {displayVersion} • Created {new Date(versionData.created_at).toLocaleString()}
            </p>
          </div>
          <div className="px-3 py-1 bg-brand-500/10 border border-brand-500/30 rounded-lg text-xs font-medium text-brand-500">
            v{displayVersion}
          </div>
        </div>

        {/* Prompt Display */}
        <div className="space-y-4">
          {parsedPrompt.system && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-fg-tertiary">System Prompt</h3>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(parsedPrompt.system!);
                    toast.success('System prompt copied');
                  }}
                  className="text-xs text-brand-500 hover:text-brand-600 transition-colors"
                >
                  Copy
                </button>
              </div>
              <div className="p-4 bg-bg-tertiary border border-border-primary rounded-lg">
                <pre className="text-sm text-fg-secondary font-mono whitespace-pre-wrap leading-relaxed">
                  {parsedPrompt.system}
                </pre>
              </div>
            </div>
          )}

          {parsedPrompt.user && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-fg-tertiary">User Prompt</h3>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(parsedPrompt.user!);
                    toast.success('User prompt copied');
                  }}
                  className="text-xs text-brand-500 hover:text-brand-600 transition-colors"
                >
                  Copy
                </button>
              </div>
              <div className="p-4 bg-bg-tertiary border border-border-primary rounded-lg">
                <pre className="text-sm text-fg-secondary font-mono whitespace-pre-wrap leading-relaxed">
                  {parsedPrompt.user}
                </pre>
              </div>
            </div>
          )}

          {parsedPrompt.full && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-fg-tertiary">Generation Prompt</h3>
                <button
                  onClick={handleCopyPrompt}
                  className="text-xs text-brand-500 hover:text-brand-600 transition-colors"
                >
                  Copy
                </button>
              </div>
              <div className="p-4 bg-bg-tertiary border border-border-primary rounded-lg">
                <pre className="text-sm text-fg-secondary font-mono whitespace-pre-wrap leading-relaxed">
                  {parsedPrompt.full}
                </pre>
              </div>
            </div>
          )}

          {refinementPrompt && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-fg-tertiary">Refinement Prompt</h3>
                <button
                  onClick={handleCopyRefinement}
                  className="text-xs text-brand-500 hover:text-brand-600 transition-colors"
                >
                  Copy
                </button>
              </div>
              <div className="p-4 bg-brand-500/10 border border-brand-500/30 rounded-lg">
                <pre className="text-sm text-brand-500 font-mono whitespace-pre-wrap leading-relaxed">
                  {refinementPrompt}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Metadata */}
        {asset.asset_vision_description && (
          <div className="p-4 bg-bg-tertiary/50 border border-border-primary rounded-lg space-y-2">
            <h4 className="text-xs font-medium text-fg-tertiary uppercase tracking-wide">
              AI Vision Analysis
            </h4>
            <p className="text-sm text-fg-secondary leading-relaxed">
              {asset.asset_vision_description}
            </p>
          </div>
        )}

        {/* Dominant Colors Used */}
        {asset.dominant_colors && asset.dominant_colors.length > 0 && (
          <div className="p-4 bg-bg-tertiary/50 border border-border-primary rounded-lg space-y-3">
            <h4 className="text-xs font-medium text-fg-tertiary uppercase tracking-wide">
              Dominant Colors Used
            </h4>
            <div className="flex gap-2 flex-wrap">
              {asset.dominant_colors.map((color, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    navigator.clipboard.writeText(color);
                    toast.success(`Color ${color} copied`);
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-bg-secondary hover:bg-bg-tertiary border border-border-primary rounded-lg transition-colors"
                  title="Click to copy"
                >
                  <div
                    className="w-6 h-6 rounded-full border-2 border-white/20 shadow"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-mono text-fg-secondary">{color}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-border-primary">
          <Button variant="primary" onClick={handleCopyAll} className="flex-1">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy All
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Tips */}
        <div className="p-3 bg-brand-500/10 border border-brand-500/30 rounded-lg">
          <p className="text-xs text-fg-secondary">
            <strong className="text-brand-500">Tip:</strong> Use these prompts as a reference when
            refining backgrounds. Understanding what works helps you write better refinement
            instructions.
          </p>
        </div>
      </div>
    </Modal>
  );
}
