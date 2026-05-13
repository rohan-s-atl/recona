# Test Data — Fiserv/Clover Merchant Billing Scenario

Simulates the internal reconciliation problem at a company like Fiserv: the account management system (product charges) vs the billing/invoicing system.

## Scenario

10 Clover merchants billed for January 2024. Each merchant pays a combination of:
- Monthly POS platform fee (Starter $14.95 / Standard $49.95 / Advanced $84.95)
- Merchant processing fee (% of gross volume — rate varies by contract)
- PCI/security compliance fee ($9.95/mo)
- Add-on subscriptions (Clover Rewards, Virtual Terminal, Main Street Insights)

## Discrepancy inventory

| # | Type | Description | Records |
|---|---|---|---|
| 1 | Missing from billing | Loyalty add-on charged but not provisioned in billing | CHG-2024-013 |
| 2 | Missing from billing | Virtual terminal charged but not in billing system | CHG-2024-021 |
| 3 | Rate mismatch | Merchant upgraded to Advanced ($84.95) but billed Standard ($49.95) — $35/mo revenue leak | CHG-2024-007 / INV-24-00887 |
| 4 | Overbilled — closed account | Merchant closed Dec 28 but billed full January anyway | CHG-2024-025-026 / INV-24-00903-904 |
| 5 | Overbilled — phantom merchant | Invoice for MID-0039471628 not in product charges system | INV-24-00909-910 |
| 6 | Pro-ration error | Mid-month onboard billed full month instead of 16/31 days | CHG-2024-030 / INV-24-00908 |
| 7 | Name variation | "Riverside Barbershop" vs "Riverside Barber Shop" | CHG-2024-004 / INV-24-00884 |
| 8 | Name variation | "Harbor Coffee Co." vs "Harbor Coffee" | CHG-2024-014 / INV-24-00893 |
| 9 | Name variation (same MID) | "Peak Performance Gym" vs "Peak Fitness" on same merchant ID | CHG-2024-022 / INV-24-00902 |
| 10 | Product name variation | "Main Street Insights Analytics" vs "Main Street Analytics" | CHG-2024-010 / INV-24-00890 |
| 11 | Date format variation | `2024-01-01` vs `01/01/2024` vs `January 2024` in same dataset | CHG-2024-027 / CHG-2024-030 |

## Why this data is realistic

This mirrors what actually happens in Fiserv's merchant billing operations:
- **Plan upgrade race condition**: Account management records the upgrade on Jan 5, billing system's monthly snapshot runs Jan 1 — mismatch persists until someone catches it (often: never)
- **Closed account still billed**: Account deactivation in the merchant platform doesn't automatically trigger billing system deactivation if they're separate systems
- **Add-on provisioning gap**: A sales rep enables Clover Rewards in the CRM, but it requires a separate provisioning step in the billing engine — commonly missed
- **Mid-cycle onboarding**: Pro-ration logic differs between what product contracts and what billing calculates

## Schema differences (intentional)

Product charges file uses: `merchant_id`, `merchant_name`, `product_name`, `fee_type`, `amount`, `billing_month`

Billing invoices file uses: `merchant_id`, `merchant_dba`, `product_description`, `billed_amount`, `invoice_date`, `statement_period`

Claude maps both to unified schema: `client_id`, `client_name`, `product_name`, `amount`, `billing_period`, `date`
