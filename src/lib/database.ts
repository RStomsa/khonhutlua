// ==============================================================================
// Production Data Access Layer & Repository Engine for Kho Nhựt Lúa
// ==============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  Warehouse,
  WarehouseZone,
  WarehouseLocation,
  Product,
  ProductCurrentLocation,
  ProductLocationMovement,
  SyncAction
} from '../types/warehouse';

import {
  STORES,
  idbGetAll,
  idbPutItems,
  idbPutItem,
  idbDeleteItem,
  queueIndexedDbOutbox,
  getIndexedDbOutbox,
  markIndexedDbOutboxDone,
  clearIndexedDbData
} from './offline/indexedDb';

export * from '../types/warehouse';

// --- Production Environment Resolution ---
const DEFAULT_PROD_URL = 'https://sfzzqgcitwpkvebozcuh.supabase.co';
const DEFAULT_PROD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmenpxZ2NpdHdwa3ZlYm96Y3VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NDYxNzgsImV4cCI6MjEwMjMyMjE3OH0.T2KSLqjF4fvPlCFfcyiFvhog4J0VmwGg5QJ276xTPOo';

let envUrl = (import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('supabase_url') || DEFAULT_PROD_URL).trim();
let envAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_key') || DEFAULT_PROD_KEY).trim();

let supabaseClient: SupabaseClient | null = null;

export const initSupabase = (customUrl?: string, customKey?: string) => {
  if (customUrl) envUrl = customUrl.trim();
  if (customKey) envAnonKey = customKey.trim();

  if (envUrl && envAnonKey) {
    try {
      supabaseClient = createClient(envUrl, envAnonKey, {
        auth: { persistSession: true },
        realtime: { params: { eventsPerSecond: 10 } }
      });
      console.log('⚡ Supabase Client initialized successfully.');
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
      supabaseClient = null;
    }
  } else {
    supabaseClient = null;
  }
};

initSupabase();

export const isSupabaseEnabled = (): boolean => !!supabaseClient;

export const getSupabaseConfig = () => ({
  url: envUrl,
  key: envAnonKey,
  isFromEnv: Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
  isEnabled: !!supabaseClient
});

export const saveCustomSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem('supabase_url', url.trim());
  localStorage.setItem('supabase_key', key.trim());
  initSupabase(url, key);
};

// --- Dynamic Seed Data for First-Time Setup / Offline Fallback ---
const DEFAULT_SEED_WAREHOUSES: Warehouse[] = [
  {
    id: 'a1111111-1111-1111-1111-111111111111',
    code: 'K1',
    name: 'Kho 1 - Kho Lúa Nhựt Chính',
    width_m: 15.0,
    length_m: 30.0,
    gps_lat: 10.776889,
    gps_lng: 106.700806,
    color: '#2563eb',
    created_at: new Date().toISOString()
  },
  {
    id: 'a2222222-2222-2222-2222-222222222222',
    code: 'K2',
    name: 'Kho 2 - Kho Phụ Phía Bắc',
    width_m: 12.0,
    length_m: 25.0,
    gps_lat: 10.777200,
    gps_lng: 106.701100,
    color: '#10b981',
    created_at: new Date().toISOString()
  },
  {
    id: 'a3333333-3333-3333-3333-333333333333',
    code: 'K3',
    name: 'Kho 3 - Kho Đóng Gói & Xuất Hàng',
    width_m: 10.0,
    length_m: 20.0,
    gps_lat: 10.776600,
    gps_lng: 106.701400,
    color: '#f59e0b',
    created_at: new Date().toISOString()
  },
  {
    id: 'a4444444-4444-4444-4444-444444444444',
    code: 'K4',
    name: 'Kho 4 - Dãy Ngoài Sân Vận Chuyển',
    width_m: 8.0,
    length_m: 35.0,
    gps_lat: 10.776300,
    gps_lng: 106.700600,
    color: '#8b5cf6',
    created_at: new Date().toISOString()
  }
];

