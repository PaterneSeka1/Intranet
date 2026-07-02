export default function Loading() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 w-40 bg-gray-200 rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl h-40 shadow-sm" />
        ))}
      </div>
    </div>
  )
}
