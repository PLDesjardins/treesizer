(function (root) {
  'use strict';
  const graphOrigin = 'https://graph.microsoft.com';
  function graphURL(path) {
    const url = new URL(path, `${graphOrigin}/v1.0/`);
    if (url.origin !== graphOrigin || !url.pathname.startsWith('/v1.0/')) throw new Error('Invalid Microsoft Graph page URL.');
    return url.href;
  }
  async function scanDrive(request, onProgress = () => {}, signal) {
    const { folder } = root.TreeSizer || require('./core');
    const drive = await request(graphURL('me/drive'), signal);
    const tree = folder(drive.name || 'OneDrive');
    const queue = [{ node: tree, path: 'me/drive/root/children' }];
    let scanned = 0, skipped = 0;
    for (let index = 0; index < queue.length; index++) {
      const { node, path } = queue[index];
      let url = graphURL(`${path}?$select=id,name,size,lastModifiedDateTime,file,folder,remoteItem,package&$top=200`);
      while (url) {
        if (signal?.aborted) throw new DOMException('Scan cancelled.', 'AbortError');
        const page = await request(url, signal);
        if (!Array.isArray(page.value)) throw new Error('Microsoft returned an invalid folder listing.');
        for (const item of page.value) {
          // Shared shortcuts can reference other drives or form cycles.
          if (item.remoteItem) { skipped++; continue; }
          const modified = Date.parse(item.lastModifiedDateTime) || 0;
          if (item.folder) {
            const child = folder(item.name, node);
            node.children.set(item.name, child);
            queue.push({ node: child, path: `me/drive/items/${encodeURIComponent(item.id)}/children` });
          } else if (item.file || item.package) {
            node.children.set(item.name, { name: item.name, parent: node, kind: 'file', size: item.size || 0, modified, count: 1 });
            scanned++;
          } else { skipped++; }
        }
        onProgress(scanned, index + 1, queue.length);
        url = page['@odata.nextLink'] ? graphURL(page['@odata.nextLink']) : null;
      }
    }
    // Aggregate from leaves up, including zero-byte files and empty folders.
    for (let index = queue.length - 1; index >= 0; index--) {
      const node = queue[index].node;
      for (const child of node.children.values()) {
        node.size += child.size;
        node.count += child.count;
        node.modified = Math.max(node.modified, child.modified);
      }
    }
    return { tree, skipped };
  }
  const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  async function signIn(clientId) {
    if (!/^https?:$/.test(location.protocol) || !window.isSecureContext) {
      throw new Error('OneDrive sign-in requires a local web server or HTTPS. See the OneDrive setup instructions.');
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) throw new Error('Enter the Application (client) ID from your Microsoft app registration.');
    // Open immediately within the user's click to avoid popup blockers.
    const popup = window.open('about:blank', 'treesizer-microsoft', 'width=540,height=720');
    if (!popup) throw new Error('Allow popups for this page, then try again.');
    try {
      const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
      const redirect = `${location.origin}${location.pathname}`;
      const endpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0';
      const params = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirect, response_mode: 'query', scope: 'https://graph.microsoft.com/Files.Read', state, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account' });
      const code = await new Promise((resolve, reject) => {
        let poll, timeout;
        const cleanup = () => { window.removeEventListener('message', listener); clearInterval(poll); clearTimeout(timeout); };
        const listener = event => {
          if (event.origin !== location.origin || event.source !== popup || event.data?.type !== 'treesizer-oauth') return;
          if (event.data.state !== state) { cleanup(); reject(new Error('Sign-in state did not match. Try signing in again.')); return; }
          cleanup();
          if (event.data.error) reject(new Error('Microsoft sign-in was declined or failed. Check the app registration and try again.'));
          else if (event.data.code) resolve(event.data.code);
          else reject(new Error('Microsoft did not return an authorization code.'));
        };
        window.addEventListener('message', listener);
        poll = setInterval(() => { if (popup.closed) { cleanup(); reject(new Error('Sign-in window closed.')); } }, 500);
        timeout = setTimeout(() => { cleanup(); reject(new Error('Sign-in timed out. Please try again.')); }, 300000);
        popup.location.href = `${endpoint}/authorize?${params}`;
      });
      const response = await fetch(`${endpoint}/token`, { method: 'POST', body: new URLSearchParams({ client_id: clientId, grant_type: 'authorization_code', code, redirect_uri: redirect, code_verifier: verifier, scope: 'https://graph.microsoft.com/Files.Read' }) });
      const result = await response.json();
      if (!response.ok || !result.access_token) throw new Error('Sign-in could not finish. Check that the exact page address is registered as a Single-page application redirect URI.');
      return result.access_token;
    } finally { popup.close(); }
  }
  function graphRequest(token) {
    return async (path, signal) => {
      const url = graphURL(path);
      for (let attempt = 0; attempt < 4; attempt++) {
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal });
        if ((response.status === 429 || response.status === 503) && attempt < 3) {
          const seconds = Math.min(60, Math.max(1, Number(response.headers.get('Retry-After')) || 2 ** (attempt + 1)));
          await new Promise((resolve, reject) => {
            if (signal?.aborted) { reject(new DOMException('Scan cancelled.', 'AbortError')); return; }
            const abort = () => { clearTimeout(timer); reject(new DOMException('Scan cancelled.', 'AbortError')); };
            const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, seconds * 1000);
            signal?.addEventListener('abort', abort, { once: true });
          });
          continue;
        }
        if (response.status === 401) throw new Error('Microsoft sign-in expired. Disconnect and sign in again to rescan.');
        if (response.status === 403) throw new Error('Microsoft denied access to a folder. Your organization may require administrator approval for Files.Read.');
        if (!response.ok) throw new Error(`OneDrive request failed (HTTP ${response.status}). Try again. No partial results are shown.`);
        return response.json();
      }
    };
  }
  if (typeof window !== 'undefined' && window.opener && /^https?:$/.test(location.protocol)) {
    const params = new URLSearchParams(location.search);
    if (params.has('state') && (params.has('code') || params.has('error'))) {
      const message = { type: 'treesizer-oauth', state: params.get('state'), code: params.get('code'), error: params.get('error') };
      history.replaceState(null, '', location.pathname);
      window.opener.postMessage(message, location.origin);
      window.close();
    }
  }
  const api = { graphURL, scanDrive, signIn, graphRequest };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OneDrive = api;
})(globalThis);
