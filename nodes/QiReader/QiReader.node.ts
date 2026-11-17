import {
  NodeConnectionTypes,
  NodeApiError,
  NodeOperationError,
  type IDataObject,
  type IExecuteFunctions,
  type INodeExecutionData,
  type INodeType,
  type INodeTypeDescription,
} from "n8n-workflow";
import { properties } from "./properties";
import { articles, request } from "./transport";
import { categoriesWithSubscriptions, subscriptionsWithCategories } from "./subscriptions";

// QiReader responses have endpoint-specific shapes and no published schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiValue = any;

export class QiReader implements INodeType {
  description: INodeTypeDescription = {
    displayName: "QiReader",
    name: "qiReader",
    icon: { light: "file:qireader.svg", dark: "file:qireader.svg" },
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    group: ["transform"],
    version: 1,
    description: "Manage QiReader feeds and articles",
    defaults: { name: "QiReader" },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: "qiReaderApi",
        required: true,
        displayOptions: { show: { authentication: ["account"] } },
      },
      {
        name: "qiReaderCookieApi",
        required: true,
        displayOptions: { show: { authentication: ["cookie"] } },
      },
    ],
    properties,
    usableAsTool: true,
  };
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const output: INodeExecutionData[] = [];
    for (let i = 0; i < this.getInputData().length; i++) {
      try {
        const get = (key: string, fallback?: ApiValue): ApiValue =>
          this.getNodeParameter(key, i, fallback);
        const res = get("resource") as string,
          op = get("operation") as string;
        const credential =
          get("authentication") === "account"
            ? "qiReaderApi"
            : "qiReaderCookieApi";
        const call = (method: ApiValue, path: string, params: IDataObject = {}) =>
          request(this, credential, method, path, params);
        const id = (key: string) => encodeURIComponent(String(get(key)));
        const ids = () =>
          String(get("articleIds"))
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
        const limit = () =>
          get("returnAll", false) ? Infinity : Number(get("limit", 50));
        let result: ApiValue;
        const getStream = async () => {
          const type = String(get("streamType"));
          if (type !== "all") return `${type}-${get("streamId")}`;
          const snapshot = await call("GET", "/subscriptions");
          const all = snapshot.categories.find((x: ApiValue) => x.label === "!all");
          if (!all)
            throw new NodeOperationError(
              this.getNode(),
              "The All Articles folder was not found",
            );
          return `category-${all.id}`;
        };
        if (res === "article") {
          if (op === "getMany") {
            const stream = await getStream();
            result = await articles(
              this,
              credential,
              stream,
              Number(get("order")),
              Boolean(get("unreadOnly")),
              limit(),
            );
            if (get("includeContent", false) && result.length) {
              for (let start = 0; start < result.length; start += 100) {
                const page = result.slice(start, start + 100);
                const contents = await call("GET", "/entry-contents", {
                  streamId: stream,
                  entryIds: page.map((x: IDataObject) => x.id),
                });
                if (!Array.isArray(contents))
                  throw new NodeOperationError(
                    this.getNode(),
                    "Invalid article content response",
                  );
                const byId = new Map(
                  contents.map((x: ApiValue) => [x.id, x.content]),
                );
                for (const article of page)
                  if (byId.has(article.id))
                    article.content = byId.get(article.id);
              }
            }
          } else if (op === "get") {
            const stream = await getStream();
            result = await call("GET", `/entry/${id("articleId")}`, {
              streamId: stream,
            });
            if (get("includeContent", false)) {
              const content = await call("GET", "/entry-contents", {
                streamId: stream,
                entryIds: [get("articleId")],
              });
              if (Array.isArray(content)) {
                const found = content.find(
                  (x: ApiValue) => x.id === get("articleId"),
                );
                if (found) result.content = found.content;
              }
            }
          } else if (op === "content")
            result = await call("GET", "/entry-contents", {
              streamId: await getStream(),
              entryIds: ids(),
            });
          else if (op === "markRead") {
            const scope = get("markScope");
            const data: IDataObject = scope === "entries" ? {type:scope,entryIds:ids()} : scope === "subscription" ? {type:scope,subscriptionId:get("markSubscriptionId"),asOf:get("asOf")} : {type:scope,categoryId:get("markFolderId"),asOf:get("asOf")};
            await call("PUT", "/markers/reads", data);
            result = { success: true, ...data };
          } else if (op === "markUnread") {
            await call("PUT", "/markers/unread", { entryId: get("articleId") });
            result = { success: true, articleId: get("articleId") };
          } else {
            const entryId = get("articleId"),
              tagId = get("tagId"),
              entryType = get("entryType");
            const path =
              op === "addTag"
                ? `/entries/${id("articleId")}/tags/${id("tagId")}`
                : `/entries/${encodeURIComponent(entryType)}/${id("articleId")}/tags/${id("tagId")}`;
            await call(op === "addTag" ? "PUT" : "DELETE", path, {
              entryId,
              tagId,
              entryType,
            });
            result = { success: true, articleId: entryId, tagId };
          }
        } else if (res === "subscription") {
          if (op === "getMany")
            result = subscriptionsWithCategories(await call("GET", "/subscriptions")).slice(0, limit());
          else if (op === "getSnapshot") result = await call("GET", "/subscriptions");
          else if (op === "unreadCounts")
            result = (await call("GET", "/markers/unread/counts")).unreadCounts;
          else if (op === "create")
            result = await call("POST", "/subscriptions", {
              [get("addBy")]: get("feedInput"),
            });
          else {
            const subscriptionId = get("subscriptionId");
            const r = await call(
              op === "update" ? "POST" : "DELETE",
              `/subscriptions/${id("subscriptionId")}`,
              op === "update"
                ? { subscriptionId, title: get("title") }
                : { subscriptionId },
            );
            result = r ?? { success: true, subscriptionId };
          }
        } else if (res === "folder" || res === "tag") {
          const plural = res === "folder" ? "categories" : "tags",
            key = res === "folder" ? "categoryId" : "tagId",
            param = res === "folder" ? "folderId" : "tagId";
          if (op === "getMany") {
            const snapshot = await call(
              "GET",
              res === "folder" ? "/subscriptions" : "/tags",
            );
            result = (res === "folder" ? categoriesWithSubscriptions(snapshot) : snapshot.tags).slice(0, limit());
          } else if (op === "create")
            result = await call("POST", `/${plural}`, { label: get("label") });
          else if (
            res === "folder" &&
            ["addSubscription", "removeSubscription"].includes(op)
          ) {
            const categoryId = get("folderId"),
              subscriptionId = get("subscriptionId");
            await call(
              op === "addSubscription" ? "PUT" : "DELETE",
              `/categories/${id("folderId")}/subscriptions/${id("subscriptionId")}`,
              { categoryId, subscriptionId },
            );
            result = { success: true, categoryId, subscriptionId };
          } else {
            const identifier = get(param);
            const data: IDataObject = { [key]: identifier };
            if (op === "update") data.label = get("label");
            const r = await call(
              op === "update" ? "PUT" : "DELETE",
              `/${plural}/${id(param)}`,
              data,
            );
            result = r ?? { success: true, [key]: identifier };
          }
        } else if (res === "feed") {
          if (op === "get")
            result = await call("GET", `/feeds/${id("feedId")}`);
          else if (op === "state")
            result = await call("GET", "/feed-state", { id: get("feedId") });
          else if (op === "states")
            result = (await call("GET", "/feed-basic-states")).feedStates;
          else if (op === "tags") {
            const q: IDataObject = {};
            if (get("language")) q.language = get("language");
            if (get("lastUpdateDays")) q.lastUpdateDays = get("lastUpdateDays");
            result = await call("GET", "/feed-tags", q);
          } else {
            result = [];
            let startIndex = 0;
            const max = limit();
            for (;;) {
              const q: IDataObject = {
                query: get("query"),
                startIndex,
                limit: Math.min(50, max - startIndex),
              };
              if (get("language")) q.language = get("language");
              if (get("lastUpdateDays"))
                q.lastUpdateDays = get("lastUpdateDays");
              const page = await call("GET", "/search", q);
              if (Array.isArray(page.links)) {
                result.push(
                  ...page.links.map((x: ApiValue) => ({
                    type: "link",
                    ...(typeof x === "object" ? x : { url: x }),
                  })),
                );
                break;
              }
              const feeds = page.feeds ?? [];
              result.push(...feeds.map((x: ApiValue) => ({ type: "feed", ...x })));
              startIndex += feeds.length;
              if (!page.hasNextPage || !feeds.length || result.length >= max)
                break;
            }
            result = result.slice(0, max);
          }
        } else if (res === "preference") {
          if (op === "get") result = await call("GET", "/preferences");
          else if (op === "pin" || op === "unpin") {
            await call(
              op === "pin" ? "PUT" : "DELETE",
              `/preferences/pinned-items/${id("streamId")}`,
              { itemId: get("streamId") },
            );
            result = { success: true, streamId: get("streamId") };
          } else {
            const scope = get("scope"),
              values = JSON.parse(String(get("preferences")));
            if (!values || Array.isArray(values) || typeof values !== "object")
              throw new NodeOperationError(
                this.getNode(),
                "Preferences must be a JSON object",
              );
            const key =
              scope === "global"
                ? "globalPreferences"
                : scope === "subscriptions"
                  ? "subscriptionPreferences"
                  : scope === "categories"
                    ? "categoryPreferences"
                    : "tagPreferences";
            const identity =
              scope === "subscriptions"
                ? "subscriptionId"
                : scope === "categories"
                  ? "categoryId"
                  : "tagId";
            const body: IDataObject = { [key]: values };
            if (scope !== "global") body[identity] = get("scopeId");
            await call(
              "PUT",
              `/preferences/${scope}${scope === "global" ? "" : `/${id("scopeId")}`}`,
              body,
            );
            result = { success: true, scope };
          }
        } else if (res === "opml") {
          if (op === "export") {
            const data = await call("GET", "/subscriptions");
            const escape = (v: unknown) =>
              String(v ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&apos;");
            const line = (sub: ApiValue) =>
              `<outline text="${escape(sub.title)}" title="${escape(sub.title)}" type="rss" xmlUrl="${escape(sub.feedUrl)}"${sub.homePageUrl ? ` htmlUrl="${escape(sub.homePageUrl)}"` : ""}/>`;
            const regular = data.categories.filter(
              (c: ApiValue) => c.label !== "!all",
            );
            const assigned = new Set<string>();
            const groups = regular.map((c: ApiValue) => {
              const relations = data.subscriptionCategories.filter(
                (x: ApiValue) => x.categoryId === c.id,
              );
              const subs = relations
                .map((x: ApiValue) =>
                  data.subscriptions.find(
                    (y: ApiValue) => y.id === x.subscriptionId,
                  ),
                )
                .filter(Boolean);
              for (const sub of subs) assigned.add(sub.id);
              return `<outline text="${escape(c.label)}" title="${escape(c.label)}">${subs.map(line).join("")}</outline>`;
            });
            const xml = `<?xml version="1.0" encoding="UTF-8"?><opml version="2.0"><head><title>QiReader subscriptions</title></head><body>${groups.join("")}${data.subscriptions
              .filter((x: ApiValue) => !assigned.has(x.id))
              .map(line)
              .join("")}</body></opml>`;
            const binary = await this.helpers.prepareBinaryData(
              Buffer.from(xml),
              "qireader.opml",
              "text/x-opml",
            );
            output.push({
              json: { success: true },
              binary: { data: binary },
              pairedItem: { item: i },
            });
            continue;
          }
          const xml =
            get("opmlInput") === "binary"
              ? (
                  await this.helpers.getBinaryDataBuffer(
                    i,
                    get("binaryProperty"),
                  )
                ).toString("utf8")
              : get("opml");
          const parsed = await call("POST", "/opml", { opml: xml });
          if (!parsed || !Array.isArray(parsed.items))
            throw new NodeOperationError(
              this.getNode(),
              "Invalid OPML response",
            );
          if (op === "parse") result = parsed.items;
          else {
            const snapshot = await call("GET", "/subscriptions");
            const folders = new Map<string, string>(
              snapshot.categories.map((x: ApiValue) => [x.label, x.id]),
            );
            result = [];
            for (const entry of parsed.items) {
              try {
                const added = await call("POST", "/subscriptions", {
                  feedUrl: entry.url,
                });
                const subscriptionId = added.subscription.id;
                const categoryIds = [];
                for (const label of entry.categories ?? []) {
                  let categoryId = folders.get(label);
                  if (!categoryId) {
                    const created = await call("POST", "/categories", {
                      label,
                    });
                    categoryId = created.id;
                    folders.set(label, categoryId!);
                  }
                  await call(
                    "PUT",
                    `/categories/${encodeURIComponent(categoryId!)}/subscriptions/${encodeURIComponent(subscriptionId)}`,
                    { categoryId, subscriptionId },
                  );
                  categoryIds.push(categoryId);
                }
                result.push({
                  url: entry.url,
                  success: true,
                  subscriptionId,
                  categoryIds,
                });
              } catch (error) {
                result.push({
                  url: entry.url,
                  success: false,
                  error: (error as Error).message,
                });
              }
            }
          }
        } else
          throw new NodeOperationError(this.getNode(), "Unsupported operation");
        for (const item of Array.isArray(result) ? result : [result]) {
          if (!item || typeof item !== "object")
            throw new NodeOperationError(
              this.getNode(),
              "Invalid QiReader response",
            );
          output.push({ json: item, pairedItem: { item: i } });
        }
      } catch (e) {
        if (!this.continueOnFail()) {
          if (e instanceof NodeApiError || e instanceof NodeOperationError) {
            // Preserve the original API error details.
            // eslint-disable-next-line @n8n/community-nodes/require-node-api-error
            throw e;
          }
          throw new NodeOperationError(this.getNode(), e as Error, { itemIndex: i });
        }
        output.push({
          json: { error: (e as Error).message },
          pairedItem: { item: i },
        });
      }
    }
    return [output];
  }
}
