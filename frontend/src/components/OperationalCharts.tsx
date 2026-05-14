import { formatCurrency } from '@/lib/utils'

export interface DonutSegment {
  label: string
  value: number
  color: string
  textClass?: string
}

interface DonutChartProps {
  title: string
  subtitle?: string
  centerLabel: string
  centerValue: string
  segments: DonutSegment[]
  valueFormatter?: (value: number) => string
}

export function DonutChart({
  title,
  subtitle,
  centerLabel,
  centerValue,
  segments,
  valueFormatter = (value) => value.toLocaleString(),
}: DonutChartProps) {
  const total = segments.reduce((sum, segment) => sum + Math.max(segment.value, 0), 0)
  const radius = 42
  const circumference = 2 * Math.PI * radius
  let offset = 0
  const visibleSegments = segments.filter((segment) => segment.value > 0)

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 112 112" className="-rotate-90 overflow-visible">
            <circle cx="56" cy="56" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12" />
            {visibleSegments.map((segment) => {
              const length = (segment.value / total) * circumference
              const dashArray = `${length} ${circumference}`
              const dashOffset = -offset
              offset += length
              return (
                <circle
                  key={segment.label}
                  cx="56"
                  cy="56"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="12"
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="butt"
                />
              )
            })}
          </svg>
          <div className="absolute inset-4 rounded-full bg-white/90 shadow-inner flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{centerLabel}</span>
            <span className="text-xs font-bold text-gray-900">{centerValue}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center justify-between gap-3 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                <span className="truncate text-gray-500">{segment.label}</span>
              </div>
              <span className={`font-semibold tabular-nums ${segment.textClass ?? 'text-gray-800'}`}>
                {valueFormatter(segment.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface BarListItem {
  label: string
  value: number
  sublabel?: string
  colorClass?: string
}

interface BarListProps {
  title: string
  items: BarListItem[]
  valueFormatter?: (value: number) => string
  emptyText?: string
}

export function BarList({
  title,
  items,
  valueFormatter = (value) => value.toLocaleString(),
  emptyText = 'No data yet',
}: BarListProps) {
  const max = Math.max(...items.map((item) => item.value), 1)

  return (
    <div className="glass rounded-xl p-4">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <div className="mt-4 space-y-3">
        {items.length === 0 && <p className="text-sm text-gray-400">{emptyText}</p>}
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-700">{item.label}</p>
                {item.sublabel && <p className="truncate text-gray-400">{item.sublabel}</p>}
              </div>
              <span className="font-bold text-gray-900 tabular-nums">{valueFormatter(item.value)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/5">
              <div
                className={`h-full rounded-full ${item.colorClass ?? 'bg-blue-500'}`}
                style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 3 : 0)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function currencyFormatter(value: number) {
  return formatCurrency(value)
}
