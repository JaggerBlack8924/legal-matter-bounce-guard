import assert from "node:assert/strict";
import test from "node:test";
import type { LegalEmailClient, SendResult, SuppressionResult } from "../src/infrai_email.js";
import { deliverMatterNotice, recordHardBounce } from "../src/legal_delivery.js";

class MemoryEmailClient implements LegalEmailClient {
  readonly suppressed = new Set<string>();
  readonly sent: string[] = [];

  async checkSuppression(email: string): Promise<SuppressionResult> {
    return { suppressed: this.suppressed.has(email) };
  }

  async addHardBounce(email: string): Promise<unknown> {
    this.suppressed.add(email);
    return {};
  }

  async sendEmail(message: { to: string }): Promise<SendResult> {
    this.sent.push(message.to);
    return { message_id: "msg_test_1" };
  }
}

test("a hard bounce suppresses the address before deadline follow-up", async () => {
  const client = new MemoryEmailClient();
  const identity = { matterId: "MAT-41", clientEmail: "patient@example.test" };

  await recordHardBounce(client, { ...identity, event: "hard_bounce" });
  const result = await deliverMatterNotice(client, {
    ...identity,
    kind: "deadline_follow_up",
    deadline: "2026-10-15",
  });

  assert.deepEqual(result, { decision: "suppressed" });
  assert.deepEqual(client.sent, []);
});
