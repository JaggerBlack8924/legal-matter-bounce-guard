import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError, type ZodType } from "zod";
import { InfraiEmailClient, InfraiError } from "./infrai_email.js";
import {
  bounceRequestSchema,
  deliverMatterNotice,
  deliveryRequestSchema,
  recordHardBounce,
} from "./legal_delivery.js";

const client = new InfraiEmailClient();

async function readValidated<T>(request: IncomingMessage, schema: ZodType<T>): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return schema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/matter-notices") {
      const input = await readValidated(request, deliveryRequestSchema);
      json(response, 200, await deliverMatterNotice(client, input));
      return;
    }
    if (request.method === "POST" && request.url === "/delivery-bounces") {
      const input = await readValidated(request, bounceRequestSchema);
      json(response, 200, await recordHardBounce(client, input));
      return;
    }
    json(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "Invalid request body" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.detail });
      return;
    }
    json(response, 500, { error: "Request failed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Legal delivery service listening on ${port}`));
