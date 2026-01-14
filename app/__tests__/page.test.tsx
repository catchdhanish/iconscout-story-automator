import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from '../page';

// Mock fetch
global.fetch = jest.fn();

describe('Bulk Approval Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, assets: [] })
    });
  });

  it('should show toolbar when Draft assets selected', async () => {
    const mockAssets = {
      success: true,
      assets: [
        {
          id: '1',
          status: 'Draft',
          meta_description: 'Test 1',
          date: '2026-01-31',
          active_version: 1,
          versions: [{ version: 1, file_path: '/uploads/1/v1.png', created_at: '2026-01-14T00:00:00Z', prompt_used: 'test' }],
          created_at: '2026-01-14T00:00:00Z',
          asset_url: 'https://example.com/test1.png'
        },
        {
          id: '2',
          status: 'Ready',
          meta_description: 'Test 2',
          date: '2026-02-01',
          active_version: 1,
          versions: [{ version: 1, file_path: '/uploads/2/v1.png', created_at: '2026-01-14T00:00:00Z', prompt_used: 'test' }],
          created_at: '2026-01-14T00:00:00Z',
          asset_url: 'https://example.com/test2.png'
        }
      ]
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAssets
    });

    render(<Dashboard />);
    await waitFor(() => screen.getByText('Test 1'));

    // Select Draft asset - find checkbox by test ID or role
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // Toolbar should appear
    await waitFor(() => {
      expect(screen.getByText(/1 asset selected/i)).toBeInTheDocument();
    });
  });

  it('should call bulk approve API and refresh', async () => {
    const mockAssets = {
      success: true,
      assets: [
        {
          id: '1',
          status: 'Draft',
          meta_description: 'Test 1',
          date: '2026-01-31',
          active_version: 1,
          versions: [{ version: 1, file_path: '/uploads/1/v1.png', created_at: '2026-01-14T00:00:00Z', prompt_used: 'test' }],
          created_at: '2026-01-14T00:00:00Z',
          asset_url: 'https://example.com/test1.png'
        }
      ]
    };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => mockAssets })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          approved: ['1'],
          failed: [],
          summary: { total_selected: 1, total_approved: 1, total_failed: 0 }
        })
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, assets: [] }) });

    // Mock window.alert
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});

    render(<Dashboard />);
    await waitFor(() => screen.getByText('Test 1'));

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    await waitFor(() => {
      expect(screen.getByText(/1 asset selected/i)).toBeInTheDocument();
    });

    const approveButton = screen.getByLabelText('Approve selected assets');
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/assets/bulk-approve', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ assetIds: ['1'] })
      }));
    });

    alertMock.mockRestore();
  });

  it('should clear selection when filters change', async () => {
    const mockAssets = {
      success: true,
      assets: [
        {
          id: '1',
          status: 'Draft',
          meta_description: 'Test 1',
          date: '2026-01-31',
          active_version: 1,
          versions: [{ version: 1, file_path: '/uploads/1/v1.png', created_at: '2026-01-14T00:00:00Z', prompt_used: 'test' }],
          created_at: '2026-01-14T00:00:00Z',
          asset_url: 'https://example.com/test1.png'
        }
      ]
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockAssets
    });

    render(<Dashboard />);
    await waitFor(() => screen.getByText('Test 1'));

    // Select asset
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    await waitFor(() => {
      expect(screen.getByText(/1 asset selected/i)).toBeInTheDocument();
    });

    // Change filter - find the status filter dropdown (first combobox)
    const comboboxes = screen.getAllByRole('combobox');
    const statusFilter = comboboxes[0]; // First combobox is the status filter
    fireEvent.change(statusFilter, { target: { value: 'ready' } });

    // Selection should be cleared (toolbar should disappear)
    await waitFor(() => {
      expect(screen.queryByText(/1 asset selected/i)).not.toBeInTheDocument();
    });
  });
});
