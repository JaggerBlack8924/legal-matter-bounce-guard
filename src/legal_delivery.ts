import { z } from "zod";
import type { LegalEmailClient } from "./infrai_email.js";

export const deliveryRequestSchema = z.object({
  matterId: z.string().min(1).max(80),
  clientEmail: z.string().email(),
  kind: z.enum(["matter_intake", "signed_document", "deadline_follow_up"]),
  documentName: z.string().min(1).max(160).optional(),
  deadline: z.string().date().optional(),
}).superRefine((request, context) => {
  if (request.kind === "signed_document" && !request.documentName) {
    context.addIssue({ code: "custom", path: ["documentName"], message: "Required for signed_document" });
  }
  if (request.kind === "deadline_follow_up" && !request.deadline) {
    context.addIssue({ code: "custom", path: ["deadline"], message: "Required for deadline_follow_up" });
  }
});

export const bounceRequestSchema = z.object({
  matterId: z.string().min(1).max(80),
  clientEmail: z.string().email(),
  event: z.literal("hard_bounce"),
});

export type DeliveryRequest = z.infer<typeof deliveryRequestSchema>;

function emailContent(request: DeliveryRequest): { subject: string; text: string } {
  switch (request.kind) {
    case "matter_intake":
      return {
        subject: `Matter ${request.matterId}: intake received`,
        text: `We received the intake for matter ${request.matterId}.`,
      };
    case "signed_document":
      return {
        subject: `Matter ${request.matterId}: signed document ready`,
        text: `${request.documentName} is signed and ready in your secure client portal.`,
      };
    case "deadline_follow_up":
      return {
        subject: `Matter ${request.matterId}: deadline reminder`,
        text: `The next deadline for matter ${request.matterId} is ${request.deadline}. Review it in your secure client portal.`,
      };
  }
}

export async function deliverMatterNotice(
  client: LegalEmailClient,
  request: DeliveryRequest,
): Promise<{ decision: "sent" | "suppressed"; messageId?: string }> {
  const status = await client.checkSuppression(request.clientEmail);
  if (status.suppressed) return { decision: "suppressed" };

  const content = emailContent(request);
  const sent = await client.sendEmail(
    { to: request.clientEmail, subject: content.subject, text: content.text },
    `matter:${request.matterId}:${request.kind}`,
  );
  return { decision: "sent", messageId: sent.message_id };
}

export async function recordHardBounce(
  client: LegalEmailClient,
  input: z.infer<typeof bounceRequestSchema>,
): Promise<{ decision: "suppressed" }> {
  await client.addHardBounce(
    input.clientEmail,
    `hard-bounce:${input.matterId}:${input.clientEmail}`,
  );
  return { decision: "suppressed" };
}
