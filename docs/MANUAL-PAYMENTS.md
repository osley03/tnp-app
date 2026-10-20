# Direct landlord payments and payment evidence

The current TNP app uses manual wallet/bank payments as the primary flow. TNP never receives or holds money. Paynow remains an optional hosted checkout upgrade that requires a receiving landlord's merchant connection. No merchant credentials are needed for manual payments.

## Landlord

Open Payments received, then Your receiving details. Save the USD account-holder name, wallet/account number, institution/branch and instructions for EcoCash, OneMoney, InnBucks or bank transfer. Each save creates an immutable new version; disabling a method creates a disabled version. Tenants with an approved rental can retrieve current enabled details. Older versions remain available to the landlord/admin and in existing payment snapshots.

Open Manual payment evidence & confirmations. Inspect the reference, reported amount/date, recipient snapshot and private receipt. Verify your own wallet/bank statement before confirming. Confirmation or dispute is a locked decision; a dispute needs a reason. A tenant may submit a new corrected proof after a dispute, preserving the original. Amount mismatches are flagged and cannot settle the request. Partial-payment allocation is not included; agree a corrected charge instead of confirming an unmatched amount.

## Tenant

After approval creates the rent/deposit requests, choose the approved charge under Pay rent directly to your landlord. Check the recipient and USD account, pay using your wallet/bank app and the unique TNP reference, then enter the actual amount/date, provider transaction reference and a screenshot. Do not include PINs, passwords, card security details or unrelated transactions. TNP does not initiate that external transfer. A submitted screenshot is a claim, not proof of receipt. Await landlord review; do not pay again while it is pending.

The screenshot is prepared as a private JPEG with metadata removed. Its SHA-256 fingerprint is saved with the report. A stored receipt must match this fingerprint when viewed. The original account-details snapshot stays attached even if the landlord later changes details; a change before submission is flagged. A reference reused for a different invoice is rejected. Manual and gateway attempts cannot be mixed on the same invoice after submission.

## Admin and exports

Open Payments → Manual payment evidence & confirmations. Filter a lease using its ID, or resolve a dispute ID to its linked lease. Read all submissions and decisions, and view private receipts. Export CSV & check chain downloads the full lease event trail, including account snapshots and proof/decision references. Print / save PDF opens a printable report with receipt images that match their stored fingerprints; use the browser's Save as PDF option. Missing/mismatched images are labelled for investigation. CSV contains the evidence metadata, not embedded image files.

Events are hash-linked per lease and records are append-only through application/database permissions and triggers. Confirmed invoice amounts/status/date cannot be edited or deleted through normal app workflows. Exported chain heads provide a separate comparison record. This does not make a tenant screenshot genuine, confirm bank settlement or prevent a database/storage owner from bypassing permissions and recomputing data. Keep exports and compare provider references against the recipient's actual statements.

## Supabase setup

The new migration is 20261019120000_tnp_manual_payment_trail.sql. It adds destination versions, submissions, decisions, chained events, private receipt storage and authenticated RPCs. Apply it to the current linked project from the existing tnp-app folder:

    npx supabase db push

No new Supabase project, account promotion, merchant key or Paynow activation is required. The new database objects must exist before the screens can work. Deployment status and test results are recorded in the current workflow review; the presence of this guide alone does not mean the migration was deployed. No real transfer was made during implementation.

## 360° capture

Open the property form or Tour Library's capture guide. Use one full spherical room photo per room; a 2:1 ordinary crop is insufficient. The local checker lets you look around the image without uploading it. Connect doorway arrows and return paths, preview the walkthrough, publish/select it and save the property. TNP prepares uploads at up to 4096 × 2048 JPEG for mobile loading and retains suitable small JPEGs. It does not capture/stitch a full sphere with an ordinary phone camera. A suitable 360 camera, capture service or full-sphere capture tool must produce the source image.
