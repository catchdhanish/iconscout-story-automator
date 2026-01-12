'use client';

import { useState } from 'react';
import { AssetMetadata } from '@/lib/types';
import Modal from './Modal';
import Button from './Button';
import toast from 'react-hot-toast';

interface ErrorDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetMetadata | null;
  onRetry?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export default function ErrorDetailsModal({
  isOpen,
  onClose,
  asset,
  onRetry,
  onDelete,
}: ErrorDetailsModalProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [retrying, setRetrying] = useState(false);

  if (!asset || !asset.error) return null;

  const error = asset.error;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry?.(asset.id);
      toast.success('Retry initiated');
      onClose();
    } catch (err) {
      toast.error('Failed to retry');
      console.error('Retry error:', err);
    } finally {
      setRetrying(false);
    }
  };

  const handleCopyError = () => {
    const errorText = `
Error Report - IconScout Story Automator
========================================

Asset ID: ${asset.id}
Date: ${asset.date}
Status: ${asset.status}

Error Message:
${error.message}

${error.code ? `Error Code: ${error.code}\n` : ''}
${error.timestamp ? `Timestamp: ${new Date(error.timestamp).toLocaleString()}\n` : ''}
${error.stack ? `\nStack Trace:\n${error.stack}` : ''}
${error.details ? `\nAdditional Details:\n${JSON.stringify(error.details, null, 2)}` : ''}
    `.trim();

    navigator.clipboard.writeText(errorText);
    toast.success('Error details copied to clipboard');
  };

  // Determine error category and icon
  const getErrorCategory = () => {
    if (error.code?.startsWith('NETWORK_')) return 'Network Error';
    if (error.code?.startsWith('API_')) return 'API Error';
    if (error.code?.startsWith('VALIDATION_')) return 'Validation Error';
    if (error.code?.startsWith('GENERATION_')) return 'Generation Error';
    return 'System Error';
  };

  const getErrorIcon = () => {
    const category = getErrorCategory();

    if (category === 'Network Error') {
      return (
        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
        </svg>
      );
    }

    if (category === 'API Error') {
      return (
        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      );
    }

    return (
      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Error Details" size="lg">
      <div className="space-y-6">
        {/* Error Icon and Category */}
        <div className="flex items-center gap-4 p-4 bg-status-failed-bg/30 border border-status-failed-border rounded-lg">
          <div className="text-status-failed-fg">
            {getErrorIcon()}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-status-failed-fg mb-1">
              {getErrorCategory()}
            </h3>
            <p className="text-sm text-fg-secondary">
              {error.timestamp && (
                <>Occurred {new Date(error.timestamp).toLocaleString()}</>
              )}
            </p>
          </div>
          {error.code && (
            <div className="px-3 py-1 bg-bg-tertiary border border-border-primary rounded text-xs font-mono text-fg-primary">
              {error.code}
            </div>
          )}
        </div>

        {/* Asset Context */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-fg-tertiary">Affected Asset</h4>
          <div className="flex items-center gap-3 p-3 bg-bg-tertiary rounded-lg">
            {asset.asset_url && (
              <img
                src={asset.asset_url}
                alt="Asset preview"
                className="w-16 h-20 object-cover rounded border border-border-primary"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-fg-primary truncate">
                {asset.meta_description}
              </p>
              <p className="text-xs text-fg-tertiary">
                Date: {new Date(asset.date).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-fg-tertiary">Error Message</h4>
          <div className="p-4 bg-bg-tertiary border border-border-primary rounded-lg">
            <p className="text-sm text-fg-primary leading-relaxed">
              {error.message}
            </p>
          </div>
        </div>

        {/* Technical Details (Collapsible) */}
        {(error.stack || error.details) && (
          <div className="space-y-2">
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="flex items-center gap-2 text-sm font-medium text-fg-secondary hover:text-fg-primary transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showTechnicalDetails ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Technical Details
            </button>

            {showTechnicalDetails && (
              <div className="p-4 bg-bg-primary border border-border-primary rounded-lg overflow-x-auto">
                {error.stack && (
                  <div className="mb-4">
                    <h5 className="text-xs font-medium text-fg-tertiary mb-2">Stack Trace:</h5>
                    <pre className="text-xs text-fg-secondary font-mono whitespace-pre-wrap">
                      {error.stack}
                    </pre>
                  </div>
                )}
                {error.details && (
                  <div>
                    <h5 className="text-xs font-medium text-fg-tertiary mb-2">Additional Details:</h5>
                    <pre className="text-xs text-fg-secondary font-mono whitespace-pre-wrap">
                      {JSON.stringify(error.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Suggested Actions */}
        <div className="p-4 bg-brand-500/10 border border-brand-500/30 rounded-lg">
          <h4 className="text-sm font-semibold text-brand-500 mb-2">Suggested Actions</h4>
          <ul className="space-y-1 text-sm text-fg-secondary">
            {getErrorCategory() === 'Network Error' && (
              <>
                <li>• Check your internet connection</li>
                <li>• Verify that the asset URL is accessible</li>
                <li>• Try again in a few moments</li>
              </>
            )}
            {getErrorCategory() === 'API Error' && (
              <>
                <li>• The AI service may be temporarily unavailable</li>
                <li>• Check if you have sufficient API credits</li>
                <li>• Try again with a different prompt or asset</li>
              </>
            )}
            {getErrorCategory() === 'Validation Error' && (
              <>
                <li>• Review the asset format and size</li>
                <li>• Ensure the description meets requirements</li>
                <li>• Check that the date is valid</li>
              </>
            )}
            {getErrorCategory() === 'Generation Error' && (
              <>
                <li>• The AI may have struggled with this asset</li>
                <li>• Try refining your description</li>
                <li>• Use a different asset or style</li>
              </>
            )}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-border-primary">
          <Button
            variant="secondary"
            onClick={handleCopyError}
            className="flex-1"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy Error
          </Button>

          <Button
            variant="primary"
            onClick={handleRetry}
            disabled={retrying}
            className="flex-1"
          >
            {retrying ? (
              <>
                <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Retrying...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry Operation
              </>
            )}
          </Button>

          <Button
            variant="danger"
            onClick={() => {
              onDelete?.(asset.id);
              onClose();
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
