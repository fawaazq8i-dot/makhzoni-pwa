const DB_NAME = "makhzoni-db";
const DB_VERSION = 3;
const PRODUCTS_STORE = "products";
const LOCATIONS_STORE = "locations";
const CAPITAL_HISTORY_STORE = "capitalHistory";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PRODUCTS_STORE)) {
        const products = db.createObjectStore(PRODUCTS_STORE, { keyPath: "id" });
        products.createIndex("status", "status", { unique: false });
        products.createIndex("soldDate", "soldDate", { unique: false });
      }
      if (!db.objectStoreNames.contains(LOCATIONS_STORE)) {
        db.createObjectStore(LOCATIONS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(CAPITAL_HISTORY_STORE)) {
        db.createObjectStore(CAPITAL_HISTORY_STORE, { keyPath: "date" });
      }
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

async function getStore(name, mode) {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

export async function addProduct(record) {
  return wrap((await getStore(PRODUCTS_STORE, "readwrite")).add(record));
}

export async function getProduct(id) {
  return wrap((await getStore(PRODUCTS_STORE, "readonly")).get(id));
}

// Merges patch into the existing record. Note: a key present in `patch`
// with value `undefined` will still overwrite (spread keeps it), so callers
// that need to *remove* a field (e.g. clearing soldDate) should not rely on
// this — this app only ever adds/overwrites fields via patch, never removes
// them, so that's not a concern here.
export async function updateProduct(id, patch) {
  const s = await getStore(PRODUCTS_STORE, "readwrite");
  const existing = await wrap(s.get(id));
  if (!existing) return;
  return wrap(s.put({ ...existing, ...patch }));
}

// Reverses a sale: back to "in-stock" with sellPrice/soldDate fully removed
// (not set to null) — same indexing rule as addProduct: the soldDate index
// only excludes a record when the property is absent, so a lingering null
// would keep wrongly matching day-summary queries for the old sold date.
export async function returnProduct(id) {
  const s = await getStore(PRODUCTS_STORE, "readwrite");
  const existing = await wrap(s.get(id));
  if (!existing) return;
  const { sellPrice, soldDate, ...rest } = existing;
  rest.status = "in-stock";
  return wrap(s.put(rest));
}

export async function deleteProduct(id) {
  return wrap((await getStore(PRODUCTS_STORE, "readwrite")).delete(id));
}

export async function getProductsByStatus(status) {
  return wrap((await getStore(PRODUCTS_STORE, "readonly")).index("status").getAll(status));
}

export async function getProductsBySoldDate(dateKey) {
  return wrap((await getStore(PRODUCTS_STORE, "readonly")).index("soldDate").getAll(dateKey));
}

// خانات (warehouse bins/sections) — not indexed on products since the list
// is always small; grouping is done in JS by locationId.
export async function getLocations() {
  const all = await wrap((await getStore(LOCATIONS_STORE, "readonly")).getAll());
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function addLocation(name) {
  const record = { id: crypto.randomUUID(), name, createdAt: Date.now() };
  await wrap((await getStore(LOCATIONS_STORE, "readwrite")).add(record));
  return record;
}

export async function renameLocation(id, name) {
  const s = await getStore(LOCATIONS_STORE, "readwrite");
  const existing = await wrap(s.get(id));
  if (!existing) return;
  return wrap(s.put({ ...existing, name }));
}

// Deletes the location and unassigns any products that were in it, so they
// fall back to "بدون خانة" instead of pointing at a location that no longer exists.
export async function deleteLocation(id) {
  const productsStore = await getStore(PRODUCTS_STORE, "readwrite");
  const allProducts = await wrap(productsStore.getAll());
  for (const p of allProducts) {
    if (p.locationId === id) {
      await wrap(productsStore.put({ ...p, locationId: null }));
    }
  }
  return wrap((await getStore(LOCATIONS_STORE, "readwrite")).delete(id));
}

// One record per calendar day (keyPath "date" — upsert-by-day). Called every
// time the dashboard computes current capital, so "today"'s entry always
// reflects the latest live value while past days stay frozen at whatever
// they were the last time the app was open that day.
export async function recordCapitalSnapshot(dateKey, capital) {
  return wrap((await getStore(CAPITAL_HISTORY_STORE, "readwrite")).put({ date: dateKey, capital }));
}

export async function getCapitalHistory() {
  const all = await wrap((await getStore(CAPITAL_HISTORY_STORE, "readonly")).getAll());
  return all.sort((a, b) => b.date.localeCompare(a.date));
}
