import { Loader2 } from 'lucide-react'

interface FrostedLoaderProps {
  label?: string
}

export function FrostedLoader({ label = 'Loading' }: FrostedLoaderProps) {
  return (
    <div className="frosted-loader" role="status" aria-live="polite" aria-label={label}>
      <div className="frosted-loader__panel">
        <div className="frosted-loader__ring">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
        <p className="mt-4 text-sm font-semibold text-gray-700">{label}</p>
      </div>
    </div>
  )
}
