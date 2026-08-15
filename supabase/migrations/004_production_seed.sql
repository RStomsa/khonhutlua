-- ==============================================================================
-- Supabase Migration: 004_production_seed.sql
-- Description: Production initial seed data with UUIDs, Zones, Products and Locations
-- ==============================================================================

DO $$
DECLARE
    -- Warehouses UUIDs
    v_wh_k1 UUID := 'a1111111-1111-1111-1111-111111111111';
    v_wh_k2 UUID := 'a2222222-2222-2222-2222-222222222222';
    v_wh_k3 UUID := 'a3333333-3333-3333-3333-333333333333';
    v_wh_k4 UUID := 'a4444444-4444-4444-4444-444444444444';

    -- Zones UUIDs for K1
    v_zone_k1_120 UUID := 'b1111111-1111-1111-1111-111111111111';
    v_zone_k1_100 UUID := 'b1111111-1111-1111-1111-222222222222';
    v_zone_k1_80  UUID := 'b1111111-1111-1111-1111-333333333333';

    -- Locations UUIDs for K1
    v_loc_k1_a01 UUID := 'c1111111-1111-1111-1111-000000000a01';
    v_loc_k1_a02 UUID := 'c1111111-1111-1111-1111-000000000a02';
    v_loc_k1_a03 UUID := 'c1111111-1111-1111-1111-000000000a03';
    v_loc_k1_b01 UUID := 'c1111111-1111-1111-1111-000000000b01';
    v_loc_k1_b02 UUID := 'c1111111-1111-1111-1111-000000000b02';
    v_loc_k1_b03 UUID := 'c1111111-1111-1111-1111-000000000b03';
    v_loc_k1_c01 UUID := 'c1111111-1111-1111-1111-000000000c01';
    v_loc_k1_c02 UUID := 'c1111111-1111-1111-1111-000000000c02';
    v_loc_k1_c03 UUID := 'c1111111-1111-1111-1111-000000000c03';
    v_loc_k1_d01 UUID := 'c1111111-1111-1111-1111-000000000d01';
    v_loc_k1_d02 UUID := 'c1111111-1111-1111-1111-000000000d02';
    v_loc_k1_d03 UUID := 'c1111111-1111-1111-1111-000000000d03';

    -- Locations UUIDs for K2
    v_loc_k2_a01 UUID := 'c2222222-2222-2222-2222-000000000a01';
    v_loc_k2_a02 UUID := 'c2222222-2222-2222-2222-000000000a02';
    v_loc_k2_a03 UUID := 'c2222222-2222-2222-2222-000000000a03';

    -- Products UUIDs
    v_prod_e120_30 UUID := 'e1203000-0000-0000-0000-000000000001';
    v_prod_e100_34 UUID := 'e1003400-0000-0000-0000-000000000002';
    v_prod_e80_343 UUID := 'e8034300-0000-0000-0000-000000000003';
    v_prod_p500_45 UUID := 'f5004500-0000-0000-0000-000000000004';
    v_prod_a100_99 UUID := 'a1009900-0000-0000-0000-000000000005';
    v_prod_x888_88 UUID := 'f8888800-0000-0000-0000-000000000006';

