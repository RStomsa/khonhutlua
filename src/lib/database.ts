import { createClient, SupabaseClient } from '@supabase/supabase-js';

// --- Interface Definitions ---
export interface Warehouse {
  id: string;
  name: string;
  columns: number;
  rows: number;
  type: 'grid' | 'aisle';
  created_at?: string;
}

export interface WarehouseLocation {
  id: string;
  warehouse_id: string;
  code: string;
  column_index: number;
  row_index: number;
  qr_payload: string;
  created_at?: string;
}

export interface ProductCurrentLocation {
  product_code: string;
  location_id: string | null;
  updated_at?: string;
  updated_by?: string;
}

export interface ProductLocationMovement {
  id: string;
  product_code: string;
  from_location_id: string | null;
  to_location_id: string | null;
  status: 'started' | 'completed';
  ocr_confidence: number | null;
  ocr_image_path?: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  user_name: string | null;
  created_at: string;
}

export interface SyncAction {
  id: string;
  action_type: 'start_move' | 'complete_move' | 'create_warehouse';
  payload: any;
  status: 'pending' | 'synced' | 'failed';
  error_message?: string | null;
  created_at: string;
}

// --- Seed Constants ---
const INITIAL_WAREHOUSES: Warehouse[] = [
  { id: 'K1', name: 'K1 Blue', columns: 3, rows: 4, type: 'grid' },
  { id: 'K2', name: 'K2 Pink', columns: 3, rows: 2, type: 'grid' },
  { id: 'K3', name: 'K3 Red', columns: 2, rows: 3, type: 'grid' },
  { id: 'K4', name: 'K4 Green', columns: 2, rows: 1, type: 'aisle' }
];

const generateK1Locations = (): WarehouseLocation[] => {
  const locs: WarehouseLocation[] = [];
  const rows = ['A', 'B', 'C', 'D'];
  for (let rIndex = 0; rIndex < 4; rIndex++) {
    for (let cIndex = 0; cIndex < 3; cIndex++) {
      const code = `${rows[rIndex]}0${cIndex + 1}`;
      locs.push({
        id: `K1-${code}`,
        warehouse_id: 'K1',
        code,
        column_index: cIndex,
        row_index: rIndex,
        qr_payload: `WAREHOUSE_LOCATION:K1-${code}`
      });
    }
  }
  return locs;
};

const generateK2Locations = (): WarehouseLocation[] => {
  const locs: WarehouseLocation[] = [];
  const rows = ['A', 'B'];
  for (let rIndex = 0; rIndex < 2; rIndex++) {
    for (let cIndex = 0; cIndex < 3; cIndex++) {
      const code = `${rows[rIndex]}0${cIndex + 1}`;
      locs.push({
        id: `K2-${code}`,
        warehouse_id: 'K2',
        code,
        column_index: cIndex,
        row_index: rIndex,
        qr_payload: `WAREHOUSE_LOCATION:K2-${code}`
      });
    }
  }
  return locs;
};

const generateK3Locations = (): WarehouseLocation[] => {
  const locs: WarehouseLocation[] = [];
  const rows = ['A', 'B', 'C'];
  for (let rIndex = 0; rIndex < 3; rIndex++) {
    for (let cIndex = 0; cIndex < 2; cIndex++) {
      const code = `${rows[rIndex]}0${cIndex + 1}`;
      locs.push({
        id: `K3-${code}`,
        warehouse_id: 'K3',
        code,
        column_index: cIndex,
        row_index: rIndex,
        qr_payload: `WAREHOUSE_LOCATION:K3-${code}`
      });
    }
  }
  return locs;
};

const generateK4Locations = (): WarehouseLocation[] => [
  { id: 'K4-D1', warehouse_id: 'K4', code: 'D1', column_index: 0, row_index: 0, qr_payload: 'WAREHOUSE_LOCATION:K4-D1' },
  { id: 'K4-D2', warehouse_id: 'K4', code: 'D2', column_index: 1, row_index: 0, qr_payload: 'WAREHOUSE_LOCATION:K4-D2' }
];

const INITIAL_LOCATIONS: WarehouseLocation[] = [
  ...generateK1Locations(),
  ...generateK2Locations(),
  ...generateK3Locations(),
  ...generateK4Locations()
];

