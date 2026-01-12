// components/EmptyState.tsx
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {icon && (
        <div className="mb-6 text-fg-tertiary">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-bold text-fg-primary mb-2">{title}</h3>
      <p className="text-fg-secondary max-w-md mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
