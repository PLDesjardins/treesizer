(function (root) {
  'use strict';
  function folder(name, parent = null) {
    return { name, parent, kind: 'folder', size: 0, modified: 0, count: 0, children: new Map() };
  }
  function addFile(tree, path, size, modified) {
    const parts = path.split('/').filter(Boolean);
    if (!parts.length) return;
    let current = tree;
    const ancestors = [tree];
    for (const part of parts.slice(0, -1)) {
      if (!current.children.has(part)) current.children.set(part, folder(part, current));
      current = current.children.get(part);
      ancestors.push(current);
    }
    current.children.set(parts.at(-1), { name: parts.at(-1), kind: 'file', size, modified, count: 1, parent: current });
    for (const ancestor of ancestors) {
      ancestor.size += size;
      ancestor.count += 1;
      ancestor.modified = Math.max(ancestor.modified, modified);
    }
  }
  function sortedChildren(tree, key, direction, foldersOnly) {
    return [...tree.children.values()].filter(item => !foldersOnly || item.kind === 'folder').sort((a, b) => {
      const comparison = key === 'name' ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) : a[key] - b[key];
      return comparison * direction || a.name.localeCompare(b.name);
    });
  }
  function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 5);
    return `${(bytes / 1024 ** unit).toLocaleString(undefined, { maximumFractionDigits: unit ? 2 : 0 })} ${['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'][unit]}`;
  }
  const api = { folder, addFile, sortedChildren, formatSize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TreeSizer = api;
})(globalThis);
