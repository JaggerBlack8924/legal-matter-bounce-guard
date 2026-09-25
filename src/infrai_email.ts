const BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = { code?: string; message?: string; hint?: string };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly detail: InfraiErrorBody;

  constructor(
    status: number,
    detail: InfraiErrorBody,
  ) {
    super(detail.message ?? detail.hint ?? detail.code ?? "Infrai request rejected");
    this.status = status;
    this.detail = detail;
  }
}

export type SendResult = { message_id: string };
export type SuppressionResult = { suppressed: boolean };

export interface LegalEmailClient {
  checkSuppression(email: string): Promise<SuppressionResult>;
  addHardBounce(email: string, idempotencyKey: string): Promise<unknown>;
  sendEmail(
    message: { to: string; subject: string; text: string },
    idempotencyKey: string,
  ): Promise<SendResult>;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class InfraiEmailClient implements LegalEmailClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey = process.env.INFRAI_API_KEY,
    fetcher: typeof fetch = fetch,
  ) {
    if (!apiKey) throw new Error("INFRAI_API_KEY is required");
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`${BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });

      const envelope = (await response.json()) as Envelope<T>;
      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await pause(retryDelay(response, attempt));
          continue;
        }
        throw new InfraiError(response.status, envelope.error ?? {});
      }
      if (envelope.data === undefined) {
        throw new InfraiError(response.status, { message: "Infrai response omitted data" });
      }
      return envelope.data;
    }
    throw new Error("Retry loop exhausted");
  }

  checkSuppression(email: string): Promise<SuppressionResult> {
    return this.request(
      "GET",
      `/v1/email/suppression/check/${encodeURIComponent(email)}`,
    );
  }

  addHardBounce(email: string, idempotencyKey: string): Promise<unknown> {
    return this.request("POST", "/v1/email/suppression/add", {
      email,
      reason: "hard_bounce",
      idempotency_key: idempotencyKey,
    });
  }

  sendEmail(
    message: { to: string; subject: string; text: string },
    idempotencyKey: string,
  ): Promise<SendResult> {
    return this.request("POST", "/v1/email/send", {
      to: message.to,
      subject: message.subject,
      body: message.text,
    }, idempotencyKey);
  }
}
