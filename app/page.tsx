'use client'

import { useState, useEffect } from 'react';
import { AssetMetadata, Status } from '@/lib/types';
import { AssetCard } from '@/components/AssetCard';
import toast, { Toaster } from 'react-hot-toast';

export default function Dashboard() {
  // State management
  const [assets, setAssets] = useState<AssetMetadata[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<AssetMetadata[]>([]);
  const [statusFilter, setStatusFilter] = useState<Status | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingAssetIds, setLoadingAssetIds] = useState<Set<string>>(new Set());
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [scheduledDateTime, setScheduledDateTime] = useState('');

  // Fetch assets on mount
  useEffect(() => {
    fetchAssets();
  }, []);

  // Filter assets when filter/search changes
  useEffect(() => {
    applyFilters();
  }, [statusFilter, searchQuery, assets]);

  // Fetch assets from API
  async function fetchAssets() {
    try {
      setLoading(true);
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

  // Apply filters
  function applyFilters() {
    let result = assets;

    // Filter by status
    if (statusFilter !== 'All') {
      result = result.filter(a => a.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.meta_description.toLowerCase().includes(query)
      );
    }

    setFilteredAssets(result);
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
    toast('Edit functionality coming soon', {
      icon: 'ℹ️',
    });
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Gallery Dashboard
          </h1>
          <p className="text-gray-600">
            Manage and schedule your Instagram Stories
          </p>
        </div>

        {/* Filters and Search */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as Status | 'All')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="All">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Ready">Ready</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Published">Published</option>
              <option value="Failed">Failed</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Assets Grid or Empty State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-600">Loading assets...</p>
            </div>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {assets.length === 0 ? 'No assets yet' : 'No assets found'}
            </h3>
            <p className="text-gray-500 mb-4">
              {assets.length === 0
                ? 'Upload your first asset to get started'
                : 'Try adjusting your filters or search query'}
            </p>
            {assets.length === 0 && (
              <a
                href="/upload"
                className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Upload Asset
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onGenerateBackground={handleGenerateBackground}
                onSchedule={handleSchedule}
                onEdit={handleEdit}
                onDelete={handleDelete}
                loading={loadingAssetIds.has(asset.id)}
              />
            ))}
          </div>
        )}

        {/* Results Count */}
        {!loading && filteredAssets.length > 0 && (
          <div className="mt-6 text-center text-sm text-gray-600">
            Showing {filteredAssets.length} of {assets.length} assets
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Schedule Story</h2>
            <p className="text-gray-600 mb-4">
              Select the date and time to publish this story
            </p>
            <input
              type="datetime-local"
              value={scheduledDateTime}
              onChange={(e) => setScheduledDateTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowScheduleModal(false);
                  setSelectedAssetId(null);
                  setScheduledDateTime('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmSchedule}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                Confirm Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