BEGIN
    -- 1. Insert Warehouses
    INSERT INTO public.warehouses (id, code, name, width_m, length_m, gps_lat, gps_lng, color)
    VALUES
        (v_wh_k1, 'K1', 'Kho 1 - Kho Lúa Nhựt Chính', 15.0, 30.0, 10.776889, 106.700806, '#2563eb'),
        (v_wh_k2, 'K2', 'Kho 2 - Kho Phụ Phía Bắc', 12.0, 25.0, 10.777200, 106.701100, '#10b981'),
        (v_wh_k3, 'K3', 'Kho 3 - Kho Đóng Gói & Xuất Hàng', 10.0, 20.0, 10.776600, 106.701400, '#f59e0b'),
        (v_wh_k4, 'K4', 'Kho 4 - Dãy Ngoài Sân Vận Chuyển', 8.0, 35.0, 10.776300, 106.700600, '#8b5cf6')
    ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        width_m = EXCLUDED.width_m,
        length_m = EXCLUDED.length_m,
        color = EXCLUDED.color;

    -- 2. Insert Warehouse Zones for K1
    INSERT INTO public.warehouse_zones (id, warehouse_id, code, name, color, x_m, y_m, width_m, height_m)
    VALUES
        (v_zone_k1_120, v_wh_k1, 'KHU_120', 'Khu 120cm', '#3b82f6', 0.0, 0.0, 5.0, 10.0),
        (v_zone_k1_100, v_wh_k1, 'KHU_100', 'Khu 100cm', '#60a5fa', 5.0, 0.0, 5.0, 10.0),
        (v_zone_k1_80,  v_wh_k1, 'KHU_80',  'Khu 80cm',  '#93c5fd', 10.0, 0.0, 5.0, 10.0)
    ON CONFLICT (id) DO NOTHING;

    -- 3. Insert Locations for K1
    INSERT INTO public.warehouse_locations (id, warehouse_id, zone_id, code, x_m, y_m, width_m, height_m, qr_payload)
    VALUES
        (v_loc_k1_a01, v_wh_k1, v_zone_k1_120, 'A01', 0.0, 0.0, 1.5, 1.5, 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000a01'),
        (v_loc_k1_a02, v_wh_k1, v_zone_k1_120, 'A02', 1.5, 0.0, 1.5, 1.5, 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000a02'),
        (v_loc_k1_a03, v_wh_k1, v_zone_k1_120, 'A03', 3.0, 0.0, 1.5, 1.5, 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000a03'),
        (v_loc_k1_b01, v_wh_k1, v_zone_k1_100, 'B01', 0.0, 2.0, 1.5, 1.5, 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000b01'),
        (v_loc_k1_b02, v_wh_k1, v_zone_k1_100, 'B02', 1.5, 2.0, 1.5, 1.5, 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000b02'),
        (v_loc_k1_b03, v_wh_k1, v_zone_k1_100, 'B03', 3.0, 2.0, 1.5, 1.5, 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000b03'),
        (v_loc_k1_c01, v_wh_k1, v_zone_k1_80,  'C01', 0.0, 4.0, 1.5, 1.5, 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000c01'),
        (v_loc_k1_c02, v_wh_k1, v_zone_k1_80,  'C02', 1.5, 4.0, 1.5, 1.5, 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000c02'),
        (v_loc_k1_c03, v_wh_k1, v_zone_k1_80,  'C03', 3.0, 4.0, 1.5, 1.5, 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000c03'),
        (v_loc_k1_d01, v_wh_k1, NULL,          'D01', 0.0, 6.0, 1.5, 1.5, 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000d01'),
        (v_loc_k1_d02, v_wh_k1, NULL,          'D02', 1.5, 6.0, 1.5, 1.5, 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000d02'),
        (v_loc_k1_d03, v_wh_k1, NULL,          'D03', 3.0, 6.0, 1.5, 1.5, 'WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000d03')
    ON CONFLICT (id) DO NOTHING;

    -- 4. Insert Locations for K2
    INSERT INTO public.warehouse_locations (id, warehouse_id, zone_id, code, x_m, y_m, width_m, height_m, qr_payload)
    VALUES
        (v_loc_k2_a01, v_wh_k2, NULL, 'A01', 0.0, 0.0, 1.5, 1.5, 'WAREHOUSE_LOCATION:c2222222-2222-2222-2222-000000000a01'),
        (v_loc_k2_a02, v_wh_k2, NULL, 'A02', 1.5, 0.0, 1.5, 1.5, 'WAREHOUSE_LOCATION:c2222222-2222-2222-2222-000000000a02'),
        (v_loc_k2_a03, v_wh_k2, NULL, 'A03', 3.0, 0.0, 1.5, 1.5, 'WAREHOUSE_LOCATION:c2222222-2222-2222-2222-000000000a03')
    ON CONFLICT (id) DO NOTHING;

    -- 5. Insert Products
    INSERT INTO public.products (id, product_code, name, length_value, length_unit, status)
    VALUES
        (v_prod_e120_30, 'e120.30', 'Thanh Nhựa e120 bản 30mm', 120.0, 'cm', 'active'),
        (v_prod_e100_34, 'e100.34', 'Thanh Nhựa e100 bản 34mm', 100.0, 'cm', 'active'),
        (v_prod_e80_343, 'e80.343', 'Thanh Nhựa e80 bản 34.3mm', 80.0, 'cm', 'active'),
        (v_prod_p500_45, 'p500.45', 'Ống Profile p500 bản 45mm', 500.0, 'cm', 'active'),
        (v_prod_a100_99, 'a100.99', 'Khung Nhôm a100 cao cấp', 100.0, 'cm', 'active'),
        (v_prod_x888_88, 'x888.88', 'Thanh Chữ X Series 888', 88.0, 'cm', 'active')
    ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        length_value = EXCLUDED.length_value,
        length_unit = EXCLUDED.length_unit;

    -- 6. Insert Product Current Locations (Bindings)
    INSERT INTO public.product_current_locations (product_id, location_id, updated_by)
    VALUES
        (v_prod_e120_30, v_loc_k1_b02, 'Khanh Admin'),
        (v_prod_e100_34, v_loc_k1_a01, 'Khanh Admin'),
        (v_prod_e80_343, v_loc_k1_c03, 'Khanh Admin'),
        (v_prod_p500_45, v_loc_k2_a01, 'Khanh Admin'),
        (v_prod_a100_99, v_loc_k1_d01, 'Khanh Admin')
    ON CONFLICT (product_id) DO UPDATE SET
        location_id = EXCLUDED.location_id,
        updated_by = EXCLUDED.updated_by;

END $$;