const INITIAL_PRODUCT_LOCATIONS: ProductCurrentLocation[] = [
  { product_code: 'e120.30', location_id: 'K1-B02', updated_at: new Date().toISOString(), updated_by: 'System Seed' },
  { product_code: 'p500.45', location_id: 'K2-A03', updated_at: new Date().toISOString(), updated_by: 'System Seed' },
  { product_code: 'a100.99', location_id: 'K3-C01', updated_at: new Date().toISOString(), updated_by: 'System Seed' },
  { product_code: 'x888.88', location_id: 'K4-D1', updated_at: new Date().toISOString(), updated_by: 'System Seed' }
];

const INITIAL_MOVEMENTS: ProductLocationMovement[] = [
  {
    id: 'm1',
    product_code: 'e120.30',
    from_location_id: null,
    to_location_id: 'K1-B02',
    status: 'completed',
    ocr_confidence: 94.5,
    gps_lat: 10.762622,
    gps_lng: 106.660172,
    user_name: 'Admin Seed',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'm2',
    product_code: 'p500.45',
    from_location_id: null,
    to_location_id: 'K2-A03',
    status: 'completed',
    ocr_confidence: 88.2,
    gps_lat: 10.762990,
    gps_lng: 106.660500,
    user_name: 'Admin Seed',
    created_at: new Date(Date.now() - 3600000).toISOString()
  }
];

// --- Supabase Settings & Auto Environment Detection ---
const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const envAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

let supabaseUrl = localStorage.getItem('supabase_url') || envUrl;
let supabaseAnonKey = localStorage.getItem('supabase_anon_key') || envAnonKey;
let supabaseClient: SupabaseClient | null = null;

const initSupabase = () => {
  if (supabaseUrl && supabaseAnonKey) {
    try {
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
        realtime: { params: { eventsPerSecond: 10 } }
      });
    } catch (e) {
      console.error('Failed to init Supabase client:', e);
      supabaseClient = null;
    }
  } else {
    supabaseClient = null;
  }
};

initSupabase();

// --- Local Storage Keys ---
const LS_KEYS = {
  WAREHOUSES: 'kho_pwa_warehouses',
  LOCATIONS: 'kho_pwa_locations',
  PRODUCT_LOCATIONS: 'kho_pwa_product_locations',
  MOVEMENTS: 'kho_pwa_movements',
  SYNC_OUTBOX: 'kho_pwa_sync_outbox'
};

// --- Initialization Helper ---
export const initializeSeed = (force = false) => {
  if (force || !localStorage.getItem(LS_KEYS.WAREHOUSES)) {
    localStorage.setItem(LS_KEYS.WAREHOUSES, JSON.stringify(INITIAL_WAREHOUSES));
    localStorage.setItem(LS_KEYS.LOCATIONS, JSON.stringify(INITIAL_LOCATIONS));
    localStorage.setItem(LS_KEYS.PRODUCT_LOCATIONS, JSON.stringify(INITIAL_PRODUCT_LOCATIONS));
    localStorage.setItem(LS_KEYS.MOVEMENTS, JSON.stringify(INITIAL_MOVEMENTS));
    localStorage.setItem(LS_KEYS.SYNC_OUTBOX, JSON.stringify([]));
  }
};

// Run seed init automatically
initializeSeed();

// --- Auto Push Seed Data to Supabase if Server Database is Empty ---
export const autoBootstrapSupabaseDatabase = async () => {
  if (!supabaseClient) return;
  try {
    const { data: existingWh, error } = await supabaseClient
      .from('warehouses')
      .select('id')
      .limit(1);

    if (!error && (!existingWh || existingWh.length === 0)) {
      console.log('⚡ Máy chủ Supabase chưa có dữ liệu, đang tự động đẩy sơ đồ kho, kệ và sản phẩm mẫu lên...');
      await supabaseClient.from('warehouses').upsert(INITIAL_WAREHOUSES);
      await supabaseClient.from('warehouse_locations').upsert(INITIAL_LOCATIONS);
      await supabaseClient.from('product_current_locations').upsert(INITIAL_PRODUCT_LOCATIONS);
      await supabaseClient.from('product_location_movements').upsert(INITIAL_MOVEMENTS);
      console.log('✅ Tự động khởi tạo dữ liệu kho lên Supabase thành công!');
    }
  } catch (err) {
    console.warn('Lỗi kiểm tra dữ liệu Supabase:', err);
  }
};

// Auto-bootstrap whenever connected
if (supabaseClient) {
  autoBootstrapSupabaseDatabase();
}

