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
    width_m: 18.0,
    length_m: 24.0,
    gps_lat: 15.916620,
    gps_lng: 108.260309,
    color: '#ef4444',
    created_at: new Date().toISOString()
  },
  {
    id: 'a2222222-2222-2222-2222-222222222222',
    code: 'K2',
    name: 'Kho 2 - Kho Phụ Đông Bắc',
    width_m: 15.0,
    length_m: 15.0,
    gps_lat: 15.916730,
    gps_lng: 108.260580,
    color: '#22c55e',
    created_at: new Date().toISOString()
  },
  {
    id: 'a3333333-3333-3333-3333-333333333333',
    code: 'K3',
    name: 'Kho 3 - Kho Đóng Gói Phía Đông',
    width_m: 12.0,
    length_m: 16.0,
    gps_lat: 15.916520,
    gps_lng: 108.260650,
    color: '#eab308',
    created_at: new Date().toISOString()
  },
  {
    id: 'a4444444-4444-4444-4444-444444444444',
    code: 'K4',
    name: 'Kho 4 - Dãy Dọc Phía Nam',
    width_m: 12.0,
    length_m: 20.0,
    gps_lat: 15.916450,
    gps_lng: 108.260350,
    color: '#3b82f6',
    created_at: new Date().toISOString()
  }
];

const DEFAULT_SEED_ZONES: WarehouseZone[] = [
  {
    id: 'b1111111-1111-1111-1111-111111111111',
    warehouse_id: 'a1111111-1111-1111-1111-111111111111',
    code: 'KHU_120',
    name: 'Khu 120cm',
    color: '#ef4444',
    x_m: 0.0,
    y_m: 0.0,
    width_m: 18.0,
    height_m: 4.0,
    created_at: new Date().toISOString()
  },
  {
    id: 'b1111111-1111-1111-1111-222222222222',
    warehouse_id: 'a1111111-1111-1111-1111-111111111111',
    code: 'KHU_100',
    name: 'Khu 100cm',
    color: '#f87171',
    x_m: 0.0,
    y_m: 4.0,
    width_m: 18.0,
    height_m: 4.0,
    created_at: new Date().toISOString()
  },
  {
    id: 'b1111111-1111-1111-1111-333333333333',
    warehouse_id: 'a1111111-1111-1111-1111-111111111111',
    code: 'KHU_80',
    name: 'Khu 80cm',
    color: '#fca5a5',
    x_m: 0.0,
    y_m: 8.0,
    width_m: 18.0,
    height_m: 4.0,
    created_at: new Date().toISOString()
  }
];

