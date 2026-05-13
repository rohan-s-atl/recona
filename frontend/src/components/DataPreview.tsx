'use client'

interface DataPreviewProps {
  headers: string[]
  rows: Record<string, string>[]
  title: string
}

export function DataPreview({ headers, rows, title }: DataPreviewProps) {
  const preview = rows.slice(0, 5)

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        {title} — first {preview.length} rows
      </p>
      <div className="glass rounded-xl overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-white/60">
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/50">
            {preview.map((row, i) => (
              <tr key={i} className="hover:bg-white/30 transition-colors">
                {headers.map((h) => (
                  <td key={h} className="px-3 py-2 text-gray-600 max-w-[180px] truncate">
                    {row[h] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
