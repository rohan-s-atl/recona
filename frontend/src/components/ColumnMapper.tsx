'use client'

import { ColumnMapping } from '@/types'

const SCHEMA_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: 'record_id',           label: 'Record ID',             required: false },
  { key: 'client_id',           label: 'Merchant / Account ID', required: true  },
  { key: 'client_name',         label: 'Merchant Name / DBA',   required: true  },
  { key: 'product_line',        label: 'Product Line / Family', required: false },
  { key: 'product_name',        label: 'Product / Plan Name',   required: true  },
  { key: 'fee_type',            label: 'Fee Type / Category',   required: true  },
  { key: 'amount',              label: 'Amount ($)',             required: true  },
  { key: 'billing_period',      label: 'Billing Period / Month',required: true  },
  { key: 'date',                label: 'Date',                   required: false },
  { key: 'transaction_volume',  label: 'Transaction Volume ($)', required: false },
  { key: 'account_status',      label: 'Account Status',        required: false },
]

type FileRole = 'charges' | 'invoices'

interface ColumnMapperProps {
  role: FileRole
  headers: string[]
  mapping: ColumnMapping
  onChange: (mapping: ColumnMapping) => void
}

export function ColumnMapper({ role, headers, mapping, onChange }: ColumnMapperProps) {
  const isCharges = role === 'charges'
  const badgeBg = isCharges ? 'bg-blue-500/10 text-blue-700' : 'bg-violet-500/10 text-violet-700'
  const label = isCharges ? 'Product Charges' : 'Billing Invoices'

  function handleChange(field: keyof ColumnMapping, value: string) {
    onChange({ ...mapping, [field]: value === '' ? null : value })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${badgeBg}`}>
          {label.toUpperCase()}
        </span>
        <p className="text-sm text-gray-400">
          Claude auto-mapped these — verify before running
        </p>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/60">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/2">Field</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/2">Your column</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/50">
            {SCHEMA_FIELDS.map(({ key, label, required }) => (
              <tr key={key} className={!mapping[key] && required ? 'bg-red-500/5' : ''}>
                <td className="px-4 py-2 text-gray-700 font-medium text-sm">
                  {label}
                  {required && <span className="text-red-400 ml-1">*</span>}
                </td>
                <td className="px-4 py-2">
                  <select
                    value={mapping[key] ?? ''}
                    onChange={(e) => handleChange(key, e.target.value)}
                    className="w-full text-sm border border-white/60 rounded-lg px-2.5 py-1.5 bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400/60 transition-all"
                  >
                    <option value="">— not mapped —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
