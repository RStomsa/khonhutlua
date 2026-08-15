// ==============================================================================
// IndexedDB Layer for Offline-First PWA Warehouse Architecture
// ==============================================================================

import type {
  SyncAction
} from '../../types/warehouse';

const DB_NAME = 'KhoNhutLua_OfflineDB';
const DB_VERSION = 1;

export const STORES = {
  WAREHOUSES: 'warehouses',
  ZONES: 'warehouse_zones',
  LOCATIONS: 'warehouse_locations',
  PRODUCTS: 'products',
  PRODUCT_LOCATIONS: 'product_current_locations',
  MOVEMENTS: 'product_location_movements',
  SETTINGS: 'warehouse_settings',
  OUTBOX: 'sync_outbox'
} as const;

export const openOfflineDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.WAREHOUSES)) {
        db.createObjectStore(STORES.WAREHOUSES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.ZONES)) {
        const zoneStore = db.createObjectStore(STORES.ZONES, { keyPath: 'id' });
        zoneStore.createIndex('warehouse_id', 'warehouse_id', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.LOCATIONS)) {
        const locStore = db.createObjectStore(STORES.LOCATIONS, { keyPath: 'id' });
        locStore.createIndex('warehouse_id', 'warehouse_id', { unique: false });
        locStore.createIndex('zone_id', 'zone_id', { unique: false });
        locStore.createIndex('qr_payload', 'qr_payload', { unique: true });
      }
      if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
        const prodStore = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
        prodStore.createIndex('product_code', 'product_code', { unique: true });
      }
      if (!db.objectStoreNames.contains(STORES.PRODUCT_LOCATIONS)) {
        const curStore = db.createObjectStore(STORES.PRODUCT_LOCATIONS, { keyPath: 'id' });
        curStore.createIndex('product_id', 'product_id', { unique: true });
        curStore.createIndex('location_id', 'location_id', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.MOVEMENTS)) {
        const moveStore = db.createObjectStore(STORES.MOVEMENTS, { keyPath: 'id' });
        moveStore.createIndex('product_id', 'product_id', { unique: false });
        moveStore.createIndex('idempotency_key', 'idempotency_key', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.OUTBOX)) {
        const outboxStore = db.createObjectStore(STORES.OUTBOX, { keyPath: 'id' });
        outboxStore.createIndex('status', 'status', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Generic Get All items from a Store
export const idbGetAll = async <T>(storeName: string): Promise<T[]> => {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`IDB getAll error on ${storeName}:`, err);
    return [];
  }
};

// Generic Put items to a Store
export const idbPutItems = async <T>(storeName: string, items: T[]): Promise<void> => {
  if (!items || items.length === 0) return;
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      items.forEach(item => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`IDB putItems error on ${storeName}:`, err);
  }
};

// Generic Put single item
export const idbPutItem = async <T>(storeName: string, item: T): Promise<void> => {
  return idbPutItems(storeName, [item]);
};

// Generic Delete single item
export const idbDeleteItem = async (storeName: string, id: string): Promise<void> => {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`IDB deleteItem error on ${storeName}:`, err);
  }
};

// Outbox Operations
export const queueIndexedDbOutbox = async (
  actionType: SyncAction['action_type'],
  payload: any
): Promise<SyncAction> => {
  const action: SyncAction = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
    action_type: actionType,
    payload,
    status: 'pending',
    created_at: new Date().toISOString()
  };
  await idbPutItem(STORES.OUTBOX, action);
  return action;
};

export const getIndexedDbOutbox = async (): Promise<SyncAction[]> => {
  const all = await idbGetAll<SyncAction>(STORES.OUTBOX);
  return all.filter(a => a.status === 'pending');
};

export const markIndexedDbOutboxDone = async (actionId: string): Promise<void> => {
  await idbDeleteItem(STORES.OUTBOX, actionId);
};

// Clear and Seed Database
export const clearIndexedDbData = async (): Promise<void> => {
  const db = await openOfflineDB();
  const stores = [
    STORES.WAREHOUSES,
    STORES.ZONES,
    STORES.LOCATIONS,
    STORES.PRODUCTS,
    STORES.PRODUCT_LOCATIONS,
    STORES.MOVEMENTS,
    STORES.SETTINGS,
    STORES.OUTBOX
  ];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    stores.forEach(s => tx.objectStore(s).clear());
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};
