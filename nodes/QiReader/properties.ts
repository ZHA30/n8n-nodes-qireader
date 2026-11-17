import type { INodeProperties } from "n8n-workflow";

const operations: Record<string, Array<[string, string]>> = {
  article: [
    ["Get Many", "getMany"],
    ["Get", "get"],
    ["Get Content", "content"],
    ["Mark Read", "markRead"],
    ["Mark Unread", "markUnread"],
    ["Add Tag", "addTag"],
    ["Remove Tag", "removeTag"],
  ],
  subscription: [
    ["Get Many", "getMany"],
    ["Get Snapshot", "getSnapshot"],
    ["Create", "create"],
    ["Update", "update"],
    ["Delete", "delete"],
    ["Get Unread Counts", "unreadCounts"],
  ],
  folder: [
    ["Get Many", "getMany"],
    ["Create", "create"],
    ["Update", "update"],
    ["Delete", "delete"],
    ["Add Subscription", "addSubscription"],
    ["Remove Subscription", "removeSubscription"],
  ],
  tag: [
    ["Get Many", "getMany"],
    ["Create", "create"],
    ["Update", "update"],
    ["Delete", "delete"],
  ],
  feed: [
    ["Search", "search"],
    ["Get", "get"],
    ["Get State", "state"],
    ["Get Many States", "states"],
    ["Get Tags", "tags"],
  ],
  preference: [
    ["Get", "get"],
    ["Update", "update"],
    ["Pin", "pin"],
    ["Unpin", "unpin"],
  ],
  opml: [
    ["Parse", "parse"],
    ["Import", "import"],
    ["Export", "export"],
  ],
};
const props: INodeProperties[] = [
  {
    displayName: "Authentication",
    name: "authentication",
    type: "options",
    options: [
      { name: "Email and Password", value: "account" },
      { name: "Cookie", value: "cookie" },
    ],
    default: "account",
  },
  {
    displayName: "Resource",
    name: "resource",
    type: "options",
				noDataExpression: true,
    options: Object.keys(operations).map((v) => ({
      name: v === "opml" ? "OPML" : v[0].toUpperCase() + v.slice(1),
      value: v,
    })),
    default: "article",
  },
];
for (const [resource, choices] of Object.entries(operations))
  // The default is selected from the resource-specific options below.
  // eslint-disable-next-line n8n-nodes-base/node-param-default-missing
  props.push({
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    displayOptions: { show: { resource: [resource] } },
    options: choices.map(([name, value]) => ({
      name,
      value,
      action: `${name} ${resource}`,
    })),
    default: choices[0][1],
  });
