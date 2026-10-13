# TreeSizer

A private, read-only folder size explorer with local folder and direct OneDrive scanning. Download just `index.html` using GitHub's **Download raw file** button, then open it directly in a modern desktop browser (Chrome, Edge, Firefox, or Safari) and choose a local folder. Styling and JavaScript are included in that single file. Local scanning requires no installation, account, backend, or network connection. The browser may ask permission to select or “upload” the folder; local scanning reads only file metadata and sends nothing anywhere.

Immediate subfolders are ranked by the combined size of all their nested files. Click a column heading to sort by size, name, or last modified; click again to reverse it. Click a folder to explore it, and use the breadcrumbs to return. Uncheck **Folders only** to include files directly in the current folder.

Folder dates represent the most recently modified contained file, since browsers do not expose directory timestamps. Sizes represent logical bytes, not allocated disk space. Empty directories are not visible to the browser's file picker; hidden or inaccessible files may also be omitted. Symlink traversal depends on the browser and OS. Re-select the folder to refresh a scan. Very large selections may take time and use significant browser memory.

## Development

Edit the HTML markup in `index.html` and the sources in `style.css`, `core.js`, `onedrive.js`, and `app.js`. Run `node build.js` to refresh the embedded styles and scripts, then reload `index.html`. Commit the updated HTML with source changes so the downloadable file stays current. Users do not need Node or a build step. Use the existing checkout; cloud tasks are already isolated and do not require a Git worktree.

Run the core aggregation and sorting tests:

```sh
node --test core.test.js onedrive.test.js
```

For development over HTTP instead of opening the file:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

The server is optional for local folders and required for OneDrive sign-in.

## Direct OneDrive scanning

OneDrive scanning reads folder and file metadata through Microsoft Graph, including cloud-only files. It does not download file contents. It scans your signed-in account's own drive, includes empty folders, follows paginated results, and excludes shared shortcuts to other drives. Sizes and dates can change while a scan is running; rescan to refresh. An inaccessible folder fails the scan rather than silently showing incomplete totals. You can cancel an in-progress scan.

Microsoft sign-in requires an application registration and a web origin; it cannot run from `file://`.

1. In [Microsoft Entra](https://entra.microsoft.com/), open **App registrations → New registration**. Choose **Accounts in any organizational directory and personal Microsoft accounts**. Registering apps may require your organization to grant permission or administrator assistance.
2. In **Authentication**, add a **Single-page application (SPA)** platform. Register `http://localhost:8000/index.html` as a redirect URI. The port and path must match the address you actually use, including `index.html`. Do not enable implicit grant or create a client secret.
3. In **API permissions**, add Microsoft Graph **Delegated permissions → Files.Read**. This app requests read-only access to your files, not write access. Your organization may require administrator consent.
4. Download `index.html` into a folder on your computer. From that folder, run `python -m http.server 8000 --bind 127.0.0.1` (on some Windows installations, use `py` instead of `python`). Open `http://localhost:8000/index.html` in your browser.
5. Paste the public **Application (client) ID** from the registration into TreeSizer. Click **Sign in & scan OneDrive** and complete Microsoft's sign-in and consent screens. Allow the sign-in popup if prompted.

The app uses the authorization code flow with PKCE. Tokens remain in page memory, are sent only to `graph.microsoft.com`, and are discarded on disconnect or page close. No refresh token or client secret is stored. Disconnecting TreeSizer does not sign your Microsoft account out of the browser. If a long scan outlasts the access token, disconnect and sign in again. Internet access to `login.microsoftonline.com` and `graph.microsoft.com` is required. A Microsoft account with OneDrive provisioned is required.

Core aggregation, pagination, cancellation, and error handling are tested using mocked Microsoft responses. The sign-in popup and scan UI are also checked using simulated authorization responses. A live Microsoft sign-in and account scan still require a real app registration and user consent and have not been validated in the cloud environment.
