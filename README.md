# TreeSizer

A private, read-only folder size explorer. Open `index.html` directly in a modern desktop browser (Chrome, Edge, Firefox, or Safari) and choose a folder. No build, account, backend, or network connection is required. The browser may ask permission to select or “upload” the folder; this app reads only local file metadata and sends nothing anywhere.

Immediate subfolders are ranked by the combined size of all their nested files. Click a column heading to sort by size, name, or last modified; click again to reverse it. Click a folder to explore it, and use the breadcrumbs to return. Uncheck **Folders only** to include files directly in the current folder.

Folder dates represent the most recently modified contained file, since browsers do not expose directory timestamps. Sizes represent logical bytes, not allocated disk space. Empty directories are not visible to the browser's file picker; hidden or inaccessible files may also be omitted. Symlink traversal depends on the browser and OS. Re-select the folder to refresh a scan. Very large selections may take time and use significant browser memory.

## Development

Edit the HTML, CSS, and JavaScript and reload `index.html`. Use the existing checkout; cloud tasks are already isolated and do not require a Git worktree.

Run the core aggregation and sorting tests:

```sh
node --test core.test.js
```

For development over HTTP instead of opening the file:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

The server is optional; it is not needed to scan folders on your own computer.
