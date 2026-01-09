'use client'

import { useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

export default function UploadPage() {
  const router = useRouter();
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [metaDescription, setMetaDescription] = useState('');
  const [date, setDate] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<{
    file?: string;
    description?: string;
    date?: string;
  }>({});

  // File input validation and preview generation
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    // Clear previous errors
    setErrors(prev => ({ ...prev, file: undefined }));

    if (!file) {
      setAssetFile(null);
      setPreview(null);
      return;
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg'];
    if (!allowedTypes.includes(file.type)) {
      setErrors(prev => ({
        ...prev,
        file: 'Invalid file type. Please upload PNG, JPG, or JPEG images only.'
      }));
      setAssetFile(null);
      setPreview(null);
      return;
    }

    // Validate file size (30MB)
    const maxSize = 30 * 1024 * 1024; // 30MB in bytes
    if (file.size > maxSize) {
      setErrors(prev => ({
        ...prev,
        file: `File size exceeds 30MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`
      }));
      setAssetFile(null);
      setPreview(null);
      return;
    }

    // File is valid, set it and generate preview
    setAssetFile(file);

    // Generate preview using FileReader
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    // Validate file
    if (!assetFile) {
      newErrors.file = 'Please select an image file to upload.';
    }

    // Validate meta description
    if (!metaDescription.trim()) {
      newErrors.description = 'Meta description is required.';
    } else if (metaDescription.trim().length < 10) {
      newErrors.description = 'Meta description must be at least 10 characters.';
    }

    // Validate date format (if provided)
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      newErrors.date = 'Date must be in YYYY-MM-DD format.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form submission handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting.');
      return;
    }

    setUploading(true);

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('assetFile', assetFile!);
      formData.append('metaDescription', metaDescription.trim());
      if (date) {
        formData.append('date', date);
      }

      // POST to upload API
      const response = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        // Success - show toast and redirect
        toast.success('Asset uploaded successfully!');
        router.push('/');
      } else {
        // Error from API
        toast.error(data.error || 'Failed to upload asset');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('An error occurred while uploading. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Upload Asset
          </h1>
          <p className="text-gray-600">
            Upload a new image asset with description
          </p>
        </div>

        {/* Form Card */}
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg border border-gray-200 p-8">

            {/* File Input */}
            <div className="mb-6">
              <label htmlFor="assetFile" className="block text-sm font-medium text-gray-700 mb-2">
                Asset File *
              </label>
              <div className="mt-1">
                <input
                  id="assetFile"
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100
                    disabled:opacity-50 disabled:cursor-not-allowed
                    cursor-pointer"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                PNG, JPG, or JPEG (max 30MB)
              </p>
              {errors.file && (
                <p className="mt-2 text-sm text-red-600">{errors.file}</p>
              )}
            </div>

            {/* Image Preview */}
            {preview && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preview
                </label>
                <div className="flex justify-center">
                  <img
                    src={preview}
                    alt="Asset preview"
                    className="w-48 h-48 object-cover rounded-md border-2 border-gray-200"
                  />
                </div>
              </div>
            )}

            {/* Meta Description */}
            <div className="mb-6">
              <label htmlFor="metaDescription" className="block text-sm font-medium text-gray-700 mb-2">
                Meta Description *
              </label>
              <textarea
                id="metaDescription"
                value={metaDescription}
                onChange={(e) => {
                  setMetaDescription(e.target.value);
                  if (errors.description) {
                    setErrors(prev => ({ ...prev, description: undefined }));
                  }
                }}
                placeholder="Describe this asset..."
                rows={4}
                disabled={uploading}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  disabled:opacity-50 disabled:cursor-not-allowed
                  placeholder-gray-400"
              />
              <p className="mt-1 text-xs text-gray-500">
                Minimum 10 characters
              </p>
              {errors.description && (
                <p className="mt-2 text-sm text-red-600">{errors.description}</p>
              )}
            </div>

            {/* Date Input */}
            <div className="mb-8">
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                Date (Optional)
              </label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (errors.date) {
                    setErrors(prev => ({ ...prev, date: undefined }));
                  }
                }}
                disabled={uploading}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">
                Defaults to current date if not specified
              </p>
              {errors.date && (
                <p className="mt-2 text-sm text-red-600">{errors.date}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.push('/')}
                disabled={uploading}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-md text-gray-700 font-medium
                  hover:bg-gray-50 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-md font-medium
                  hover:bg-blue-600 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <span>Upload Asset</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