// --- Configuration APIs ---
export const saveSupabaseConfig = (url: string, key: string) => {
  const cleanUrl = url.trim();
  const cleanKey = key.trim();
  localStorage.setItem('supabase_url', cleanUrl);
  localStorage.setItem('supabase_anon_key', cleanKey);
  supabaseUrl = cleanUrl;
  supabaseAnonKey = cleanKey;
  initSupabase();
  if (supabaseClient) {
    autoBootstrapSupabaseDatabase();
  }
};

export const clearSupabaseConfig = () => {
  localStorage.removeItem('supabase_url');
  localStorage.removeItem('supabase_anon_key');
  supabaseUrl = envUrl;
  supabaseAnonKey = envAnonKey;
  initSupabase();
};

export const getSupabaseConfig = () => {
  return {
    url: supabaseUrl,
    key: supabaseAnonKey,
    isFromEnv: Boolean(envUrl && envAnonKey && (supabaseUrl === envUrl)),
    isEnabled: !!supabaseClient
  };
};

export const isSupabaseEnabled = () => {
  return !!supabaseClient;
};

// --- Warehouse GPS Coordinates Database APIs ---
export const getWarehouseGPSConfig = async (): Promise<{ lat: number; lng: number; scale: number }> => {
  const DEFAULT_GPS = { lat: 10.7932, lng: 106.6542, scale: 1 };

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('warehouse_settings')
        .select('value')
        .eq('id', 'warehouse_map_gps')
        .single();
      
      if (!error && data && data.value) {
        localStorage.setItem('kho_gps_coords', JSON.stringify(data.value));
        return data.value;
      }
    } catch (e) {
      console.warn('Không thể tải GPS từ Supabase, chuyển dùng cache:', e);
    }
  }

  const cached = localStorage.getItem('kho_gps_coords');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed.lat && parsed.lng) return { lat: parsed.lat, lng: parsed.lng, scale: parsed.scale || 1 };
    } catch (e) {}
  }

  return DEFAULT_GPS;
};

// --- Per-Warehouse Geometries Configuration ---
export interface WarehouseGeometryConfig {
  centerLat: number;
  centerLng: number;
  width: number;  // in degrees (approx 50m = 0.0005)
  height: number; // in degrees (approx 40m = 0.0004)
  color?: string;
}

export type AllWarehousesGeometries = Record<string, WarehouseGeometryConfig>;

export const getWarehousesGeometriesConfig = async (): Promise<AllWarehousesGeometries> => {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('warehouse_settings')
        .select('value')
        .eq('id', 'warehouses_individual_geometries')
        .single();
      
      if (!error && data && data.value) {
        localStorage.setItem('kho_individual_geometries', JSON.stringify(data.value));
        return data.value;
      }
    } catch (e) {
      console.warn('Không thể tải cấu hình từng kho từ Supabase, dùng cache:', e);
    }
  }

  const cached = localStorage.getItem('kho_individual_geometries');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }

  return {};
};

export const saveWarehouseGeometryConfig = async (
  warehouseId: string,
  geom: WarehouseGeometryConfig
): Promise<boolean> => {
  const current = await getWarehousesGeometriesConfig();
  const updated: AllWarehousesGeometries = {
    ...current,
    [warehouseId]: geom
  };

  localStorage.setItem('kho_individual_geometries', JSON.stringify(updated));

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('warehouse_settings')
        .upsert({
          id: 'warehouses_individual_geometries',
          value: updated,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      console.log(`⚡ Đã cập nhật tọa độ & kích thước riêng cho Kho ${warehouseId} lên Supabase!`);
      return true;
    } catch (e) {
      console.warn(`Lưu tọa độ kho ${warehouseId} lên Supabase thất bại:`, e);
      return false;
    }
  }

  return true;
};

// --- Realtime Subscription Listener ---
export const subscribeToRealtimeChanges = (onDataChanged: () => void) => {
  if (!supabaseClient) return () => {};

  try {
    const channel = supabaseClient
      .channel('public-warehouse-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_location_movements' }, () => {
        onDataChanged();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_current_locations' }, () => {
        onDataChanged();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouses' }, () => {
        onDataChanged();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_settings' }, () => {
        onDataChanged();
      })
      .subscribe();

    return () => {
      if (supabaseClient) {
        supabaseClient.removeChannel(channel);
      }
    };
  } catch (e) {
    console.warn('Realtime subscription error:', e);
    return () => {};
  }
};