const DEFAULT_SEED_ZONES: WarehouseZone[] = [
  {
    id: 'b1111111-1111-1111-1111-111111111111',
    warehouse_id: 'a1111111-1111-1111-1111-111111111111',
    code: 'KHU_120',
    name: 'Khu 120cm',
    color: '#3b82f6',
    x_m: 0.0,
    y_m: 0.0,
    width_m: 5.0,
    height_m: 10.0,
    created_at: new Date().toISOString()
  },
  {
    id: 'b1111111-1111-1111-1111-222222222222',
    warehouse_id: 'a1111111-1111-1111-1111-111111111111',
    code: 'KHU_100',
    name: 'Khu 100cm',
    color: '#60a5fa',
    x_m: 5.0,
    y_m: 0.0,
    width_m: 5.0,
    height_m: 10.0,
    created_at: new Date().toISOString()
  },
  {
    id: 'b1111111-1111-1111-1111-333333333333',
    warehouse_id: 'a1111111-1111-1111-1111-111111111111',
    code: 'KHU_80',
    name: 'Khu 80cm',
    color: '#93c5fd',
    x_m: 10.0,
    y_m: 0.0,
    width_m: 5.0,
    height_m: 10.0,
    created_at: new Date().toISOString()
  }
];

const DEFAULT_SEED_LOCATIONS: WarehouseLocation[] = [
  {
    id: 'c1111111-1111-1111-1111-000000000a01',
    warehouse_id: 'a1111111-1111-1111-1111-111111111111',
    zone_id: 'b1111111-1111-1111-1111-111111111111',
    code: 'A01',
    x_m: 0.0,
    y_m: 0.0,
    width_m: 1.5,
    height_m: 1.5,
    qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000a01',
    created_at: new Date().toISOString()
  },
  {
    id: 'c1111111-1111-1111-1111-000000000a02',
    warehouse_id: 'a1111111-1111-1111-1111-111111111111',
    zone_id: 'b1111111-1111-1111-1111-111111111111',
    code: 'A02',
    x_m: 1.5,
    y_m: 0.0,
    width_m: 1.5,
    height_m: 1.5,
    qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000a02',
    created_at: new Date().toISOString()
  },
  {
    id: 'c1111111-1111-1111-1111-000000000a03',
    warehouse_id: 'a1111111-1111-1111-1111-111111111111',
    zone_id: 'b1111111-1111-1111-1111-111111111111',
    code: 'A03',
    x_m: 3.0,
    y_m: 0.0,
    width_m: 1.5,
    height_m: 1.5,
    qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000a03',
    created_at: new Date().toISOString()
  },
  {
    id: 'c1111111-1111-1111-1111-000000000b01',
    warehouse_id: 'a1111111-1111-1111-1111-111111111111',
    zone_id: 'b1111111-1111-1111-1111-222222222222',
    code: 'B01',
    x_m: 0.0,
    y_m: 2.0,
    width_m: 1.5,
    height_m: 1.5,
    qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000b01',
    created_at: new Date().toISOString()
  },
  {
    id: 'c1111111-1111-1111-1111-000000000b02',
    warehouse_id: 'a1111111-1111-1111-1111-111111111111',
    zone_id: 'b1111111-1111-1111-1111-222222222222',
    code: 'B02',
    x_m: 1.5,
    y_m: 2.0,
    width_m: 1.5,
    height_m: 1.5,
    qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000b02',
    created_at: new Date().toISOString()
  },
  {
    id: 'c1111111-1111-1111-1111-000000000b03',
    warehouse_id: 'a1111111-1111-1111-1111-111111111111',
    zone_id: 'b1111111-1111-1111-1111-222222222222',
    code: 'B03',
    x_m: 3.0,
    y_m: 2.0,
    width_m: 1.5,
    height_m: 1.5,
    qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000b03',
    created_at: new Date().toISOString()
  },
  {
    id: 'c1111111-1111-1111-1111-000000000c01',
    warehouse_id: 'a1111111-1111-1111-1111-111111111111',
    zone_id: 'b1111111-1111-1111-1111-333333333333',
    code: 'C01',
    x_m: 0.0,
    y_m: 4.0,
    width_m: 1.5,
    height_m: 1.5,
    qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000c01',
    created_at: new Date().toISOString()
  },
  {
    id: 'c1111111-1111-1111-1111-000000000c02',
    warehouse_id: 'a1111111-1111-1111-1111-111111111111',
    zone_id: 'b1111111-1111-1111-1111-333333333333',
    code: 'C02',
    x_m: 1.5,
    y_m: 4.0,
    width_m: 1.5,
    height_m: 1.5,
    qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000c02',
    created_at: new Date().toISOString()
  },
  {
    id: 'c1111111-1111-1111-1111-000000000c03',
    warehouse_id: 'a1111111-1111-1111-1111-111111111111',
    zone_id: 'b1111111-1111-1111-1111-333333333333',
    code: 'C03',
    x_m: 3.0,
    y_m: 4.0,
    width_m: 1.5,
    height_m: 1.5,
    qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000c03',
    created_at: new Date().toISOString()
  },
  {
    id: 'c2222222-2222-2222-2222-000000000a01',
    warehouse_id: 'a2222222-2222-2222-2222-222222222222',
    zone_id: null,
    code: 'A01',
    x_m: 0.0,
    y_m: 0.0,
    width_m: 1.5,
    height_m: 1.5,
    qr_payload: 'WAREHOUSE_LOCATION:c2222222-2222-2222-2222-000000000a01',
    created_at: new Date().toISOString()
  },
  {
    id: 'c2222222-2222-2222-2222-000000000a02',
    warehouse_id: 'a2222222-2222-2222-2222-222222222222',
    zone_id: null,
    code: 'A02',
    x_m: 1.5,
    y_m: 0.0,
    width_m: 1.5,
    height_m: 1.5,
    qr_payload: 'WAREHOUSE_LOCATION:c2222222-2222-2222-2222-000000000a02',
    created_at: new Date().toISOString()
  },
  {
    id: 'c2222222-2222-2222-2222-000000000a03',
    warehouse_id: 'a2222222-2222-2222-2222-222222222222',
    zone_id: null,
    code: 'A03',
    x_m: 3.0,
    y_m: 0.0,
    width_m: 1.5,
    height_m: 1.5,
    qr_payload: 'WAREHOUSE_LOCATION:c2222222-2222-2222-2222-000000000a03',
    created_at: new Date().toISOString()
  }
];

