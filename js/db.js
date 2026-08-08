const DB_NAME = "makhzoni-db";
const DB_VERSION = 1;
const STORE = "products";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const store = db.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("status", "status", { unique: false });
      store.createIndex("soldDate", "soldDate", { unique: false });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function store(mode) {
  const db = await openDB();
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function addProduct(record) {
  return wrap((await store("readwrite")).add(record));
}

export async function getProduct(id) {
  return wrap((await store("readonly")).get(id));
}

// Merges patch into the existing record. Note: a key present in `patch`
// with value `undefined` will still overwrite (spread keeps it), so callers
// that need to *remove* a field (e.g. clearing soldDate) should not rely on
// this — this app only ever adds fields via patch (marking sold), never
// removes them, so that's not a concern here.
export async function updateProduct(id, patch) {
  const s = await store("readwrite");
  const existing = await wrap(s.get(id));
  if (!existing) return;
  return wrap(s.put({ ...existing, ...patch }));
}

export async function deleteProduct(id) {
  return wrap((await store("readwrite")).delete(id));
}

export async function getProductsByStatus(status) {
  return wrap((await store("readonly")).index("status").getAll(status));
}

export async function getProductsBySoldDate(dateKey) {
  return wrap((await store("readonly")).index("soldDate").getAll(dateKey));
}
