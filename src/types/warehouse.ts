// ==============================================================================
// Types Definition for Production Warehouse Management System
// ==============================================================================

export interface Warehouse {
  id: string; // UUID Primary Key
  code: string; // Business Code, e.g. 'K1', 'K2'
  name: string; // Display name, e.g. 'Kho 1 - Kho Lúa Nhựt'
  width_m: number; // Dimension in meters (e.g. 15m)
  length_m: number; // Dimension in meters (e.g. 30m)
  gps_lat: number | null; // Center GPS Latitude
  gps_lng: number | null; // Center GPS Longitude
  color?: string; // Hex color code for satellite overlay
  created_at?: string;
  updated_at?: string;
}

export interface WarehouseZone {
  id: string; // UUID Primary Key
  warehouse_id: string; // UUID Foreign Key to Warehouse
  code: string; // e.g. 'KHU_120', 'DAY_1'
  name: string; // e.g. 'Khu 120cm', 'Dãy 1'
  color?: string;
  x_m: number; // Relative metric offset X from warehouse origin (meters)
  y_m: number; // Relative metric offset Y from warehouse origin (meters)
  width_m: number; // Zone width (meters)
  height_m: number; // Zone height (meters)
  created_at?: string;
  updated_at?: string;
}

export interface WarehouseLocation {
  id: string; // UUID Primary Key
  warehouse_id: string; // UUID Foreign Key to Warehouse
  zone_id?: string | null; // UUID Foreign Key to Zone (optional)
  code: string; // Business label, e.g. 'A01', 'B02'
  x_m: number; // Metric position X (meters)
  y_m: number; // Metric position Y (meters)
  width_m: number; // Location slot width (meters)
  height_m: number; // Location slot height (meters)
  qr_payload: string; // Immutable format: 'WAREHOUSE_LOCATION:<UUID>'
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string; // UUID Primary Key
  product_code: string; // Business Unique Code, e.g. 'e120.30', 'p500.45'
  name: string; // e.g. 'Thanh Nhựa e120 bản 30mm'
  length_value: number; // e.g. 120
  length_unit: string; // e.g. 'cm'
  status: 'active' | 'inactive' | 'archived';
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface ProductCurrentLocation {
  id: string; // UUID Primary Key
  product_id: string; // UUID Foreign Key to Product
  location_id: string | null; // UUID Foreign Key to WarehouseLocation
  updated_at: string;
  updated_by?: string;
}

export interface ProductLocationMovement {
  id: string; // UUID Primary Key
  product_id: string; // UUID Foreign Key to Product
  from_location_id: string | null; // UUID Foreign Key to WarehouseLocation
  to_location_id: string | null; // UUID Foreign Key to WarehouseLocation
  status: 'started' | 'moving' | 'completed' | 'cancelled';
  idempotency_key?: string | null; // Unique key to prevent duplicates
  ocr_confidence?: number | null;
  ocr_image_path?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  user_name?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id?: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'RPC';
  old_data?: Record<string, any> | null;
  new_data?: Record<string, any> | null;
  performed_by: string;
  created_at: string;
}

export interface SyncAction {
  id: string;
  action_type: 'execute_movement' | 'create_warehouse' | 'create_zone' | 'create_location';
  payload: any;
  status: 'pending' | 'synced' | 'failed';
  error_message?: string;
  created_at: string;
}
