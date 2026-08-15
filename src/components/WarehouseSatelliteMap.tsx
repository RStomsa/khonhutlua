import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Search,
  Maximize2,
  Minimize2,
  Compass,
  Clock,
  MapPin,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Grid,
  ArrowRightLeft
} from 'lucide-react';
import type {
  Warehouse,
  WarehouseZone,
  WarehouseLocation,
  Product,
  ProductCurrentLocation,
  ProductLocationMovement
} from '../lib/database';
import {
  createWarehouseLocation,
  deleteWarehouseLocation,
  executeProductMovement
} from '../lib/database';

interface WarehouseSatelliteMapProps {
  warehouses: Warehouse[];
  zones?: WarehouseZone[];
  allLocations: WarehouseLocation[];
  products?: Product[];
  currentLocations: ProductCurrentLocation[];
  movementsHistory: ProductLocationMovement[];
  onSelectLocation?: (locationId: string) => void;
  selectedLocationId?: string | null;
  highlightProductCode?: string | null;
  onOpenPartitionModal?: (warehouseId?: string) => void;
  onDataChanged?: () => void;
}

// Map Tile Providers
const TILE_PROVIDERS = {
  google_hybrid: {
    name: 'Google Maps Vệ tinh + Địa danh (Hybrid)',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps Satellite',
    maxZoom: 21,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
  },
  google_satellite: {
    name: 'Google Maps Vệ tinh (Gốc)',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    maxZoom: 21,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
  },
  google_streets: {
    name: 'Google Maps Đường phố',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
  }
};

// Default center GPS anchor
const DEFAULT_CENTER_LAT = 10.776889;
const DEFAULT_CENTER_LNG = 106.700806;

// Helper: Convert meters to latitude offset
const metersToLat = (meters: number) => meters / 111320;

// Helper: Convert meters to longitude offset at given latitude
const metersToLng = (meters: number, atLat: number) =>
  meters / (111320 * Math.cos((atLat * Math.PI) / 180));

