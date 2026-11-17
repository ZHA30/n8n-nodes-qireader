# n8n-nodes-qireader

An n8n community node for managing QiReader articles, subscriptions, and reading settings.

> [!NOTE]
> This package is under development and its API coverage is evolving.

> [!WARNING]
> The node uses QiReader's undocumented web API, which may change without notice.

## Install

```sh
npm i n8n-nodes-qireader
```

## Features

The QiReader node provides email and password or Cookie authentication and supports articles, subscriptions, folders, tags, feeds, preferences, and OPML.

- **Articles**: Retrieve articles and content, mark articles as read or unread, and add or remove tags.
- **Subscriptions**: Create, rename, and delete subscriptions, retrieve unread counts, and inspect the complete subscription snapshot.
- **Folders and tags**: Manage folders and tags and organize subscriptions or articles.
- **Subscription relationships**: Include associated folders with each subscription and associated subscriptions with each folder.
- **Feeds**: Search for feeds and retrieve feed details, states, and discovery tags.
- **Preferences**: Retrieve and update reading preferences and pin or unpin streams.
- **OPML**: Parse, import, or export subscriptions using OPML text or files.
- **Development**: Install dependencies with `npm ci`, build with `npm run build`, check with `npm run lint`, and test with `npm test`.

## References

- [QiReader](https://www.qireader.com/)
- [n8n community nodes](https://docs.n8n.io/integrations/community-nodes/)