// Auto Background Network Sync
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (supabaseClient) {
      syncOfflineQueue();
    }
  });

  setInterval(() => {
    if (navigator.onLine && supabaseClient) {
      syncOfflineQueue();
    }
  }, 12000);
}

// --- Core DB Data APIs ---

// 1. Get Warehouses
export const getWarehouses = async (): Promise<Warehouse[]> => {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('warehouses')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Supabase fetch failed, falling back to local DB:', e);
    }
  }
  return JSON.parse(localStorage.getItem(LS_KEYS.WAREHOUSES) || '[]');
};

// 2. Get Locations of Warehouse
export const getWarehouseLocations = async (warehouseId: string): Promise<WarehouseLocation[]> => {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('warehouse_locations')
        .select('*')
        .eq('warehouse_id', warehouseId);
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Supabase fetch failed, falling back to local DB:', e);
    }
  }
  const allLocs: WarehouseLocation[] = JSON.parse(localStorage.getItem(LS_KEYS.LOCATIONS) || '[]');
  return allLocs.filter(loc => loc.warehouse_id === warehouseId);
};

// 3. Get Current Locations map
export const getCurrentProductLocations = async (): Promise<ProductCurrentLocation[]> => {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('product_current_locations')
        .select('*');
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Supabase fetch failed, falling back to local DB:', e);
    }
  }
  return JSON.parse(localStorage.getItem(LS_KEYS.PRODUCT_LOCATIONS) || '[]');
};

// 4. Get Current Location for specific product
export const getProductCurrentLocation = async (productCode: string): Promise<ProductCurrentLocation | null> => {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('product_current_locations')
        .select('*')
        .eq('product_code', productCode)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('Supabase fetch failed, falling back to local DB:', e);
    }
  }
  const allCur: ProductCurrentLocation[] = JSON.parse(localStorage.getItem(LS_KEYS.PRODUCT_LOCATIONS) || '[]');
  return allCur.find(cur => cur.product_code === productCode) || null;
};

// 5. Start Product Movement (fromLocationId can be loaded automatically from current location)
export const startProductMovement = async (
  productCode: string,
  fromLocationId: string | null,
  ocrConfidence: number | null,
  ocrImagePath: string | null = null
): Promise<ProductLocationMovement> => {
  const movement: ProductLocationMovement = {
    id: Math.random().toString(36).substr(2, 9),
    product_code: productCode,
    from_location_id: fromLocationId,
    to_location_id: null,
    status: 'started',
    ocr_confidence: ocrConfidence,
    ocr_image_path: ocrImagePath,
    gps_lat: null,
    gps_lng: null,
    user_name: 'User',
    created_at: new Date().toISOString()
  };

  // 1. Write to LocalStorage (always keep it sync'ed for instant UX)
  const allMovements: ProductLocationMovement[] = JSON.parse(localStorage.getItem(LS_KEYS.MOVEMENTS) || '[]');
  allMovements.push(movement);
  localStorage.setItem(LS_KEYS.MOVEMENTS, JSON.stringify(allMovements));

  // 2. Try saving to Supabase or queue offline
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('product_location_movements')
        .insert({
          id: movement.id,
          product_code: movement.product_code,
          from_location_id: movement.from_location_id,
          to_location_id: null,
          status: 'started',
          ocr_confidence: movement.ocr_confidence,
          ocr_image_path: movement.ocr_image_path,
          gps_lat: null,
          gps_lng: null,
          user_name: movement.user_name
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('Supabase save failed, queuing offline:', e);
      queueOfflineAction('start_move', movement);
    }
  }

  return movement;
};

