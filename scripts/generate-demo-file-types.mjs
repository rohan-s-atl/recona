import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'

const outDir = path.join(process.cwd(), 'docs', 'demo-file-types')
fs.mkdirSync(outDir, { recursive: true })

const charges = [
  {
    record_id: 'CHG-1001',
    client_id: 'MID-1001',
    client_name: 'Northstar Coffee',
    product_line: 'Apex POS',
    product_name: 'Apex POS Pro',
    fee_type: 'Monthly software',
    amount: '199.00',
    billing_period: '2026-05',
    date: '2026-05-01',
    transaction_volume: '',
    account_status: 'active',
  },
  {
    record_id: 'CHG-1002',
    client_id: 'MID-1002',
    client_name: 'Harbor Books',
    product_line: 'FlowPay',
    product_name: 'FlowPay Processing',
    fee_type: 'Processing',
    amount: '310.00',
    billing_period: '2026-05',
    date: '2026-05-01',
    transaction_volume: '10000',
    account_status: 'active',
  },
  {
    record_id: 'CHG-1003',
    client_id: 'MID-1003',
    client_name: 'Cedar Fitness',
    product_line: 'ShieldNet',
    product_name: 'ShieldNet Core',
    fee_type: 'Security add-on',
    amount: '89.00',
    billing_period: '2026-05',
    date: '2026-05-01',
    transaction_volume: '',
    account_status: 'active',
  },
  {
    record_id: 'CHG-1004',
    client_id: 'MID-1004',
    client_name: 'Lakeview Market',
    product_line: 'InsightIQ',
    product_name: 'InsightIQ Dashboard',
    fee_type: 'Analytics',
    amount: '149.00',
    billing_period: '2026-05',
    date: '2026-05-01',
    transaction_volume: '',
    account_status: 'active',
  },
  {
    record_id: 'CHG-1005',
    client_id: 'MID-1005',
    client_name: 'Metro Salon',
    product_line: 'LoyaltyLoop',
    product_name: 'LoyaltyLoop Starter',
    fee_type: 'Loyalty',
    amount: '59.00',
    billing_period: '2026-05',
    date: '2026-05-01',
    transaction_volume: '',
    account_status: 'active',
  },
]

const invoices = [
  {
    invoice_id: 'INV-9001',
    client_id: 'MID-1001',
    client_name: 'Northstar Coffee LLC',
    product_line: 'Apex POS',
    product_name: 'Apex POS Pro',
    fee_type: 'Monthly software',
    amount: '199.00',
    billing_period: '2026-05',
    invoice_date: '2026-05-02',
    transaction_volume: '',
    status: 'sent',
  },
  {
    invoice_id: 'INV-9002',
    client_id: 'MID-1002',
    client_name: 'Harbor Books',
    product_line: 'FlowPay',
    product_name: 'FlowPay Processing',
    fee_type: 'Processing',
    amount: '350.00',
    billing_period: '2026-05',
    invoice_date: '2026-05-02',
    transaction_volume: '10000',
    status: 'sent',
  },
  {
    invoice_id: 'INV-9003',
    client_id: 'MID-1003',
    client_name: 'Cedar Fitness',
    product_line: 'ShieldNet',
    product_name: 'ShieldNet Core',
    fee_type: 'Security add-on',
    amount: '0.00',
    billing_period: '2026-05',
    invoice_date: '2026-05-02',
    transaction_volume: '',
    status: 'missing',
  },
  {
    invoice_id: 'INV-9004',
    client_id: 'MID-1004',
    client_name: 'Lakeview Market',
    product_line: 'InsightIQ',
    product_name: 'InsightIQ Dashboard',
    fee_type: 'Analytics',
    amount: '149.00',
    billing_period: '2026-05',
    invoice_date: '2026-05-02',
    transaction_volume: '',
    status: 'sent',
  },
  {
    invoice_id: 'INV-9006',
    client_id: 'MID-9999',
    client_name: 'Unknown Merchant',
    product_line: 'WebCharge',
    product_name: 'WebCharge Gateway',
    fee_type: 'Gateway',
    amount: '49.00',
    billing_period: '2026-05',
    invoice_date: '2026-05-02',
    transaction_volume: '',
    status: 'sent',
  },
]

