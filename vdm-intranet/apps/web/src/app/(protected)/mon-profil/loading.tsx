export default function Loading() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 w-40 bg-gray-200 rounded-lg" />
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-200" />
          <div className="space-y-2">
            <div className="h-5 w-36 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-100 rounded" />
          </div>
        </div>
        <div className="h-px bg-gray-100" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