// 6. Complete Product Movement
export const completeProductMovement = async (
  productCode: string,
  toLocationId: string,
  gpsLat: number | null,
  gpsLng: number | null,
  userName: string = 'User'
): Promise<ProductLocationMovement> => {
  const allMovements: ProductLocationMovement[] = JSON.parse(localStorage.getItem(LS_KEYS.MOVEMENTS) || '[]');
  
  // Find current started movement for this product
  let activeMove = allMovements.find(m => m.product_code === productCode && m.status === 'started');
  
  const fromLocationId = activeMove ? activeMove.from_location_id : null;
  const ocrConfidence = activeMove ? activeMove.ocr_confidence : null;

  const finishedMove: ProductLocationMovement = {
    id: activeMove ? activeMove.id : Math.random().toString(36).substr(2, 9),
    product_code: productCode,
    from_location_id: fromLocationId,
    to_location_id: toLocationId,
    status: 'completed',
    ocr_confidence: ocrConfidence,
    gps_lat: gpsLat,
    gps_lng: gpsLng,
    user_name: userName,
    created_at: new Date().toISOString()
  };

  // Update in local movements list
  let updatedMovements: ProductLocationMovement[];
  if (activeMove) {
    updatedMovements = allMovements.map(m => m.id === activeMove.id ? finishedMove : m);
  } else {
    updatedMovements = [...allMovements, finishedMove];
  }
  localStorage.setItem(LS_KEYS.MOVEMENTS, JSON.stringify(updatedMovements));

  // Update current product location in LocalStorage
  const allCur: ProductCurrentLocation[] = JSON.parse(localStorage.getItem(LS_KEYS.PRODUCT_LOCATIONS) || '[]');
  const idx = allCur.findIndex(c => c.product_code === productCode);
  const newLoc: ProductCurrentLocation = {
    product_code: productCode,
    location_id: toLocationId,
    updated_at: new Date().toISOString(),
    updated_by: userName
  };
  if (idx > -1) {
    allCur[idx] = newLoc;
  } else {
    allCur.push(newLoc);
  }
  localStorage.setItem(LS_KEYS.PRODUCT_LOCATIONS, JSON.stringify(allCur));

  // Try updating Supabase or queue offline
  if (supabaseClient) {
    try {
      // Upsert product current location
      const { error: curErr } = await supabaseClient
        .from('product_current_locations')
        .upsert({
          product_code: productCode,
          location_id: toLocationId,
          updated_at: newLoc.updated_at,
          updated_by: newLoc.updated_by
        });
      if (curErr) throw curErr;

      // Upsert or insert movement record
      const { data, error: moveErr } = await supabaseClient
        .from('product_location_movements')
        .upsert({
          id: finishedMove.id,
          product_code: finishedMove.product_code,
          from_location_id: finishedMove.from_location_id,
          to_location_id: finishedMove.to_location_id,
          status: 'completed',
          ocr_confidence: finishedMove.ocr_confidence,
          gps_lat: finishedMove.gps_lat,
          gps_lng: finishedMove.gps_lng,
          user_name: finishedMove.user_name,
          created_at: finishedMove.created_at
        })
        .select()
        .single();
      if (moveErr) throw moveErr;
      return data;
    } catch (e) {
      console.warn('Supabase save failed, queuing offline:', e);
      queueOfflineAction('complete_move', finishedMove);
    }
  }

  return finishedMove;
};

// 7. Get History Logs
export const getMovementsHistory = async (): Promise<ProductLocationMovement[]> => {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('product_location_movements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Supabase fetch failed, falling back to local DB:', e);
    }
  }
  const list: ProductLocationMovement[] = JSON.parse(localStorage.getItem(LS_KEYS.MOVEMENTS) || '[]');
  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

// 8. Create Custom Warehouse (along with dynamic locations)
export const createCustomWarehouse = async (
  id: string,
  name: string,
  columns: number,
  rows: number,
  type: 'grid' | 'aisle'
): Promise<Warehouse> => {
  const warehouse: Warehouse = {
    id,
    name,
    columns,
    rows,
    type,
    created_at: new Date().toISOString()
  };

  // Generate dynamic locations
  const generatedLocs: WarehouseLocation[] = [];
  if (type === 'grid') {
    // Label rows with letters (A, B, C, D...)
    const getRowLetter = (index: number) => String.fromCharCode(65 + index); // 65 is 'A'
    for (let r = 0; r < rows; r++) {
      const rowLetter = getRowLetter(r);
      for (let c = 0; c < columns; c++) {
        const colString = String(c + 1).padStart(2, '0');
        const code = `${rowLetter}${colString}`;
        generatedLocs.push({
          id: `${id}-${code}`,
          warehouse_id: id,
          code,
          column_index: c,
          row_index: r,
          qr_payload: `WAREHOUSE_LOCATION:${id}-${code}`
        });
      }
    }
  } else {
    // Aisles layout: K5-D1, K5-D2
    for (let c = 0; c < columns; c++) {
      const code = `D${c + 1}`;
      generatedLocs.push({
        id: `${id}-${code}`,
        warehouse_id: id,
        code,
        column_index: c,
        row_index: 0,
        qr_payload: `WAREHOUSE_LOCATION:${id}-${code}`
      });
    }
  }

  // Update LocalStorage
  const allWhs: Warehouse[] = JSON.parse(localStorage.getItem(LS_KEYS.WAREHOUSES) || '[]');
  allWhs.push(warehouse);
  localStorage.setItem(LS_KEYS.WAREHOUSES, JSON.stringify(allWhs));

  const allLocs: WarehouseLocation[] = JSON.parse(localStorage.getItem(LS_KEYS.LOCATIONS) || '[]');
  const updatedLocs = [...allLocs, ...generatedLocs];
  localStorage.setItem(LS_KEYS.LOCATIONS, JSON.stringify(updatedLocs));

  if (supabaseClient) {
    try {
      await supabaseClient.from('warehouses').upsert(warehouse);
      await supabaseClient.from('warehouse_locations').upsert(generatedLocs);
    } catch (e) {
      console.warn('Supabase save failed, queuing offline:', e);
      queueOfflineAction('create_warehouse', { warehouse, locations: generatedLocs });
    }
  }

  return warehouse;
};

