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

  it('shows spinner when approving', () => {
    render(
      <BulkActionToolbar
        selectedCount={5}
        onApprove={jest.fn()}
        onCancel={jest.fn()}
        isApproving={true}
      />
    );

    expect(screen.getByText('Approving 5 assets...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve/i })).toHaveTextContent('Approving...');
    expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled();
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
