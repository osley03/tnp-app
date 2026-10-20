Manual direct wallet/bank payments are now the primary flow. See MANUAL-PAYMENTS.md for receiving details, private proof, landlord confirmation and admin exports. The hosted checkout steps below describe the optional Paynow upgrade.

# TNP rental payments

## Tenant steps

1. Open Find a property in the tenant dashboard and send an application.
2. The owning landlord approves it. TNP creates the linked rental record, an initial rent request and a deposit request when the saved deposit is greater than zero. When no move-in date was given, the initial rent request is due on its creation date. This does not activate a lease, sign a document or record a payment.
3. Use Open payments on the dashboard, Pay rent / deposit on the approved application, or Payments & Receipts in the sidebar.
4. In Ready to pay, choose Rent or Deposit for the correct property. The checkout selector names the property, charge and rent month.
5. Click EcoCash or Mastercard to open its payment portal. Review the property/charge, full amount, reference and method-specific requirements. Continue to the landlord's secure Paynow checkout when their merchant connection is enabled; choose the final method on Paynow and complete its approval instructions there.
6. Returning from checkout opens the portal and automatically asks the server to verify the provider result once. Returning alone is not payment confirmation. If it is pending, use Check provider status again later. A verified live payment updates history and makes its verification record available below; test transactions never mark real rent paid.

The administrator no longer has to activate the lease before the initial rent or deposit can be paid. Lease activation remains a separate step. An active rental also lets tenants prepare a later rent month. TNP reuses an existing request for the same month and prevents the tenant from lowering the saved rent or deposit amount. Agreed utilities, late fees and other charges remain available for active rentals. Application fees are excluded.

## Landlord payments

The landlord dashboard Payments card opens Payments received directly. Older escrow records remain available under an explicitly labelled legacy sidebar entry. Payments received shows total recorded paid/released amounts, current-month totals, requests awaiting payment and overdue requests. The history identifies the property, tenant, charge, rent month, amount, due date, date paid, status and request reference. Filter by rental, payment status and paid-date range; history is paginated in groups of 25. Provider receipt cards include the same rental payment reference so the record can be traced to the ledger.

Older records without a saved rent period or payment timestamp are labelled Period not recorded or Not recorded. Creating a request never fills in Date paid. Test provider records are clearly marked and do not mark a real rent payment paid.

## Merchant setup

EcoCash and Mastercard are presented through Paynow. They do not constitute two separately configured merchant systems. Each receiving landlord needs their own USD Paynow merchant integration configured securely by TNP administration in PAYNOW_LANDLORD_MERCHANTS. PAYMENT_GATEWAY_ENABLED and, for live transactions, PAYNOW_LIVE_ENABLED must be enabled after configuration. No merchant secrets belong in property forms or browser environment files.

The UI shows both methods even before an application is approved. Checkout stays disabled when the landlord is not connected. TNP does not hold these direct payments in escrow. Provider confirmation and subsequent merchant bank/wallet settlement are different stages.

The payment portal explains whether the landlord has no merchant connection or has a connection that is not enabled. These states cannot be resolved by entering card or wallet credentials in TNP. TNP never collects card numbers, CVVs or EcoCash PINs. Provider fees, supported methods and the final total must be reviewed on the provider page. Browser checkout tests simulate the provider redirect and verified return for both methods; they do not charge a live account or certify merchant acceptance.

## Other fixes

Find a property in the tenant header now opens /app/tenant/properties. The shared add/edit property dialog is rendered at the document viewport, aligned near the top, so dashboard styling cannot push it down the page. Labels use navy text, and labels are linked to their input controls.

## Verification

The migrations are 20261016170000_tnp_approval_to_payment.sql and 20261016171000_tnp_initial_rent_due_date.sql. Local tests cover approval-created invoices, paid dates, duplicate months, exact rent amounts, payment ownership, prevention of overlapping approvals, monthly continuation after activation and provider-verified initial payment before activation. Browser tests use isolated synthetic records; real payment processing requires merchant credentials and was not charged during these checks.

Both approval-to-payment migrations were deployed to the linked Supabase project kjtkwujuevbzcydbjscq in the earlier setup. Earlier browser reports are historical. Current review results are recorded in current-workflow-verification.json and WORKFLOW-REVIEW.md; no real provider transaction or merchant activation is claimed.