// 9. Update Warehouse Grid / Partitioning
export const updateWarehousePartitionGrid = async (
  warehouseId: string,
  columns: number,
  rows: number,
  type: 'grid' | 'aisle' = 'grid',
  regenerateSlots = false
): Promise<boolean> => {
  const allWhs: Warehouse[] = JSON.parse(localStorage.getItem(LS_KEYS.WAREHOUSES) || '[]');
  const whIdx = allWhs.findIndex(w => w.id === warehouseId);
  if (whIdx > -1) {
    allWhs[whIdx].columns = columns;
    allWhs[whIdx].rows = rows;
    allWhs[whIdx].type = type;
    localStorage.setItem(LS_KEYS.WAREHOUSES, JSON.stringify(allWhs));
  }

  if (supabaseClient) {
    try {
      await supabaseClient
        .from('warehouses')
        .update({ columns, rows, type })
        .eq('id', warehouseId);
    } catch (e) {
      console.warn('Update warehouse grid in Supabase failed:', e);
    }
  }

  if (regenerateSlots) {
    let allLocs: WarehouseLocation[] = JSON.parse(localStorage.getItem(LS_KEYS.LOCATIONS) || '[]');
    const otherLocs = allLocs.filter(l => l.warehouse_id !== warehouseId);
    const newLocs: WarehouseLocation[] = [];

    if (type === 'grid') {
      const getRowLetter = (index: number) => String.fromCharCode(65 + index);
      for (let r = 0; r < rows; r++) {
        const rowLetter = getRowLetter(r);
        for (let c = 0; c < columns; c++) {
          const colString = String(c + 1).padStart(2, '0');
          const code = `${rowLetter}${colString}`;
          newLocs.push({
            id: `${warehouseId}-${code}`,
            warehouse_id: warehouseId,
            code,
            column_index: c,
            row_index: r,
            qr_payload: `WAREHOUSE_LOCATION:${warehouseId}-${code}`
          });
        }
      }
    } else {
      for (let c = 0; c < columns; c++) {
        const code = `D${c + 1}`;
        newLocs.push({
          id: `${warehouseId}-${code}`,
          warehouse_id: warehouseId,
          code,
          column_index: c,
          row_index: 0,
          qr_payload: `WAREHOUSE_LOCATION:${warehouseId}-${code}`
        });
      }
    }

    allLocs = [...otherLocs, ...newLocs];
    localStorage.setItem(LS_KEYS.LOCATIONS, JSON.stringify(allLocs));

    if (supabaseClient) {
      try {
        await supabaseClient.from('warehouse_locations').delete().eq('warehouse_id', warehouseId);
        await supabaseClient.from('warehouse_locations').upsert(newLocs);
      } catch (e) {
        console.warn('Regenerate slots in Supabase failed:', e);
      }
    }
  }

  return true;
};

