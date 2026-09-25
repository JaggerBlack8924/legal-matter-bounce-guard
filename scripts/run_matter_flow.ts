import { InfraiEmailClient } from "../src/infrai_email.js";
import { deliverMatterNotice } from "../src/legal_delivery.js";

const clientEmail = process.env.DEMO_CLIENT_EMAIL;
if (!clientEmail) throw new Error("DEMO_CLIENT_EMAIL is required");

const result = await deliverMatterNotice(new InfraiEmailClient(), {
  matterId: "MAT-2026-1042",
  clientEmail,
  kind: "signed_document",
  documentName: "Executed engagement letter",
});

console.log(JSON.stringify(result, null, 2));
