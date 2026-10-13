'use strict';
const { folder, addFile, sortedChildren, formatSize } = TreeSizer;
const $ = id => document.getElementById(id);
let tree = null, current = null, key = 'size', direction = -1;
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function render() {
  $('total').textContent = formatSize(current.size);
  $('count').textContent = current.count.toLocaleString();
  $('folders').textContent = [...current.children.values()].filter(c => c.kind === 'folder').length.toLocaleString();
  const ancestors = [];
  for (let node = current; node; node = node.parent) ancestors.unshift(node);
  $('breadcrumbs').replaceChildren();
  ancestors.forEach((node, index) => {
    if (index) $('breadcrumbs').append(element('span', ' / '));
    const button = element('button', node.name);
    button.disabled = node === current;
    button.addEventListener('click', () => { current = node; render(); });
    $('breadcrumbs').append(button);
  });
  document.querySelectorAll('th button').forEach(button => {
    const active = button.dataset.key === key;
    button.querySelector('span').textContent = active ? (direction === -1 ? '↓' : '↑') : '↕';
    if (active) button.closest('th').setAttribute('aria-sort', direction === -1 ? 'descending' : 'ascending');
    else button.closest('th').removeAttribute('aria-sort');
  });
  const children = sortedChildren(current, key, direction, $('foldersOnly').checked);
  const fragment = document.createDocumentFragment();
  children.forEach(item => {
    const row = element('tr');
    const name = element('td');
    const entry = element(item.kind === 'folder' ? 'button' : 'span', undefined, item.kind === 'folder' ? 'entry' : 'file-name');
    const icon = element('span', item.kind === 'folder' ? '▰' : '▧', 'icon');
    icon.setAttribute('aria-hidden', 'true');
    entry.append(icon, element('span', item.name));
    if (item.kind === 'folder') entry.addEventListener('click', () => { current = item; render(); });
    name.append(entry);
    const size = element('td', formatSize(item.size), 'size-cell');
    size.title = `${item.size.toLocaleString()} bytes · ${item.count.toLocaleString()} file(s)`;
    const share = element('td');
    const percentage = current.size ? item.size / current.size * 100 : 0;
    const bar = element('span', undefined, 'bar');
    const fill = element('i');
    fill.style.width = `${percentage}%`;
    bar.append(fill);
    share.append(bar, element('span', `${percentage.toFixed(1)}%`, 'percentage'));
    row.append(name, size, share, element('td', item.modified ? dateFormat.format(item.modified) : '—'));
    fragment.append(row);
  });
  $('rows').replaceChildren(fragment);
  $('empty').hidden = children.length > 0;
  $('empty').textContent = $('foldersOnly').checked ? 'No subfolders here. Uncheck “Folders only” to see individual files.' : 'No files or folders here.';
}
$('choose').addEventListener('click', () => { $('picker').value = ''; $('picker').click(); });
$('picker').addEventListener('change', async event => {
  const files = event.target.files;
  if (!files.length) return;
  $('choose').disabled = true;
  $('results').hidden = true;
  try {
    const rootName = files[0].webkitRelativePath.split('/')[0] || 'Selected folder';
    const next = folder(rootName);
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const path = file.webkitRelativePath ? file.webkitRelativePath.split('/').slice(1).join('/') : file.name;
      addFile(next, path, file.size, file.lastModified);
      if (index % 500 === 0) {
        $('status').textContent = `Scanning ${index.toLocaleString()} of ${files.length.toLocaleString()} files…`;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    tree = next; current = tree;
    render();
    $('results').hidden = false;
    $('status').textContent = `Scan complete · ${files.length.toLocaleString()} files in ${rootName}. Choose another folder to rescan.`;
  } catch (error) {
    $('status').textContent = 'The scan could not finish. Try choosing a smaller folder.';
    console.error(error);
  } finally { $('choose').disabled = false; }
});
$('foldersOnly').addEventListener('change', () => { if (current) render(); });
document.querySelectorAll('th button').forEach(button => button.addEventListener('click', () => {
  if (key === button.dataset.key) direction *= -1;
  else { key = button.dataset.key; direction = key === 'name' ? 1 : -1; }
  if (current) render();
}));
