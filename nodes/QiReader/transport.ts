import type {
  IExecuteFunctions,
  IHttpRequestMethods,
  IDataObject,
} from "n8n-workflow";

// QiReader responses have endpoint-specific shapes and no published schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiValue = any;
import { NodeApiError, NodeOperationError, sleep } from "n8n-workflow";

export async function request(
  ctx: IExecuteFunctions,
  credential: string,
  method: IHttpRequestMethods,
  path: string,
  params: IDataObject = {},
): Promise<ApiValue> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await ctx.helpers.httpRequestWithAuthentication.call(
        ctx,
        credential,
        {
          method,
          url: `https://www.qireader.com/api${path}`,
          headers: { "x-api-version": "21.0.0", Accept: "application/json" },
          ...(method === "GET"
            ? { qs: params, arrayFormat: "repeat" as const }
            : { body: params }),
          json: true,
        },
      );
      return response?.result;
    } catch (error) {
      const e = error as ApiValue;
      const status = Number(
        e.response?.status ?? e.httpCode ?? e.cause?.response?.status,
      );
      if (status !== 429 || method !== "GET" || attempt >= 2) {
        if (error instanceof NodeApiError || error instanceof NodeOperationError) {
          // Preserve response status and headers from the request helper.
          // eslint-disable-next-line @n8n/community-nodes/require-node-api-error
          throw error;
        }
        throw new NodeOperationError(ctx.getNode(), error as Error);
      }
      const headers = e.response?.headers ?? e.cause?.response?.headers ?? {};
      const retry = headers["retry-after"];
      const reset = headers["x-ratelimit-reset"];
      const delay = retry
        ? Number.isFinite(Number(retry))
          ? Number(retry) * 1000
          : Date.parse(String(retry)) - Date.now()
        : reset
          ? Number(reset) * 1000 - Date.now()
          : NaN;
      if (!Number.isFinite(delay) || delay < 0 || delay > 30000) {
        if (error instanceof NodeApiError || error instanceof NodeOperationError) {
          // eslint-disable-next-line @n8n/community-nodes/require-node-api-error
          throw error;
        }
        throw new NodeOperationError(ctx.getNode(), error as Error);
      }
      await sleep(delay);
    }
  }
}
export async function articles(
  ctx: IExecuteFunctions,
  credential: string,
  stream: string,
  order: number,
  unreadOnly: boolean,
  limit: number,
): Promise<IDataObject[]> {
  const entries: IDataObject[] = [];
  let cursor: string | undefined;
  while (entries.length < limit) {
    const query: IDataObject = {
      articleOrder: order,
      unreadOnly,
      count: Math.min(100, limit - entries.length),
    };
    if (cursor) query[order === 0 ? "olderThan" : "newerThan"] = cursor;
    const page = await request(
      ctx,
      credential,
      "GET",
      `/streams/${encodeURIComponent(stream)}`,
      query,
    );
    if (!page || !Array.isArray(page.entries))
      throw new NodeOperationError(
        ctx.getNode(),
        "Invalid article stream response",
      );
    entries.push(...page.entries);
    if (!page.hasMore || entries.length >= limit) break;
    const next = page.entries.at(-1)?.timestamp;
    if (typeof next !== "string" || !next || next === cursor)
      throw new NodeOperationError(
        ctx.getNode(),
        "Article pagination did not advance",
      );
    cursor = next;
  }
  return entries;
}
