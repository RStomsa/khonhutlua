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
  EyeOff,
  Crosshair,
  Sliders,
  Check,
  RotateCcw,
  Move
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

// Map Tile Providers including Google Maps Satellite / Hybrid
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
    name: 'Google Maps Đường phố (Sáng)',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
  },
  esri: {
    name: 'Esri World Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Imagery',
    maxZoom: 20
  }
};

// Default fallback coordinates (Vietnam Industrial area)
const DEFAULT_LAT = 10.7932;
const DEFAULT_LNG = 106.6542;

// Offset relative layout for 4 standard warehouses
const WAREHOUSE_OFFSETS: Record<string, {
  latOffset: number;
  lngOffset: number;
  width: number;
  height: number;
  color: string;
  fillColor: string;
  tagColor: string;
}> = {
  K1: {
    latOffset: 0.00035,
    lngOffset: -0.00045,
    width: 0.00060,
    height: 0.00040,
    color: '#2563eb',
    fillColor: 'rgba(37, 99, 235, 0.4)',
    tagColor: '#3b82f6'
  },
  K2: {
    latOffset: 0.00035,
    lngOffset: 0.00045,
    width: 0.00060,
    height: 0.00040,
    color: '#db2777',
    fillColor: 'rgba(219, 39, 119, 0.4)',
    tagColor: '#ec4899'
  },
  K3: {
    latOffset: -0.00035,
    lngOffset: -0.00045,
    width: 0.00060,
    height: 0.00040,
    color: '#dc2626',
    fillColor: 'rgba(220, 38, 38, 0.4)',
    tagColor: '#ef4444'
  },
  K4: {
    latOffset: -0.00035,
    lngOffset: 0.00045,
    width: 0.00060,
    height: 0.00040,
    color: '#059669',
    fillColor: 'rgba(5, 150, 105, 0.4)',
    tagColor: '#10b981'
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
  const userGpsGroupRef = useRef<L.LayerGroup | null>(null);

  // GPS Coordinates State (loaded from localStorage or default)
  const [baseCoords, setBaseCoords] = useState<{ lat: number; lng: number }>(() => {
    const saved = localStorage.getItem('kho_gps_coords');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.lat && parsed.lng) return parsed;
      } catch (e) {
        console.error('Invalid saved GPS coords', e);
      }
    }
    return { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
  });

  // Layer & Display States
  const [activeLayer, setActiveLayer] = useState<keyof typeof TILE_PROVIDERS>('google_hybrid');
  const [filterMode, setFilterMode] = useState<'all' | 'occupied' | 'empty'>('all');
  const [showRacks, setShowRacks] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [activeWarehouseFocus, setActiveWarehouseFocus] = useState<string | null>(null);
  const [inspectedLocation, setInspectedLocation] = useState<WarehouseLocation | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // GPS & Calibration Mode
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'success' | 'error'>('idle');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [customLatInput, setCustomLatInput] = useState(baseCoords.lat.toString());
  const [customLngInput, setCustomLngInput] = useState(baseCoords.lng.toString());
  const [scaleFactor, setScaleFactor] = useState(1);

  // Product lookup map
  const productByLocation = useMemo(() => {
    const map = new Map<string, string>();
    currentLocations.forEach(item => {
      if (item.location_id) {
        map.set(item.location_id, item.product_code);
      }
    });
    return map;
  }, [currentLocations]);

  // Statistics calculation
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

  // Calculate dynamic warehouse bounds based on base coordinates and scale factor
  const warehouseGeometries = useMemo(() => {
    const geoms: Record<string, {
      center: [number, number];
      bounds: [[number, number], [number, number]];
      color: string;
      fillColor: string;
      tagColor: string;
    }> = {};

    warehouses.forEach(wh => {
      const offset = WAREHOUSE_OFFSETS[wh.id] || {
        latOffset: 0,
        lngOffset: 0,
        width: 0.0005,
        height: 0.0004,
        color: '#2563eb',
        fillColor: 'rgba(37, 99, 235, 0.4)',
        tagColor: '#3b82f6'
      };

      const centerLat = baseCoords.lat + (offset.latOffset * scaleFactor);
      const centerLng = baseCoords.lng + (offset.lngOffset * scaleFactor);
      const halfHeight = (offset.height * scaleFactor) / 2;
      const halfWidth = (offset.width * scaleFactor) / 2;

      geoms[wh.id] = {
        center: [centerLat, centerLng],
        bounds: [
          [centerLat - halfHeight, centerLng - halfWidth],
          [centerLat + halfHeight, centerLng + halfWidth]
        ],
        color: offset.color,
        fillColor: offset.fillColor,
        tagColor: offset.tagColor
      };
    });

    return geoms;
  }, [warehouses, baseCoords, scaleFactor]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [baseCoords.lat, baseCoords.lng],
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

    // Handle map click during calibration mode
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (isCalibrating) {
        setBaseCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        setCustomLatInput(e.latlng.lat.toFixed(6));
        setCustomLngInput(e.latlng.lng.toFixed(6));
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const provider = TILE_PROVIDERS[activeLayer];
    tileLayerRef.current.setUrl(provider.url);
    tileLayerRef.current.options.maxZoom = provider.maxZoom;
  }, [activeLayer]);

  // Real-time GPS Detection Helper
  const fetchCurrentDeviceGPS = (centerWarehouseHere = false) => {
    if (!navigator.geolocation) {
      alert('Thiết bị của bạn không hỗ trợ định vị GPS.');
      return;
    }

    setGpsStatus('locating');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;

        setUserLocation({ lat: userLat, lng: userLng, accuracy });
        setGpsStatus('success');

        const map = mapInstanceRef.current;
        const gpsGroup = userGpsGroupRef.current;

        if (map && gpsGroup) {
          gpsGroup.clearLayers();

          // User GPS pulse marker
          const userIcon = L.divIcon({
            html: `
              <div class="user-gps-pulse-marker">
                <div class="pulse-ring"></div>
                <div class="pulse-center"></div>
              </div>
            `,
            className: 'custom-gps-icon',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          L.marker([userLat, userLng], { icon: userIcon }).addTo(gpsGroup);

          // Accuracy radius circle
          if (accuracy && accuracy < 200) {
            L.circle([userLat, userLng], {
              radius: accuracy,
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.15,
              weight: 1
            }).addTo(gpsGroup);
          }

          if (centerWarehouseHere) {
            setBaseCoords({ lat: userLat, lng: userLng });
            setCustomLatInput(userLat.toFixed(6));
            setCustomLngInput(userLng.toFixed(6));
            localStorage.setItem('kho_gps_coords', JSON.stringify({ lat: userLat, lng: userLng }));
            map.flyTo([userLat, userLng], 19, { duration: 1.2 });
          } else {
            map.flyTo([userLat, userLng], 18, { duration: 1 });
          }
        }
      },
      (err) => {
        console.warn('GPS location error:', err);
        setGpsStatus('error');
        alert('Không thể nhận vị trí GPS. Hãy bật quyền vị trí trên trình duyệt của bạn.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Draw Polygons, Rack Grids, and Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layersGroup = layersGroupRef.current;
    const racksGroup = racksGroupRef.current;
    if (!map || !layersGroup || !racksGroup) return;

    layersGroup.clearLayers();
    racksGroup.clearLayers();

    warehouses.forEach(wh => {
      const geom = warehouseGeometries[wh.id];
      if (!geom) return;

      const stat = warehouseStats[wh.id] || { total: 0, occupied: 0, percentage: 0 };
      const isFocused = activeWarehouseFocus === wh.id;

      // Warehouse Footprint Rectangle
      const rectangle = L.rectangle(geom.bounds, {
        color: geom.color,
        weight: isFocused ? 3.5 : 2,
        fillColor: geom.color,
        fillOpacity: isFocused ? 0.45 : 0.25,
        dashArray: isFocused ? undefined : '5, 5',
        className: 'warehouse-polygon-layer'
      });

      rectangle.on('click', () => {
        setActiveWarehouseFocus(wh.id);
        map.flyToBounds(geom.bounds, { padding: [40, 40], duration: 1 });
      });

      rectangle.addTo(layersGroup);

      // Warehouse Title Label
      if (showLabels) {
        const labelHtml = `
          <div class="satellite-wh-label" style="border-left: 3.5px solid ${geom.color};">
            <div class="wh-label-title" style="color: ${geom.color}">${wh.name}</div>
            <div class="wh-label-sub">
              <span>${stat.occupied}/${stat.total} SP</span>
              <span class="wh-fill-badge" style="background: ${stat.percentage > 80 ? '#dc2626' : '#059669'}">${stat.percentage}%</span>
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

      // Internal Rack Cells
      if (showRacks) {
        const locs = allLocations.filter(l => l.warehouse_id === wh.id);
        const [southWest, northEast] = geom.bounds;
        const latSpan = northEast[0] - southWest[0];
        const lngSpan = northEast[1] - southWest[1];

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

          if (filterMode === 'occupied' && !hasProduct) return;
          if (filterMode === 'empty' && hasProduct) return;

          const isLocationSelected = selectedLocationId === loc.id;
          const isHighlightProduct = highlightProductCode && product === highlightProductCode;

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

          let cellColor = hasProduct ? '#059669' : '#94a3b8';
          let cellFill = hasProduct ? 'rgba(5, 150, 105, 0.85)' : 'rgba(255, 255, 255, 0.85)';
          let cellWeight = 1.4;

          if (isHighlightProduct || isLocationSelected) {
            cellColor = '#f59e0b';
            cellFill = 'rgba(245, 158, 11, 0.95)';
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

          // Rack Label text
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
    warehouseGeometries,
    activeWarehouseFocus,
    filterMode,
    showRacks,
    showLabels,
    selectedLocationId,
    highlightProductCode
  ]);

  // Save manual GPS input coordinates
  const handleSaveManualGPS = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(customLatInput);
    const lng = parseFloat(customLngInput);
    if (!isNaN(lat) && !isNaN(lng)) {
      setBaseCoords({ lat, lng });
      localStorage.setItem('kho_gps_coords', JSON.stringify({ lat, lng }));
      setIsCalibrating(false);
      mapInstanceRef.current?.flyTo([lat, lng], 18, { duration: 1 });
    }
  };

  const handleResetToDefaultGPS = () => {
    setBaseCoords({ lat: DEFAULT_LAT, lng: DEFAULT_LNG });
    setCustomLatInput(DEFAULT_LAT.toString());
    setCustomLngInput(DEFAULT_LNG.toString());
    localStorage.removeItem('kho_gps_coords');
    mapInstanceRef.current?.flyTo([DEFAULT_LAT, DEFAULT_LNG], 18, { duration: 1 });
  };

  // Search logic
  const handlePerformSearch = (query: string) => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return;

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

    const geom = warehouseGeometries[loc.warehouse_id];
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
    map.flyTo([baseCoords.lat, baseCoords.lng], 18, { duration: 1 });
    setActiveWarehouseFocus(null);
    setInspectedLocation(null);
  };

  return (
    <div className={`satellite-map-wrapper ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      {/* Top Map Control Bar */}
      <div className="satellite-topbar glass-card">
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
                const geom = warehouseGeometries[w.id];
                if (geom && mapInstanceRef.current) {
                  mapInstanceRef.current.flyToBounds(geom.bounds, { padding: [50, 50], duration: 1 });
                }
              }}
            >
              <span className="dot-indicator" style={{ background: warehouseGeometries[w.id]?.color || '#3b82f6' }} />
              {w.name}
            </button>
          ))}
        </div>

        {/* GPS Location & Custom Calibration Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="sat-tab-btn"
            style={{ background: 'var(--color-primary-glow)', color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
            onClick={() => fetchCurrentDeviceGPS(false)}
            title="Định vị vị trí GPS của tôi trên bản đồ"
          >
            <Crosshair size={14} className={gpsStatus === 'locating' ? 'animate-spin' : ''} />
            <span>GPS của tôi</span>
          </button>

          <button
            className={`sat-tab-btn ${isCalibrating ? 'active' : ''}`}
            onClick={() => setIsCalibrating(!isCalibrating)}
            title="Tự căn chỉnh vị trí tọa độ kho trên Google Maps"
          >
            <Sliders size={14} />
            <span>Căn chỉnh GPS Kho</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="sat-search-box">
          <Search size={16} className="sat-search-icon" />
          <input
            type="text"
            placeholder="Tìm SP (e120.30) hoặc vị trí (A01)..."
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

      {/* GPS Calibration Bar (Opens when Calibrating) */}
      {isCalibrating && (
        <div className="glass-card gps-calibration-bar animate-fade-in">
          <div className="calib-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Move size={18} className="text-primary" />
              <strong>Căn chỉnh Tọa độ Sơ đồ Kho trên Google Maps</strong>
              {userLocation && (
                <span className="badge badge-completed" style={{ fontSize: '0.7rem' }}>
                  GPS: &plusmn;{Math.round(userLocation.accuracy || 0)}m
                </span>
              )}
            </div>
            <button className="calib-close" onClick={() => setIsCalibrating(false)}>&times;</button>
          </div>

          <p className="text-muted" style={{ fontSize: '0.8rem', margin: '4px 0 12px' }}>
            💡 Nhấp chuột trực tiếp lên bản đồ vệ tinh để đặt vị trí kho mới, hoặc bấm nút dưới để lấy GPS thực tế của bạn:
          </p>

          <form onSubmit={handleSaveManualGPS} className="calib-form">
            <div className="calib-inputs">
              <div className="input-field">
                <label>Vĩ độ (Lat):</label>
                <input
                  type="text"
                  value={customLatInput}
                  onChange={(e) => setCustomLatInput(e.target.value)}
                  placeholder="10.7932..."
                />
              </div>

              <div className="input-field">
                <label>Kinh độ (Lng):</label>
                <input
                  type="text"
                  value={customLngInput}
                  onChange={(e) => setCustomLngInput(e.target.value)}
                  placeholder="106.6542..."
                />
              </div>

              <div className="input-field" style={{ maxWidth: '140px' }}>
                <label>Tỉ lệ kho:</label>
                <select
                  value={scaleFactor}
                  onChange={(e) => setScaleFactor(parseFloat(e.target.value))}
                  className="scale-select"
                >
                  <option value="0.75">Thu nhỏ 75%</option>
                  <option value="1">Chuẩn 100%</option>
                  <option value="1.25">Phóng to 125%</option>
                  <option value="1.5">Phóng to 150%</option>
                  <option value="2">Rộng 200%</option>
                </select>
              </div>
            </div>

            <div className="calib-actions">
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={() => fetchCurrentDeviceGPS(true)}
              >
                <Crosshair size={14} /> Đặt kho tại GPS của tôi
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={handleResetToDefaultGPS}
              >
                <RotateCcw size={14} /> Mặc định
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: 'auto', padding: '6px 16px', fontSize: '0.8rem' }}
              >
                <Check size={14} /> Lưu tọa độ GPS
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Map Canvas */}
      <div className="satellite-map-canvas-container">
        <div ref={mapContainerRef} className="leaflet-map-canvas" />

        {/* Floating Controls Toolbar */}
        <div className="sat-floating-tools">
          {/* Map Layer Selector (Google Hybrid, Google Sat, Google Street, Esri) */}
          <div className="sat-tool-group">
            <button
              className={`sat-tool-btn ${activeLayer === 'google_hybrid' ? 'active' : ''}`}
              title="Google Maps Vệ tinh + Địa danh (Hybrid)"
              onClick={() => setActiveLayer('google_hybrid')}
            >
              🛰️ Google
            </button>
            <button
              className={`sat-tool-btn ${activeLayer === 'google_streets' ? 'active' : ''}`}
              title="Google Maps Đường phố (Sáng rõ)"
              onClick={() => setActiveLayer('google_streets')}
            >
              🗺️ Sáng
            </button>
            <button
              className={`sat-tool-btn ${activeLayer === 'esri' ? 'active' : ''}`}
              title="Esri World Imagery"
              onClick={() => setActiveLayer('esri')}
            >
              🌐 Esri
            </button>
          </div>

          {/* Display Toggles */}
          <div className="sat-tool-group">
            <button
              className={`sat-tool-btn ${showRacks ? 'active' : ''}`}
              title="Ẩn/Hiện Ô kệ hàng"
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

          {/* Filter Status */}
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
              title="Chỉ ô có hàng"
              onClick={() => setFilterMode('occupied')}
            >
              📦 Có hàng
            </button>
            <button
              className={`sat-tool-btn ${filterMode === 'empty' ? 'active' : ''}`}
              title="Chỉ ô trống"
              onClick={() => setFilterMode('empty')}
            >
              ⬜ Trống
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="sat-tool-group">
            <button className="sat-tool-btn" title="Phóng to" onClick={() => mapInstanceRef.current?.zoomIn()}>
              <ZoomIn size={16} />
            </button>
            <button className="sat-tool-btn" title="Thu nhỏ" onClick={() => mapInstanceRef.current?.zoomOut()}>
              <ZoomOut size={16} />
            </button>
            <button className="sat-tool-btn" title="Về toàn cảnh" onClick={resetView}>
              <Navigation size={16} />
            </button>
            <button className="sat-tool-btn" title="Toàn màn hình" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        {/* Real-time Occupancy Overview Widget */}
        <div className="sat-occupancy-legend glass-card">
          <div className="legend-header">
            <span className="legend-title">Sức chứa toàn kho</span>
            <span className="legend-badge">Google Map</span>
          </div>
          <div className="legend-items">
            {warehouses.map(w => {
              const stat = warehouseStats[w.id] || { total: 0, occupied: 0, percentage: 0 };
              const color = warehouseGeometries[w.id]?.color || '#2563eb';
              return (
                <div
                  key={w.id}
                  className="legend-row"
                  onClick={() => {
                    setActiveWarehouseFocus(w.id);
                    const geom = warehouseGeometries[w.id];
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
                      <div className="legend-bar-fill" style={{ width: `${stat.percentage}%`, background: color }} />
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

              <div className="inspector-info-row">
                <span className="info-key">Mã QR Kệ:</span>
                <code className="info-val">{inspectedLocation.qr_payload}</code>
              </div>

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
                              {h.to_location_id === inspectedLocation.id ? '📥 Nhập/Đến' : '📤 Xuất/Đi'}
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
