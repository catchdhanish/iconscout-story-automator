// components/Button.tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}: ButtonProps) {
  const baseClasses = 'font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-primary disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-brand-500 hover:bg-brand-600 text-white focus:ring-brand-500',
    secondary: 'bg-bg-tertiary hover:bg-bg-tertiary/70 text-fg-primary border border-border-primary focus:ring-brand-500',
    danger: 'bg-status-failed-bg hover:bg-status-failed-border/20 text-status-failed-fg border border-status-failed-border focus:ring-error',
    ghost: 'bg-transparent hover:bg-bg-tertiary text-fg-secondary hover:text-fg-primary focus:ring-brand-500',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