const DEFAULT_SEED_PRODUCTS: Product[] = [
  {
    id: 'e1203000-0000-0000-0000-000000000001',
    product_code: 'e120.30',
    name: 'Thanh Nhựa e120 bản 30mm',
    length_value: 120.0,
    length_unit: 'cm',
    status: 'active',
    created_at: new Date().toISOString()
  },
  {
    id: 'e1003400-0000-0000-0000-000000000002',
    product_code: 'e100.34',
    name: 'Thanh Nhựa e100 bản 34mm',
    length_value: 100.0,
    length_unit: 'cm',
    status: 'active',
    created_at: new Date().toISOString()
  },
  {
    id: 'e8034300-0000-0000-0000-000000000003',
    product_code: 'e80.343',
    name: 'Thanh Nhựa e80 bản 34.3mm',
    length_value: 80.0,
    length_unit: 'cm',
    status: 'active',
    created_at: new Date().toISOString()
  },
  {
    id: 'f5004500-0000-0000-0000-000000000004',
    product_code: 'p500.45',
    name: 'Ống Profile p500 bản 45mm',
    length_value: 500.0,
    length_unit: 'cm',
    status: 'active',
    created_at: new Date().toISOString()
  },
  {
    id: 'a1009900-0000-0000-0000-000000000005',
    product_code: 'a100.99',
    name: 'Khung Nhôm a100 cao cấp',
    length_value: 100.0,
    length_unit: 'cm',
    status: 'active',
    created_at: new Date().toISOString()
  },
  {
    id: 'f8888800-0000-0000-0000-000000000006',
    product_code: 'x888.88',
    name: 'Thanh Chữ X Series 888',
    length_value: 88.0,
    length_unit: 'cm',
    status: 'active',
    created_at: new Date().toISOString()
  }
];

