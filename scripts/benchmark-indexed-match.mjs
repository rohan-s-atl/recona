import fs from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'

const rows = Number(process.argv[2] ?? 50000)
const dir = path.resolve('docs', 'load-test-data')
const chargesPath = path.join(dir, `product_charges_${rows}.csv`)
const invoicesPath = path.join(dir, `billing_invoices_${rows}.csv`)

function parseCsv(file) {
  const [header, ...lines] = fs.readFileSync(file, 'utf8').trim().split('\n')
  const keys = header.split(',')
  return lines.map((line, index) => {
    const values = line.split(',')
    const row = Object.fromEntries(keys.map((key, i) => [key, values[i] ?? '']))
    return {
      _sourceRow: index,
      client_id: row.merchant_id,
      client_name: row.merchant_name,
      product_line: row.product_line,
      product_name: row.product_name,
      fee_type: row.fee_type,
      amount: Number(row.amount),
      billing_period: row.billing_month ?? row.billing_period,
      account_status: row.account_status ?? '',
    }
  })
}

function normFee(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normProduct(value) {
  return (value || '').toLowerCase().replace(/[^a-z]/g, '')
}

function period(value) {
  return (value || '').substring(0, 7)
}

function keys(record) {
  const merchant = record.client_id || '_'
  const p = period(record.billing_period)
  const product = normProduct(record.product_line)
  const fee = normFee(record.fee_type)
  return [
    `${merchant}|${p}|${product}|${fee}`,
    `${merchant}|${p}|${product}|*`,
    `${merchant}|${p}|*|${fee}`,
    `${merchant}|${p}|*|*`,
  ]
}

function feeMatch(a, b) {
  const na = normFee(a)
  const nb = normFee(b)
  return na === nb || na.includes(nb) || nb.includes(na)
}

function productMatch(a, b) {
  const na = normProduct(a)
  const nb = normProduct(b)
  return na === nb || na.includes(nb) || nb.includes(na)
}

function runIndexedMatch(charges, invoices) {
  const invoiceIndex = new Map()
  invoices.forEach((invoice, index) => {
    for (const key of keys(invoice)) {
      const bucket = invoiceIndex.get(key)
      if (bucket) bucket.push(index)
      else invoiceIndex.set(key, [index])
    }
  })

  const used = new Set()
  let matches = 0
  let mismatches = 0
  let unmatchedCharges = 0

  for (const charge of charges) {
    let best = -1
    let bestScore = 0
    const candidates = new Set()
    keys(charge).forEach((key) => invoiceIndex.get(key)?.forEach((idx) => candidates.add(idx)))

    for (const idx of candidates) {
      if (used.has(idx)) continue
      const invoice = invoices[idx]
      let score = 0
      if (feeMatch(charge.fee_type, invoice.fee_type)) score += 3
      if (productMatch(charge.product_line, invoice.product_line)) score += 2
      if (Math.abs(charge.amount - invoice.amount) <= 0.02) score += 2
      if (score > bestScore) {
        bestScore = score
        best = idx
        if (score >= 7) break
      }
    }

    if (best >= 0 && bestScore >= 2) {
      used.add(best)
      matches += 1
      if (Math.abs(charge.amount - invoices[best].amount) > 0.02) mismatches += 1
    } else {
      unmatchedCharges += 1
    }
  }

  return { matches, mismatches, unmatchedCharges, unmatchedInvoices: invoices.length - used.size }
}

if (!fs.existsSync(chargesPath) || !fs.existsSync(invoicesPath)) {
  console.error(`Missing load-test files. Run: npm run loadtest:generate -- ${rows}`)
  process.exit(1)
}

const parseStart = performance.now()
const charges = parseCsv(chargesPath)
const invoices = parseCsv(invoicesPath)
const parseMs = performance.now() - parseStart

const matchStart = performance.now()
const result = runIndexedMatch(charges, invoices)
const matchMs = performance.now() - matchStart

console.log(JSON.stringify({
  rows,
  parse_ms: Math.round(parseMs),
  exact_match_ms: Math.round(matchMs),
  total_ms: Math.round(parseMs + matchMs),
  result,
}, null, 2))