const DEFAULT_SEED_LOCATIONS: WarehouseLocation[] = [
  // --- KHO K1 (12 Ô) ---
  { id: 'c1111111-1111-1111-1111-000000000a01', warehouse_id: 'a1111111-1111-1111-1111-111111111111', zone_id: 'b1111111-1111-1111-1111-111111111111', code: 'A01', x_m: 0.0, y_m: 0.0, width_m: 4.5, height_m: 4.0, qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000a01', created_at: new Date().toISOString() },
  { id: 'c1111111-1111-1111-1111-000000000a02', warehouse_id: 'a1111111-1111-1111-1111-111111111111', zone_id: 'b1111111-1111-1111-1111-111111111111', code: 'A02', x_m: 4.5, y_m: 0.0, width_m: 4.5, height_m: 4.0, qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000a02', created_at: new Date().toISOString() },
  { id: 'c1111111-1111-1111-1111-000000000a03', warehouse_id: 'a1111111-1111-1111-1111-111111111111', zone_id: 'b1111111-1111-1111-1111-111111111111', code: 'A03', x_m: 9.0, y_m: 0.0, width_m: 4.5, height_m: 4.0, qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000a03', created_at: new Date().toISOString() },
  { id: 'c1111111-1111-1111-1111-000000000a04', warehouse_id: 'a1111111-1111-1111-1111-111111111111', zone_id: 'b1111111-1111-1111-1111-111111111111', code: 'A04', x_m: 13.5, y_m: 0.0, width_m: 4.5, height_m: 4.0, qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000a04', created_at: new Date().toISOString() },

  { id: 'c1111111-1111-1111-1111-000000000b01', warehouse_id: 'a1111111-1111-1111-1111-111111111111', zone_id: 'b1111111-1111-1111-1111-222222222222', code: 'B01', x_m: 0.0, y_m: 4.0, width_m: 4.5, height_m: 4.0, qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000b01', created_at: new Date().toISOString() },
  { id: 'c1111111-1111-1111-1111-000000000b02', warehouse_id: 'a1111111-1111-1111-1111-111111111111', zone_id: 'b1111111-1111-1111-1111-222222222222', code: 'B02', x_m: 4.5, y_m: 4.0, width_m: 4.5, height_m: 4.0, qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000b02', created_at: new Date().toISOString() },
  { id: 'c1111111-1111-1111-1111-000000000b03', warehouse_id: 'a1111111-1111-1111-1111-111111111111', zone_id: 'b1111111-1111-1111-1111-222222222222', code: 'B03', x_m: 9.0, y_m: 4.0, width_m: 4.5, height_m: 4.0, qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000b03', created_at: new Date().toISOString() },
  { id: 'c1111111-1111-1111-1111-000000000b04', warehouse_id: 'a1111111-1111-1111-1111-111111111111', zone_id: 'b1111111-1111-1111-1111-222222222222', code: 'B04', x_m: 13.5, y_m: 4.0, width_m: 4.5, height_m: 4.0, qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000b04', created_at: new Date().toISOString() },

  { id: 'c1111111-1111-1111-1111-000000000c01', warehouse_id: 'a1111111-1111-1111-1111-111111111111', zone_id: 'b1111111-1111-1111-1111-333333333333', code: 'C01', x_m: 0.0, y_m: 8.0, width_m: 4.5, height_m: 4.0, qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000c01', created_at: new Date().toISOString() },
  { id: 'c1111111-1111-1111-1111-000000000c02', warehouse_id: 'a1111111-1111-1111-1111-111111111111', zone_id: 'b1111111-1111-1111-1111-333333333333', code: 'C02', x_m: 4.5, y_m: 8.0, width_m: 4.5, height_m: 4.0, qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000c02', created_at: new Date().toISOString() },
  { id: 'c1111111-1111-1111-1111-000000000c03', warehouse_id: 'a1111111-1111-1111-1111-111111111111', zone_id: 'b1111111-1111-1111-1111-333333333333', code: 'C03', x_m: 9.0, y_m: 8.0, width_m: 4.5, height_m: 4.0, qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000c03', created_at: new Date().toISOString() },
  { id: 'c1111111-1111-1111-1111-000000000c04', warehouse_id: 'a1111111-1111-1111-1111-111111111111', zone_id: 'b1111111-1111-1111-1111-333333333333', code: 'C04', x_m: 13.5, y_m: 8.0, width_m: 4.5, height_m: 4.0, qr_payload: 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000c04', created_at: new Date().toISOString() },

  // --- KHO K2 (9 Ô: 3 Cột x 3 Hàng) ---
  { id: 'c2222222-2222-2222-2222-000000000a01', warehouse_id: 'a2222222-2222-2222-2222-222222222222', zone_id: null, code: 'A01', x_m: 0.0, y_m: 0.0, width_m: 5.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c2222222-2222-2222-2222-000000000a01', created_at: new Date().toISOString() },
  { id: 'c2222222-2222-2222-2222-000000000a02', warehouse_id: 'a2222222-2222-2222-2222-222222222222', zone_id: null, code: 'A02', x_m: 5.0, y_m: 0.0, width_m: 5.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c2222222-2222-2222-2222-000000000a02', created_at: new Date().toISOString() },
  { id: 'c2222222-2222-2222-2222-000000000a03', warehouse_id: 'a2222222-2222-2222-2222-222222222222', zone_id: null, code: 'A03', x_m: 10.0, y_m: 0.0, width_m: 5.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c2222222-2222-2222-2222-000000000a03', created_at: new Date().toISOString() },
  { id: 'c2222222-2222-2222-2222-000000000b01', warehouse_id: 'a2222222-2222-2222-2222-222222222222', zone_id: null, code: 'B01', x_m: 0.0, y_m: 5.0, width_m: 5.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c2222222-2222-2222-2222-000000000b01', created_at: new Date().toISOString() },
  { id: 'c2222222-2222-2222-2222-000000000b02', warehouse_id: 'a2222222-2222-2222-2222-222222222222', zone_id: null, code: 'B02', x_m: 5.0, y_m: 5.0, width_m: 5.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c2222222-2222-2222-2222-000000000b02', created_at: new Date().toISOString() },
  { id: 'c2222222-2222-2222-2222-000000000b03', warehouse_id: 'a2222222-2222-2222-2222-222222222222', zone_id: null, code: 'B03', x_m: 10.0, y_m: 5.0, width_m: 5.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c2222222-2222-2222-2222-000000000b03', created_at: new Date().toISOString() },
  { id: 'c2222222-2222-2222-2222-000000000c01', warehouse_id: 'a2222222-2222-2222-2222-222222222222', zone_id: null, code: 'C01', x_m: 0.0, y_m: 10.0, width_m: 5.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c2222222-2222-2222-2222-000000000c01', created_at: new Date().toISOString() },
  { id: 'c2222222-2222-2222-2222-000000000c02', warehouse_id: 'a2222222-2222-2222-2222-222222222222', zone_id: null, code: 'C02', x_m: 5.0, y_m: 10.0, width_m: 5.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c2222222-2222-2222-2222-000000000c02', created_at: new Date().toISOString() },
  { id: 'c2222222-2222-2222-2222-000000000c03', warehouse_id: 'a2222222-2222-2222-2222-222222222222', zone_id: null, code: 'C03', x_m: 10.0, y_m: 10.0, width_m: 5.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c2222222-2222-2222-2222-000000000c03', created_at: new Date().toISOString() },

  // --- KHO K3 (4 Ô: 2 Cột x 2 Hàng) ---
  { id: 'c3333333-3333-3333-3333-000000000a01', warehouse_id: 'a3333333-3333-3333-3333-333333333333', zone_id: null, code: 'A01', x_m: 0.0, y_m: 0.0, width_m: 6.0, height_m: 8.0, qr_payload: 'WAREHOUSE_LOCATION:c3333333-3333-3333-3333-000000000a01', created_at: new Date().toISOString() },
  { id: 'c3333333-3333-3333-3333-000000000a02', warehouse_id: 'a3333333-3333-3333-3333-333333333333', zone_id: null, code: 'A02', x_m: 6.0, y_m: 0.0, width_m: 6.0, height_m: 8.0, qr_payload: 'WAREHOUSE_LOCATION:c3333333-3333-3333-3333-000000000a02', created_at: new Date().toISOString() },
  { id: 'c3333333-3333-3333-3333-000000000b01', warehouse_id: 'a3333333-3333-3333-3333-333333333333', zone_id: null, code: 'B01', x_m: 0.0, y_m: 8.0, width_m: 6.0, height_m: 8.0, qr_payload: 'WAREHOUSE_LOCATION:c3333333-3333-3333-3333-000000000b01', created_at: new Date().toISOString() },
  { id: 'c3333333-3333-3333-3333-000000000b02', warehouse_id: 'a3333333-3333-3333-3333-333333333333', zone_id: null, code: 'B02', x_m: 6.0, y_m: 8.0, width_m: 6.0, height_m: 8.0, qr_payload: 'WAREHOUSE_LOCATION:c3333333-3333-3333-3333-000000000b02', created_at: new Date().toISOString() },

  // --- KHO K4 (12 Ô: 3 Cột x 4 Hàng) ---
  { id: 'c4444444-4444-4444-4444-000000000a01', warehouse_id: 'a4444444-4444-4444-4444-444444444444', zone_id: null, code: 'A01', x_m: 0.0, y_m: 0.0, width_m: 4.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c4444444-4444-4444-4444-000000000a01', created_at: new Date().toISOString() },
  { id: 'c4444444-4444-4444-4444-000000000a02', warehouse_id: 'a4444444-4444-4444-4444-444444444444', zone_id: null, code: 'A02', x_m: 4.0, y_m: 0.0, width_m: 4.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c4444444-4444-4444-4444-000000000a02', created_at: new Date().toISOString() },
  { id: 'c4444444-4444-4444-4444-000000000a03', warehouse_id: 'a4444444-4444-4444-4444-444444444444', zone_id: null, code: 'A03', x_m: 8.0, y_m: 0.0, width_m: 4.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c4444444-4444-4444-4444-000000000a03', created_at: new Date().toISOString() },

  { id: 'c4444444-4444-4444-4444-000000000b01', warehouse_id: 'a4444444-4444-4444-4444-444444444444', zone_id: null, code: 'B01', x_m: 0.0, y_m: 5.0, width_m: 4.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c4444444-4444-4444-4444-000000000b01', created_at: new Date().toISOString() },
  { id: 'c4444444-4444-4444-4444-000000000b02', warehouse_id: 'a4444444-4444-4444-4444-444444444444', zone_id: null, code: 'B02', x_m: 4.0, y_m: 5.0, width_m: 4.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c4444444-4444-4444-4444-000000000b02', created_at: new Date().toISOString() },
  { id: 'c4444444-4444-4444-4444-000000000b03', warehouse_id: 'a4444444-4444-4444-4444-444444444444', zone_id: null, code: 'B03', x_m: 8.0, y_m: 5.0, width_m: 4.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c4444444-4444-4444-4444-000000000b03', created_at: new Date().toISOString() },

  { id: 'c4444444-4444-4444-4444-000000000c01', warehouse_id: 'a4444444-4444-4444-4444-444444444444', zone_id: null, code: 'C01', x_m: 0.0, y_m: 10.0, width_m: 4.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c4444444-4444-4444-4444-000000000c01', created_at: new Date().toISOString() },
  { id: 'c4444444-4444-4444-4444-000000000c02', warehouse_id: 'a4444444-4444-4444-4444-444444444444', zone_id: null, code: 'C02', x_m: 4.0, y_m: 10.0, width_m: 4.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c4444444-4444-4444-4444-000000000c02', created_at: new Date().toISOString() },
  { id: 'c4444444-4444-4444-4444-000000000c03', warehouse_id: 'a4444444-4444-4444-4444-444444444444', zone_id: null, code: 'C03', x_m: 8.0, y_m: 10.0, width_m: 4.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c4444444-4444-4444-4444-000000000c03', created_at: new Date().toISOString() },

  { id: 'c4444444-4444-4444-4444-000000000d01', warehouse_id: 'a4444444-4444-4444-4444-444444444444', zone_id: null, code: 'D01', x_m: 0.0, y_m: 15.0, width_m: 4.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c4444444-4444-4444-4444-000000000d01', created_at: new Date().toISOString() },
  { id: 'c4444444-4444-4444-4444-000000000d02', warehouse_id: 'a4444444-4444-4444-4444-444444444444', zone_id: null, code: 'D02', x_m: 4.0, y_m: 15.0, width_m: 4.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c4444444-4444-4444-4444-000000000d02', created_at: new Date().toISOString() },
  { id: 'c4444444-4444-4444-4444-000000000d03', warehouse_id: 'a4444444-4444-4444-4444-444444444444', zone_id: null, code: 'D03', x_m: 8.0, y_m: 15.0, width_m: 4.0, height_m: 5.0, qr_payload: 'WAREHOUSE_LOCATION:c4444444-4444-4444-4444-000000000d03', created_at: new Date().toISOString() }
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

export const updateWarehouse = async (
  warehouseId: string,
  updates: Partial<Pick<Warehouse, 'code' | 'name' | 'width_m' | 'length_m' | 'gps_lat' | 'gps_lng' | 'color'>>
): Promise<Warehouse | null> => {
  const current = await idbGetAll<Warehouse>(STORES.WAREHOUSES);
  const found = current.find(w => w.id === warehouseId);
  if (!found) return null;

  const updatedWh: Warehouse = {
    ...found,
    ...updates
  };

  await idbPutItem(STORES.WAREHOUSES, updatedWh);

  if (supabaseClient) {
    try {
      await supabaseClient.from('warehouses').update(updates).eq('id', warehouseId);
    } catch (e) {
      console.warn('Supabase update warehouse queued offline:', e);
      await queueIndexedDbOutbox('update_warehouse', updatedWh);
    }
  }

  return updatedWh;
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

export const repartitionWarehouseGrid = async (
  warehouseId: string,
  rows: number,
  cols: number,
  rowPrefixes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
): Promise<WarehouseLocation[]> => {
  const currentLocs = await idbGetAll<WarehouseLocation>(STORES.LOCATIONS);
  const toDelete = currentLocs.filter(l => l.warehouse_id === warehouseId);
  for (const loc of toDelete) {
    await idbDeleteItem(STORES.LOCATIONS, loc.id);
  }

  if (supabaseClient) {
    try {
      await supabaseClient.from('warehouse_locations').delete().eq('warehouse_id', warehouseId);
    } catch (e) {
      console.warn('Delete old locations failed:', e);
    }
  }

  const wh = (await idbGetAll<Warehouse>(STORES.WAREHOUSES)).find(w => w.id === warehouseId);
  const widthM = wh?.width_m || 15.0;
  const lengthM = wh?.length_m || 20.0;
  const cellW = widthM / cols;
  const cellH = lengthM / rows;

  const newLocs: WarehouseLocation[] = [];
  for (let r = 0; r < rows; r++) {
    const prefix = rowPrefixes[r] || `R${r + 1}`;
    for (let c = 0; c < cols; c++) {
      const colNum = (c + 1).toString().padStart(2, '0');
      const code = `${prefix}${colNum}`;
      const id = crypto.randomUUID ? crypto.randomUUID() : `c${Math.random().toString(36).substr(2, 8)}-0000-0000-0000-000000000000`;
      const loc: WarehouseLocation = {
        id,
        warehouse_id: warehouseId,
        zone_id: null,
        code,
        x_m: c * cellW,
        y_m: r * cellH,
        width_m: Number((cellW * 0.9).toFixed(1)),
        height_m: Number((cellH * 0.9).toFixed(1)),
        qr_payload: `WAREHOUSE_LOCATION:${id}`,
        created_at: new Date().toISOString()
      };
      newLocs.push(loc);
    }
  }

  await idbPutItems(STORES.LOCATIONS, newLocs);
  if (supabaseClient) {
    try {
      await supabaseClient.from('warehouse_locations').upsert(newLocs);
    } catch (e) {
      console.warn('Upsert new locations failed:', e);
    }
  }

  return newLocs;
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

export const createProduct = async (
  productCode: string,
  name?: string,
  lengthValue = 120,
  lengthUnit = 'cm',
  initialLocationId: string | null = null,
  userName = 'Admin'
): Promise<{ product: Product; currentLocation: ProductCurrentLocation }> => {
  const cleanCode = productCode.trim();
  const existing = await getProductByCode(cleanCode);
  let product: Product;

  if (existing) {
    product = existing;
  } else {
    const id = crypto.randomUUID ? crypto.randomUUID() : `e${Math.random().toString(36).substr(2, 7)}-0000-0000-0000-000000000000`;
    product = {
      id,
      product_code: cleanCode,
      name: name?.trim() || `Thanh Nhựa ${cleanCode}`,
      length_value: lengthValue,
      length_unit: lengthUnit,
      status: 'active',
      created_at: new Date().toISOString()
    };
    await idbPutItem(STORES.PRODUCTS, product);
    if (supabaseClient) {
      try {
        await supabaseClient.from('products').upsert(product);
      } catch (e) {
        console.warn('Upsert product queued offline:', e);
        await queueIndexedDbOutbox('create_product', product);
      }
    }
  }

  // Handle Current Location Assignment
  let curLoc = await getProductCurrentLocation(product.id);
  const curLocId = curLoc?.id || (crypto.randomUUID ? crypto.randomUUID() : `d${Math.random().toString(36).substr(2, 7)}-0000-0000-0000-000000000000`);
  const fromLocId = curLoc?.location_id || null;

  curLoc = {
    id: curLocId,
    product_id: product.id,
    location_id: initialLocationId,
    updated_at: new Date().toISOString(),
    updated_by: userName
  };
  await idbPutItem(STORES.PRODUCT_LOCATIONS, curLoc);

  if (supabaseClient) {
    try {
      await supabaseClient.from('product_current_locations').upsert(curLoc);
    } catch (e) {
      console.warn('Upsert curLoc queued offline:', e);
    }
  }

  // Record initial movement history if placed in a location
  if (initialLocationId) {
    const moveId = crypto.randomUUID ? crypto.randomUUID() : `m_${Math.random().toString(36).substr(2, 9)}`;
    const movement: ProductLocationMovement = {
      id: moveId,
      product_id: product.id,
      from_location_id: fromLocId,
      to_location_id: initialLocationId,
      status: 'completed',
      user_name: userName,
      created_at: new Date().toISOString(),
      idempotency_key: `INBOUND_${product.id}_${initialLocationId}_${Date.now()}`
    };
    await idbPutItem(STORES.MOVEMENTS, movement);
    if (supabaseClient) {
      try {
        await supabaseClient.from('product_location_movements').insert(movement);
      } catch (e) {
        console.warn('Insert movement queued offline:', e);
      }
    }
  }

  return { product, currentLocation: curLoc };
};

export const bulkImportProducts = async (
  items: Array<{
    product_code: string;
    name?: string;
    length_value?: number;
    length_unit?: string;
    location_id?: string | null;
  }>,
  userName = 'Admin'
): Promise<{ successCount: number; createdProducts: Product[] }> => {
  const created: Product[] = [];
  for (const item of items) {
    if (!item.product_code || !item.product_code.trim()) continue;
    const res = await createProduct(
      item.product_code,
      item.name,
      item.length_value || 120,
      item.length_unit || 'cm',
      item.location_id || null,
      userName
    );
    created.push(res.product);
  }
  return { successCount: created.length, createdProducts: created };
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
      } else if (item.action_type === 'update_warehouse') {
        await supabaseClient.from('warehouses').update(item.payload).eq('id', item.payload.id);
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
