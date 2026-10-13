const { test } = require('node:test');
const assert = require('node:assert/strict');
const { folder, addFile, sortedChildren, formatSize } = require('./core');

test('recursive totals include root files, zero-byte files, and newest descendant dates', () => {
  const root = folder('root');
  addFile(root, 'photos/a.jpg', 100, 10);
  addFile(root, 'photos/nested/b.jpg', 200, 50);
  addFile(root, 'empty/zero.txt', 0, 20);
  addFile(root, 'root.txt', 50, 100);
  assert.equal(root.size, 350);
  assert.equal(root.count, 4);
  assert.equal(root.modified, 100);
  const photos = root.children.get('photos');
  assert.equal(photos.size, 300);
  assert.equal(photos.count, 2);
  assert.equal(photos.modified, 50);
  assert.equal(photos.children.get('nested').parent, photos);
  assert.equal(root.children.get('empty').size, 0);
});

test('size, natural name, and modification sorting work both ways with folder filtering', () => {
  const root = folder('root');
  addFile(root, 'folder10/file', 100, 10);
  addFile(root, 'folder2/file', 200, 20);
  addFile(root, 'direct', 300, 30);
  const names = (key, direction, only) => sortedChildren(root, key, direction, only).map(x => x.name);
  assert.deepEqual(names('size', -1, true), ['folder2', 'folder10']);
  assert.deepEqual(names('size', 1, true), ['folder10', 'folder2']);
  assert.deepEqual(names('name', 1, true), ['folder2', 'folder10']);
  assert.deepEqual(names('name', -1, true), ['folder10', 'folder2']);
  assert.deepEqual(names('modified', -1, false), ['direct', 'folder2', 'folder10']);
  assert.deepEqual(names('modified', 1, false), ['folder10', 'folder2', 'direct']);
});

test('empty folders and byte formatting', () => {
  assert.deepEqual(sortedChildren(folder('empty'), 'size', -1, true), []);
  assert.equal(formatSize(0), '0 B');
  assert.equal(formatSize(1024), '1 KiB');
  assert.equal(formatSize(1024 ** 3), '1 GiB');
});
