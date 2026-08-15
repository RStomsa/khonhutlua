import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Search,
  Maximize2,
  Minimize2,
  Compass,
  Package,
  Clock,
  MapPin,
  ZoomIn,
  ZoomOut,
  Navigation,
  Eye,
  EyeOff
} from 'lucide-react';
import type {
  Warehouse,
  WarehouseLocation,
  ProductCurrentLocation,
  ProductLocationMovement
} from '../lib/database';

interface WarehouseSatelliteMapProps {
  warehouses: Warehouse[];
  allLocations: WarehouseLocation[];
  currentLocations: ProductCurrentLocation[];
  movementsHistory: ProductLocationMovement[];
  onSelectLocation?: (locationId: string) => void;
  selectedLocationId?: string | null;
  highlightProductCode?: string | null;
}

// Map layer provider configurations
const TILE_PROVIDERS = {
  satellite: {
    name: 'Vệ tinh (Esri World Imagery)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 20
  },
  street: {
    name: 'Bản đồ đường phố (OSM)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  },
  dark: {
    name: 'Bản đồ Dạ quang (CartoDB Dark)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20
  }
};

// Base coordinates for the warehouse complex (Industrial park complex)
// Lat/Lng center point
const BASE_LAT = 10.7932;
const BASE_LNG = 106.6542;

// Offset coordinates for warehouse bounding polygons (Simulated realistic industrial buildings)
const WAREHOUSE_GEOMETRIES: Record<string, {
  center: [number, number];
  bounds: [[number, number], [number, number]];
  color: string;
  fillColor: string;
  tagColor: string;
}> = {
  K1: {
    center: [BASE_LAT + 0.00035, BASE_LNG - 0.00045],
    bounds: [
      [BASE_LAT + 0.00015, BASE_LNG - 0.00075],
      [BASE_LAT + 0.00055, BASE_LNG - 0.00015]
    ],
    color: '#3b82f6',
    fillColor: 'rgba(59, 130, 246, 0.35)',
    tagColor: '#60a5fa'
  },
  K2: {
    center: [BASE_LAT + 0.00035, BASE_LNG + 0.00045],
    bounds: [
      [BASE_LAT + 0.00015, BASE_LNG + 0.00015],
      [BASE_LAT + 0.00055, BASE_LNG + 0.00075]
    ],
    color: '#ec4899',
    fillColor: 'rgba(236, 72, 153, 0.35)',
    tagColor: '#f472b6'
  },
  K3: {
    center: [BASE_LAT - 0.00035, BASE_LNG - 0.00045],
    bounds: [
      [BASE_LAT - 0.00055, BASE_LNG - 0.00075],
      [BASE_LAT - 0.00015, BASE_LNG - 0.00015]
    ],
    color: '#ef4444',
    fillColor: 'rgba(239, 68, 68, 0.35)',
    tagColor: '#f87171'
  },
  K4: {
    center: [BASE_LAT - 0.00035, BASE_LNG + 0.00045],
    bounds: [
      [BASE_LAT - 0.00055, BASE_LNG + 0.00015],
      [BASE_LAT - 0.00015, BASE_LNG + 0.00075]
    ],
    color: '#10b981',
    fillColor: 'rgba(16, 185, 129, 0.35)',
    tagColor: '#34d399'
  }
};

export const WarehouseSatelliteMap: React.FC<WarehouseSatelliteMapProps> = ({
  warehouses,
  allLocations,
  currentLocations,
  movementsHistory,
  onSelectLocation,
  selectedLocationId,
  highlightProductCode
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const racksGroupRef = useRef<L.LayerGroup | null>(null);

  const [activeLayer, setActiveLayer] = useState<'satellite' | 'street' | 'dark'>('satellite');
  const [filterMode, setFilterMode] = useState<'all' | 'occupied' | 'empty'>('all');
  const [showRacks, setShowRacks] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [activeWarehouseFocus, setActiveWarehouseFocus] = useState<string | null>(null);
  const [inspectedLocation, setInspectedLocation] = useState<WarehouseLocation | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Map product dictionary by location_id for O(1) lookup
  const productByLocation = useMemo(() => {
    const map = new Map<string, string>();
    currentLocations.forEach(item => {
      if (item.location_id) {
        map.set(item.location_id, item.product_code);
      }
    });
    return map;
  }, [currentLocations]);

  // Statistics calculation for each warehouse
  const warehouseStats = useMemo(() => {
    const stats: Record<string, { total: number; occupied: number; empty: number; percentage: number }> = {};
    warehouses.forEach(wh => {
      const locs = allLocations.filter(l => l.warehouse_id === wh.id);
      const total = locs.length;
      let occupied = 0;
      locs.forEach(l => {
        if (productByLocation.has(l.id)) occupied++;
      });
      const empty = total - occupied;
      const percentage = total > 0 ? Math.round((occupied / total) * 100) : 0;
      stats[wh.id] = { total, occupied, empty, percentage };
    });
    return stats;
  }, [warehouses, allLocations, productByLocation]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [BASE_LAT, BASE_LNG],
      zoom: 18,
      minZoom: 15,
      maxZoom: 21,
      zoomControl: false,
      attributionControl: false
    });

    const tile = L.tileLayer(TILE_PROVIDERS.satellite.url, {
      maxZoom: TILE_PROVIDERS.satellite.maxZoom,
      attribution: TILE_PROVIDERS.satellite.attribution
    }).addTo(map);

    tileLayerRef.current = tile;
    layersGroupRef.current = L.layerGroup().addTo(map);
    racksGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer when layer type changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const provider = TILE_PROVIDERS[activeLayer];
    tileLayerRef.current.setUrl(provider.url);
    tileLayerRef.current.options.maxZoom = provider.maxZoom;
  }, [activeLayer]);

  // Render Warehouse Geometries, Labels, and Rack Grids on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layersGroup = layersGroupRef.current;
    const racksGroup = racksGroupRef.current;
    if (!map || !layersGroup || !racksGroup) return;

    layersGroup.clearLayers();
    racksGroup.clearLayers();

    warehouses.forEach(wh => {
      const geom = WAREHOUSE_GEOMETRIES[wh.id] || {
        center: [BASE_LAT, BASE_LNG],
        bounds: [
          [BASE_LAT - 0.0002, BASE_LNG - 0.0002],
          [BASE_LAT + 0.0002, BASE_LNG + 0.0002]
        ],
        color: '#3b82f6',
        fillColor: 'rgba(59, 130, 246, 0.35)',
        tagColor: '#60a5fa'
      };

      const stat = warehouseStats[wh.id] || { total: 0, occupied: 0, percentage: 0 };
      const isFocused = activeWarehouseFocus === wh.id;

      // Draw warehouse building footprint rectangle polygon
      const rectangle = L.rectangle(geom.bounds, {
        color: geom.color,
        weight: isFocused ? 3.5 : 2,
        fillColor: geom.color,
        fillOpacity: isFocused ? 0.45 : 0.22,
        dashArray: isFocused ? undefined : '6, 6',
        className: 'warehouse-polygon-layer'
      });

      rectangle.on('click', () => {
        setActiveWarehouseFocus(wh.id);
        map.flyToBounds(geom.bounds, { padding: [40, 40], duration: 1 });
      });

      rectangle.addTo(layersGroup);

      // Add Warehouse Header Label on satellite image
      if (showLabels) {
        const labelHtml = `
          <div class="satellite-wh-label" style="border-left: 3px solid ${geom.color};">
            <div class="wh-label-title" style="color: ${geom.tagColor}">${wh.name}</div>
            <div class="wh-label-sub">
              <span>${stat.occupied}/${stat.total} SP</span>
              <span class="wh-fill-badge" style="background: ${stat.percentage > 80 ? '#ef4444' : '#10b981'}">${stat.percentage}%</span>
            </div>
          </div>
        `;

        const labelIcon = L.divIcon({
          html: labelHtml,
          className: 'custom-leaflet-label',
          iconSize: [120, 40],
          iconAnchor: [60, -10]
        });

        L.marker([geom.bounds[1][0], geom.center[1]], { icon: labelIcon, interactive: false }).addTo(layersGroup);
      }

      // Draw Internal Racks / Locations inside the Warehouse
      if (showRacks) {
        const locs = allLocations.filter(l => l.warehouse_id === wh.id);
        const [southWest, northEast] = geom.bounds;
        const latSpan = northEast[0] - southWest[0];
        const lngSpan = northEast[1] - southWest[1];

        // Padding inside warehouse footprint
        const padRatioLat = 0.15;
        const padRatioLng = 0.12;
        const effectiveLatStart = southWest[0] + latSpan * padRatioLat;
        const effectiveLatEnd = northEast[0] - latSpan * padRatioLat;
        const effectiveLngStart = southWest[1] + lngSpan * padRatioLng;
        const effectiveLngEnd = northEast[1] - lngSpan * padRatioLng;

        const effectiveLatSpan = effectiveLatEnd - effectiveLatStart;
        const effectiveLngSpan = effectiveLngEnd - effectiveLngStart;

        const numRows = Math.max(wh.rows, 1);
        const numCols = Math.max(wh.columns, 1);
        const cellLatSize = effectiveLatSpan / numRows;
        const cellLngSize = effectiveLngSpan / numCols;

        locs.forEach(loc => {
          const product = productByLocation.get(loc.id);
          const hasProduct = Boolean(product);

          // Apply filters
          if (filterMode === 'occupied' && !hasProduct) return;
          if (filterMode === 'empty' && hasProduct) return;

          const isLocationSelected = selectedLocationId === loc.id;
          const isHighlightProduct = highlightProductCode && product === highlightProductCode;

          // Calculate cell position in matrix (Row 0 is top / North)
          const r = loc.row_index;
          const c = loc.column_index;

          const cellNorth = effectiveLatEnd - (r * cellLatSize) - (cellLatSize * 0.08);
          const cellSouth = cellNorth - (cellLatSize * 0.84);
          const cellWest = effectiveLngStart + (c * cellLngSize) + (cellLngSize * 0.08);
          const cellEast = cellWest + (cellLngSize * 0.84);

          const cellBounds: [[number, number], [number, number]] = [
            [cellSouth, cellWest],
            [cellNorth, cellEast]
          ];

          // Determine styling based on rack state
          let cellColor = hasProduct ? '#10b981' : 'rgba(255, 255, 255, 0.4)';
          let cellFill = hasProduct ? 'rgba(16, 185, 129, 0.65)' : 'rgba(15, 23, 42, 0.55)';
          let cellWeight = 1.2;

          if (isHighlightProduct || isLocationSelected) {
            cellColor = '#f59e0b';
            cellFill = 'rgba(245, 158, 11, 0.9)';
            cellWeight = 3;
          }

          const rackPoly = L.rectangle(cellBounds, {
            color: cellColor,
            fillColor: cellFill,
            fillOpacity: 0.85,
            weight: cellWeight,
            className: isHighlightProduct ? 'pulse-rack-highlight' : ''
          });

          rackPoly.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            setInspectedLocation(loc);
            if (onSelectLocation) {
              onSelectLocation(loc.id);
            }
          });

          rackPoly.addTo(racksGroup);

          // Rack mini label text inside cell
          const centerLat = (cellNorth + cellSouth) / 2;
          const centerLng = (cellWest + cellEast) / 2;

          const rackIcon = L.divIcon({
            html: `
              <div class="rack-marker-inner ${hasProduct ? 'has-item' : 'empty'} ${isHighlightProduct ? 'highlight' : ''}">
                <span class="rack-code">${loc.code}</span>
                ${hasProduct ? `<span class="rack-prod">${product}</span>` : ''}
              </div>
            `,
            className: 'rack-leaflet-marker',
            iconSize: [46, 26],
            iconAnchor: [23, 13]
          });

          L.marker([centerLat, centerLng], { icon: rackIcon, interactive: false }).addTo(racksGroup);
        });
      }
    });
  }, [
    warehouses,
    allLocations,
    productByLocation,
    warehouseStats,
    activeWarehouseFocus,
    filterMode,
    showRacks,
    showLabels,
    selectedLocationId,
    highlightProductCode
  ]);

  // Handle fly to searched location or product
  const handlePerformSearch = (query: string) => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return;

    // Search by product code
    const foundProduct = currentLocations.find(
      p => p.product_code.toLowerCase().includes(trimmed) && p.location_id
    );

    if (foundProduct && foundProduct.location_id) {
      const loc = allLocations.find(l => l.id === foundProduct.location_id);
      if (loc) {
        flyToLocation(loc);
        setInspectedLocation(loc);
        return;
      }
    }

    // Search by location ID or code (e.g., "K1-A01" or "A01")
    const foundLoc = allLocations.find(
      l => l.id.toLowerCase().includes(trimmed) || l.code.toLowerCase() === trimmed
    );

    if (foundLoc) {
      flyToLocation(foundLoc);
      setInspectedLocation(foundLoc);
    }
  };

  const flyToLocation = (loc: WarehouseLocation) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const geom = WAREHOUSE_GEOMETRIES[loc.warehouse_id];
    if (geom) {
      map.flyTo(geom.center, 20, { duration: 1.2 });
      setActiveWarehouseFocus(loc.warehouse_id);
      if (onSelectLocation) {
        onSelectLocation(loc.id);
      }
    }
  };

  const resetView = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo([BASE_LAT, BASE_LNG], 18, { duration: 1 });
    setActiveWarehouseFocus(null);
    setInspectedLocation(null);
  };

  return (
    <div className={`satellite-map-wrapper ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      {/* Top Map Control Bar */}
      <div className="satellite-topbar glass-card">
        {/* Warehouse Quick Selector Buttons */}
        <div className="sat-quick-tabs">
          <button
            className={`sat-tab-btn ${activeWarehouseFocus === null ? 'active' : ''}`}
            onClick={resetView}
          >
            <Compass size={14} /> Toàn cảnh khuôn viên
          </button>
          {warehouses.map(w => (
            <button
              key={w.id}
              className={`sat-tab-btn ${activeWarehouseFocus === w.id ? 'active' : ''}`}
              onClick={() => {
                setActiveWarehouseFocus(w.id);
                const geom = WAREHOUSE_GEOMETRIES[w.id];
                if (geom && mapInstanceRef.current) {
                  mapInstanceRef.current.flyToBounds(geom.bounds, { padding: [50, 50], duration: 1 });
                }
              }}
            >
              <span className="dot-indicator" style={{ background: WAREHOUSE_GEOMETRIES[w.id]?.color || '#3b82f6' }} />
              {w.name}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="sat-search-box">
          <Search size={16} className="sat-search-icon" />
          <input
            type="text"
            placeholder="Tìm mã SP (e120.30) hoặc vị trí (A01)..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handlePerformSearch(localSearch);
            }}
          />
          {localSearch && (
            <button className="sat-search-btn" onClick={() => handlePerformSearch(localSearch)}>
              Tìm
            </button>
          )}
        </div>
      </div>

      {/* Main Map Container Canvas */}
      <div className="satellite-map-canvas-container">
        <div ref={mapContainerRef} className="leaflet-map-canvas" />

        {/* Floating Side Tools Toolbar */}
        <div className="sat-floating-tools">
          {/* Layer Selector */}
          <div className="sat-tool-group">
            <button
              className={`sat-tool-btn ${activeLayer === 'satellite' ? 'active' : ''}`}
              title="Ảnh Vệ tinh thực địa"
              onClick={() => setActiveLayer('satellite')}
            >
              🛰️
            </button>
            <button
              className={`sat-tool-btn ${activeLayer === 'street' ? 'active' : ''}`}
              title="Bản đồ đường phố"
              onClick={() => setActiveLayer('street')}
            >
              🗺️
            </button>
            <button
              className={`sat-tool-btn ${activeLayer === 'dark' ? 'active' : ''}`}
              title="Bản đồ đêm Dạ quang"
              onClick={() => setActiveLayer('dark')}
            >
              🌌
            </button>
          </div>

          {/* Display Toggles */}
          <div className="sat-tool-group">
            <button
              className={`sat-tool-btn ${showRacks ? 'active' : ''}`}
              title="Ẩn/Hiện Chi tiết Ô kệ hàng"
              onClick={() => setShowRacks(!showRacks)}
            >
              <Package size={16} />
            </button>
            <button
              className={`sat-tool-btn ${showLabels ? 'active' : ''}`}
              title="Ẩn/Hiện Tên kho"
              onClick={() => setShowLabels(!showLabels)}
            >
              {showLabels ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          </div>

          {/* Filter Status Selector */}
          <div className="sat-tool-group">
            <button
              className={`sat-tool-btn ${filterMode === 'all' ? 'active' : ''}`}
              title="Tất cả vị trí"
              onClick={() => setFilterMode('all')}
            >
              Tất cả
            </button>
            <button
              className={`sat-tool-btn ${filterMode === 'occupied' ? 'active' : ''}`}
              title="Chỉ vị trí có hàng"
              onClick={() => setFilterMode('occupied')}
            >
              📦 Có hàng
            </button>
            <button
              className={`sat-tool-btn ${filterMode === 'empty' ? 'active' : ''}`}
              title="Chỉ vị trí trống"
              onClick={() => setFilterMode('empty')}
            >
              ⬜ Trống
            </button>
          </div>

          {/* Zoom & Fullscreen Controls */}
          <div className="sat-tool-group">
            <button
              className="sat-tool-btn"
              title="Phóng to"
              onClick={() => mapInstanceRef.current?.zoomIn()}
            >
              <ZoomIn size={16} />
            </button>
            <button
              className="sat-tool-btn"
              title="Thu nhỏ"
              onClick={() => mapInstanceRef.current?.zoomOut()}
            >
              <ZoomOut size={16} />
            </button>
            <button
              className="sat-tool-btn"
              title="Về toàn cảnh"
              onClick={resetView}
            >
              <Navigation size={16} />
            </button>
            <button
              className="sat-tool-btn"
              title="Toàn màn hình"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        {/* Warehouse Real-time Occupancy Overview Widget */}
        <div className="sat-occupancy-legend glass-card">
          <div className="legend-header">
            <span className="legend-title">Sức chứa toàn kho</span>
            <span className="legend-badge">Trực quan Vệ tinh</span>
          </div>
          <div className="legend-items">
            {warehouses.map(w => {
              const stat = warehouseStats[w.id] || { total: 0, occupied: 0, percentage: 0 };
              const color = WAREHOUSE_GEOMETRIES[w.id]?.color || '#3b82f6';
              return (
                <div
                  key={w.id}
                  className="legend-row"
                  onClick={() => {
                    setActiveWarehouseFocus(w.id);
                    const geom = WAREHOUSE_GEOMETRIES[w.id];
                    if (geom && mapInstanceRef.current) {
                      mapInstanceRef.current.flyToBounds(geom.bounds, { padding: [50, 50], duration: 1 });
                    }
                  }}
                >
                  <div className="legend-row-left">
                    <span className="legend-dot" style={{ background: color }} />
                    <span className="legend-name">{w.name}</span>
                  </div>
                  <div className="legend-row-right">
                    <span className="legend-count">{stat.occupied}/{stat.total}</span>
                    <div className="legend-bar-bg">
                      <div
                        className="legend-bar-fill"
                        style={{ width: `${stat.percentage}%`, background: color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Location Inspector Side Drawer Popup */}
        {inspectedLocation && (
          <div className="sat-location-inspector glass-card animate-fade-in">
            <div className="inspector-header">
              <div className="inspector-title-row">
                <MapPin size={18} className="text-primary" />
                <div>
                  <h4 className="inspector-code">{inspectedLocation.id}</h4>
                  <span className="inspector-wh">
                    Kho: {warehouses.find(w => w.id === inspectedLocation.warehouse_id)?.name} &bull; Kệ {inspectedLocation.code}
                  </span>
                </div>
              </div>
              <button className="inspector-close" onClick={() => setInspectedLocation(null)}>
                &times;
              </button>
            </div>

            <div className="inspector-body">
              {/* Product State */}
              <div className="inspector-product-card">
                <span className="inspector-label">Hàng hóa lưu trữ:</span>
                {productByLocation.has(inspectedLocation.id) ? (
                  <div className="inspector-item-active">
                    <div className="inspector-item-code">
                      {productByLocation.get(inspectedLocation.id)}
                    </div>
                    <span className="badge badge-completed">Đang lưu kho</span>
                  </div>
                ) : (
                  <div className="inspector-item-empty">
                    <span className="text-muted">Vị trí hiện đang còn trống</span>
                  </div>
                )}
              </div>

              {/* QR Payload Info */}
              <div className="inspector-info-row">
                <span className="info-key">Mã QR Kệ:</span>
                <code className="info-val">{inspectedLocation.qr_payload}</code>
              </div>

              {/* Transaction History for this rack */}
              <div className="inspector-history-section">
                <h5 className="history-title"><Clock size={14} /> Lịch sử xuất/nhập kệ</h5>
                {(() => {
                  const hist = movementsHistory.filter(
                    m => m.from_location_id === inspectedLocation.id || m.to_location_id === inspectedLocation.id
                  );
                  if (hist.length === 0) {
                    return <p className="text-muted" style={{ fontSize: '0.75rem', padding: '6px 0' }}>Chưa có nhật ký giao dịch nào.</p>;
                  }
                  return (
                    <div className="inspector-history-list">
                      {hist.slice(0, 4).map(h => (
                        <div key={h.id} className="inspector-history-item">
                          <div className="item-row">
                            <strong>{h.product_code}</strong>
                            <span className={h.to_location_id === inspectedLocation.id ? 'text-success' : 'text-warning'}>
                              {h.to_location_id === inspectedLocation.id ? '📥 Nhập/Chuyển đến' : '📤 Xuất/Chuyển đi'}
                            </span>
                          </div>
                          <div className="item-date">{new Date(h.created_at).toLocaleString('vi-VN')}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default WarehouseSatelliteMap;