function field(
  displayName: string,
  name: string,
  show: Record<string, string[]>,
  extra: Partial<INodeProperties> = {},
) {
  props.push({
    displayName,
    name,
    type: "string",
    default: "",
    required: true,
    displayOptions: { show },
    ...extra,
  });
}
props.push({
  displayName: "Stream",
  name: "streamType",
  type: "options",
  options: [
    { name: "All Articles", value: "all" },
    { name: "Feed", value: "feed" },
    { name: "Folder", value: "category" },
    { name: "Subscription", value: "subscription" },
    { name: "Tag", value: "tag" },
  ],
  default: "all",
  displayOptions: {
    show: { resource: ["article"], operation: ["getMany", "get", "content"] },
  },
});
field(
  "Stream Object ID",
  "streamId",
  {
    resource: ["article"],
    operation: ["getMany", "get", "content"],
    streamType: ["subscription", "category", "tag", "feed"],
  },
  { description: "ID of the selected subscription, folder, tag, or feed" },
);
props.push({ displayName: "Mark", name: "markScope", type: "options", options: [{name:"Articles",value:"entries"},{name:"Folder",value:"category"},{name:"Subscription",value:"subscription"}], default:"entries", displayOptions:{show:{resource:["article"],operation:["markRead"]}} });
field("Article IDs", "articleIds", {resource:["article"],operation:["markRead"],markScope:["entries"]}, {description:"Comma-separated article IDs"});
field("Subscription ID", "markSubscriptionId", {resource:["article"],operation:["markRead"],markScope:["subscription"]});
field("Folder ID", "markFolderId", {resource:["article"],operation:["markRead"],markScope:["category"]});
field("As Of", "asOf", {resource:["article"],operation:["markRead"],markScope:["subscription","category"]}, {description:"Article timestamp cursor; articles at or before this cursor are marked read"});
field("Article ID", "articleId", {
  resource: ["article"],
  operation: ["get", "markUnread", "addTag", "removeTag"],
});
field(
  "Article IDs",
  "articleIds",
  { resource: ["article"], operation: ["content"] },
  { description: "Comma-separated article IDs" },
);
field("Tag ID", "tagId", {
  resource: ["article"],
  operation: ["addTag", "removeTag"],
});
props.push({
  displayName: "Article Type",
  name: "entryType",
  type: "options",
  options: [
    { name: "Feed", value: "feed" },
    { name: "Saved", value: "saved" },
  ],
  default: "feed",
  displayOptions: {
    show: { resource: ["article"], operation: ["addTag", "removeTag"] },
  },
});
field("Subscription ID", "subscriptionId", {
  resource: ["subscription"],
  operation: ["update", "delete"],
});
field("Subscription ID", "subscriptionId", {
  resource: ["folder"],
  operation: ["addSubscription", "removeSubscription"],
});
field("Folder ID", "folderId", {
  resource: ["folder"],
  operation: ["update", "delete", "addSubscription", "removeSubscription"],
});
field("Tag ID", "tagId", {
  resource: ["tag"],
  operation: ["update", "delete"],
});
field("Name", "label", {
  resource: ["folder", "tag"],
  operation: ["create", "update"],
});
field("Title", "title", { resource: ["subscription"], operation: ["update"] });
props.push({
  displayName: "Add By",
  name: "addBy",
  type: "options",
  options: [
    { name: "Feed ID", value: "feedId" },
    { name: "Feed URL", value: "feedUrl" },
  ],
  default: "feedUrl",
  displayOptions: {
    show: { resource: ["subscription"], operation: ["create"] },
  },
});
field("Feed ID or URL", "feedInput", {
  resource: ["subscription"],
  operation: ["create"],
});
field("Feed ID", "feedId", { resource: ["feed"], operation: ["get", "state"] });
field("Query", "query", { resource: ["feed"], operation: ["search"] });
props.push(
  {
    displayName: "Language",
    name: "language",
    type: "string",
    default: "",
    displayOptions: {
      show: { resource: ["feed"], operation: ["search", "tags"] },
    },
    description: "Optional language code",
  },
  {
    displayName: "Last Updated Within",
    name: "lastUpdateDays",
    type: "number",
    default: 0,
    typeOptions: { minValue: 0 },
    displayOptions: {
      show: { resource: ["feed"], operation: ["search", "tags"] },
    },
    description: "Maximum age in days; 0 uses the service default",
  },
);
props.push({
  displayName: "Input",
  name: "opmlInput",
  type: "options",
  options: [
    { name: "Text", value: "text" },
    { name: "Binary File", value: "binary" },
  ],
  default: "text",
  displayOptions: {
    show: { resource: ["opml"], operation: ["parse", "import"] },
  },
});
field(
  "OPML",
  "opml",
  { resource: ["opml"], operation: ["parse", "import"], opmlInput: ["text"] },
  { typeOptions: { rows: 5 } },
);
field(
  "Input Binary Field",
  "binaryProperty",
  { resource: ["opml"], operation: ["parse", "import"], opmlInput: ["binary"] },
  { default: "data" },
);
field(
  "Stream ID",
  "streamId",
  { resource: ["preference"], operation: ["pin", "unpin"] },
  { description: "For example, subscription- followed by its ID" },
);
props.push({
  displayName: "Preference Scope",
  name: "scope",
  type: "options",
  options: [
    { name: "Global", value: "global" },
    { name: "Subscription", value: "subscriptions" },
    { name: "Folder", value: "categories" },
    { name: "Tag", value: "tags" },
  ],
  default: "global",
  displayOptions: { show: { resource: ["preference"], operation: ["update"] } },
});
field("Scope ID", "scopeId", {
  resource: ["preference"],
  operation: ["update"],
  scope: ["subscriptions", "categories", "tags"],
});
field(
  "Preferences",
  "preferences",
  { resource: ["preference"], operation: ["update"] },
  {
    type: "json",
    default: "{}",
    description: "JSON object of preference fields; use null to clear a field",
  },
);
props.push(
  {
    displayName: "Order",
    name: "order",
    type: "options",
    options: [
      { name: "Newest First", value: 0 },
      { name: "Oldest First", value: 1 },
    ],
    default: 0,
    displayOptions: { show: { resource: ["article"], operation: ["getMany"] } },
  },
  {
    displayName: "Unread Only",
    name: "unreadOnly",
    type: "boolean",
    default: false,
    displayOptions: { show: { resource: ["article"], operation: ["getMany"] } },
  },
  {
    displayName: "Include Content",
    name: "includeContent",
    type: "boolean",
    default: false,
    displayOptions: {
      show: { resource: ["article"], operation: ["getMany", "get"] },
    },
  },
  {
    displayName: "Return All",
    name: "returnAll",
    type: "boolean",
				description: 'Whether to return all results or only up to a given limit',
    default: false,
    displayOptions: {
      show: {
        resource: ["article", "subscription", "folder", "tag", "feed"],
        operation: ["getMany", "search"],
      },
    },
  },
  {
    displayName: "Limit",
    name: "limit",
    type: "number",
				description: 'Max number of results to return',
    typeOptions: { minValue: 1 },
    default: 50,
    displayOptions: {
      show: {
        resource: ["article", "subscription", "folder", "tag", "feed"],
        operation: ["getMany", "search"],
        returnAll: [false],
      },
    },
  },
);
export const properties = props;
