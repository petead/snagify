export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#fcfcfc]">
      {/* Header skeleton */}
      <div className="sticky top-0 z-50 h-16 bg-white border-b border-[#E5E7EB]">
        <div className="h-full max-w-[480px] mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gray-200 animate-pulse" />
            <div className="w-20 h-5 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-4 pb-24">
        {/* Hero skeleton */}
        <div className="h-32 rounded-2xl bg-gray-200 animate-pulse mt-4" />

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-gray-100 animate-pulse"
            />
          ))}
        </div>

        {/* Section title skeleton */}
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mt-8 mb-4" />

        {/* Empty state skeleton */}
        <div className="rounded-2xl border border-gray-100 bg-white p-8 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
          <div className="h-12 w-40 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
