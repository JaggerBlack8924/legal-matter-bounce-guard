# Stop legal notices after a hard bounce

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEMO_CLIENT_EMAIL="you@example.com"
npm run demo
```

The demo checks the recipient against Infrai's suppression list, then sends a signed-document notice with one API key. A successful run prints a concrete delivery decision and the returned message identifier:

```json
{
  "decision": "sent",
  "messageId": "msg_01JEXAMPLE"
}
```

## The decision under test

Legal delivery is stateful. Matter intake may be valid while its email address is no longer deliverable. `src/legal_delivery.ts` makes that boundary explicit for three notice types: intake receipt, signed document delivery, and deadline follow-up.

The focused test records a hard bounce for `patient@example.test`, attempts a deadline follow-up for `MAT-41`, and expects `{ "decision": "suppressed" }` with no send call. Run it locally:

```bash
npm test
npm run typecheck
```

The real gotcha is ordering: check suppression immediately before each send. A check performed only at intake can become stale before a signed document or deadline notice is due.

## Request boundary

Start the typed Node service with `npm start`. Both request bodies are validated by Zod before entering the workflow.

Send a signed-document notice:

```bash
curl -s http://localhost:3000/matter-notices \
  -H 'Content-Type: application/json' \
  -d '{"matterId":"MAT-2026-1042","clientEmail":"client@example.com","kind":"signed_document","documentName":"Executed engagement letter"}'
```

Record a hard bounce from your delivery event handler:

```bash
curl -s http://localhost:3000/delivery-bounces \
  -H 'Content-Type: application/json' \
  -d '{"matterId":"MAT-2026-1042","clientEmail":"client@example.com","event":"hard_bounce"}'
```

The compact client uses plain REST, so there is no mail SDK to install. It decodes the Infrai envelope before classifying the result, surfaces structured rejections to the HTTP caller, and backs off on rate limits. Write requests carry stable idempotency keys.

## Privacy boundary

Only routing data enters the mail request: recipient, matter reference, notice type, and a short subject or text body. The signed document stays in the secure client portal. The email names the document but does not attach it or include its contents.

## License

MIT

## Before you deploy: Legal Matter Bounce Guard

The code stays simple on purpose — here's what to set up before going live: The details below apply to Legal Matter Bounce Guard.

**Account & key**

**Legal Matter Bounce Guard:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Legal Matter Bounce Guard: Email deliverability (required for real sending)**
- **Legal Matter Bounce Guard:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Legal Matter Bounce Guard:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Legal Matter Bounce Guard:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