const DEFAULT_SEED_PRODUCT_LOCATIONS: ProductCurrentLocation[] = [
  {
    id: 'd1111111-0000-0000-0000-000000000001',
    product_id: 'e1203000-0000-0000-0000-000000000001',
    location_id: 'c1111111-1111-1111-1111-000000000b02',
    updated_at: new Date().toISOString(),
    updated_by: 'Khanh Admin'
  },
  {
    id: 'd1111111-0000-0000-0000-000000000002',
    product_id: 'e1003400-0000-0000-0000-000000000002',
    location_id: 'c1111111-1111-1111-1111-000000000a01',
    updated_at: new Date().toISOString(),
    updated_by: 'Khanh Admin'
  },
  {
    id: 'd1111111-0000-0000-0000-000000000003',
    product_id: 'e8034300-0000-0000-0000-000000000003',
    location_id: 'c1111111-1111-1111-1111-000000000c03',
    updated_at: new Date().toISOString(),
    updated_by: 'Khanh Admin'
  },
  {
    id: 'd1111111-0000-0000-0000-000000000004',
    product_id: 'f5004500-0000-0000-0000-000000000004',
    location_id: 'c2222222-2222-2222-2222-000000000a01',
    updated_at: new Date().toISOString(),
    updated_by: 'Khanh Admin'
  }
];

// Initialize IndexedDB with Seed if empty
export const initializeProductionSeed = async () => {
  const existing = await idbGetAll<Warehouse>(STORES.WAREHOUSES);
  if (existing.length === 0) {
    console.log('📦 Seeding initial data to IndexedDB...');
    await idbPutItems(STORES.WAREHOUSES, DEFAULT_SEED_WAREHOUSES);
    await idbPutItems(STORES.ZONES, DEFAULT_SEED_ZONES);
    await idbPutItems(STORES.LOCATIONS, DEFAULT_SEED_LOCATIONS);
    await idbPutItems(STORES.PRODUCTS, DEFAULT_SEED_PRODUCTS);
    await idbPutItems(STORES.PRODUCT_LOCATIONS, DEFAULT_SEED_PRODUCT_LOCATIONS);
  }
};

initializeProductionSeed();

// Auto Bootstrap Supabase if Server Database is Empty
export const autoBootstrapSupabaseDatabase = async (): Promise<boolean> => {
  if (!supabaseClient) return false;
  try {
    const { data: existingWh } = await supabaseClient
      .from('warehouses')
      .select('id')
      .limit(1);

    if (!existingWh || existingWh.length === 0) {
      console.log('⚡ Server database is empty. Bootstrapping production seed...');
      await supabaseClient.from('warehouses').upsert(DEFAULT_SEED_WAREHOUSES);
      await supabaseClient.from('warehouse_zones').upsert(DEFAULT_SEED_ZONES);
      await supabaseClient.from('warehouse_locations').upsert(DEFAULT_SEED_LOCATIONS);
      await supabaseClient.from('products').upsert(DEFAULT_SEED_PRODUCTS);
      await supabaseClient.from('product_current_locations').upsert(DEFAULT_SEED_PRODUCT_LOCATIONS);
      console.log('✅ Server database bootstrap completed!');
    }
    return true;
  } catch (err) {
    console.warn('Auto-bootstrap failed:', err);
    return false;
  }
};

if (supabaseClient) {
  autoBootstrapSupabaseDatabase();
}

// --- 1. Warehouse APIs ---
export const getWarehouses = async (): Promise<Warehouse[]> => {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('warehouses')
        .select('*')
        .order('code', { ascending: true });
      if (!error && data) {
        await idbPutItems(STORES.WAREHOUSES, data);
        return data;
      }
    } catch (e) {
      console.warn('Supabase fetch warehouses failed, using IndexedDB:', e);
    }
  }
  return idbGetAll<Warehouse>(STORES.WAREHOUSES);
};

