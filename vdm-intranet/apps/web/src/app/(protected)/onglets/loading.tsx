export default function Loading() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded-lg" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-24 bg-gray-200 rounded-xl" />
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
