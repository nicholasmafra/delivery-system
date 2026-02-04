export default function ProductSkeleton() {
  return (
    <div className="bg-white p-3 rounded-2xl border border-gray-100 flex flex-col gap-3 animate-pulse">
      <div className="aspect-square bg-gray-200 rounded-xl" />
      <div className="space-y-2">
        <div className="h-3 w-12 bg-gray-200 rounded" />
        <div className="h-4 w-3/4 bg-gray-200 rounded" />
        <div className="flex justify-between items-center pt-2">
          <div className="h-6 w-16 bg-gray-200 rounded" />
          <div className="h-10 w-10 bg-gray-200 rounded-xl" />
        </div>
      </div>
    </div>
  );
}