-- Supabase Migration: 001_warehouse_schema.sql
-- Description: Creates the tables for the Warehouse Management system.

-- 1. Warehouses Table
CREATE TABLE IF NOT EXISTS public.warehouses (
    id TEXT PRIMARY KEY, -- e.g., 'K1', 'K2', 'K3', 'K4'
    name TEXT NOT NULL,
    columns INTEGER NOT NULL DEFAULT 1, -- grid columns width
    rows INTEGER NOT NULL DEFAULT 1,    -- grid rows height
    type TEXT NOT NULL DEFAULT 'grid',   -- 'grid' or 'aisle'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Warehouse Locations Table
CREATE TABLE IF NOT EXISTS public.warehouse_locations (
    id TEXT PRIMARY KEY, -- e.g., 'K1-A01', 'K4-D1'
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE CASCADE,
    code TEXT NOT NULL,  -- e.g., 'A01', 'D1'
    column_index INTEGER NOT NULL DEFAULT 0, -- 0-based index for grid layouts
    row_index INTEGER NOT NULL DEFAULT 0,    -- 0-based index for grid layouts
    qr_payload TEXT NOT NULL,               -- e.g., 'WAREHOUSE_LOCATION:K1-A01'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Product Current Locations Table
CREATE TABLE IF NOT EXISTS public.product_current_locations (
    product_code TEXT PRIMARY KEY,
    location_id TEXT REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- 4. Product Location Movements Table (Logs history of product moves)
CREATE TABLE IF NOT EXISTS public.product_location_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code TEXT NOT NULL,
    from_location_id TEXT REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
    to_location_id TEXT REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('started', 'completed')),
    ocr_confidence NUMERIC, -- Confidence score if read via OCR, null if manual
    ocr_image_path TEXT,    -- Reference to OCR image
    gps_lat NUMERIC,
    gps_lng NUMERIC,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Warehouse Sync Outbox Table (For offline synchronization)
CREATE TABLE IF NOT EXISTS public.warehouse_sync_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL, -- e.g. 'start_move', 'complete_move', 'create_warehouse'
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_locations_warehouse ON public.warehouse_locations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_movements_product ON public.product_location_movements(product_code);
CREATE INDEX IF NOT EXISTS idx_current_location ON public.product_current_locations(location_id);