export const createWarehouse = async (
  code: string,
  name: string,
  widthM = 15.0,
  lengthM = 30.0,
  gpsLat: number | null = null,
  gpsLng: number | null = null,
  color = '#2563eb'
): Promise<Warehouse> => {
  const newWh: Warehouse = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
    code: code.trim().toUpperCase(),
    name: name.trim(),
    width_m: widthM,
    length_m: lengthM,
    gps_lat: gpsLat,
    gps_lng: gpsLng,
    color,
    created_at: new Date().toISOString()
  };

  await idbPutItem(STORES.WAREHOUSES, newWh);

  if (supabaseClient) {
    try {
      await supabaseClient.from('warehouses').upsert(newWh);
    } catch (e) {
      console.warn('Supabase create warehouse queued offline:', e);
      await queueIndexedDbOutbox('create_warehouse', newWh);
    }
  }
  return newWh;
};

// --- 2. Warehouse Zones APIs ---
export const getWarehouseZones = async (warehouseId?: string): Promise<WarehouseZone[]> => {
  if (supabaseClient) {
    try {
      let query = supabaseClient.from('warehouse_zones').select('*');
      if (warehouseId) query = query.eq('warehouse_id', warehouseId);
      const { data, error } = await query.order('code', { ascending: true });
      if (!error && data) {
        await idbPutItems(STORES.ZONES, data);
        return data;
      }
    } catch (e) {
      console.warn('Supabase fetch zones failed, using IndexedDB:', e);
    }
  }
  const all = await idbGetAll<WarehouseZone>(STORES.ZONES);
  return warehouseId ? all.filter(z => z.warehouse_id === warehouseId) : all;
};

export const createWarehouseZone = async (
  warehouseId: string,
  code: string,
  name: string,
  xM = 0.0,
  yM = 0.0,
  widthM = 5.0,
  heightM = 10.0,
  color = '#3b82f6'
): Promise<WarehouseZone> => {
  const newZone: WarehouseZone = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
    warehouse_id: warehouseId,
    code: code.trim().toUpperCase(),
    name: name.trim(),
    x_m: xM,
    y_m: yM,
    width_m: widthM,
    height_m: heightM,
    color,
    created_at: new Date().toISOString()
  };

  await idbPutItem(STORES.ZONES, newZone);

  if (supabaseClient) {
    try {
      await supabaseClient.from('warehouse_zones').upsert(newZone);
    } catch (e) {
      await queueIndexedDbOutbox('create_zone', newZone);
    }
  }
  return newZone;
};

// --- 3. Warehouse Locations APIs ---
export const getWarehouseLocations = async (warehouseId?: string): Promise<WarehouseLocation[]> => {
  if (supabaseClient) {
    try {
      let query = supabaseClient.from('warehouse_locations').select('*');
      if (warehouseId) query = query.eq('warehouse_id', warehouseId);
      const { data, error } = await query.order('code', { ascending: true });
      if (!error && data) {
        await idbPutItems(STORES.LOCATIONS, data);
        return data;
      }
    } catch (e) {
      console.warn('Supabase fetch locations failed, using IndexedDB:', e);
    }
  }
  const all = await idbGetAll<WarehouseLocation>(STORES.LOCATIONS);
  return warehouseId ? all.filter(l => l.warehouse_id === warehouseId) : all;
};

export const getWarehouseLocationById = async (locationId: string): Promise<WarehouseLocation | null> => {
  const all = await getWarehouseLocations();
  return all.find(l => l.id === locationId) || null;
};

export const createWarehouseLocation = async (
  warehouseId: string,
  code: string,
  zoneId: string | null = null,
  xM = 0.0,
  yM = 0.0,
  widthM = 1.5,
  heightM = 1.5
): Promise<WarehouseLocation> => {
  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
  const cleanCode = code.trim().toUpperCase();
  const newLoc: WarehouseLocation = {
    id,
    warehouse_id: warehouseId,
    zone_id: zoneId,
    code: cleanCode,
    x_m: xM,
    y_m: yM,
    width_m: widthM,
    height_m: heightM,
    qr_payload: `WAREHOUSE_LOCATION:${id}`,
    created_at: new Date().toISOString()
  };

  await idbPutItem(STORES.LOCATIONS, newLoc);

  if (supabaseClient) {
    try {
      await supabaseClient.from('warehouse_locations').upsert(newLoc);
    } catch (e) {
      await queueIndexedDbOutbox('create_location', newLoc);
    }
  }
  return newLoc;
};

