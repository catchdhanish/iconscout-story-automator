// components/LoadingSkeleton.tsx
export function CardSkeleton() {
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-xl overflow-hidden animate-pulse">
      {/* Image skeleton */}
      <div className="aspect-[9/16] bg-bg-tertiary" />
      {/* Footer skeleton */}
      <div className="p-4 space-y-3">
        <div className="h-4 bg-bg-tertiary rounded w-1/3" />
        <div className="h-4 bg-bg-tertiary rounded w-full" />
        <div className="h-4 bg-bg-tertiary rounded w-2/3" />
        <div className="h-10 bg-bg-tertiary rounded" />
      </div>
    </div>
  );
}

export function GallerySkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