const feeSchedule = [
  {
    merchant_id: 'MID-1001',
    merchant_name: 'Northstar Coffee',
    product_line: 'Apex POS',
    product_name: 'Apex POS Pro',
    fee_type: 'Monthly software',
    rate_type: 'flat',
    contracted_rate: '199.00',
    effective_date: '2026-01-01',
  },
  {
    merchant_id: 'MID-1002',
    merchant_name: 'Harbor Books',
    product_line: 'FlowPay',
    product_name: 'FlowPay Processing',
    fee_type: 'Processing',
    rate_type: 'percentage',
    contracted_rate: '3.10',
    effective_date: '2026-01-01',
  },
  {
    merchant_id: 'MID-1003',
    merchant_name: 'Cedar Fitness',
    product_line: 'ShieldNet',
    product_name: 'ShieldNet Core',
    fee_type: 'Security add-on',
    rate_type: 'flat',
    contracted_rate: '89.00',
    effective_date: '2026-01-01',
  },
  {
    merchant_id: 'MID-1005',
    merchant_name: 'Metro Salon',
    product_line: 'LoyaltyLoop',
    product_name: 'LoyaltyLoop Starter',
    fee_type: 'Loyalty',
    rate_type: 'flat',
    contracted_rate: '59.00',
    effective_date: '2026-01-01',
  },
]

const datasets = [
  { basename: 'charges_demo', rows: charges },
  { basename: 'invoices_demo', rows: invoices },
  { basename: 'fee_schedule_demo', rows: feeSchedule },
]

const formats = [
  { ext: 'csv', type: 'text', delimiter: ',' },
  { ext: 'tsv', type: 'text', delimiter: '\t' },
  { ext: 'json', type: 'json' },
  { ext: 'xlsx', type: 'workbook', bookType: 'xlsx' },
  { ext: 'xls', type: 'workbook', bookType: 'xls' },
  { ext: 'ods', type: 'workbook', bookType: 'ods' },
]

for (const dataset of datasets) {
  for (const format of formats) {
    const filePath = path.join(outDir, `${dataset.basename}.${format.ext}`)
    if (format.type === 'text') writeDelimited(filePath, dataset.rows, format.delimiter)
    if (format.type === 'json') fs.writeFileSync(filePath, JSON.stringify(dataset.rows, null, 2))
    if (format.type === 'workbook') writeWorkbook(filePath, dataset.rows, format.bookType)
  }
}

fs.writeFileSync(path.join(outDir, 'README.md'), readme())

function writeDelimited(filePath, rows, delimiter) {
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(delimiter),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header], delimiter)).join(delimiter)),
  ]
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`)
}

function escapeCell(value, delimiter) {
  const text = String(value ?? '')
  if (text.includes('"') || text.includes('\n') || text.includes(delimiter)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function writeWorkbook(filePath, rows, bookType) {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, 'Demo Data')
  XLSX.writeFile(workbook, filePath, { bookType })
}

function readme() {
  return `# Demo File Types

This folder contains small demo datasets for every input format Recona supports.

Each format includes:

- \`charges_demo.*\` - product/account charge export
- \`invoices_demo.*\` - billing invoice export
- \`fee_schedule_demo.*\` - optional contracted rates/fee schedule

Supported formats represented here:

- CSV: \`.csv\`
- TSV: \`.tsv\`
- Excel workbook: \`.xlsx\`
- Legacy Excel workbook: \`.xls\`
- OpenDocument spreadsheet: \`.ods\`
- JSON array: \`.json\`

## How to test

1. Open Recona at \`/upload\`.
2. Pick any one format.
3. Upload the matching three files for that format:
   - \`charges_demo.<ext>\`
   - \`invoices_demo.<ext>\`
   - \`fee_schedule_demo.<ext>\`
4. Confirm the column mappings.
5. Run reconciliation.

You can mix formats too, for example charges as CSV, invoices as XLSX, and fee schedule as JSON.

## Expected behavior

The files intentionally include a few issues:

- One processing rate mismatch for Harbor Books.
- One missing/zero-billed ShieldNet fee for Cedar Fitness.
- One invoice with no matching charge for Unknown Merchant.
- One contracted LoyaltyLoop fee for Metro Salon that is not invoiced.

Exact counts can change as matching logic evolves, but the upload, preview, mapping, reconciliation, and fee schedule parser paths should all work for every file extension in this folder.
`
}
