import { NextResponse } from 'next/server'
import { getDataScope } from '@/lib/auth'
import { getWorkflowAnalytics } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const analytics = await getWorkflowAnalytics(getDataScope())
  const rows = [
    ['section', 'label', 'value', 'extra'],
    ...analytics.monthTrend.map((row) => ['month_trend', row.month, row.atRisk.toString(), `${row.issues} issues`]),
    ...Object.entries(analytics.rootCauseCounts).map(([label, value]) => ['root_cause', label, value.toString(), '']),
    ...analytics.chronicMerchants.map((row) => [
      'chronic_merchant',
      row.merchantName,
      row.occurrences.toString(),
      row.atRisk.toString(),
    ]),
    ...analytics.productTrend.map((row) => ['product_exposure', row.productLine, row.atRisk.toString(), `${row.issues} issues`]),
  ]
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="recona-trend-analytics-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
