const CACHE = '__CACHE_NAME__';
const SHELL = __PRECACHE__;
// Ephemeral memory only: never Cache Storage, IndexedDB, localStorage or Supabase.
const shares = new Map();
const MAX_IMAGE = 3 * 1024 * 1024;
function expireShares() {
  for (const [id, image] of shares)
    if (Date.now() - image.at > 5 * 60 * 1000) {
      image.bytes.fill(0);
      shares.delete(id);
    }
}
self.addEventListener('install', (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith('skysave-') && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
async function receiveShare(request) {
  expireShares();
  const reader = request.body?.getReader();
  if (!reader) return Response.redirect(new URL('/?share_error=empty', self.location.origin), 303);
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE + 65536) {
        await reader.cancel();
        return Response.redirect(new URL('/?share_error=size', self.location.origin), 303);
      }
      chunks.push(value);
    }
    const body = new Blob(chunks, { type: request.headers.get('content-type') || '' });
    const data = await new Response(body, {
      headers: { 'content-type': request.headers.get('content-type') || '' },
    }).formData();
    const file = data.get('receipt');
    if (
      data.getAll('receipt').length !== 1 ||
      !(file instanceof File) ||
      !/^image\/(jpeg|png|webp)$/.test(file.type) ||
      file.size === 0 ||
      file.size > MAX_IMAGE
    )
      return Response.redirect(new URL('/?share_error=type', self.location.origin), 303);
    while (shares.size >= 3) {
      const first = shares.keys().next().value;
      shares.get(first).bytes.fill(0);
      shares.delete(first);
    }
    const id = crypto.randomUUID();
    shares.set(id, {
      bytes: new Uint8Array(await file.arrayBuffer()),
      type: file.type,
      at: Date.now(),
    });
    setTimeout(expireShares, 5 * 60 * 1000 + 100);
    return Response.redirect(new URL(`/?share=${id}`, self.location.origin), 303);
  } catch {
    return Response.redirect(new URL('/?share_error=type', self.location.origin), 303);
  } finally {
    chunks.forEach((chunk) => chunk.fill(0));
    reader.releaseLock();
  }
}
self.addEventListener('message', (event) => {
  if (
    event.data?.type !== 'TAKE_SHARE' ||
    !event.ports[0] ||
    !event.source ||
    new URL(event.source.url).origin !== self.location.origin
  )
    return;
  expireShares();
  const file = shares.get(event.data.id);
  shares.delete(event.data.id);
  if (!file) {
    event.ports[0].postMessage({ error: 'expired' });
    return;
  }
  event.ports[0].postMessage({ bytes: file.bytes.buffer, type: file.type }, [file.bytes.buffer]);
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/share' && event.request.method === 'POST') {
    event.respondWith(receiveShare(event.request));
    return;
  }
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/')));
    return;
  }
  if (
    !/^\/(?:_next\/static|design)\//.test(url.pathname) &&
    !/^\/(?:icon[^/]*|manifest\.json)$/.test(url.pathname)
  )
    return;
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
          }
          return response;
        }),
    ),
  );
});
