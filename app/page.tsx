'use client'

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AssetMetadata, Status } from '@/lib/types';
import { useAutoPolling } from '@/hooks/useAutoPolling';
import { AssetCard } from '@/components/AssetCard';
import MetricCard from '@/components/MetricCard';
import FilterBar from '@/components/FilterBar';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/Modal';
import { GallerySkeleton } from '@/components/LoadingSkeleton';
import KeyboardShortcutsHelp, { useKeyboardShortcuts } from '@/components/KeyboardShortcutsHelp';
import EditAssetModal from '@/components/EditAssetModal';
import ErrorDetailsModal from '@/components/ErrorDetailsModal';
import PromptPreviewModal from '@/components/PromptPreviewModal';
import BulkActionToolbar from '@/components/BulkActionToolbar';
import toast from 'react-hot-toast';

// Helper for screen reader announcements
function announceToScreenReader(message: string) {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);
  setTimeout(() => {
    if (announcement.parentNode) {
      document.body.removeChild(announcement);
    }
  }, 1000);
}

export default function Dashboard() {
  // State management
  const [assets, setAssets] = useState<AssetMetadata[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<AssetMetadata[]>([]);
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [loading, setLoading] = useState(true);
  const [loadingAssetIds, setLoadingAssetIds] = useState<Set<string>>(new Set());
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [isApproving, setIsApproving] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [focusedAssetIndex, setFocusedAssetIndex] = useState(-1);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetMetadata | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorAsset, setErrorAsset] = useState<AssetMetadata | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptAsset, setPromptAsset] = useState<AssetMetadata | null>(null);

  // Define asset selection handlers first
  const handleAssetSelect = useCallback((id: string, selected: boolean) => {
    setSelectedAssetIds(prev =>
      selected
        ? [...prev, id]
        : prev.filter(assetId => assetId !== id)
    );
  }, []);

  // Memoize keyboard shortcut callbacks
  const handleHelpCallback = useCallback(() => setShowHelpModal(true), []);

  const handleSelectCallback = useCallback(() => {
    if (focusedAssetIndex >= 0 && focusedAssetIndex < filteredAssets.length) {
      const asset = filteredAssets[focusedAssetIndex];
      handleAssetSelect(asset.id, !selectedAssetIds.includes(asset.id));
    }
  }, [focusedAssetIndex, filteredAssets, selectedAssetIds, handleAssetSelect]);

  const handleOpenCallback = useCallback(() => {
    if (focusedAssetIndex >= 0 && focusedAssetIndex < filteredAssets.length) {
      const asset = filteredAssets[focusedAssetIndex];
      handleEdit(asset.id);
    }
  }, [focusedAssetIndex, filteredAssets]);

  const handleGenerateBackgroundCallback = useCallback(() => {
    if (focusedAssetIndex >= 0 && focusedAssetIndex < filteredAssets.length) {
      const asset = filteredAssets[focusedAssetIndex];
      if (asset.status === 'Draft') {
        handleGenerateBackground(asset.id);
      }
    }
  }, [focusedAssetIndex, filteredAssets]);

  const handleScheduleCallback = useCallback(() => {
    if (focusedAssetIndex >= 0 && focusedAssetIndex < filteredAssets.length) {
      const asset = filteredAssets[focusedAssetIndex];
      if (asset.status === 'Ready') {
        handleSchedule(asset.id);
      }
    }
  }, [focusedAssetIndex, filteredAssets]);

  const handleEditCallback = useCallback(() => {
    if (focusedAssetIndex >= 0 && focusedAssetIndex < filteredAssets.length) {
      const asset = filteredAssets[focusedAssetIndex];
      handleEdit(asset.id);
    }
  }, [focusedAssetIndex, filteredAssets]);

  const handleDeleteCallback = useCallback(() => {
    if (focusedAssetIndex >= 0 && focusedAssetIndex < filteredAssets.length) {
      const asset = filteredAssets[focusedAssetIndex];
      handleDelete(asset.id);
    }
  }, [focusedAssetIndex, filteredAssets]);

  const handleSelectAllCallback = useCallback(() => {
    const draftAssets = filteredAssets.filter(a => a.status === 'Draft');
    const allIds = draftAssets.map(a => a.id);
    setSelectedAssetIds(allIds);
    toast.success(`Selected ${allIds.length} assets`);
  }, [filteredAssets]);

  const handleDeselectAllCallback = useCallback(() => {
    setSelectedAssetIds([]);
    toast.success('Deselected all assets');
  }, []);

  const handleNavigateLeftCallback = useCallback(() => {
    setFocusedAssetIndex(prev => Math.max(0, prev - 1));
  }, []);

  const handleNavigateRightCallback = useCallback(() => {
    setFocusedAssetIndex(prev => Math.min(filteredAssets.length - 1, prev + 1));
  }, [filteredAssets.length]);

  const handleNavigateUpCallback = useCallback(() => {
    const cols = window.innerWidth >= 1280 ? 4 : window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1;
    setFocusedAssetIndex(prev => Math.max(0, prev - cols));
  }, []);

  const handleNavigateDownCallback = useCallback(() => {
    const cols = window.innerWidth >= 1280 ? 4 : window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1;
    setFocusedAssetIndex(prev => Math.min(filteredAssets.length - 1, prev + cols));
  }, [filteredAssets.length]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onHelp: handleHelpCallback,
    onSelect: handleSelectCallback,
    onOpen: handleOpenCallback,
    onGenerateBackground: handleGenerateBackgroundCallback,
    onSchedule: handleScheduleCallback,
    onEdit: handleEditCallback,
    onDelete: handleDeleteCallback,
    onSelectAll: handleSelectAllCallback,
    onDeselectAll: handleDeselectAllCallback,
    onNavigateLeft: handleNavigateLeftCallback,
    onNavigateRight: handleNavigateRightCallback,
    onNavigateUp: handleNavigateUpCallback,
    onNavigateDown: handleNavigateDownCallback,
  });

  // Check if there are assets that need polling (Draft or Scheduled status)
  const hasProcessingAssets = useMemo(() => {
    return assets.some(a => a.status === 'Draft' || a.status === 'Scheduled');
  }, [assets]);

  // Auto-polling for status updates
  useAutoPolling({
    onPoll: async () => {
      setIsPolling(true);
      await fetchAssets();
      setIsPolling(false);
    },
    interval: 5000, // Poll every 5 seconds
    enabled: hasProcessingAssets,
    shouldContinue: () => hasProcessingAssets,
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const scheduledThisMonth = assets.filter(a => {
      const assetDate = new Date(a.date);
      return a.status === 'Scheduled' &&
        assetDate.getMonth() === currentMonth &&
        assetDate.getFullYear() === currentYear;
    }).length;

    const publishedToday = assets.filter(a => {
      const assetDate = new Date(a.date);
      const today = new Date();
      return a.status === 'Published' &&
        assetDate.toDateString() === today.toDateString();
    }).length;

    const totalScheduled = assets.filter(a => a.status === 'Scheduled' || a.status === 'Published').length;
    const failedScheduled = assets.filter(a => a.status === 'Failed').length;
    const successRate = totalScheduled > 0
      ? Math.round(((totalScheduled - failedScheduled) / totalScheduled) * 100)
      : 0;

    return {
      totalStories: assets.length,
      scheduledThisMonth,
      publishedToday,
      successRate,
    };
  }, [assets]);

  // Apply filters function
  const applyFilters = useCallback(() => {
    let result = assets;

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(a => a.status.toLowerCase() === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.meta_description.toLowerCase().includes(query)
      );
    }

    // Sort results
    result = sortAssets(result, sortBy);

    setFilteredAssets(result);
  }, [assets, statusFilter, searchQuery, sortBy]);

  // Fetch assets on mount
  useEffect(() => {
    fetchAssets();
  }, []);

  // Filter assets when filter/search/sort changes
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedAssetIds([]);
  }, [statusFilter, searchQuery]);

  // Fetch assets from API
  async function fetchAssets() {
    setLoading(true);
    try {
      const response = await fetch('/api/assets');
      const data = await response.json();

      if (data.success) {
        setAssets(data.assets || []);
      } else {
        toast.error(data.error || 'Failed to load assets');
      }
    } catch (error) {
      toast.error('Failed to load assets');
      console.error('Fetch assets error:', error);
    } finally {
      setLoading(false);
    }
  }

  // Sort assets based on selected criteria
  function sortAssets(assetsToSort: AssetMetadata[], sortCriteria: string): AssetMetadata[] {
    const sorted = [...assetsToSort];

    switch(sortCriteria) {
      case 'date-desc':
        return sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      case 'date-asc':
        return sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      case 'status':
        return sorted.sort((a, b) => a.status.localeCompare(b.status));
      case 'created':
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      default:
        return sorted;
    }
  }

  // Mark asset as loading
  function setAssetLoading(id: string, isLoading: boolean) {
    setLoadingAssetIds(prev => {
      const next = new Set(prev);
      if (isLoading) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  // Handle Generate Background button
  async function handleGenerateBackground(id: string) {
    try {
      setAssetLoading(id, true);
      const response = await fetch(`/api/assets/${id}/background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Background generated successfully');
        await fetchAssets();
      } else {
        toast.error(data.error || 'Failed to generate background');
      }
    } catch (error) {
      toast.error('Failed to generate background');
      console.error('Generate background error:', error);
    } finally {
      setAssetLoading(id, false);
    }
  }

  // Handle Schedule button - show modal
  function handleSchedule(id: string) {
    setSelectedAssetId(id);

    // Pre-populate with the asset's date at 9 AM
    const asset = assets.find(a => a.id === id);
    if (asset) {
      const assetDate = new Date(asset.date);
      assetDate.setHours(9, 0, 0, 0);
      const localDateTime = formatDateTimeLocal(assetDate);
      console.log('[Schedule Modal] Opening with initial time:', localDateTime, 'for asset date:', asset.date);
      setScheduledDateTime(localDateTime);
    }

    setShowScheduleModal(true);
  }

  // Format date for datetime-local input
  function formatDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  // Handle Schedule confirmation
  async function confirmSchedule() {
    if (!selectedAssetId || !scheduledDateTime) {
      toast.error('Please select a date and time');
      return;
    }

    try {
      setAssetLoading(selectedAssetId, true);
      setShowScheduleModal(false);

      // Convert local datetime to ISO string
      const scheduledDate = new Date(scheduledDateTime);
      const scheduledTime = scheduledDate.toISOString();

      console.log('[Schedule] Sending to API:', {
        scheduledDateTime,
        scheduledTime,
        assetId: selectedAssetId
      });

      const response = await fetch(`/api/assets/${selectedAssetId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledTime })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Story scheduled successfully');
        await fetchAssets();
      } else {
        toast.error(data.error || 'Failed to schedule story');
      }
    } catch (error) {
      toast.error('Failed to schedule story');
      console.error('Schedule error:', error);
    } finally {
      if (selectedAssetId) {
        setAssetLoading(selectedAssetId, false);
      }
      setSelectedAssetId(null);
      setScheduledDateTime('');
    }
  }

  // Handle Edit button
  function handleEdit(id: string) {
    const asset = assets.find(a => a.id === id);
    if (asset) {
      setEditingAsset(asset);
      setShowEditModal(true);
    }
  }

  // Handle Delete button
  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this asset? This action cannot be undone.')) {
      return;
    }

    try {
      setAssetLoading(id, true);
      const response = await fetch(`/api/assets/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success || response.ok) {
        toast.success('Asset deleted successfully');
        await fetchAssets();
      } else {
        toast.error(data.error || 'Failed to delete asset');
      }
    } catch (error) {
      toast.error('Failed to delete asset');
      console.error('Delete error:', error);
    } finally {
      setAssetLoading(id, false);
    }
  }

  // Handle asset selection
  const handleToggleSelection = useCallback((assetId: string) => {
    setSelectedAssetIds(prev => {
      const newSelection = prev.includes(assetId)
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId];

      // Screen reader announcement
      const message = newSelection.length > prev.length
        ? `Asset selected. ${newSelection.length} asset${newSelection.length !== 1 ? 's' : ''} selected.`
        : `Asset deselected. ${newSelection.length} asset${newSelection.length !== 1 ? 's' : ''} selected.`;

      announceToScreenReader(message);

      return newSelection;
    });
  }, []);

  const handleCancelSelection = useCallback(() => {
    setSelectedAssetIds([]);
  }, []);

  const handleSelectAll = useCallback(() => {
    const draftAssets = filteredAssets.filter(a => a.status === 'Draft');
    setSelectedAssetIds(draftAssets.map(a => a.id));
  }, [filteredAssets]);

  const handleBulkApprove = useCallback(async () => {
    if (selectedAssetIds.length === 0) return;

    setIsApproving(true);

    try {
      const response = await fetch('/api/assets/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetIds: selectedAssetIds })
      });

      const result = await response.json();

      if (result.success) {
        // Show success toast
        toast.success(`Successfully approved ${result.summary.total_approved} asset${result.summary.total_approved !== 1 ? 's' : ''}`);

        // Refresh assets
        await fetchAssets();

        // Clear selection
        setSelectedAssetIds([]);
      } else {
        toast.error(`Bulk approval failed: ${result.error ?? 'Unknown error'}`);
      }
    } catch (error) {
      toast.error('Network error during bulk approval');
    } finally {
      setIsApproving(false);
    }
  }, [selectedAssetIds]);

  // Handle regenerate background from edit modal
  async function handleRegenerateFromModal(id: string, refinementPrompt?: string) {
    try {
      setAssetLoading(id, true);

      const response = await fetch(`/api/assets/${id}/background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refinementPrompt }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Background regeneration started');
        await fetchAssets();

        // Update editing asset with new data
        const updatedAsset = assets.find(a => a.id === id);
        if (updatedAsset) {
          setEditingAsset(updatedAsset);
        }
      } else {
        toast.error(data.error || 'Failed to regenerate background');
      }
    } catch (error) {
      toast.error('Failed to regenerate background');
      console.error('Regenerate error:', error);
    } finally {
      setAssetLoading(id, false);
    }
  }

  // Handle version change from edit modal
  async function handleVersionChange(id: string, version: number) {
    try {
      const response = await fetch(`/api/assets/${id}/version`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Switched to version ${version}`);
        await fetchAssets();

        // Update editing asset with new data
        const updatedAsset = assets.find(a => a.id === id);
        if (updatedAsset) {
          setEditingAsset(updatedAsset);
        }
      } else {
        toast.error(data.error || 'Failed to change version');
      }
    } catch (error) {
      toast.error('Failed to change version');
      console.error('Version change error:', error);
    }
  }

  // Handle view error details
  function handleViewError(id: string) {
    const asset = assets.find(a => a.id === id);
    if (asset && asset.error) {
      setErrorAsset(asset);
      setShowErrorModal(true);
    }
  }

  // Handle view prompt
  function handleViewPrompt(id: string) {
    const asset = assets.find(a => a.id === id);
    if (asset && asset.versions.length > 0 && asset.versions[0].prompt_used) {
      setPromptAsset(asset);
      setShowPromptModal(true);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary pt-24 pb-12 px-6">
      <div className="max-w-[1920px] mx-auto space-y-8">
        {/* Hero Section with Metrics */}
        <section className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl md:text-5xl font-bold text-fg-primary tracking-tight">
                  Story Dashboard
                </h1>
                {/* Auto-refresh indicator */}
                {hasProcessingAssets && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-500/10 border border-brand-500/30 rounded-lg">
                    <div className={`w-2 h-2 rounded-full bg-brand-500 ${isPolling ? 'animate-pulse' : ''}`} />
                    <span className="text-xs font-medium text-brand-500">Auto-refreshing</span>
                  </div>
                )}
              </div>
              <p className="text-lg text-fg-secondary">
                Manage and schedule your Instagram Stories with AI-powered automation
              </p>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={() => fetchAssets()}
              disabled={loading}
              className="px-4 py-2 bg-bg-secondary hover:bg-bg-tertiary border border-border-primary rounded-lg text-sm font-medium text-fg-primary transition-colors flex items-center gap-2 disabled:opacity-50"
              title="Refresh assets"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              label="Total Stories"
              value={metrics.totalStories}
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            />
            <MetricCard
              label="Scheduled This Month"
              value={metrics.scheduledThisMonth}
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            />
            <MetricCard
              label="Published Today"
              value={metrics.publishedToday}
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <MetricCard
              label="Success Rate"
              value={`${metrics.successRate}%`}
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
            />
          </div>
        </section>

        {/* Filter Bar */}
        <FilterBar
          onSearch={setSearchQuery}
          onStatusFilter={(status) => setStatusFilter(status as Status | 'all')}
          onSort={setSortBy}
          selectedCount={selectedAssetIds.length}
          onBulkAction={() => {}}
        />

        {/* Keyboard shortcuts help */}
        <div className="mb-4 text-sm text-gray-400">
          <span>Keyboard shortcuts: </span>
          <kbd className="px-2 py-1 bg-gray-700 rounded">Ctrl+A</kbd> Select all Draft assets
          <span className="mx-2">•</span>
          <kbd className="px-2 py-1 bg-gray-700 rounded">Esc</kbd> Clear selection
          <span className="mx-2">•</span>
          <kbd className="px-2 py-1 bg-gray-700 rounded">T</kbd> Toggle text overlay (in modal)
          <span className="mx-2">•</span>
          <kbd className="px-2 py-1 bg-gray-700 rounded">S</kbd> Toggle safe zones (in modal)
        </div>

        {/* Bulk Action Toolbar */}
        {selectedAssetIds.length > 0 && (
          <BulkActionToolbar
            selectedCount={selectedAssetIds.length}
            onApprove={handleBulkApprove}
            onCancel={handleCancelSelection}
            isApproving={isApproving}
          />
        )}

        {/* Asset Gallery */}
        <section>
          {loading ? (
            <GallerySkeleton count={8} />
          ) : filteredAssets.length === 0 ? (
            <EmptyState
              icon={
                <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
              title={assets.length === 0 ? 'No stories yet' : 'No assets found'}
              description={
                assets.length === 0
                  ? 'Upload your first asset to get started with automated Instagram Story creation'
                  : 'Try adjusting your filters or search query'
              }
              action={
                assets.length === 0
                  ? {
                      label: 'Upload Assets',
                      onClick: () => (window.location.href = '/upload'),
                    }
                  : undefined
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAssets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    onGenerateBackground={handleGenerateBackground}
                    onSchedule={handleSchedule}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onViewError={handleViewError}
                    onViewPrompt={handleViewPrompt}
                    loading={loadingAssetIds.has(asset.id)}
                    isSelectable={true}
                    isSelected={selectedAssetIds.includes(asset.id)}
                    onToggleSelection={handleToggleSelection}
                  />
                ))}
              </div>

              {/* Results Count */}
              <div className="mt-6 text-center text-sm text-fg-tertiary">
                Showing {filteredAssets.length} of {assets.length} assets
              </div>
            </>
          )}
        </section>
      </div>

      {/* Schedule Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false);
          setSelectedAssetId(null);
          setScheduledDateTime('');
        }}
        title="Schedule Story"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-fg-secondary">
            Select the date and time to publish this story
          </p>
          <input
            type="datetime-local"
            value={scheduledDateTime}
            onChange={(e) => {
              console.log('[Schedule Modal] DateTime changed:', e.target.value);
              setScheduledDateTime(e.target.value);
            }}
            className="w-full h-11 px-4 bg-bg-tertiary border border-border-primary rounded-lg text-sm text-fg-primary focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
          />
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setShowScheduleModal(false);
                setSelectedAssetId(null);
                setScheduledDateTime('');
              }}
              className="flex-1 px-4 py-2 bg-bg-tertiary hover:bg-bg-tertiary/70 text-fg-primary border border-border-primary rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmSchedule}
              className="flex-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors"
            >
              Confirm Schedule
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Asset Modal */}
      <EditAssetModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingAsset(null);
        }}
        asset={editingAsset}
        onRegenerateBackground={handleRegenerateFromModal}
        onSchedule={(id) => {
          setShowEditModal(false);
          handleSchedule(id);
        }}
        onDelete={(id) => {
          setShowEditModal(false);
          handleDelete(id);
        }}
        onVersionChange={handleVersionChange}
      />

      {/* Error Details Modal */}
      <ErrorDetailsModal
        isOpen={showErrorModal}
        onClose={() => {
          setShowErrorModal(false);
          setErrorAsset(null);
        }}
        asset={errorAsset}
        onRetry={handleGenerateBackground}
        onDelete={handleDelete}
      />

      {/* Prompt Preview Modal */}
      <PromptPreviewModal
        isOpen={showPromptModal}
        onClose={() => {
          setShowPromptModal(false);
          setPromptAsset(null);
        }}
        asset={promptAsset}
      />

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />

      {/* Floating Help Button */}
      <button
        onClick={() => setShowHelpModal(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 bg-brand-500 hover:bg-brand-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 group"
        aria-label="Show keyboard shortcuts"
        title="Keyboard shortcuts (?)"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-bg-secondary border border-brand-500 rounded-full flex items-center justify-center text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity">
          ?
        </span>
      </button>
    </div>
  );
}
