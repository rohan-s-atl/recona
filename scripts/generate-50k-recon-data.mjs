import fs from 'fs'
import path from 'path'

const outDir = path.resolve('docs', 'load-test-data')
fs.mkdirSync(outDir, { recursive: true })

const rows = Number(process.argv[2] ?? 50000)
const chargesPath = path.join(outDir, `product_charges_${rows}.csv`)
const invoicesPath = path.join(outDir, `billing_invoices_${rows}.csv`)
const feesPath = path.join(outDir, `merchant_fee_schedule_${rows}.csv`)

const chargeHeader = [
  'charge_id',
  'merchant_id',
  'merchant_name',
  'product_line',
  'product_name',
  'fee_type',
  'contracted_rate',
  'transaction_volume',
  'amount',
  'billing_month',
  'account_status',
].join(',')

const invoiceHeader = [
  'invoice_id',
  'merchant_id',
  'merchant_name',
  'product_line',
  'product_name',
  'fee_type',
  'amount',
  'invoice_date',
  'billing_period',
  'status',
].join(',')

const feeHeader = [
  'merchant_id',
  'merchant_name',
  'product_line',
  'product_name',
  'fee_type',
  'rate_type',
  'contracted_rate',
  'effective_date',
].join(',')

const products = [
  ['Apex POS', 'Apex POS Core', 'Monthly Platform Fee', 49.95],
  ['ShieldNet', 'ShieldNet Basic', 'PCI Compliance Fee', 19.95],
  ['LoyaltyLoop', 'LoyaltyLoop Starter', 'Loyalty Fee', 29.95],
  ['InsightIQ', 'InsightIQ Standard', 'Analytics Fee', 39.95],
]

const chargeLines = [chargeHeader]
const invoiceLines = [invoiceHeader]
const feeLines = [feeHeader]

for (let i = 0; i < rows; i++) {
  const merchantNum = Math.floor(i / products.length) + 1
  const merchantId = `MID-${String(merchantNum).padStart(10, '0')}`
  const merchantName = `Load Test Merchant ${merchantNum}`
  const [productLine, productName, feeType, baseAmount] = products[i % products.length]
  const amount = i % 97 === 0 ? baseAmount + 5 : baseAmount
  const invoiceAmount = i % 97 === 0 ? baseAmount : baseAmount
  const period = '2026-05'

  chargeLines.push([
    `CHG-${String(i + 1).padStart(8, '0')}`,
    merchantId,
    merchantName,
    productLine,
    productName,
    feeType,
    baseAmount.toFixed(2),
    '',
    amount.toFixed(2),
    period,
    'Active',
  ].join(','))

  invoiceLines.push([
    `INV-${String(i + 1).padStart(8, '0')}`,
    merchantId,
    merchantName,
    productLine,
    productName,
    feeType,
    invoiceAmount.toFixed(2),
    '2026-06-01',
    period,
    'Collected',
  ].join(','))

  if (i < rows / products.length) {
    for (const [line, name, type, fee] of products) {
      feeLines.push([
        merchantId,
        merchantName,
        line,
        name,
        type,
        'flat',
        Number(fee).toFixed(2),
        '2026-01-01',
      ].join(','))
    }
  }
}

fs.writeFileSync(chargesPath, `${chargeLines.join('\n')}\n`)
fs.writeFileSync(invoicesPath, `${invoiceLines.join('\n')}\n`)
fs.writeFileSync(feesPath, `${feeLines.join('\n')}\n`)

console.log(`Generated ${rows.toLocaleString()} rows:`)
console.log(`- ${chargesPath}`)
console.log(`- ${invoicesPath}`)
console.log(`- ${feesPath}`)
