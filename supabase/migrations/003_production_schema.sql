-- ==============================================================================
-- Supabase Migration: 003_production_schema.sql
-- Description: Production-ready Warehouse Management Schema for Kho Nhựt Lúa
-- Features:
--   1. UUID Primary Keys across all entities
--   2. 3-Tier Hierarchy: Warehouse -> WarehouseZone -> WarehouseLocation
--   3. Dedicated Products entity (e120.30 with physical dimensions & attributes)
--   4. Product Current Locations (Product -> Location binding)
--   5. Idempotent Movement Log with GPS coordinates & OCR confidence
--   6. Audit Logging & Realtime Publications
--   7. Row-Level Security (RLS) & Atomic Movement RPC Function
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Warehouses Table
CREATE TABLE IF NOT EXISTS public.warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,          -- Business Code, e.g. 'K1', 'K2'
    name TEXT NOT NULL,                 -- Display Name, e.g. 'Kho 1 - Kho Lúa Nhựt'
    width_m NUMERIC NOT NULL DEFAULT 15.0,  -- Metric width in meters
    length_m NUMERIC NOT NULL DEFAULT 30.0, -- Metric length in meters
    gps_lat NUMERIC,                    -- GPS Latitude center
    gps_lng NUMERIC,                    -- GPS Longitude center
    color TEXT DEFAULT '#2563eb',       -- Visual theme color on satellite map
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Warehouse Zones Table (Khu / Dãy bên trong từng kho)
CREATE TABLE IF NOT EXISTS public.warehouse_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    code TEXT NOT NULL,                 -- e.g. 'KHU_120', 'KHU_100', 'DAY_1'
    name TEXT NOT NULL,                 -- e.g. 'Khu 120cm', 'Dãy 1'
    color TEXT DEFAULT '#3b82f6',
    x_m NUMERIC NOT NULL DEFAULT 0.0,   -- Relative X position inside warehouse (meters)
    y_m NUMERIC NOT NULL DEFAULT 0.0,   -- Relative Y position inside warehouse (meters)
    width_m NUMERIC NOT NULL DEFAULT 5.0,
    height_m NUMERIC NOT NULL DEFAULT 10.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_warehouse_zone UNIQUE (warehouse_id, code)
);

-- 4. Warehouse Locations Table (Ô Kệ định danh bằng UUID)
CREATE TABLE IF NOT EXISTS public.warehouse_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES public.warehouse_zones(id) ON DELETE SET NULL,
    code TEXT NOT NULL,                 -- e.g. 'A01', 'B02', 'D1'
    x_m NUMERIC NOT NULL DEFAULT 0.0,   -- Metric X position
    y_m NUMERIC NOT NULL DEFAULT 0.0,   -- Metric Y position
    width_m NUMERIC NOT NULL DEFAULT 1.5,
    height_m NUMERIC NOT NULL DEFAULT 1.5,
    qr_payload TEXT NOT NULL UNIQUE,    -- Immutable payload: 'WAREHOUSE_LOCATION:<UUID>'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_warehouse_loc UNIQUE (warehouse_id, code)
);

-- 5. Products Table (Thực thể Sản phẩm)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_code TEXT NOT NULL UNIQUE,  -- e.g. 'e120.30', 'e80.343', 'p500.45'
    name TEXT NOT NULL,                 -- e.g. 'Thanh Nhựa e120 bản 30mm'
    length_value NUMERIC NOT NULL DEFAULT 120.0,
    length_unit TEXT NOT NULL DEFAULT 'cm',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Product Current Locations Table (Vị trí hiện tại của Sản phẩm)
CREATE TABLE IF NOT EXISTS public.product_current_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT DEFAULT 'Staff'
);

-- 7. Product Location Movements Table (Nhật ký Luân chuyển Idempotent)
CREATE TABLE IF NOT EXISTS public.product_location_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    from_location_id UUID REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
    to_location_id UUID REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('started', 'moving', 'completed', 'cancelled')),
    idempotency_key TEXT UNIQUE,        -- Chống trùng lặp khi quét lặp hoặc mạng chập chờn
    ocr_confidence NUMERIC,
    ocr_image_path TEXT,
    gps_lat NUMERIC,
    gps_lng NUMERIC,
    user_name TEXT DEFAULT 'Staff',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Warehouse Settings Table (Cấu hình hệ thống & GPS Map)
