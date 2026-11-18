// Згенеровано під час збирання (tools/offline.ts).
const CACHE = "astrolabe-bc9cb0734ffe";
const FILES = ["./","assets/case-CKUIE7No.js","assets/case-GdoZY3rC.css","assets/caveat-cyrillic-500-normal-DpMZbbjM.woff2","assets/caveat-cyrillic-ext-500-normal-DcrB4vVx.woff2","assets/caveat-latin-500-normal-B9SDL8cy.woff2","assets/caveat-latin-ext-500-normal-jKqJW7bC.woff2","assets/courier-prime-latin-400-normal-BbyBr73r.woff2","assets/courier-prime-latin-700-normal-D1YCjmaD.woff2","assets/courier-prime-latin-ext-400-normal-B-EsvyE4.woff2","assets/courier-prime-latin-ext-700-normal-ByMJlNdM.woff2","assets/main-5ASaJIvO.js","assets/main-B8z_RM97.css","assets/pt-sans-narrow-cyrillic-400-normal-BMtsfkyI.woff2","assets/pt-sans-narrow-cyrillic-700-normal-BU1d2_nm.woff2","assets/pt-sans-narrow-cyrillic-ext-400-normal-BOoQADkR.woff2","assets/pt-sans-narrow-cyrillic-ext-700-normal-Bc6GRch3.woff2","assets/pt-sans-narrow-latin-400-normal-Bh-jGih9.woff2","assets/pt-sans-narrow-latin-700-normal-Cky7KMl6.woff2","assets/pt-sans-narrow-latin-ext-400-normal-Bc9CpGBT.woff2","assets/pt-sans-narrow-latin-ext-700-normal-DuFccbRk.woff2","assets/pt-serif-cyrillic-400-italic-Bicg0I0x.woff2","assets/pt-serif-cyrillic-400-normal-B-euljER.woff2","assets/pt-serif-cyrillic-700-normal-DvVvs_4R.woff2","assets/pt-serif-cyrillic-ext-400-italic-3ud5gcxD.woff2","assets/pt-serif-cyrillic-ext-400-normal-DU92duxl.woff2","assets/pt-serif-cyrillic-ext-700-normal-CpXZPNZI.woff2","assets/pt-serif-latin-400-italic-zg5EJ2cW.woff2","assets/pt-serif-latin-400-normal-Cx0mQj7e.woff2","assets/pt-serif-latin-700-normal-Bsuo9jes.woff2","assets/pt-serif-latin-ext-400-italic-CBoOQ8LN.woff2","assets/pt-serif-latin-ext-400-normal-B7STXmTm.woff2","assets/pt-serif-latin-ext-700-normal-B7jTzfC-.woff2","assets/qr-scanner-worker.min-D85Z9gVD.js","assets/qr-scanner.min-imwIVtJC.js","favicon.svg","icons/icon-192.png","icons/icon-512.png","img/1-02-clock.jpg","img/1-03-watch.jpg","img/1-04-square.jpg","img/1-10-fireworks-a.jpg","img/1-10-fireworks-b.jpg","img/3-03-mechanism.jpg","img/3-05-tower-day.jpg","img/4-06-cctv.jpg","img/4-07-safe.jpg","img/4-11-orest-1974.jpg","img/astrolabe.jpg","img/c-02-paving.jpg","img/p-barvinok.jpg","img/p-bayda.jpg","img/p-dorosh.jpg","img/p-iryna.jpg","img/p-korzh.jpg","img/p-luhovyi.jpg","img/p-orest.jpg","img/p-prokopchuk.jpg","img/p-solomiya.jpg","img/p-tymur.jpg","img/p-veis.jpg","img/p-zgurska.jpg","index.html","manifest.webmanifest"];

self.addEventListener('install', (e) => {
  // повз HTTP-кеш браузера: одразу після публікації він ще може віддати старі файли
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('astrolabe-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const late = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Свіжа сторінка, якщо мережа відповідає швидко; інакше — сторінка цієї збірки з кешу.
    // У кеш нічого не дописуємо: відкрите в новій вкладці фото чи сторінка нової збірки не мають підмінити гру.
    // сторінки друку в кеші немає: для неї без мережі — звичайна помилка
    const target = url.pathname.endsWith('print.html') ? req : './';
    e.respondWith(
      Promise.race([fetch(req), late(4000)]).catch(() => caches.match(target, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit || Response.error())),
    );
    return;
  }
  // Vite підключає модулі з crossorigin; відповідь із «Vary: Origin» без ignoreVary не знайшлася б.
  e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit || fetch(req)));
});
