# Demo File Types

This folder contains small demo datasets for every input format Recona supports.

Each format includes:

- `charges_demo.*` - product/account charge export
- `invoices_demo.*` - billing invoice export
- `fee_schedule_demo.*` - optional contracted rates/fee schedule

Supported formats represented here:

- CSV: `.csv`
- TSV: `.tsv`
- Excel workbook: `.xlsx`
- Legacy Excel workbook: `.xls`
- OpenDocument spreadsheet: `.ods`
- JSON array: `.json`

## How to test

1. Open Recona at `/upload`.
2. Pick any one format.
3. Upload the matching three files for that format:
   - `charges_demo.<ext>`
   - `invoices_demo.<ext>`
   - `fee_schedule_demo.<ext>`
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