export const deleteWarehouseLocation = async (locationId: string): Promise<boolean> => {
  await idbDeleteItem(STORES.LOCATIONS, locationId);

  // Clear product binding if any
  const prods = await idbGetAll<ProductCurrentLocation>(STORES.PRODUCT_LOCATIONS);
  const cur = prods.find(p => p.location_id === locationId);
  if (cur) {
    cur.location_id = null;
    cur.updated_at = new Date().toISOString();
    await idbPutItem(STORES.PRODUCT_LOCATIONS, cur);
  }

  if (supabaseClient) {
    try {
      await supabaseClient.from('warehouse_locations').delete().eq('id', locationId);
    } catch (e) {
      console.warn('Supabase delete location failed:', e);
    }
  }
  return true;
};

// --- 4. Products APIs ---
export const getProducts = async (): Promise<Product[]> => {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('products')
        .select('*')
        .order('product_code', { ascending: true });
      if (!error && data) {
        await idbPutItems(STORES.PRODUCTS, data);
        return data;
      }
    } catch (e) {
      console.warn('Supabase fetch products failed, using IndexedDB:', e);
    }
  }
  return idbGetAll<Product>(STORES.PRODUCTS);
};

export const getProductByCode = async (productCode: string): Promise<Product | null> => {
  const cleanCode = productCode.trim().toLowerCase();
  const allProds = await getProducts();
  return allProds.find(p => p.product_code.toLowerCase() === cleanCode) || null;
};

export const getProductById = async (productId: string): Promise<Product | null> => {
  const allProds = await getProducts();
  return allProds.find(p => p.id === productId) || null;
};

// --- 5. Product Current Locations APIs ---
export const getCurrentProductLocations = async (): Promise<ProductCurrentLocation[]> => {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('product_current_locations')
        .select('*');
      if (!error && data) {
        await idbPutItems(STORES.PRODUCT_LOCATIONS, data);
        return data;
      }
    } catch (e) {
      console.warn('Supabase fetch current locations failed, using IndexedDB:', e);
    }
  }
  return idbGetAll<ProductCurrentLocation>(STORES.PRODUCT_LOCATIONS);
};

export const getProductCurrentLocation = async (productId: string): Promise<ProductCurrentLocation | null> => {
  const all = await getCurrentProductLocations();
  return all.find(c => c.product_id === productId) || null;
};

// --- 6. Movements History & Idempotent Movement Execution ---
export const getMovementsHistory = async (): Promise<ProductLocationMovement[]> => {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('product_location_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data) {
        await idbPutItems(STORES.MOVEMENTS, data);
        return data;
      }
    } catch (e) {
      console.warn('Supabase fetch movements failed, using IndexedDB:', e);
    }
  }
  const all = await idbGetAll<ProductLocationMovement>(STORES.MOVEMENTS);
  return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