CREATE TABLE IF NOT EXISTS public.warehouse_settings (
    id TEXT PRIMARY KEY,                -- e.g. 'warehouse_map_gps', 'system_config'
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID,
    action TEXT NOT NULL,               -- 'INSERT', 'UPDATE', 'DELETE'
    old_data JSONB,
    new_data JSONB,
    performed_by TEXT DEFAULT 'Staff',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_wh_zones_wh ON public.warehouse_zones(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_wh_locs_wh ON public.warehouse_locations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_wh_locs_zone ON public.warehouse_locations(zone_id);
CREATE INDEX IF NOT EXISTS idx_prod_code ON public.products(product_code);
CREATE INDEX IF NOT EXISTS idx_prod_cur_loc_prod ON public.product_current_locations(product_id);
CREATE INDEX IF NOT EXISTS idx_prod_cur_loc_loc ON public.product_current_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_movements_prod ON public.product_location_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_to ON public.product_location_movements(to_location_id);
CREATE INDEX IF NOT EXISTS idx_movements_idempotency ON public.product_location_movements(idempotency_key);

-- 11. Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE 
    public.warehouses, 
    public.warehouse_zones, 
    public.warehouse_locations, 
    public.products, 
    public.product_current_locations, 
    public.product_location_movements, 
    public.warehouse_settings;

-- 12. Atomic Product Movement RPC Function
CREATE OR REPLACE FUNCTION public.execute_product_movement(
    p_product_id UUID,
    p_to_location_id UUID,
    p_user_name TEXT,
    p_idempotency_key TEXT,
    p_ocr_confidence NUMERIC DEFAULT NULL,
    p_gps_lat NUMERIC DEFAULT NULL,
    p_gps_lng NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_from_location_id UUID;
    v_movement_id UUID;
    v_existing_movement_id UUID;
    v_product_code TEXT;
BEGIN
    -- 1. Check Idempotency Key
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_movement_id
        FROM public.product_location_movements
        WHERE idempotency_key = p_idempotency_key
        LIMIT 1;

        IF v_existing_movement_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'already_processed', true,
                'movement_id', v_existing_movement_id
            );
        END IF;
    END IF;

    -- 2. Verify Product Exists
    SELECT product_code INTO v_product_code
    FROM public.products
    WHERE id = p_product_id;

    IF v_product_code IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy sản phẩm với ID %', p_product_id;
    END IF;

    -- 3. Get Current Location
    SELECT location_id INTO v_from_location_id
    FROM public.product_current_locations
    WHERE product_id = p_product_id;

    -- 4. Update Current Location
    INSERT INTO public.product_current_locations (product_id, location_id, updated_at, updated_by)
    VALUES (p_product_id, p_to_location_id, NOW(), p_user_name)
    ON CONFLICT (product_id)
    DO UPDATE SET 
        location_id = EXCLUDED.location_id,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by;

    -- 5. Record Movement Log
    INSERT INTO public.product_location_movements (
        product_id,
        from_location_id,
        to_location_id,
        status,
        idempotency_key,
        ocr_confidence,
        gps_lat,
        gps_lng,
        user_name,
        created_at
    )
    VALUES (
        p_product_id,
        v_from_location_id,
        p_to_location_id,
        'completed',
        p_idempotency_key,
        p_ocr_confidence,
        p_gps_lat,
        p_gps_lng,
        p_user_name,
        NOW()
    )
    RETURNING id INTO v_movement_id;

    -- 6. Return Result
    RETURN jsonb_build_object(
        'success', true,
        'movement_id', v_movement_id,
        'product_id', p_product_id,
        'from_location_id', v_from_location_id,
        'to_location_id', p_to_location_id
    );
END;
$$;

-- 13. Enable Row-Level Security (RLS)
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_current_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_location_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_settings ENABLE ROW LEVEL SECURITY;

-- Allow Public/Anon read-write for Warehouse Operations with RLS policies
CREATE POLICY "Allow public read warehouses" ON public.warehouses FOR SELECT USING (true);
CREATE POLICY "Allow public write warehouses" ON public.warehouses FOR ALL USING (true);

CREATE POLICY "Allow public read zones" ON public.warehouse_zones FOR SELECT USING (true);
CREATE POLICY "Allow public write zones" ON public.warehouse_zones FOR ALL USING (true);

CREATE POLICY "Allow public read locations" ON public.warehouse_locations FOR SELECT USING (true);
CREATE POLICY "Allow public write locations" ON public.warehouse_locations FOR ALL USING (true);

CREATE POLICY "Allow public read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public write products" ON public.products FOR ALL USING (true);

CREATE POLICY "Allow public read current locations" ON public.product_current_locations FOR SELECT USING (true);
CREATE POLICY "Allow public write current locations" ON public.product_current_locations FOR ALL USING (true);

CREATE POLICY "Allow public read movements" ON public.product_location_movements FOR SELECT USING (true);
CREATE POLICY "Allow public insert movements" ON public.product_location_movements FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read settings" ON public.warehouse_settings FOR SELECT USING (true);
CREATE POLICY "Allow public write settings" ON public.warehouse_settings FOR ALL USING (true);
