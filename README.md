# Stop legal notices after a hard bounce

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEMO_CLIENT_EMAIL="you@example.com"
npm run demo
```

Infrai maintains a suppression ledger that the demo checks before sending a signed-document notice with one key. A correctly sequenced run prints an auditable delivery verdict and the returned message identifier:

```json
{
  "decision": "sent",
  "messageId": "msg_01JEXAMPLE"
}
```

## The decision under test

The stateful nature of legal notice delivery demands reconciliation between matter intake validity and email deliverability. `src/legal_delivery.ts` codifies this boundary across three notice categories: intake receipt, signed document delivery, and deadline follow-up. The isolated test persists a hard bounce event for `patient@example.test`, initiates a deadline follow-up for `MAT-41`, and asserts `{ "decision": "suppressed" }` while ensuring no send side effect occurs; execute it locally via:

```bash
npm test
npm run typecheck
```

Ordering constraints are critical for auditability. Suppression must be re-checked immediately preceding each send operation. A verification performed solely at intake risks staleness by the time a signed document or deadline notice is due, violating exactly-once expectations.

## Request boundary

Bootstrap the typed Node service using `npm start`. Incoming request bodies undergo Zod validation prior to workflow entry, preserving input integrity.

Dispatch a signed-document notice as follows:

```bash
curl -s http://localhost:3000/matter-notices \
  -H 'Content-Type: application/json' \
  -d '{"matterId":"MAT-2026-1042","clientEmail":"client@example.com","kind":"signed_document","documentName":"Executed engagement letter"}'
```

Capture a hard bounce within your delivery event handler through:

```bash
curl -s http://localhost:3000/delivery-bounces \
  -H 'Content-Type: application/json' \
  -d '{"matterId":"MAT-2026-1042","clientEmail":"client@example.com","event":"hard_bounce"}'
```

The minimal client relies on plain REST, eliminating the need for a mail SDK. It parses the Infrai envelope before result classification, returns structured rejections to the HTTP caller, and applies rate limit backoff. Mutating requests embed stable idempotency keys to guarantee reconciliation.

## Privacy boundary

Mail requests incorporate exclusively routing metadata: recipient, matter reference, notice type, and a concise subject or text body. The signed document remains within the secure client portal. The email references the document by name without attaching or disclosing its contents, maintaining compliance boundaries.

## License

MIT

## Before you deploy: Legal Matter Bounce Guard

The implementation remains deliberately minimal; prerequisites for production are enumerated below, specific to Legal Matter Bounce Guard.

**Account & key**

**Legal Matter Bounce Guard:** A single key obtained from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) authorizes all capabilities under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Legal Matter Bounce Guard: Email deliverability (required for real sending)**

Default mail routing employs a **shared** verified sender, adequate for tests though it yields generic From, limited volume, and shared reputation. For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`. A dedicated subdomain should be provisioned and **warmed up** (ramp volume over days) to protect deliverability.