// 10. Add Single Custom Slot to Warehouse
export const addWarehouseSlot = async (
  warehouseId: string,
  code: string,
  rowIndex = 0,
  columnIndex = 0
): Promise<WarehouseLocation> => {
  const cleanCode = code.trim().toUpperCase();
  const id = `${warehouseId}-${cleanCode}`;
  const newLocation: WarehouseLocation = {
    id,
    warehouse_id: warehouseId,
    code: cleanCode,
    row_index: rowIndex,
    column_index: columnIndex,
    qr_payload: `WAREHOUSE_LOCATION:${id}`,
    created_at: new Date().toISOString()
  };

  const allLocs: WarehouseLocation[] = JSON.parse(localStorage.getItem(LS_KEYS.LOCATIONS) || '[]');
  const existingIdx = allLocs.findIndex(l => l.id === id);
  if (existingIdx > -1) {
    allLocs[existingIdx] = newLocation;
  } else {
    allLocs.push(newLocation);
  }
  localStorage.setItem(LS_KEYS.LOCATIONS, JSON.stringify(allLocs));

  if (supabaseClient) {
    try {
      await supabaseClient.from('warehouse_locations').upsert(newLocation);
    } catch (e) {
      console.warn('Add slot to Supabase failed:', e);
    }
  }

  return newLocation;
};

// 11. Delete Single Slot
export const deleteWarehouseSlot = async (locationId: string): Promise<boolean> => {
  let allLocs: WarehouseLocation[] = JSON.parse(localStorage.getItem(LS_KEYS.LOCATIONS) || '[]');
  allLocs = allLocs.filter(l => l.id !== locationId);
  localStorage.setItem(LS_KEYS.LOCATIONS, JSON.stringify(allLocs));

  const allCur: ProductCurrentLocation[] = JSON.parse(localStorage.getItem(LS_KEYS.PRODUCT_LOCATIONS) || '[]');
  const prodIdx = allCur.findIndex(p => p.location_id === locationId);
  if (prodIdx > -1) {
    allCur[prodIdx].location_id = null;
    allCur[prodIdx].updated_at = new Date().toISOString();
    localStorage.setItem(LS_KEYS.PRODUCT_LOCATIONS, JSON.stringify(allCur));
  }

  if (supabaseClient) {
    try {
      await supabaseClient.from('warehouse_locations').delete().eq('id', locationId);
      if (prodIdx > -1) {
        await supabaseClient
          .from('product_current_locations')
          .update({ location_id: null, updated_at: new Date().toISOString() })
          .eq('product_code', allCur[prodIdx].product_code);
      }
    } catch (e) {
      console.warn('Delete slot in Supabase failed:', e);
    }
  }

  return true;
};

// 12. Transfer / Move Entire Slot (and stored product) to Another Warehouse
export const transferSlotToWarehouse = async (
  sourceLocationId: string,
  targetWarehouseId: string
): Promise<{ success: boolean; newLocationId: string }> => {
  const allLocs: WarehouseLocation[] = JSON.parse(localStorage.getItem(LS_KEYS.LOCATIONS) || '[]');
  const srcLoc = allLocs.find(l => l.id === sourceLocationId);

  if (!srcLoc) {
    throw new Error(`Không tìm thấy vị trí ${sourceLocationId}`);
  }

  const newLocationId = `${targetWarehouseId}-${srcLoc.code}`;
  const newLocation: WarehouseLocation = {
    ...srcLoc,
    id: newLocationId,
    warehouse_id: targetWarehouseId,
    qr_payload: `WAREHOUSE_LOCATION:${newLocationId}`,
    created_at: new Date().toISOString()
  };

  const updatedLocs = allLocs.filter(l => l.id !== sourceLocationId);
  updatedLocs.push(newLocation);
  localStorage.setItem(LS_KEYS.LOCATIONS, JSON.stringify(updatedLocs));

  const allCur: ProductCurrentLocation[] = JSON.parse(localStorage.getItem(LS_KEYS.PRODUCT_LOCATIONS) || '[]');
  const prod = allCur.find(p => p.location_id === sourceLocationId);
  if (prod) {
    prod.location_id = newLocationId;
    prod.updated_at = new Date().toISOString();
    localStorage.setItem(LS_KEYS.PRODUCT_LOCATIONS, JSON.stringify(allCur));

    const movement: ProductLocationMovement = {
      id: Math.random().toString(36).substr(2, 9),
      product_code: prod.product_code,
      from_location_id: sourceLocationId,
      to_location_id: newLocationId,
      status: 'completed',
      ocr_confidence: 1,
      gps_lat: null,
      gps_lng: null,
      user_name: 'Transfer Slot Admin',
      created_at: new Date().toISOString()
    };
    const moves: ProductLocationMovement[] = JSON.parse(localStorage.getItem(LS_KEYS.MOVEMENTS) || '[]');
    moves.unshift(movement);
    localStorage.setItem(LS_KEYS.MOVEMENTS, JSON.stringify(moves));

    if (supabaseClient) {
      try {
        await supabaseClient.from('product_location_movements').insert(movement);
      } catch (e) {}
    }
  }

  if (supabaseClient) {
    try {
      await supabaseClient.from('warehouse_locations').delete().eq('id', sourceLocationId);
      await supabaseClient.from('warehouse_locations').upsert(newLocation);

      if (prod) {
        await supabaseClient
          .from('product_current_locations')
          .upsert({
            product_code: prod.product_code,
            location_id: newLocationId,
            updated_at: prod.updated_at
          });
      }
    } catch (e) {
      console.warn('Transfer slot in Supabase failed:', e);
    }
  }

  return { success: true, newLocationId };
};

