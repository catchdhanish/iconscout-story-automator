'use client'

import { useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/Button';
import toast from 'react-hot-toast';

type UploadMode = 'manual' | 'csv';

export default function UploadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<UploadMode>('manual');
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [metaDescription, setMetaDescription] = useState('');
  const [date, setDate] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{
    file?: string;
    description?: string;
    date?: string;
  }>({});

  // File input validation and preview generation
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    processFile(file);
  };

  const processFile = (file: File | undefined) => {
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
    const maxSize = 30 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrors(prev => ({
        ...prev,
        file: `File size exceeds 30MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`
      }));
      setAssetFile(null);
      setPreview(null);
      return;
    }

    setAssetFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // CSV file handling
  const handleCsvChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
    } else {
      toast.error('Please select a valid CSV file');
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      if (mode === 'csv') {
        const file = e.dataTransfer.files[0];
        if (file.type === 'text/csv') {
          setCsvFile(file);
        } else {
          toast.error('Please drop a valid CSV file');
        }
      } else {
        processFile(e.dataTransfer.files[0]);
      }
    }
  };

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!assetFile) {
      newErrors.file = 'Please select an image file to upload.';
    }

    if (!metaDescription.trim()) {
      newErrors.description = 'Meta description is required.';
    } else if (metaDescription.trim().length < 10) {
      newErrors.description = 'Meta description must be at least 10 characters.';
    }

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      newErrors.date = 'Date must be in YYYY-MM-DD format.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form submission handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors before submitting.');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('assetFile', assetFile!);
      formData.append('metaDescription', metaDescription.trim());
      if (date) {
        formData.append('date', date);
      }

      const response = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Asset uploaded successfully!');
        router.push('/');
      } else {
        toast.error(data.error || 'Failed to upload asset');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('An error occurred while uploading. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // CSV upload handler
  const handleCsvUpload = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('csvFile', csvFile);

      const response = await fetch('/api/assets/upload-csv', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`${data.count || 0} assets uploaded successfully!`);
        router.push('/');
      } else {
        toast.error(data.error || 'Failed to upload CSV');
      }
    } catch (error) {
      console.error('CSV upload error:', error);
      toast.error('An error occurred while uploading. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary pt-24 pb-12 px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-fg-primary tracking-tight mb-2">
            Upload Assets
          </h1>
          <p className="text-lg text-fg-secondary">
            Add new assets to create Instagram Stories
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex gap-2 p-1 bg-bg-secondary border border-border-primary rounded-lg w-fit">
          <button
            onClick={() => setMode('manual')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              mode === 'manual'
                ? 'bg-bg-tertiary text-fg-primary'
                : 'text-fg-secondary hover:text-fg-primary'
            }`}
          >
            Manual Entry
          </button>
          <button
            onClick={() => setMode('csv')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              mode === 'csv'
                ? 'bg-bg-tertiary text-fg-primary'
                : 'text-fg-secondary hover:text-fg-primary'
            }`}
          >
            CSV Upload
          </button>
        </div>

        {/* Upload Form */}
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-8">
          {mode === 'csv' ? (
            // CSV Upload Mode
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                dragActive
                  ? 'border-brand-500 bg-brand-500/5'
                  : 'border-border-secondary hover:border-brand-500/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <svg className="w-16 h-16 mx-auto mb-4 text-fg-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <h3 className="text-lg font-semibold text-fg-primary mb-2">
                Drop your CSV file here
              </h3>
              <p className="text-sm text-fg-secondary mb-4">
                or click to browse files
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvChange}
                className="hidden"
                id="csv-input"
              />
              <label htmlFor="csv-input" className="inline-block">
                <span className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-lg transition-colors cursor-pointer inline-block">
                  Select File
                </span>
              </label>
              {csvFile && (
                <p className="text-sm text-fg-primary mt-4">
                  Selected: <span className="font-medium">{csvFile.name}</span>
                </p>
              )}
              <p className="text-xs text-fg-tertiary mt-4">
                CSV should include: date, asset_url, meta_description
              </p>
              {csvFile && (
                <div className="mt-6">
                  <Button
                    variant="primary"
                    onClick={handleCsvUpload}
                    disabled={uploading}
                    className="min-w-[200px]"
                  >
                    {uploading ? 'Uploading...' : 'Upload CSV'}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            // Manual Entry Mode
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Asset File */}
              <div>
                <label className="block text-sm font-medium text-fg-primary mb-2">
                  Asset File *
                </label>
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                    dragActive
                      ? 'border-brand-500 bg-brand-500/5'
                      : 'border-border-secondary hover:border-brand-500/50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  {preview ? (
                    <div className="space-y-4">
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-48 h-48 object-cover rounded-lg mx-auto border-2 border-border-primary"
                      />
                      <p className="text-sm text-fg-secondary">{assetFile?.name}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setAssetFile(null);
                          setPreview(null);
                        }}
                        className="text-sm text-brand-500 hover:text-brand-600"
                      >
                        Change file
                      </button>
                    </div>
                  ) : (
                    <>
                      <svg className="w-12 h-12 mx-auto mb-4 text-fg-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-fg-secondary mb-4">
                        Drag and drop your image here, or click to browse
                      </p>
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg"
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-input"
                      />
                      <label htmlFor="file-input" className="inline-block">
                        <span className="px-4 py-2 bg-bg-tertiary hover:bg-bg-tertiary/70 text-fg-primary border border-border-primary font-medium rounded-lg transition-colors cursor-pointer inline-block">
                          Select File
                        </span>
                      </label>
                    </>
                  )}
                </div>
                <p className="text-xs text-fg-tertiary mt-2">
                  PNG, JPG, or JPEG (max 30MB)
                </p>
                {errors.file && (
                  <p className="text-sm text-error mt-2">{errors.file}</p>
                )}
              </div>

              {/* Meta Description */}
              <div>
                <label htmlFor="metaDescription" className="block text-sm font-medium text-fg-primary mb-2">
                  Description *
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
                  placeholder="Describe the asset..."
                  rows={4}
                  disabled={uploading}
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-sm text-fg-primary placeholder:text-fg-tertiary focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all resize-none"
                />
                <p className="text-xs text-fg-tertiary mt-2">
                  Minimum 10 characters
                </p>
                {errors.description && (
                  <p className="text-sm text-error mt-2">{errors.description}</p>
                )}
              </div>

              {/* Date */}
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-fg-primary mb-2">
                  Scheduled Date (Optional)
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
                  className="w-full h-11 px-4 bg-bg-tertiary border border-border-primary rounded-lg text-sm text-fg-primary focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                />
                <p className="text-xs text-fg-tertiary mt-2">
                  Defaults to current date if not specified
                </p>
                {errors.date && (
                  <p className="text-sm text-error mt-2">{errors.date}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => router.push('/')}
                  disabled={uploading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={uploading}
                  className="flex-1"
                >
                  {uploading ? 'Uploading...' : 'Upload Asset'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
