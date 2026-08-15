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
  Navigation,
  Crosshair,
  Check,
  RotateCcw,
  Edit3
} from 'lucide-react';
import type {
  Warehouse,
  WarehouseLocation,
  ProductCurrentLocation,
  ProductLocationMovement,
  AllWarehousesGeometries,
  WarehouseGeometryConfig
} from '../lib/database';
import {
  getWarehousesGeometriesConfig,
  saveWarehouseGeometryConfig,
  getWarehouseGPSConfig
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

// Standard warehouse default presets
const DEFAULT_WAREHOUSE_OFFSETS: Record<string, {
  latOffset: number;
  lngOffset: number;
  width: number;
  height: number;
  color: string;
}> = {
  K1: {
    latOffset: 0.00035,
    lngOffset: -0.00045,
    width: 0.00060,
    height: 0.00040,
    color: '#2563eb'
  },
  K2: {
    latOffset: 0.00035,
    lngOffset: 0.00045,
    width: 0.00060,
    height: 0.00040,
    color: '#db2777'
  },
  K3: {
    latOffset: -0.00035,
    lngOffset: -0.00045,
    width: 0.00060,
    height: 0.00040,
    color: '#dc2626'
  },
  K4: {
    latOffset: -0.00035,
    lngOffset: 0.00045,
    width: 0.00060,
    height: 0.00040,
    color: '#059669'
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
  const editMarkerGroupRef = useRef<L.LayerGroup | null>(null);

  // Global Base Anchor GPS
  const [baseCoords, setBaseCoords] = useState<{ lat: number; lng: number }>({
    lat: DEFAULT_LAT,
    lng: DEFAULT_LNG
  });

  // Individual Per-Warehouse Geometries State
  const [customGeometries, setCustomGeometries] = useState<AllWarehousesGeometries>({});

  // Currently Selected Warehouse for Editing
  const [editingWhId, setEditingWhId] = useState<string>('K1');
  const [isClickToPlaceActive, setIsClickToPlaceActive] = useState<boolean>(false);

  // Editable Form Values for the Selected Warehouse
  const [editLat, setEditLat] = useState<string>('');
  const [editLng, setEditLng] = useState<string>('');
  const [editWidth, setEditWidth] = useState<number>(60);   // in meters (approx)
  const [editHeight, setEditHeight] = useState<number>(40); // in meters (approx)
  const [editColor, setEditColor] = useState<string>('#2563eb');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Zoom Tracking for Level of Detail (LOD)
  const [currentZoom, setCurrentZoom] = useState(18);

  // Layer & Display States
  const [activeLayer, setActiveLayer] = useState<keyof typeof TILE_PROVIDERS>('google_hybrid');
  const [filterMode, setFilterMode] = useState<'all' | 'occupied' | 'empty'>('all');
  const [activeWarehouseFocus, setActiveWarehouseFocus] = useState<string | null>(null);
  const [inspectedLocation, setInspectedLocation] = useState<WarehouseLocation | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Calibration Drawer Mode
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'success' | 'error'>('idle');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);

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

  // Compute final effective geometries for each warehouse
  const warehouseGeometries = useMemo(() => {
    const geoms: Record<string, {
      center: [number, number];
      bounds: [[number, number], [number, number]];
      width: number;
      height: number;
      color: string;
    }> = {};

    warehouses.forEach(wh => {
      const custom = customGeometries[wh.id];
      if (custom) {
        const halfHeight = custom.height / 2;
        const halfWidth = custom.width / 2;
        geoms[wh.id] = {
          center: [custom.centerLat, custom.centerLng],
          bounds: [
            [custom.centerLat - halfHeight, custom.centerLng - halfWidth],
            [custom.centerLat + halfHeight, custom.centerLng + halfWidth]
          ],
          width: custom.width,
          height: custom.height,
          color: custom.color || DEFAULT_WAREHOUSE_OFFSETS[wh.id]?.color || '#2563eb'
        };
      } else {
        const offset = DEFAULT_WAREHOUSE_OFFSETS[wh.id] || {
          latOffset: 0,
          lngOffset: 0,
          width: 0.0005,
          height: 0.0004,
          color: '#2563eb'
        };

        const centerLat = baseCoords.lat + offset.latOffset;
        const centerLng = baseCoords.lng + offset.lngOffset;
        const halfHeight = offset.height / 2;
        const halfWidth = offset.width / 2;

        geoms[wh.id] = {
          center: [centerLat, centerLng],
          bounds: [
            [centerLat - halfHeight, centerLng - halfWidth],
            [centerLat + halfHeight, centerLng + halfWidth]
          ],
          width: offset.width,
          height: offset.height,
          color: offset.color
        };
      }
    });

    return geoms;
  }, [warehouses, customGeometries, baseCoords]);

  // Synchronize edit inputs when editing warehouse selection changes
  useEffect(() => {
    if (!editingWhId) return;
    const geom = warehouseGeometries[editingWhId];
    if (geom) {
      setEditLat(geom.center[0].toFixed(6));
      setEditLng(geom.center[1].toFixed(6));
      setEditWidth(Math.round(geom.width * 100000));
      setEditHeight(Math.round(geom.height * 100000));
      setEditColor(geom.color);
    }
  }, [editingWhId, warehouseGeometries]);

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
    editMarkerGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    // Handle map click during calibration mode
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (isCalibrating && isClickToPlaceActive && editingWhId) {
        const newLat = e.latlng.lat;
        const newLng = e.latlng.lng;
        setEditLat(newLat.toFixed(6));
        setEditLng(newLng.toFixed(6));

        setCustomGeometries(prev => {
          const currentGeom = prev[editingWhId] || {
            centerLat: newLat,
            centerLng: newLng,
            width: (editWidth || 60) / 100000,
            height: (editHeight || 40) / 100000,
            color: editColor
          };
          return {
            ...prev,
            [editingWhId]: {
              ...currentGeom,
              centerLat: newLat,
              centerLng: newLng
            }
          };
        });

        setIsClickToPlaceActive(false);
      }
    });

    // Load initial GPS and Custom Geometries
    Promise.all([getWarehouseGPSConfig(), getWarehousesGeometriesConfig()]).then(([gps, geoms]) => {
      setBaseCoords({ lat: gps.lat, lng: gps.lng });
      if (geoms && Object.keys(geoms).length > 0) {
        setCustomGeometries(geoms);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([gps.lat, gps.lng], 18);
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [isCalibrating, isClickToPlaceActive, editingWhId, editWidth, editHeight, editColor]);

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

          if (accuracy && accuracy < 200) {
            L.circle([userLat, userLng], {
              radius: accuracy,
              color: '#2563eb',
              fillColor: '#2563eb',
              fillOpacity: 0.15,
              weight: 1
            }).addTo(gpsGroup);
          }

          if (centerWarehouseHere && editingWhId) {
            setEditLat(userLat.toFixed(6));
            setEditLng(userLng.toFixed(6));
            setCustomGeometries(prev => ({
              ...prev,
              [editingWhId]: {
                centerLat: userLat,
                centerLng: userLng,
                width: (editWidth || 60) / 100000,
                height: (editHeight || 40) / 100000,
                color: editColor
              }
            }));
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

  // ==========================================================================
  // RENDER WAREHOUSE BUILDINGS, RACKS, AND DRAGGABLE EDIT HANDLES
  // ==========================================================================
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layersGroup = layersGroupRef.current;
    const racksGroup = racksGroupRef.current;
    const editGroup = editMarkerGroupRef.current;
    if (!map || !layersGroup || !racksGroup || !editGroup) return;

    layersGroup.clearLayers();
    racksGroup.clearLayers();
    editGroup.clearLayers();

    const shouldDrawRacks = currentZoom >= 18;

    warehouses.forEach(wh => {
      const geom = warehouseGeometries[wh.id];
      if (!geom) return;

      const stat = warehouseStats[wh.id] || { total: 0, occupied: 0, percentage: 0 };
      const isFocused = activeWarehouseFocus === wh.id;
      const isBeingEdited = isCalibrating && editingWhId === wh.id;
      const isDimmed = activeWarehouseFocus !== null && !isFocused;

      // 1. Warehouse Building Outline
      const rectangle = L.rectangle(geom.bounds, {
        color: isBeingEdited ? '#2563eb' : geom.color,
        weight: isBeingEdited ? 3.5 : isFocused ? 3.5 : isDimmed ? 1 : 2,
        fillColor: isBeingEdited ? '#2563eb' : geom.color,
        fillOpacity: isBeingEdited ? 0.35 : isFocused ? 0.35 : isDimmed ? 0.08 : 0.2,
        dashArray: isFocused || isBeingEdited ? undefined : isDimmed ? '4, 4' : '6, 6',
        className: 'warehouse-polygon-layer'
      });

      rectangle.on('click', () => {
        if (isCalibrating) {
          setEditingWhId(wh.id);
        } else {
          if (activeWarehouseFocus === wh.id) {
            setActiveWarehouseFocus(null);
            resetView();
          } else {
            setActiveWarehouseFocus(wh.id);
            map.flyToBounds(geom.bounds, { padding: [50, 50], duration: 1 });
          }
        }
      });

      rectangle.addTo(layersGroup);

      // 2. Clean Warehouse Header Pill
      const labelHtml = `
        <div class="lod-wh-pill ${isFocused ? 'focus' : ''} ${isDimmed ? 'dimmed' : ''} ${isBeingEdited ? 'editing' : ''}" style="border-left-color: ${geom.color};">
          <div class="pill-name" style="color: ${geom.color}">${wh.name}</div>
          <div class="pill-stats">
            <span>${stat.occupied}/${stat.total} SP</span>
            <span class="pill-badge" style="background: ${stat.percentage > 80 ? '#dc2626' : '#059669'}">${stat.percentage}%</span>
          </div>
        </div>
      `;

      const labelIcon = L.divIcon({
        html: labelHtml,
        className: 'custom-leaflet-label',
        iconSize: [110, 36],
        iconAnchor: [55, -8]
      });

      L.marker([geom.bounds[1][0], geom.center[1]], { icon: labelIcon, interactive: false }).addTo(layersGroup);

      // 3. Draggable Center Handle when in Calibration Mode for this warehouse
      if (isCalibrating && isBeingEdited) {
        const dragHandleIcon = L.divIcon({
          html: `
            <div class="wh-drag-handle animate-fade-in" title="Kéo thả để di chuyển kho ${wh.name}">
              <div class="drag-icon-center"><span class="drag-wh-tag">${wh.id}</span></div>
            </div>
          `,
          className: 'custom-drag-marker',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        const centerMarker = L.marker(geom.center, {
          icon: dragHandleIcon,
          draggable: true,
          zIndexOffset: 1000
        });

        centerMarker.on('drag', (e: L.LeafletEvent) => {
          const marker = e.target as L.Marker;
          const pos = marker.getLatLng();
          setEditLat(pos.lat.toFixed(6));
          setEditLng(pos.lng.toFixed(6));

          setCustomGeometries(prev => ({
            ...prev,
            [wh.id]: {
              centerLat: pos.lat,
              centerLng: pos.lng,
              width: geom.width,
              height: geom.height,
              color: geom.color
            }
          }));
        });

        centerMarker.addTo(editGroup);
      }

      // 4. Internal Racks
      const renderThisWarehouseRacks = shouldDrawRacks && (!activeWarehouseFocus || isFocused);

      if (renderThisWarehouseRacks) {
        const locs = allLocations.filter(l => l.warehouse_id === wh.id);
        const [southWest, northEast] = geom.bounds;
        const latSpan = northEast[0] - southWest[0];
        const lngSpan = northEast[1] - southWest[1];

        const padRatioLat = 0.14;
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
          let cellFill = hasProduct ? '#ecfdf5' : '#ffffff';
          let cellWeight = 1.4;

          if (isHighlightProduct || isLocationSelected) {
            cellColor = '#d97706';
            cellFill = '#fffbeb';
            cellWeight = 3;
          }

          const rackPoly = L.rectangle(cellBounds, {
            color: cellColor,
            fillColor: cellFill,
            fillOpacity: 0.95,
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

          const cLat = (cellNorth + cellSouth) / 2;
          const cLng = (cellWest + cellEast) / 2;

          if (currentZoom >= 18) {
            const rackIcon = L.divIcon({
              html: `
                <div class="lod-rack-marker ${hasProduct ? 'occupied' : 'empty'} ${isHighlightProduct ? 'highlight' : ''}">
                  <span class="lod-code">${loc.code}</span>
                  ${hasProduct && currentZoom >= 19 ? `<span class="lod-prod">${product}</span>` : ''}
                </div>
              `,
              className: 'rack-leaflet-marker',
              iconSize: [44, currentZoom >= 19 && hasProduct ? 28 : 18],
              iconAnchor: [22, currentZoom >= 19 && hasProduct ? 14 : 9]
            });

            L.marker([cLat, cLng], { icon: rackIcon, interactive: false }).addTo(racksGroup);
          }
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
    currentZoom,
    isCalibrating,
    editingWhId,
    selectedLocationId,
    highlightProductCode
  ]);

  // Save changes for currently edited warehouse
  const handleSaveIndividualWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWhId) return;

    const lat = parseFloat(editLat);
    const lng = parseFloat(editLng);
    const widthDeg = (editWidth || 60) / 100000;
    const heightDeg = (editHeight || 40) / 100000;

    if (isNaN(lat) || isNaN(lng)) {
      alert('Vui lòng nhập tọa độ hợp lệ.');
      return;
    }

    const newConfig: WarehouseGeometryConfig = {
      centerLat: lat,
      centerLng: lng,
      width: widthDeg,
      height: heightDeg,
      color: editColor
    };

    setCustomGeometries(prev => ({
      ...prev,
      [editingWhId]: newConfig
    }));

    await saveWarehouseGeometryConfig(editingWhId, newConfig);
    setSaveSuccessMsg(`Đã lưu cấu hình riêng cho Kho ${editingWhId}!`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Reset current warehouse geometry to default layout
  const handleResetSingleWarehouse = async () => {
    if (!editingWhId) return;
    const defaultOffset = DEFAULT_WAREHOUSE_OFFSETS[editingWhId];
    if (defaultOffset) {
      const defLat = baseCoords.lat + defaultOffset.latOffset;
      const defLng = baseCoords.lng + defaultOffset.lngOffset;
      const defWidthDeg = defaultOffset.width;
      const defHeightDeg = defaultOffset.height;

      const restored: WarehouseGeometryConfig = {
        centerLat: defLat,
        centerLng: defLng,
        width: defWidthDeg,
        height: defHeightDeg,
        color: defaultOffset.color
      };

      setCustomGeometries(prev => ({
        ...prev,
        [editingWhId]: restored
      }));

      await saveWarehouseGeometryConfig(editingWhId, restored);
      setSaveSuccessMsg(`Đã khôi phục mặc định cho Kho ${editingWhId}!`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    }
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

  const focusedWarehouseObj = warehouses.find(w => w.id === activeWarehouseFocus);
  const focusedStats = activeWarehouseFocus ? warehouseStats[activeWarehouseFocus] : null;

  return (
    <div className={`satellite-map-wrapper ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      {/* Top Map Control Bar */}
      <div className="satellite-topbar glass-card">
        {/* Quick Tabs: All & Warehouses */}
        <div className="sat-quick-tabs">
          <button
            className={`sat-tab-btn ${activeWarehouseFocus === null ? 'active' : ''}`}
            onClick={resetView}
          >
            <Compass size={14} /> Toàn cảnh ({warehouses.length} kho)
          </button>
          {warehouses.map(w => (
            <button
              key={w.id}
              className={`sat-tab-btn ${activeWarehouseFocus === w.id ? 'active' : ''}`}
              onClick={() => {
                if (activeWarehouseFocus === w.id) {
                  setActiveWarehouseFocus(null);
                  resetView();
                } else {
                  setActiveWarehouseFocus(w.id);
                  const geom = warehouseGeometries[w.id];
                  if (geom && mapInstanceRef.current) {
                    mapInstanceRef.current.flyToBounds(geom.bounds, { padding: [50, 50], duration: 1 });
                  }
                }
              }}
            >
              <span className="dot-indicator" style={{ background: warehouseGeometries[w.id]?.color || '#2563eb' }} />
              {w.name}
            </button>
          ))}
        </div>

        {/* Action Buttons: GPS & Per-Warehouse Calibration */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="sat-tab-btn"
            style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderColor: '#bfdbfe' }}
            onClick={() => fetchCurrentDeviceGPS(false)}
            title="Định vị vị trí GPS của tôi trên Google Maps"
          >
            <Crosshair size={14} className={gpsStatus === 'locating' ? 'animate-spin' : ''} />
            <span>GPS của tôi</span>
          </button>

          <button
            className={`sat-tab-btn ${isCalibrating ? 'active' : ''}`}
            onClick={() => {
              setIsCalibrating(!isCalibrating);
              setIsClickToPlaceActive(false);
            }}
            title="Chỉnh sửa vị trí & kích thước từng kho trên Google Maps"
          >
            <Edit3 size={14} />
            <span>Chỉnh sửa từng kho</span>
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

      {/* Focus Mode Quick Banner */}
      {focusedWarehouseObj && focusedStats && (
        <div className="focus-warehouse-banner glass-card animate-fade-in">
          <div className="focus-banner-left">
            <span
              className="focus-dot"
              style={{ background: warehouseGeometries[focusedWarehouseObj.id]?.color || '#2563eb' }}
            />
            <div>
              <strong>Tiêu điểm: {focusedWarehouseObj.name}</strong>
              <span className="text-muted" style={{ fontSize: '0.78rem', marginLeft: '8px' }}>
                ({focusedWarehouseObj.type === 'grid' ? 'Lưới Ô Cột' : 'Lối đi Aisle'})
              </span>
            </div>
          </div>

          <div className="focus-banner-right">
            <span className="focus-stat-chip">
              Tổng: <strong>{focusedStats.total}</strong> ô
            </span>
            <span className="focus-stat-chip text-success">
              Có hàng: <strong>{focusedStats.occupied}</strong>
            </span>
            <span className="focus-stat-chip text-muted">
              Trống: <strong>{focusedStats.empty}</strong>
            </span>
            <button className="btn-close-focus" onClick={resetView} title="Trở về toàn cảnh">
              &times; Thoát Focus
            </button>
          </div>
        </div>
      )}

      {/* Per-Warehouse Interactive Calibration Drawer */}
      {isCalibrating && (
        <div className="glass-card per-warehouse-calib-drawer animate-fade-in">
          <div className="calib-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit3 size={18} className="text-primary" />
              <strong>Chỉnh sửa Vị trí & Kích thước Riêng Từng Kho</strong>
              {userLocation && (
                <span className="badge badge-completed" style={{ fontSize: '0.7rem' }}>
                  GPS: &plusmn;{Math.round(userLocation.accuracy || 0)}m
                </span>
              )}
              {saveSuccessMsg && (
                <span className="badge badge-completed animate-fade-in" style={{ fontSize: '0.75rem' }}>
                  {saveSuccessMsg}
                </span>
              )}
            </div>
            <button className="calib-close" onClick={() => setIsCalibrating(false)}>&times;</button>
          </div>

          {/* Warehouse Selector Tabs */}
          <div className="calib-wh-selector">
            <span className="calib-wh-label">Kho đang chỉnh sửa:</span>
            <div className="calib-wh-chips">
              {warehouses.map(w => (
                <button
                  key={w.id}
                  type="button"
                  className={`calib-wh-chip ${editingWhId === w.id ? 'active' : ''}`}
                  style={{
                    borderColor: editingWhId === w.id ? warehouseGeometries[w.id]?.color : '#cbd5e1',
                    background: editingWhId === w.id ? 'var(--color-primary-light)' : '#ffffff'
                  }}
                  onClick={() => {
                    setEditingWhId(w.id);
                    setIsClickToPlaceActive(false);
                    const geom = warehouseGeometries[w.id];
                    if (geom && mapInstanceRef.current) {
                      mapInstanceRef.current.flyTo(geom.center, 19, { duration: 0.8 });
                    }
                  }}
                >
                  <span className="dot-indicator" style={{ background: warehouseGeometries[w.id]?.color || '#2563eb' }} />
                  <strong>{w.name}</strong>
                </button>
              ))}
            </div>
          </div>

          <p className="text-muted" style={{ fontSize: '0.8rem', margin: '6px 0 14px' }}>
            💡 Cầm chuột <strong>kéo thả biểu tượng [{editingWhId}] màu xanh ở tâm kho</strong> trên bản đồ, hoặc bấm nút dưới để nhấp chuột định vị:
          </p>

          <form onSubmit={handleSaveIndividualWarehouse} className="calib-form">
            <div className="calib-inputs">
              <div className="input-field">
                <label>Vĩ độ (Lat):</label>
                <input
                  type="text"
                  value={editLat}
                  onChange={(e) => {
                    setEditLat(e.target.value);
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) {
                      setCustomGeometries(prev => ({
                        ...prev,
                        [editingWhId]: {
                          ...prev[editingWhId],
                          centerLat: v,
                          centerLng: parseFloat(editLng) || DEFAULT_LNG,
                          width: (editWidth || 60) / 100000,
                          height: (editHeight || 40) / 100000,
                          color: editColor
                        }
                      }));
                    }
                  }}
                  placeholder="10.7932..."
                />
              </div>

              <div className="input-field">
                <label>Kinh độ (Lng):</label>
                <input
                  type="text"
                  value={editLng}
                  onChange={(e) => {
                    setEditLng(e.target.value);
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) {
                      setCustomGeometries(prev => ({
                        ...prev,
                        [editingWhId]: {
                          ...prev[editingWhId],
                          centerLat: parseFloat(editLat) || DEFAULT_LAT,
                          centerLng: v,
                          width: (editWidth || 60) / 100000,
                          height: (editHeight || 40) / 100000,
                          color: editColor
                        }
                      }));
                    }
                  }}
                  placeholder="106.6542..."
                />
              </div>

              <div className="input-field" style={{ minWidth: '120px' }}>
                <label>Chiều dài: <strong>~{editWidth}m</strong></label>
                <input
                  type="range"
                  min="20"
                  max="200"
                  step="5"
                  value={editWidth}
                  onChange={(e) => {
                    const w = parseInt(e.target.value, 10);
                    setEditWidth(w);
                    setCustomGeometries(prev => ({
                      ...prev,
                      [editingWhId]: {
                        centerLat: parseFloat(editLat) || DEFAULT_LAT,
                        centerLng: parseFloat(editLng) || DEFAULT_LNG,
                        width: w / 100000,
                        height: (editHeight || 40) / 100000,
                        color: editColor
                      }
                    }));
                  }}
                />
              </div>

              <div className="input-field" style={{ minWidth: '120px' }}>
                <label>Chiều rộng: <strong>~{editHeight}m</strong></label>
                <input
                  type="range"
                  min="15"
                  max="150"
                  step="5"
                  value={editHeight}
                  onChange={(e) => {
                    const h = parseInt(e.target.value, 10);
                    setEditHeight(h);
                    setCustomGeometries(prev => ({
                      ...prev,
                      [editingWhId]: {
                        centerLat: parseFloat(editLat) || DEFAULT_LAT,
                        centerLng: parseFloat(editLng) || DEFAULT_LNG,
                        width: (editWidth || 60) / 100000,
                        height: h / 100000,
                        color: editColor
                      }
                    }));
                  }}
                />
              </div>

              <div className="input-field" style={{ maxWidth: '100px' }}>
                <label>Màu viền:</label>
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => {
                    setEditColor(e.target.value);
                    setCustomGeometries(prev => ({
                      ...prev,
                      [editingWhId]: {
                        ...prev[editingWhId],
                        centerLat: parseFloat(editLat) || DEFAULT_LAT,
                        centerLng: parseFloat(editLng) || DEFAULT_LNG,
                        width: (editWidth || 60) / 100000,
                        height: (editHeight || 40) / 100000,
                        color: e.target.value
                      }
                    }));
                  }}
                  style={{ height: '36px', padding: '2px', cursor: 'pointer' }}
                />
              </div>
            </div>

            <div className="calib-actions">
              <button
                type="button"
                className={`btn ${isClickToPlaceActive ? 'btn-primary' : 'btn-secondary'}`}
                style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={() => setIsClickToPlaceActive(!isClickToPlaceActive)}
              >
                <MapPin size={14} /> {isClickToPlaceActive ? '👉 Nhấp chuột lên bản đồ...' : `Click bản đồ để đặt Kho ${editingWhId}`}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={() => fetchCurrentDeviceGPS(true)}
              >
                <Crosshair size={14} /> Đặt Kho {editingWhId} tại GPS của tôi
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={handleResetSingleWarehouse}
              >
                <RotateCcw size={14} /> Mặc định
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: 'auto', padding: '6px 18px', fontSize: '0.8rem' }}
              >
                <Check size={14} /> Lưu cấu hình Kho {editingWhId}
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
          {/* Map Layer Selector */}
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
              const isFocused = activeWarehouseFocus === w.id;
              return (
                <div
                  key={w.id}
                  className={`legend-row ${isFocused ? 'active' : ''}`}
                  onClick={() => {
                    if (activeWarehouseFocus === w.id) {
                      setActiveWarehouseFocus(null);
                      resetView();
                    } else {
                      setActiveWarehouseFocus(w.id);
                      const geom = warehouseGeometries[w.id];
                      if (geom && mapInstanceRef.current) {
                        mapInstanceRef.current.flyToBounds(geom.bounds, { padding: [50, 50], duration: 1 });
                      }
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
