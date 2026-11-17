const { test } = require('node:test');
const assert = require('node:assert/strict');
const { QiReader } = require('../dist/nodes/QiReader/QiReader.node');
const snapshot = {
  version: 7,
  subscriptions: [{ id: 's1', title: 'One' }, { id: 's2', title: 'Two' }, { id: 's3', title: 'Unassigned' }],
  categories: [{ id: 'all', label: '!all' }, { id: 'c1', label: 'News' }, { id: 'c2', label: 'Empty' }],
  subscriptionCategories: [
    { id: 'r1', subscriptionId: 's1', categoryId: 'all' },
    { id: 'r2', subscriptionId: 's1', categoryId: 'c1' },
    { id: 'r3', subscriptionId: 's2', categoryId: 'c1' },
    { id: 'r4', subscriptionId: 's2', categoryId: 'missing' },
  ],
  futureField: { retained: true },
};
async function execute(resource, operation, limit = 50) {
  const params = { authentication: 'cookie', resource, operation, returnAll: false, limit };
  const context = {
    getInputData: () => [{}],
    getNode: () => ({ name: 'QiReader' }),
    getNodeParameter: (key, _index, fallback) => params[key] ?? fallback,
    continueOnFail: () => false,
    helpers: { httpRequestWithAuthentication: async () => ({ result: snapshot }) },
  };
  return (await new QiReader().execute.call(context))[0].map((item) => item.json);
}
test('subscriptions preserve all category links and retain unresolved links', async () => {
  const [first, second, third] = await execute('subscription', 'getMany');
  assert.deepEqual(first.categories.map((c) => c.id), ['all', 'c1']);
  assert.deepEqual(first.subscriptionCategories.map((r) => r.id), ['r1', 'r2']);
  assert.deepEqual(second.categories.map((c) => c.id), ['c1']);
  assert.deepEqual(second.subscriptionCategories.map((r) => r.id), ['r3', 'r4']);
  assert.deepEqual(third.categories, []);
  assert.deepEqual(third.subscriptionCategories, []);
  assert.equal((await execute('subscription', 'getMany', 1)).length, 1);
});
test('folders include related subscriptions, links and empty folders', async () => {
  const folders = await execute('folder', 'getMany');
  assert.deepEqual(folders[1].subscriptions.map((s) => s.id), ['s1', 's2']);
  assert.deepEqual(folders[1].subscriptionCategories.map((r) => r.id), ['r2', 'r3']);
  assert.deepEqual(folders[2].subscriptions, []);
});
test('snapshot retains version, all relations and unknown fields', async () => {
  assert.deepEqual(await execute('subscription', 'getSnapshot'), [snapshot]);
});
