-- Supabase Migration: 002_warehouse_seed.sql
-- Description: Seeds the initial warehouses and warehouse locations.

-- 1. Insert Warehouses
INSERT INTO public.warehouses (id, name, columns, rows, type) VALUES
('K1', 'K1 Blue', 3, 4, 'grid'),
('K2', 'K2 Pink', 3, 2, 'grid'),
('K3', 'K3 Red', 2, 3, 'grid'),
('K4', 'K4 Green', 2, 1, 'aisle')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    columns = EXCLUDED.columns,
    rows = EXCLUDED.rows,
    type = EXCLUDED.type;

-- 2. Insert Warehouse Locations
-- For K1 Blue (3 columns x 4 rows, cells K1-A01 to K1-D03)
-- Row indices: 0 = A, 1 = B, 2 = C, 3 = D
-- Col indices: 0 = 01, 1 = 02, 2 = 03
INSERT INTO public.warehouse_locations (id, warehouse_id, code, column_index, row_index, qr_payload) VALUES
('K1-A01', 'K1', 'A01', 0, 0, 'WAREHOUSE_LOCATION:K1-A01'),
('K1-A02', 'K1', 'A02', 1, 0, 'WAREHOUSE_LOCATION:K1-A02'),
('K1-A03', 'K1', 'A03', 2, 0, 'WAREHOUSE_LOCATION:K1-A03'),
('K1-B01', 'K1', 'B01', 0, 1, 'WAREHOUSE_LOCATION:K1-B01'),
('K1-B02', 'K1', 'B02', 1, 1, 'WAREHOUSE_LOCATION:K1-B02'),
('K1-B03', 'K1', 'B03', 2, 1, 'WAREHOUSE_LOCATION:K1-B03'),
('K1-C01', 'K1', 'C01', 0, 2, 'WAREHOUSE_LOCATION:K1-C01'),
('K1-C02', 'K1', 'C02', 1, 2, 'WAREHOUSE_LOCATION:K1-C02'),
('K1-C03', 'K1', 'C03', 2, 2, 'WAREHOUSE_LOCATION:K1-C03'),
('K1-D01', 'K1', 'D01', 0, 3, 'WAREHOUSE_LOCATION:K1-D01'),
('K1-D02', 'K1', 'D02', 1, 3, 'WAREHOUSE_LOCATION:K1-D02'),
('K1-D03', 'K1', 'D03', 2, 3, 'WAREHOUSE_LOCATION:K1-D03')
ON CONFLICT (id) DO NOTHING;

-- For K2 Pink (3 columns x 2 rows, cells K2-A01 to K2-B03)
-- Row indices: 0 = A, 1 = B
-- Col indices: 0 = 01, 1 = 02, 2 = 03
INSERT INTO public.warehouse_locations (id, warehouse_id, code, column_index, row_index, qr_payload) VALUES
('K2-A01', 'K2', 'A01', 0, 0, 'WAREHOUSE_LOCATION:K2-A01'),
('K2-A02', 'K2', 'A02', 1, 0, 'WAREHOUSE_LOCATION:K2-A02'),
('K2-A03', 'K2', 'A03', 2, 0, 'WAREHOUSE_LOCATION:K2-A03'),
('K2-B01', 'K2', 'B01', 0, 1, 'WAREHOUSE_LOCATION:K2-B01'),
('K2-B02', 'K2', 'B02', 1, 1, 'WAREHOUSE_LOCATION:K2-B02'),
('K2-B03', 'K2', 'B03', 2, 1, 'WAREHOUSE_LOCATION:K2-B03')
ON CONFLICT (id) DO NOTHING;

-- For K3 Red (2 columns x 3 rows, cells K3-A01 to K3-C02)
-- Row indices: 0 = A, 1 = B, 2 = C
-- Col indices: 0 = 01, 1 = 02
INSERT INTO public.warehouse_locations (id, warehouse_id, code, column_index, row_index, qr_payload) VALUES
('K3-A01', 'K3', 'A01', 0, 0, 'WAREHOUSE_LOCATION:K3-A01'),
('K3-A02', 'K3', 'A02', 1, 0, 'WAREHOUSE_LOCATION:K3-A02'),
('K3-B01', 'K3', 'B01', 0, 1, 'WAREHOUSE_LOCATION:K3-B01'),
('K3-B02', 'K3', 'B02', 1, 1, 'WAREHOUSE_LOCATION:K3-B02'),
('K3-C01', 'K3', 'C01', 0, 2, 'WAREHOUSE_LOCATION:K3-C01'),
('K3-C02', 'K3', 'C02', 1, 2, 'WAREHOUSE_LOCATION:K3-C02')
ON CONFLICT (id) DO NOTHING;

-- For K4 Green (2 aisles: K4-D1 and K4-D2)
INSERT INTO public.warehouse_locations (id, warehouse_id, code, column_index, row_index, qr_payload) VALUES
('K4-D1', 'K4', 'D1', 0, 0, 'WAREHOUSE_LOCATION:K4-D1'),
('K4-D2', 'K4', 'D2', 1, 0, 'WAREHOUSE_LOCATION:K4-D2')
ON CONFLICT (id) DO NOTHING;

-- Insert some sample products for testing/out-of-the-box experience
INSERT INTO public.product_current_locations (product_code, location_id, updated_at, updated_by) VALUES
('e120.30', 'K1-B02', NOW(), 'System Seed'),
('p500.45', 'K2-A03', NOW(), 'System Seed'),
('a100.99', 'K3-C01', NOW(), 'System Seed'),
('x888.88', 'K4-D1', NOW(), 'System Seed')
ON CONFLICT (product_code) DO NOTHING;
