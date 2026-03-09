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

        {/* Section title */}
        <div className="h-6 w-36 bg-gray-200 rounded animate-pulse mt-8 mb-3" />

        {/* Search skeleton */}
        <div className="h-11 rounded-xl bg-gray-100 animate-pulse mb-4" />

        {/* Property card skeletons */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-100 bg-white"
            >
              <div className="p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gray-100 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-1/3 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="h-6 w-24 rounded-full bg-gray-100 animate-pulse" />
              </div>
              <div className="border-t border-gray-50 px-4 py-2.5 flex gap-2">
                <div className="h-6 w-20 rounded-full bg-gray-100 animate-pulse" />
                <div className="h-6 w-24 rounded-full bg-gray-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
