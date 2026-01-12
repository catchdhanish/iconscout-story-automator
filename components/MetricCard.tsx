// components/MetricCard.tsx
interface MetricCardProps {
  label: string;
  value: number | string;
  change?: { value: number; trend: 'up' | 'down' };
  icon?: React.ReactNode;
}

export default function MetricCard({ label, value, change, icon }: MetricCardProps) {
  return (
    <div className="relative bg-bg-secondary border border-border-primary rounded-xl p-6 overflow-hidden group hover:border-border-secondary transition-all">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative space-y-3">
        {/* Label & Icon */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-fg-tertiary font-medium">{label}</span>
          {icon && <div className="text-fg-tertiary">{icon}</div>}
        </div>

        {/* Value */}
        <div className="text-4xl font-bold text-fg-primary tracking-tight">
          {value}
        </div>

        {/* Change Indicator */}
        {change && (
          <div className={`flex items-center gap-1 text-sm font-medium ${change.trend === 'up' ? 'text-success' : 'text-error'}`}>
            {change.trend === 'up' ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
            <span>{Math.abs(change.value)}%</span>
            <span className="text-fg-tertiary">vs last month</span>
          </div>
        )}
      </div>
    </div>
  );
}