export const WarehouseSatelliteMap: React.FC<WarehouseSatelliteMapProps> = ({
  warehouses,
  zones = [],
  allLocations,
  products = [],
  currentLocations,
  movementsHistory,
  onSelectLocation,
  selectedLocationId,
  highlightProductCode,
  onOpenPartitionModal,
  onDataChanged
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const racksGroupRef = useRef<L.LayerGroup | null>(null);
  const userGpsGroupRef = useRef<L.LayerGroup | null>(null);

  // Zoom Tracking for Level of Detail (LOD)
  const [currentZoom, setCurrentZoom] = useState(18);

  // Layer & Display States
  const [activeLayer, setActiveLayer] = useState<keyof typeof TILE_PROVIDERS>('google_hybrid');
  const [filterMode] = useState<'all' | 'occupied' | 'empty'>('all');
  const [activeWarehouseFocus, setActiveWarehouseFocus] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localSearch, setLocalSearch] = useState(highlightProductCode || '');
  const [inspectedLocation, setInspectedLocation] = useState<WarehouseLocation | null>(null);

  // GPS Device Status
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'success' | 'error'>('idle');

  // Inspector Quick Transfer State
  const [quickTargetWh, setQuickTargetWh] = useState<string>('');
  const [isQuickTransferring, setIsQuickTransferring] = useState(false);

  // Map product binding: Location ID -> Product object
  const productByLocationMap = useMemo(() => {
    const map = new Map<string, Product>();
    currentLocations.forEach(cur => {
      if (cur.location_id) {
        const prod = products.find(p => p.id === cur.product_id);
        if (prod) map.set(cur.location_id, prod);
      }
    });
    return map;
  }, [currentLocations, products]);

  // Dynamic Warehouse Geometries (Computed from database properties)
  const dynamicWarehouseGeometries = useMemo(() => {
    const map: Record<string, {
      center: [number, number];
      bounds: [[number, number], [number, number]];
      color: string;
      widthM: number;
      lengthM: number;
    }> = {};

    warehouses.forEach((wh, idx) => {
      // If GPS is not set, compute staggered offset from default center
      const centerLat = wh.gps_lat || (DEFAULT_CENTER_LAT + (idx % 2 === 0 ? 0.0003 : -0.0003));
      const centerLng = wh.gps_lng || (DEFAULT_CENTER_LNG + (idx < 2 ? -0.0003 : 0.0003));
      const lengthM = wh.length_m || 30.0;
      const widthM = wh.width_m || 15.0;

      const latHalf = metersToLat(lengthM / 2);
      const lngHalf = metersToLng(widthM / 2, centerLat);

      map[wh.id] = {
        center: [centerLat, centerLng],
        bounds: [
          [centerLat - latHalf, centerLng - lngHalf],
          [centerLat + latHalf, centerLng + lngHalf]
        ],
        color: wh.color || '#2563eb',
        widthM,
        lengthM
      };
    });

    return map;
  }, [warehouses]);

  // Compute Occupancy Stats for each warehouse
  const warehouseStats = useMemo(() => {
    const stats: Record<string, { total: number; occupied: number; percentage: number }> = {};
    warehouses.forEach(wh => {
      const whLocs = allLocations.filter(l => l.warehouse_id === wh.id);
      const total = whLocs.length;
      let occupied = 0;
      whLocs.forEach(l => {
        if (productByLocationMap.has(l.id)) occupied++;
      });
      const percentage = total > 0 ? Math.round((occupied / total) * 100) : 0;
      stats[wh.id] = { total, occupied, percentage };
    });
    return stats;
  }, [warehouses, allLocations, productByLocationMap]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const firstWh = warehouses[0];
    const initialCenterLat = firstWh?.gps_lat || DEFAULT_CENTER_LAT;
    const initialCenterLng = firstWh?.gps_lng || DEFAULT_CENTER_LNG;

    const map = L.map(mapContainerRef.current, {
      center: [initialCenterLat, initialCenterLng],
      zoom: 18,
      minZoom: 14,
      maxZoom: 21,
      zoomControl: false,
      attributionControl: false
    });

    const initialProvider = TILE_PROVIDERS[activeLayer];
    const tile = L.tileLayer(initialProvider.url, {
      maxZoom: initialProvider.maxZoom,
      attribution: initialProvider.attribution
    }).addTo(map);

    tileLayerRef.current = tile;
    layersGroupRef.current = L.layerGroup().addTo(map);
    racksGroupRef.current = L.layerGroup().addTo(map);
    userGpsGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Provider
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const provider = TILE_PROVIDERS[activeLayer];
    tileLayerRef.current.setUrl(provider.url);
    tileLayerRef.current.options.maxZoom = provider.maxZoom;
  }, [activeLayer]);

  // Render Warehouses, Zones & Locations
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layersGroup = layersGroupRef.current;
    const racksGroup = racksGroupRef.current;
    if (!map || !layersGroup || !racksGroup) return;

    layersGroup.clearLayers();
    racksGroup.clearLayers();

    const shouldDrawRacks = currentZoom >= 18;

    warehouses.forEach(wh => {
      const geom = dynamicWarehouseGeometries[wh.id];
      if (!geom) return;

      const stat = warehouseStats[wh.id] || { total: 0, occupied: 0, percentage: 0 };
      const isFocused = activeWarehouseFocus === wh.id;
      const isDimmed = activeWarehouseFocus !== null && !isFocused;

      // 1. Warehouse Building Outline
      const rectangle = L.rectangle(geom.bounds, {
        color: isFocused ? '#2563eb' : geom.color,
        weight: isFocused ? 3.5 : isDimmed ? 1 : 2.5,
        fillColor: geom.color,
        fillOpacity: isFocused ? 0.35 : isDimmed ? 0.08 : 0.2,
        dashArray: isFocused ? undefined : isDimmed ? '4, 4' : '6, 6',
        className: 'warehouse-polygon-layer'
      });

      rectangle.on('click', () => {
        if (activeWarehouseFocus === wh.id) {
          setActiveWarehouseFocus(null);
          resetView();
        } else {
          setActiveWarehouseFocus(wh.id);
          map.flyToBounds(geom.bounds, { padding: [50, 50], duration: 1 });
        }
      });

      rectangle.addTo(layersGroup);

      // 2. Warehouse Header Pill
      const labelHtml = `
        <div class="lod-wh-pill ${isFocused ? 'focus' : ''} ${isDimmed ? 'dimmed' : ''}" style="border-left-color: ${geom.color};">
          <div class="pill-name" style="color: ${geom.color}">${wh.code} - ${wh.name}</div>
          <div class="pill-stats">
            <span>${stat.occupied}/${stat.total} SP</span>
            <span class="pill-badge" style="background: ${stat.percentage > 80 ? '#dc2626' : '#059669'}">${stat.percentage}%</span>
          </div>
        </div>
      `;

      const labelIcon = L.divIcon({
        html: labelHtml,
        className: 'custom-leaflet-label',
        iconSize: [120, 36],
        iconAnchor: [60, -8]
      });

      L.marker([geom.bounds[1][0], geom.center[1]], { icon: labelIcon, interactive: false }).addTo(layersGroup);

      // 3. Render Internal Zones & Locations
      const renderThisWarehouseRacks = shouldDrawRacks && (!activeWarehouseFocus || isFocused);

      if (renderThisWarehouseRacks) {
        const whLocs = allLocations.filter(l => l.warehouse_id === wh.id);
        const whZones = zones.filter(z => z.warehouse_id === wh.id);

        const southWest = geom.bounds[0];
        const baseOriginLat = southWest[0] + metersToLat(1.0); // 1m margin
        const baseOriginLng = southWest[1] + metersToLng(1.0, geom.center[0]);

        // Render Zones Outline
        whZones.forEach(zone => {
          const zoneSouth = baseOriginLat + metersToLat(zone.y_m);
          const zoneWest = baseOriginLng + metersToLng(zone.x_m, geom.center[0]);
          const zoneNorth = zoneSouth + metersToLat(zone.height_m);
          const zoneEast = zoneWest + metersToLng(zone.width_m, geom.center[0]);

          L.rectangle([[zoneSouth, zoneWest], [zoneNorth, zoneEast]], {
            color: zone.color || '#3b82f6',
            weight: 1.5,
            fillColor: zone.color || '#3b82f6',
            fillOpacity: 0.08,
            dashArray: '3, 3'
          }).addTo(racksGroup);
        });

        // Render Locations
        whLocs.forEach((loc, locIndex) => {
          const product = productByLocationMap.get(loc.id);
          const hasProduct = Boolean(product);

          if (filterMode === 'occupied' && !hasProduct) return;
          if (filterMode === 'empty' && hasProduct) return;

          const isLocationSelected = selectedLocationId === loc.id;
          const isHighlighted =
            localSearch &&
            ((product && product.product_code.toLowerCase().includes(localSearch.toLowerCase())) ||
              loc.code.toLowerCase().includes(localSearch.toLowerCase()));

          // Calculate metric position inside warehouse
          const colIndex = locIndex % 3;
          const rowIndex = Math.floor(locIndex / 3);
          const locX = loc.x_m || colIndex * 2.0;
          const locY = loc.y_m || rowIndex * 2.5;
          const locW = loc.width_m || 1.6;
          const locH = loc.height_m || 1.6;

          const cellSouth = baseOriginLat + metersToLat(locY);
          const cellWest = baseOriginLng + metersToLng(locX, geom.center[0]);
          const cellNorth = cellSouth + metersToLat(locH);
          const cellEast = cellWest + metersToLng(locW, geom.center[0]);

          const cellBounds: [[number, number], [number, number]] = [
            [cellSouth, cellWest],
            [cellNorth, cellEast]
          ];

          const cellCenter: [number, number] = [
            (cellSouth + cellNorth) / 2,
            (cellWest + cellEast) / 2
          ];

          let fillColor = '#10b981'; // Green for empty
          let borderColor = '#059669';

          if (hasProduct) {
            fillColor = '#2563eb'; // Blue for occupied
            borderColor = '#1d4ed8';
          }
          if (isHighlighted) {
            fillColor = '#f59e0b'; // Amber for search highlight
            borderColor = '#d97706';
          }
          if (isLocationSelected) {
            fillColor = '#8b5cf6'; // Purple for selected
            borderColor = '#6d28d9';
          }

          const cellRect = L.rectangle(cellBounds, {
            color: borderColor,
            weight: isHighlighted || isLocationSelected ? 2.5 : 1,
            fillColor,
            fillOpacity: isHighlighted || isLocationSelected ? 0.9 : hasProduct ? 0.75 : 0.45
          });

          cellRect.on('click', () => {
            setInspectedLocation(loc);
            if (onSelectLocation) onSelectLocation(loc.id);
          });

          cellRect.addTo(racksGroup);

          // Rack Cell Text Badge
          const rackBadgeHtml = `
            <div class="sat-cell-badge ${hasProduct ? 'occupied' : 'empty'} ${isHighlighted ? 'highlight' : ''}">
              <div class="cell-code">${loc.code}</div>
              ${hasProduct && product ? `<div class="cell-prod">${product.product_code}</div>` : ''}
            </div>
          `;

          const rackIcon = L.divIcon({
            html: rackBadgeHtml,
            className: 'sat-cell-icon',
            iconSize: [40, 24],
            iconAnchor: [20, 12]
          });

          const rackMarker = L.marker(cellCenter, { icon: rackIcon });
          rackMarker.on('click', () => {
            setInspectedLocation(loc);
            if (onSelectLocation) onSelectLocation(loc.id);
          });
          rackMarker.addTo(racksGroup);
        });
      }
    });
  }, [
    warehouses,
    zones,
    allLocations,
    productByLocationMap,
    dynamicWarehouseGeometries,
    warehouseStats,
    activeWarehouseFocus,
    currentZoom,
    filterMode,
    selectedLocationId,
    localSearch
  ]);

  // Device GPS Location Tracker
  const fetchCurrentDeviceGPS = () => {
    if (!navigator.geolocation) {
      alert('Thiết bị của bạn không hỗ trợ định vị GPS.');
      return;
    }
    setGpsStatus('locating');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;

        setGpsStatus('success');

        const map = mapInstanceRef.current;
        const userGpsGroup = userGpsGroupRef.current;
        if (map && userGpsGroup) {
          userGpsGroup.clearLayers();
          const userIcon = L.divIcon({
            html: `
              <div class="user-gps-pulse">
                <div class="gps-dot"></div>
                <div class="gps-ring"></div>
              </div>
            `,
            className: 'custom-gps-icon',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });

          L.marker([userLat, userLng], { icon: userIcon }).addTo(userGpsGroup);
          L.circle([userLat, userLng], {
            radius: accuracy,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
            weight: 1
          }).addTo(userGpsGroup);

          map.flyTo([userLat, userLng], 19, { duration: 1.2 });
        }
      },
      err => {
        console.error('GPS error:', err);
        setGpsStatus('error');
        alert('Không thể lấy tọa độ GPS: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const resetView = () => {
    setActiveWarehouseFocus(null);
    const map = mapInstanceRef.current;
    if (!map || warehouses.length === 0) return;
    const firstGeom = dynamicWarehouseGeometries[warehouses[0].id];
    if (firstGeom) {
      map.flyTo(firstGeom.center, 18, { duration: 0.8 });
    }
  };

  const toggleFullscreen = () => {
    if (!mapContainerRef.current) return;
    if (!document.fullscreenElement) {
      mapContainerRef.current.requestFullscreen().catch(err => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className={`sat-map-wrapper ${isFullscreen ? 'is-fullscreen' : ''}`}>
      {/* Top Control Bar */}
      <div className="sat-topbar glass-card">
        <div className="sat-quick-tabs">
          <button
            className={`sat-tab-btn ${activeWarehouseFocus === null ? 'active' : ''}`}
            onClick={resetView}
          >
            <Compass size={14} />
            <span>Toàn cảnh</span>
          </button>

          {warehouses.map(w => (
            <button
              key={w.id}
              className={`sat-tab-btn ${activeWarehouseFocus === w.id ? 'active' : ''}`}
              onClick={() => {
                setActiveWarehouseFocus(w.id);
                const geom = dynamicWarehouseGeometries[w.id];
                if (geom && mapInstanceRef.current) {
                  mapInstanceRef.current.flyToBounds(geom.bounds, { padding: [50, 50], duration: 1 });
                }
              }}
            >
              <span
                className="tab-color-dot"
                style={{ background: w.color || '#2563eb' }}
              />
              <span>{w.code}</span>
            </button>
          ))}

          <button
            className="sat-tab-btn"
            style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderColor: '#bfdbfe' }}
            onClick={fetchCurrentDeviceGPS}
            title="Định vị vị trí GPS của tôi trên Google Maps"
          >
            <Crosshair size={14} className={gpsStatus === 'locating' ? 'animate-spin' : ''} />
            <span>GPS của tôi</span>
          </button>

          <button
            className="sat-tab-btn"
            style={{ background: 'var(--color-success-light)', color: 'var(--color-success)', borderColor: '#a7f3d0' }}
            onClick={() => onOpenPartitionModal && onOpenPartitionModal(activeWarehouseFocus || undefined)}
            title="Quản lý cấu trúc phân khu & ô vị trí"
          >
            <Grid size={14} />
            <span>Phân khu & Ô vị trí</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="sat-search-box">
          <Search size={16} className="sat-search-icon" />
          <input
            type="text"
            placeholder="Tìm mã SP (e120.30) hoặc vị trí (A01)..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Main Map Container */}
      <div className="sat-leaflet-container" ref={mapContainerRef}>
        {/* Floating Map Controls */}
        <div className="sat-floating-controls">
          <div className="ctrl-group">
            <button className="ctrl-btn" onClick={() => mapInstanceRef.current?.zoomIn()} title="Phóng to">
              <ZoomIn size={18} />
            </button>
            <button className="ctrl-btn" onClick={() => mapInstanceRef.current?.zoomOut()} title="Thu nhỏ">
              <ZoomOut size={18} />
            </button>
          </div>

          <div className="ctrl-group">
            <button className="ctrl-btn" onClick={resetView} title="Về trung tâm kho">
              <Compass size={18} />
            </button>
            <button className="ctrl-btn" onClick={toggleFullscreen} title="Toàn màn hình">
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>

          <div className="layer-select-dropdown">
            <select
              value={activeLayer}
              onChange={(e) => setActiveLayer(e.target.value as any)}
              className="layer-select"
            >
              <option value="google_hybrid">Google Vệ tinh (Hybrid)</option>
              <option value="google_satellite">Google Vệ tinh (Gốc)</option>
              <option value="google_streets">Google Bản đồ</option>
            </select>
          </div>
        </div>

        {/* Side Inspector Drawer for Selected Location */}
        {inspectedLocation && (
          <div className="sat-location-inspector glass-card animate-fade-in">
            <div className="inspector-header">
              <div className="inspector-title-row">
                <MapPin size={18} className="text-primary" />
                <div>
                  <h4 className="inspector-code">{inspectedLocation.code}</h4>
                  <span className="inspector-wh">
                    Kho: {warehouses.find(w => w.id === inspectedLocation.warehouse_id)?.name}
                  </span>
                </div>
              </div>
              <button className="inspector-close" onClick={() => setInspectedLocation(null)}>
                &times;
              </button>
            </div>

            <div className="inspector-body">
              <div className="inspector-product-card">
                <span className="inspector-label">Sản phẩm lưu trữ:</span>
                {productByLocationMap.has(inspectedLocation.id) ? (
                  <div className="inspector-item-active">
                    <div className="inspector-item-code">
                      📦 {productByLocationMap.get(inspectedLocation.id)?.product_code}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#065f46', marginTop: '2px' }}>
                      {productByLocationMap.get(inspectedLocation.id)?.name} ({productByLocationMap.get(inspectedLocation.id)?.length_value} {productByLocationMap.get(inspectedLocation.id)?.length_unit})
                    </div>
                    <span className="badge badge-completed" style={{ marginTop: '4px' }}>Đang lưu kho</span>
                  </div>
                ) : (
                  <div className="inspector-item-empty">
                    <span className="text-muted">Vị trí hiện đang còn trống</span>
                  </div>
                )}
              </div>

              <div className="inspector-info-row">
                <span className="info-key">UUID Định danh:</span>
                <code className="info-val" style={{ fontSize: '0.68rem' }}>{inspectedLocation.id}</code>
              </div>

              <div className="inspector-info-row">
                <span className="info-key">Mã QR Kệ:</span>
                <code className="info-val">{inspectedLocation.qr_payload}</code>
              </div>

              {/* Quick Transfer Slot Tool in Inspector */}
              <div className="inspector-product-card" style={{ marginTop: '10px' }}>
                <span className="inspector-label">🚚 Bốc nguyên ô này sang kho khác:</span>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <select
                    value={quickTargetWh}
                    onChange={(e) => setQuickTargetWh(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.78rem', padding: '6px 8px', flex: 1 }}
                  >
                    <option value="">Chọn kho đích...</option>
                    {warehouses
                      .filter(w => w.id !== inspectedLocation.warehouse_id)
                      .map(w => (
                        <option key={w.id} value={w.id}>
                          Sang {w.code} ({w.name})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '6px 12px', fontSize: '0.78rem' }}
                    disabled={!quickTargetWh || isQuickTransferring}
                    onClick={async () => {
                      if (!quickTargetWh) return;
                      setIsQuickTransferring(true);
                      try {
                        const newLoc = await createWarehouseLocation(quickTargetWh, inspectedLocation.code);
                        const product = productByLocationMap.get(inspectedLocation.id);
                        if (product) {
                          await executeProductMovement(
                            product.id,
                            newLoc.id,
                            'Transfer Admin',
                            `TRANSFER_${product.id}_${newLoc.id}_${Date.now()}`
                          );
                        }
                        await deleteWarehouseLocation(inspectedLocation.id);
                        alert(`Đã bốc ô ${inspectedLocation.code} sang Kho đích thành công!`);
                        setInspectedLocation(null);
                        setQuickTargetWh('');
                        if (onDataChanged) onDataChanged();
                      } catch (err: any) {
                        alert(err.message || 'Lỗi khi bốc ô');
                      } finally {
                        setIsQuickTransferring(false);
                      }
                    }}
                  >
                    <ArrowRightLeft size={13} /> Bốc ô
                  </button>
                </div>
              </div>

              <div className="inspector-history-section">
                <h5 className="history-title"><Clock size={14} /> Lịch sử luân chuyển</h5>
                {(() => {
                  const hist = movementsHistory.filter(
                    m => m.from_location_id === inspectedLocation.id || m.to_location_id === inspectedLocation.id
                  );
                  if (hist.length === 0) {
                    return <p className="text-muted" style={{ fontSize: '0.75rem', padding: '6px 0' }}>Chưa có nhật ký luân chuyển nào.</p>;
                  }
                  return (
                    <div className="inspector-history-list">
                      {hist.slice(0, 4).map(h => {
                        const prod = products.find(p => p.id === h.product_id);
                        return (
                          <div key={h.id} className="inspector-history-item">
                            <div className="item-row">
                              <strong>{prod ? prod.product_code : h.product_id.substring(0, 8)}</strong>
                              <span className={h.to_location_id === inspectedLocation.id ? 'text-success' : 'text-warning'}>
                                {h.to_location_id === inspectedLocation.id ? '📥 Nhập/Đến' : '📤 Xuất/Đi'}
                              </span>
                            </div>
                            <div className="item-date">{new Date(h.created_at).toLocaleString('vi-VN')}</div>
                          </div>
                        );
                      })}
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