export const executeProductMovement = async (
  productId: string,
  toLocationId: string,
  userName = 'Staff',
  idempotencyKey?: string,
  ocrConfidence: number | null = null,
  gpsLat: number | null = null,
  gpsLng: number | null = null
): Promise<{ success: boolean; movementId: string }> => {
  const effectiveKey = idempotencyKey || `${productId}_${toLocationId}_${Date.now()}`;

  // 1. Check idempotency in local database
  const allMoves = await idbGetAll<ProductLocationMovement>(STORES.MOVEMENTS);
  const existing = allMoves.find(m => m.idempotency_key === effectiveKey);
  if (existing) {
    return { success: true, movementId: existing.id };
  }

  // 2. Get current location for 'from_location_id'
  const curLoc = await getProductCurrentLocation(productId);
  const fromLocationId = curLoc ? curLoc.location_id : null;

  const movementId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
  const newMovement: ProductLocationMovement = {
    id: movementId,
    product_id: productId,
    from_location_id: fromLocationId,
    to_location_id: toLocationId,
    status: 'completed',
    idempotency_key: effectiveKey,
    ocr_confidence: ocrConfidence,
    gps_lat: gpsLat,
    gps_lng: gpsLng,
    user_name: userName,
    created_at: new Date().toISOString()
  };

  // 3. Update local IndexedDB
  await idbPutItem(STORES.MOVEMENTS, newMovement);

  const updatedCurLoc: ProductCurrentLocation = {
    id: curLoc ? curLoc.id : (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9)),
    product_id: productId,
    location_id: toLocationId,
    updated_at: new Date().toISOString(),
    updated_by: userName
  };
  await idbPutItem(STORES.PRODUCT_LOCATIONS, updatedCurLoc);

  // 4. Execute atomic RPC on Supabase if online
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.rpc('execute_product_movement', {
        p_product_id: productId,
        p_to_location_id: toLocationId,
        p_user_name: userName,
        p_idempotency_key: effectiveKey,
        p_ocr_confidence: ocrConfidence,
        p_gps_lat: gpsLat,
        p_gps_lng: gpsLng
      });
      if (error) throw error;
      return { success: true, movementId: data.movement_id || movementId };
    } catch (err) {
      console.warn('RPC execution failed, queued in offline outbox:', err);
      await queueIndexedDbOutbox('execute_movement', {
        productId,
        toLocationId,
        userName,
        idempotencyKey: effectiveKey,
        ocrConfidence,
        gpsLat,
        gpsLng
      });
    }
  } else {
    await queueIndexedDbOutbox('execute_movement', {
      productId,
      toLocationId,
      userName,
      idempotencyKey: effectiveKey,
      ocrConfidence,
      gpsLat,
      gpsLng
    });
  }

  return { success: true, movementId };
};

// --- 7. Offline Sync Engine ---
export const getSyncOutbox = async (): Promise<SyncAction[]> => {
  return getIndexedDbOutbox();
};

export const syncOfflineQueue = async (): Promise<{ success: boolean; count: number; errors: string[] }> => {
  if (!supabaseClient) {
    return { success: false, count: 0, errors: ['Supabase client is not connected'] };
  }

  const outbox = await getIndexedDbOutbox();
  if (outbox.length === 0) {
    return { success: true, count: 0, errors: [] };
  }

  let successCount = 0;
  const errors: string[] = [];

  for (const item of outbox) {
    try {
      if (item.action_type === 'execute_movement') {
        const { productId, toLocationId, userName, idempotencyKey, ocrConfidence, gpsLat, gpsLng } = item.payload;
        await supabaseClient.rpc('execute_product_movement', {
          p_product_id: productId,
          p_to_location_id: toLocationId,
          p_user_name: userName,
          p_idempotency_key: idempotencyKey,
          p_ocr_confidence: ocrConfidence,
          p_gps_lat: gpsLat,
          p_gps_lng: gpsLng
        });
      } else if (item.action_type === 'create_warehouse') {
        await supabaseClient.from('warehouses').upsert(item.payload);
      } else if (item.action_type === 'create_zone') {
        await supabaseClient.from('warehouse_zones').upsert(item.payload);
      } else if (item.action_type === 'create_location') {
        await supabaseClient.from('warehouse_locations').upsert(item.payload);
      }
      await markIndexedDbOutboxDone(item.id);
      successCount++;
    } catch (err: any) {
      errors.push(`Action ${item.id} error: ${err.message}`);
    }
  }

  return { success: errors.length === 0, count: successCount, errors };
};

// Realtime Changes Listener
export const subscribeToRealtimeChanges = (callback: () => void) => {
  if (!supabaseClient) return () => {};

  const channel = supabaseClient
    .channel('warehouse_realtime_channel')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => {
      callback();
    })
    .subscribe();

  return () => {
    supabaseClient?.removeChannel(channel);
  };
};

export const resetLocalDatabase = async (): Promise<void> => {
  await clearIndexedDbData();
  await initializeProductionSeed();
};