// --- Offline Queue Handling ---

export const getSyncOutbox = (): SyncAction[] => {
  return JSON.parse(localStorage.getItem(LS_KEYS.SYNC_OUTBOX) || '[]');
};

const queueOfflineAction = (actionType: SyncAction['action_type'], payload: any) => {
  const outbox: SyncAction[] = getSyncOutbox();
  const action: SyncAction = {
    id: Math.random().toString(36).substr(2, 9),
    action_type: actionType,
    payload,
    status: 'pending',
    created_at: new Date().toISOString()
  };
  outbox.push(action);
  localStorage.setItem(LS_KEYS.SYNC_OUTBOX, JSON.stringify(outbox));
};

export const syncOfflineQueue = async (): Promise<{ success: boolean; count: number; errors: string[] }> => {
  if (!supabaseClient) {
    return { success: false, count: 0, errors: ['Supabase client not initialized'] };
  }

  const outbox: SyncAction[] = getSyncOutbox();
  if (outbox.length === 0) {
    return { success: true, count: 0, errors: [] };
  }

  let successCount = 0;
  const errors: string[] = [];
  const updatedOutbox: SyncAction[] = [];

  for (const action of outbox) {
    try {
      if (action.action_type === 'start_move') {
        const move = action.payload;
        const { error } = await supabaseClient
          .from('product_location_movements')
          .insert({
            id: move.id,
            product_code: move.product_code,
            from_location_id: move.from_location_id,
            to_location_id: null,
            status: 'started',
            ocr_confidence: move.ocr_confidence,
            ocr_image_path: move.ocr_image_path,
            gps_lat: null,
            gps_lng: null,
            user_name: move.user_name
          });
        if (error) throw error;
      } 
      else if (action.action_type === 'complete_move') {
        const move = action.payload;
        // Upsert current location
        const { error: curErr } = await supabaseClient
          .from('product_current_locations')
          .upsert({
            product_code: move.product_code,
            location_id: move.to_location_id,
            updated_at: move.created_at,
            updated_by: move.user_name
          });
        if (curErr) throw curErr;

        // Upsert movement record
        const { error: moveErr } = await supabaseClient
          .from('product_location_movements')
          .upsert({
            id: move.id,
            product_code: move.product_code,
            from_location_id: move.from_location_id,
            to_location_id: move.to_location_id,
            status: 'completed',
            ocr_confidence: move.ocr_confidence,
            gps_lat: move.gps_lat,
            gps_lng: move.gps_lng,
            user_name: move.user_name,
            created_at: move.created_at
          });
        if (moveErr) throw moveErr;
      }
      else if (action.action_type === 'create_warehouse') {
        const { warehouse, locations } = action.payload;
        // Insert warehouse
        const { error: wErr } = await supabaseClient
          .from('warehouses')
          .insert(warehouse);
        if (wErr) throw wErr;

        // Insert locations
        const { error: lErr } = await supabaseClient
          .from('warehouse_locations')
          .insert(locations);
        if (lErr) throw lErr;
      }

      successCount++;
    } catch (err: any) {
      console.error(`Sync error for action ${action.id}:`, err);
      errors.push(err.message || 'Unknown network error');
      action.status = 'failed';
      action.error_message = err.message || 'Unknown network error';
      updatedOutbox.push(action);
    }
  }

  // Save remaining failed actions back, remove successful ones
  localStorage.setItem(LS_KEYS.SYNC_OUTBOX, JSON.stringify(updatedOutbox));

  return {
    success: errors.length === 0,
    count: successCount,
    errors
  };
};
