import type { IDataObject } from 'n8n-workflow';

type Entity = IDataObject & { id: string };
type Relation = IDataObject & { subscriptionId: string; categoryId: string };
export interface SubscriptionSnapshot extends IDataObject {
  subscriptions: Entity[];
  categories: Entity[];
  subscriptionCategories: Relation[];
}

export function subscriptionsWithCategories(snapshot: SubscriptionSnapshot): IDataObject[] {
  const categories = new Map(snapshot.categories.map((category) => [category.id, category]));
  const links = new Map<string, Relation[]>();
  for (const relation of snapshot.subscriptionCategories) {
    const list = links.get(relation.subscriptionId) ?? [];
    list.push(relation);
    links.set(relation.subscriptionId, list);
  }
  return snapshot.subscriptions.map((subscription) => {
    const relations = links.get(subscription.id) ?? [];
    return {
      ...subscription,
      categories: relations.flatMap((relation) => {
        const category = categories.get(relation.categoryId);
        return category ? [category] : [];
      }),
      subscriptionCategories: relations,
    };
  });
}

export function categoriesWithSubscriptions(snapshot: SubscriptionSnapshot): IDataObject[] {
  const subscriptions = new Map(snapshot.subscriptions.map((subscription) => [subscription.id, subscription]));
  const links = new Map<string, Relation[]>();
  for (const relation of snapshot.subscriptionCategories) {
    const list = links.get(relation.categoryId) ?? [];
    list.push(relation);
    links.set(relation.categoryId, list);
  }
  return snapshot.categories.map((category) => {
    const relations = links.get(category.id) ?? [];
    return {
      ...category,
      subscriptions: relations.flatMap((relation) => {
        const subscription = subscriptions.get(relation.subscriptionId);
        return subscription ? [subscription] : [];
      }),
      subscriptionCategories: relations,
    };
  });
}
