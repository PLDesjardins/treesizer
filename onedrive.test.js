const { test } = require('node:test');
const assert = require('node:assert/strict');
const { graphURL, scanDrive, graphRequest } = require('./onedrive');

test('OneDrive scan follows pagination and sums nested cloud metadata, retaining empty folders', async () => {
  const calls = [];
  const request = async url => {
    calls.push(url);
    const path = new URL(url).pathname;
    if (path.endsWith('/me/drive')) return { name: 'My OneDrive' };
    if (path.endsWith('/root/children')) return {
      value: [{ id: 'large', name: 'Large', folder: {} }, { id: 'empty', name: 'Empty', folder: {} }, { name: 'Shared', remoteItem: {}, folder: {} }],
      '@odata.nextLink': 'https://graph.microsoft.com/v1.0/page2',
    };
    if (path.endsWith('/page2')) return { value: [{ name: 'root.txt', file: {}, size: 10, lastModifiedDateTime: '2026-01-01T00:00:00Z' }] };
    if (path.endsWith('/large/children')) return { value: [{ id: 'nested', name: 'Nested', folder: {} }, { name: 'a.bin', file: {}, size: 100, lastModifiedDateTime: '2026-02-01T00:00:00Z' }] };
    if (path.endsWith('/nested/children')) return { value: [{ name: 'b.bin', file: {}, size: 200, lastModifiedDateTime: '2026-03-01T00:00:00Z' }] };
    if (path.endsWith('/empty/children')) return { value: [] };
    throw new Error(`Unexpected URL: ${url}`);
  };
  const progress = [];
  const { tree, skipped } = await scanDrive(request, (...args) => progress.push(args));
  assert.equal(tree.name, 'My OneDrive');
  assert.equal(tree.size, 310);
  assert.equal(tree.count, 3);
  assert.equal(tree.children.get('Large').size, 300);
  assert.equal(tree.modified, Date.parse('2026-03-01T00:00:00Z'));
  assert.equal(tree.children.get('Empty').size, 0);
  assert.equal(skipped, 1);
  assert.equal(calls.length, 6);
  assert.ok(progress.length);
  assert.ok(calls.every(url => !url.includes('/content')));
});

test('rejects pagination to another host before sending a token or request', async () => {
  assert.throws(() => graphURL('https://example.com/v1.0/me/drive'));
  assert.throws(() => graphURL('https://graph.microsoft.com/beta/me/drive'));
  let count = 0;
  await assert.rejects(scanDrive(async () => ++count === 1 ? { name: 'Drive' } : { value: [], '@odata.nextLink': 'https://example.com/token-theft' }), /Invalid/);
  assert.equal(count, 2);
});

test('cancelled and failed folder scans reject instead of returning incomplete totals', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(scanDrive(async () => ({ name: 'Drive' }), undefined, controller.signal), { name: 'AbortError' });
  await assert.rejects(scanDrive(async url => {
    if (url.endsWith('/me/drive')) return { name: 'Drive' };
    throw new Error('Access denied');
  }), /Access denied/);
});

test('Graph requests are read-only, pass cancellation, and report expired sign-in', async t => {
  const controller = new AbortController();
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return { status: 401, ok: false };
  });
  await assert.rejects(graphRequest('test-token')(graphURL('me/drive'), controller.signal), /expired/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
  assert.equal(calls[0].options.signal, controller.signal);
  assert.equal(calls[0].options.method, undefined); // fetch defaults to GET
});
