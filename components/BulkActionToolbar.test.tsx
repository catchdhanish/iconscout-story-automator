import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import BulkActionToolbar from './BulkActionToolbar';

describe('BulkActionToolbar', () => {
  it('renders with selection count', () => {
    render(
      <BulkActionToolbar
        selectedCount={3}
        onApprove={jest.fn()}
        onCancel={jest.fn()}
        isApproving={false}
      />
    );

    expect(screen.getByText('3 assets selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('disables approve button when over 50 limit', () => {
    render(
      <BulkActionToolbar
        selectedCount={51}
        onApprove={jest.fn()}
        onCancel={jest.fn()}
        isApproving={false}
      />
    );

    const approveButton = screen.getByRole('button', { name: /approve/i });
    expect(approveButton).toBeDisabled();
    expect(screen.getByText(/cannot approve more than 50 assets/i)).toBeInTheDocument();
  });

  it('calls onApprove when approve button is clicked', () => {
    const handleApprove = jest.fn();
    render(
      <BulkActionToolbar
        selectedCount={3}
        onApprove={handleApprove}
        onCancel={jest.fn()}
        isApproving={false}
      />
    );

    const approveButton = screen.getByRole('button', { name: /approve/i });
    fireEvent.click(approveButton);

    expect(handleApprove).toHaveBeenCalledTimes(1);
  });

  it('shows progress bar when approving', () => {
    render(
      <BulkActionToolbar
        selectedCount={5}
        onApprove={jest.fn()}
        onCancel={jest.fn()}
        isApproving={true}
        progress={{ current: 3, total: 5 }}
      />
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '60');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByText('Approving 3 of 5 assets...')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('uses singular "asset" for count of 1', () => {
    render(
      <BulkActionToolbar
        selectedCount={1}
        onApprove={jest.fn()}
        onCancel={jest.fn()}
        isApproving={false}
      />
    );

    expect(screen.getByText('1 asset selected')).toBeInTheDocument();
  });
});
