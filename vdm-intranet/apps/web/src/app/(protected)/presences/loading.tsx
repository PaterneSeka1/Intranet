export default function Loading() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-gray-200 rounded-lg" />
        <div className="flex gap-2">
          <div className="h-9 w-9 bg-gray-200 rounded-xl" />
          <div className="h-9 w-36 bg-gray-200 rounded-xl" />
          <div className="h-9 w-9 bg-gray-200 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl h-20 shadow-sm" />
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="h-10 bg-gray-100 border-b border-gray-200" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 border-b border-gray-100" />
        ))}
      </div>
    </div>
  )
}
