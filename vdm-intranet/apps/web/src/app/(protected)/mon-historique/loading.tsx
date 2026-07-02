export default function Loading() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded-lg" />
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="h-10 bg-gray-100 border-b border-gray-200" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 border-b border-gray-100 flex items-center px-4 gap-4">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-4 flex-1 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
