# EcoCash and Mastercard: direct landlord payments

This integration uses Paynow's hosted checkout. Every landlord needs their own USD Paynow merchant integration. TNP does not route funds through its own account or hold them in escrow. The currency of the actual Paynow integration must be verified with Paynow: this application currently records USD only and does not perform currency conversion.

Tenants create a lease-linked payment request for rent, deposit, utilities, late fees or another lease charge. Application fees are excluded. The server checks ownership, approved or active rental eligibility, recipient, saved amount and currency. EcoCash/Mastercard is a checkout preference; the final instrument is selected on Paynow. No card number, CVV, EcoCash PIN or recurring card token is collected by TNP.

## Deployment

1. Apply the new migration with `npx supabase db push`. Do not edit already applied migrations.
2. Configure the secrets below in Supabase Edge Function secrets. Do not put integration keys in frontend `.env`, profile fields, source code or chat. Use a private local secret file if deploying with the CLI; keep it outside the project and version control.
3. Deploy with `npx supabase functions deploy payment-gateway`. `verify_jwt=false` is intentional for signed Paynow callbacks. Checkout and tenant status requests verify their bearer token inside the function. The callback validates Paynow's signature and then polls the saved provider URL before recording confirmation.
4. Register each landlord's own Paynow integration. Configure only the agreed payment methods. Paynow must approve live receiving; do not substitute TNP's integration for a missing landlord configuration.
5. Run Paynow sandbox/test transactions before live activation. Localhost is acceptable for a browser return during local tests, but callbacks run on the public Supabase function URL.

Required server secrets:

```text
TNP_APP_URL=http://localhost:3000
PAYMENT_GATEWAY_ENABLED=false
PAYNOW_LIVE_ENABLED=false
PAYNOW_LANDLORD_MERCHANTS={}
```

Replace the merchant mapping with this structure, using the landlord's actual Auth user UUID as the key:

```json
{
  "LANDLORD_AUTH_USER_UUID": {
    "integrationId": "LANDLORD_PAYNOW_INTEGRATION_ID",
    "integrationKey": "LANDLORD_SECRET_INTEGRATION_KEY",
    "currency": "USD",
    "mode": "test",
    "testEmail": "LANDLORD_PAYNOW_MERCHANT_LOGIN_EMAIL"
  }
}
```

The placeholders are not working credentials. `mode=test` must correspond to an integration actually in Paynow test mode; it cannot turn a live Paynow integration into a sandbox. Only the merchant's test login can complete Paynow test checkout. Set `PAYMENT_GATEWAY_ENABLED=true` after sandbox configuration is ready. For live operation, confirm Paynow has activated the landlord's integration, update that mapping to `mode=live`, and explicitly enable `PAYNOW_LIVE_ENABLED=true`. Never enable live credentials merely to test the interface.

Automatic Supabase secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are used only inside the function. On hosting, update `TNP_APP_URL` to the HTTPS application origin. Keep historic merchant credentials available for pending transactions; changing integration ID/mode blocks verification of an old attempt rather than attributing it to a different merchant.

## Live setup on the current TNP app

Create a private file outside the project, for example C:/Users/SM333.DESKTOP-CLFNA3T/.tnp-payments.env. Include only the four payment settings above. Use the complete merchant mapping, including existing landlords; uploading it replaces the previous mapping. Never send this file or its keys in chat. The public TNP address must use HTTPS for live merchants. Localhost is accepted for test merchants only.

After Paynow approves each landlord's USD integration for EcoCash and Mastercard, use mode=live for that landlord, the public HTTPS TNP_APP_URL, and both enable flags set to true. Check the file locally first:

```cmd
npm run payments:check-config -- "C:\Users\SM333.DESKTOP-CLFNA3T\.tnp-payments.env"
npx supabase secrets set --env-file "C:\Users\SM333.DESKTOP-CLFNA3T\.tnp-payments.env" --project-ref kjtkwujuevbzcydbjscq
npx supabase functions deploy payment-gateway --project-ref kjtkwujuevbzcydbjscq
npm run payments:check-service
```

Run the upload/deployment commands only after the configuration check succeeds. The validator never prints or uploads secrets. It checks structure, distinct merchant integrations, USD currency, flags and return address; it cannot establish Paynow approval or confirm that an integration belongs to the intended landlord. Verify each UUID against the landlord's Auth account before uploading. The service check verifies anonymous-access denial, not a payment.

Before release, complete a consented low-value live payment through each enabled method with the receiving landlord, then confirm the tenant receipt, landlord payment history, admin record, amount, provider reference and callback result match. Confirm settlement separately in the landlord's merchant account. No live transaction is performed by setup commands. Pausing checkout does not disable verification of an existing attempt.

## Evidence and dispute handling

Tenant, receiving landlord and administrator can read provider evidence. Each record contains the amount/currency, tenant/landlord IDs, lease/payment IDs, merchant integration ID, Paynow reference, TNP reference, provider status, verification timestamp and signed-response fingerprint. Records can be downloaded as text for reference and compared with the canonical app/provider record.

Evidence is append-only through application/database permissions and triggers. This is not a claim that a database owner cannot modify the database, or that a downloaded text file cannot be edited. The provider reference and the canonical record are the basis for reconciliation. No secret keys, raw callback bodies, card data or polling URLs appear in participant receipts.

Paynow `Paid` means the provider accepted payment and merchant settlement follows Paynow's terms. `Awaiting Delivery`/`Delivered` can involve provider suspense. These states do not prove that funds have already arrived in a landlord's bank or wallet. TNP displays this distinction; it creates no escrow hold/release entries for direct gateway payments.

Test-mode confirmations are visibly marked TEST, never count as paid rent, and do not update the live lease-payment status. A browser redirect or a tenant assertion is never proof of payment. Duplicate callbacks do not create duplicate evidence or audit entries. Pending notifications cannot regress paid records, and a confirmed refund cannot be undone by a stale paid notification. Admin manual status changes cannot overwrite gateway-managed payments.

## Reconciliation and limitations

One checkout attempt per payment request per mode prevents repeated clicks, retries and concurrent requests from starting multiple provider charges. Returning to an existing pending checkout resumes the same URL. An initiation timeout deliberately does not start another transaction: check Paynow using the TNP reference/merchant trace and resolve with support. Do not create another request just to retry an uncertain charge.

Callbacks and the tenant's Check provider status action reconcile payments. Scheduled background reconciliation, automatic refunds, recurring billing, split payouts and self-service merchant onboarding are not included. Refund/dispute evidence is recorded when the provider reports it; TNP does not initiate refunds. Changing secret storage to a dedicated merchant onboarding system is advisable before onboarding landlords at large scale.

PayPal is not included in this version, as requested. Paynow's live merchant approval, fees, USD settlement and EcoCash/card availability must be confirmed for each landlord before accepting real money. No merchant credentials were supplied or provider transactions executed during implementation.

## Reference documentation

- https://developers.paynow.co.zw/docs/paynow/initiate_transaction/
- https://developers.paynow.co.zw/docs/paynow/generating_hash/
- https://developers.paynow.co.zw/docs/paynow/validating_hash/
- https://developers.paynow.co.zw/docs/paynow/status_update/
- https://developers.paynow.co.zw/docs/paynow/test_mode/
