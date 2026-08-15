import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  QrCode,
  Search,
  Map as MapIcon,
  History,
  Settings as SettingsIcon,
  Upload,
  Camera,
  CheckCircle,
  XCircle,
  AlertCircle,
  MapPin,
  RefreshCw,
  FileText,
  Database,
  ArrowRight,
  Sparkles,
  Info,
  Printer,
  Grid
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

import type {
  Warehouse,
  WarehouseZone,
  WarehouseLocation,
  Product,
  ProductCurrentLocation,
  ProductLocationMovement,
  SyncAction
} from './lib/database';

import {
  getWarehouses,
  getWarehouseZones,
  getWarehouseLocations,
  getProducts,
  getCurrentProductLocations,
  getMovementsHistory,
  executeProductMovement,
  getSyncOutbox,
  syncOfflineQueue,
  isSupabaseEnabled,
  autoBootstrapSupabaseDatabase,
  subscribeToRealtimeChanges,
  resetLocalDatabase
} from './lib/database';

import { performOCR } from './lib/ocr';
import { parseQRPayload } from './lib/qr';
import { WarehouseSatelliteMap } from './components/WarehouseSatelliteMap';
import { QRPrintManager } from './components/QRPrintManager';
import { WarehousePartitionManager } from './components/WarehousePartitionManager';

function App() {
  // --- Navigation State ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scanner' | 'maps' | 'search' | 'history' | 'settings'>('dashboard');

  // --- Database Data States ---
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [zones, setZones] = useState<WarehouseZone[]>([]);
  const [allLocations, setAllLocations] = useState<WarehouseLocation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [currentLocations, setCurrentLocations] = useState<ProductCurrentLocation[]>([]);
  const [movementsHistory, setMovementsHistory] = useState<ProductLocationMovement[]>([]);
  const [syncOutbox, setSyncOutbox] = useState<SyncAction[]>([]);
  const [isDbOnline, setIsDbOnline] = useState(false);

  // --- Loading / Notification States ---
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // --- OCR / Scanner States ---
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);

  // Movement Flow State: 'idle' -> 'product_selected' -> 'moving' -> 'destination_scanned' -> 'completed'
  const [movementStep, setMovementStep] = useState<'idle' | 'product_selected' | 'moving' | 'destination_scanned' | 'completed'>('idle');
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [activeFromLocation, setActiveFromLocation] = useState<WarehouseLocation | null>(null);
  const [activeFromWarehouse, setActiveFromWarehouse] = useState<Warehouse | null>(null);
  const [activeToLocation, setActiveToLocation] = useState<WarehouseLocation | null>(null);
  const [activeToWarehouse, setActiveToWarehouse] = useState<Warehouse | null>(null);
  const [activeToZone, setActiveToZone] = useState<WarehouseZone | null>(null);
  const [destinationGps, setDestinationGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);

  // QR Camera scanner state
  const [isQrScannerActive, setIsQrScannerActive] = useState(false);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);

  // Modals
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printInitialWarehouseId, setPrintInitialWarehouseId] = useState<string | undefined>(undefined);
  const [isPartitionModalOpen, setIsPartitionModalOpen] = useState(false);
  const [partitionInitialWarehouseId, setPartitionInitialWarehouseId] = useState<string | undefined>(undefined);

  // --- Search Screen States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{
    product: Product;
    currentLocation: WarehouseLocation | null;
    warehouse: Warehouse | null;
    zone: WarehouseZone | null;
    history: ProductLocationMovement[];
  } | null>(null);

  // --- Load Initial Data ---
  const loadData = async () => {
    try {
      setIsDbOnline(isSupabaseEnabled());
      const [whs, zns, locs, prods, curLocs, moves, outbox] = await Promise.all([
        getWarehouses(),
        getWarehouseZones(),
        getWarehouseLocations(),
        getProducts(),
        getCurrentProductLocations(),
        getMovementsHistory(),
        getSyncOutbox()
      ]);

      setWarehouses(whs);
      setZones(zns);
      setAllLocations(locs);
      setProducts(prods);
      setCurrentLocations(curLocs);
      setMovementsHistory(moves);
      setSyncOutbox(outbox);
    } catch (e) {
      console.error('Error loading warehouse data:', e);
      showNotification('error', 'Lỗi khi tải dữ liệu kho');
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRealtimeChanges(() => {
      loadData();
    });

    const interval = setInterval(() => {
      syncOfflineQueue().then(res => {
        if (res.count > 0) loadData();
      });
    }, 15000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleManualSync = async () => {
    setIsLoading(true);
    try {
      const res = await syncOfflineQueue();
      if (res.success) {
        showNotification('success', `Đã đồng bộ ${res.count} hành động ngoại tuyến lên Supabase!`);
      } else {
        showNotification('error', `Đồng bộ lỗi: ${res.errors.join(', ')}`);
      }
      loadData();
    } catch (e: any) {
      showNotification('error', 'Lỗi đồng bộ: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Step 1: OCR Scan or Product Select ---
  const handleOcrImageSelected = async (file: File) => {
    setOcrStatus('loading');
    setOcrPreviewUrl(URL.createObjectURL(file));

    try {
      const result = await performOCR(file);
      if (result.matchedCode) {
        setOcrConfidence(result.confidence);
        setOcrStatus('success');
        resolveProductForMovement(result.matchedCode);
      } else {
        setOcrStatus('failed');
        showNotification('error', `Không nhận diện được mã sản phẩm từ ảnh. Mã phát hiện: ${result.text || 'trống'}`);
      }
    } catch (err: any) {
      setOcrStatus('failed');
      showNotification('error', 'Lỗi xử lý OCR: ' + err.message);
    }
  };

  const resolveProductForMovement = (productCode: string) => {
    const cleanCode = productCode.trim().toLowerCase();
    const foundProd = products.find(p => p.product_code.toLowerCase() === cleanCode);

    if (!foundProd) {
      showNotification('error', `Không tìm thấy sản phẩm [${productCode}] trong cơ sở dữ liệu!`);
      return;
    }

    setActiveProduct(foundProd);

    // Resolve current location
    const curLocBinding = currentLocations.find(c => c.product_id === foundProd.id);
    if (curLocBinding && curLocBinding.location_id) {
      const loc = allLocations.find(l => l.id === curLocBinding.location_id);
      const wh = loc ? warehouses.find(w => w.id === loc.warehouse_id) : null;
      setActiveFromLocation(loc || null);
      setActiveFromWarehouse(wh || null);
    } else {
      setActiveFromLocation(null);
      setActiveFromWarehouse(null);
    }

    setMovementStep('product_selected');
    showNotification('success', `Đã nhận diện sản phẩm: ${foundProd.product_code}`);
  };

  // --- Step 2: Start Move ---
  const handleStartMove = () => {
    if (!activeProduct) return;
    setMovementStep('moving');
    showNotification('info', `Đang di chuyển [${activeProduct.product_code}]. Hãy quét mã QR tại vị trí mới.`);
  };

  // --- Step 3: Destination QR Scan ---
  const startCameraQrScanner = async () => {
    setIsQrScannerActive(true);
    try {
      const html5QrCode = new Html5Qrcode('qr-reader-target');
      qrScannerRef.current = html5QrCode;
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          handleScannedQrPayload(decodedText);
        },
        () => {}
      );
    } catch (e) {
      console.warn('QR camera start failed:', e);
      setIsQrScannerActive(false);
      showNotification('error', 'Không thể mở Camera. Vui lòng cho phép quyền truy cập Camera.');
    }
  };

  const stopCameraQrScanner = async () => {
    if (qrScannerRef.current && isQrScannerActive) {
      try {
        await qrScannerRef.current.stop();
        qrScannerRef.current.clear();
      } catch (e) {}
      setIsQrScannerActive(false);
    }
  };

  const handleScannedQrPayload = async (rawPayload: string) => {
    const parseRes = parseQRPayload(rawPayload);
    if (!parseRes.isValid || !parseRes.locationId) {
      showNotification('error', 'Mã QR không hợp lệ!');
      return;
    }

    await stopCameraQrScanner();
    resolveDestinationLocation(parseRes.locationId);
  };

  const resolveDestinationLocation = async (locationIdOrCode: string) => {
    // Find location by UUID id or code
    const targetLoc = allLocations.find(
      l => l.id === locationIdOrCode || l.code.toUpperCase() === locationIdOrCode.toUpperCase()
    );

    if (!targetLoc) {
      showNotification('error', `Vị trí [${locationIdOrCode}] không tồn tại trong hệ thống!`);
      return;
    }

    const wh = warehouses.find(w => w.id === targetLoc.warehouse_id) || null;
    const zn = targetLoc.zone_id ? zones.find(z => z.id === targetLoc.zone_id) || null : null;

    setActiveToLocation(targetLoc);
    setActiveToWarehouse(wh);
    setActiveToZone(zn);

    // Fetch Device GPS accuracy
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setDestinationGps({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
        },
        () => {
          setDestinationGps(null);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    setMovementStep('destination_scanned');
    showNotification('success', `Đã quét vị trí đích: ${wh ? wh.code + ' - ' : ''}${targetLoc.code}`);
  };

  // --- Step 4: Finalize Move with Idempotency ---
  const handleFinalizeMovement = async () => {
    if (!activeProduct || !activeToLocation) return;

    setIsLoading(true);
    try {
      const idempotencyKey = `MOVE_${activeProduct.id}_${activeToLocation.id}_${Date.now()}`;
      await executeProductMovement(
        activeProduct.id,
        activeToLocation.id,
        'Khanh Staff',
        idempotencyKey,
        ocrConfidence,
        destinationGps ? destinationGps.lat : null,
        destinationGps ? destinationGps.lng : null
      );

      setMovementStep('completed');
      showNotification('success', `Đã lưu vị trí mới cho ${activeProduct.product_code} thành công!`);
      await loadData();
    } catch (err: any) {
      showNotification('error', 'Lỗi khi hoàn tất di chuyển: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetScannerFlow = () => {
    setOcrPreviewUrl(null);
    setOcrConfidence(null);
    setOcrStatus('idle');
    setMovementStep('idle');
    setActiveProduct(null);
    setActiveFromLocation(null);
    setActiveFromWarehouse(null);
    setActiveToLocation(null);
    setActiveToWarehouse(null);
    setActiveToZone(null);
    setDestinationGps(null);
  };

  // --- Search Operations ---
  const triggerSearch = () => {
    if (!searchQuery) return;
    const clean = searchQuery.trim().toLowerCase();

    // Search product
    const foundProd = products.find(
      p => p.product_code.toLowerCase().includes(clean) || p.name.toLowerCase().includes(clean)
    );

    if (foundProd) {
      const curBinding = currentLocations.find(c => c.product_id === foundProd.id);
      const loc = curBinding?.location_id ? allLocations.find(l => l.id === curBinding.location_id) || null : null;
      const wh = loc ? warehouses.find(w => w.id === loc.warehouse_id) || null : null;
      const zn = loc?.zone_id ? zones.find(z => z.id === loc.zone_id) || null : null;
      const historyLogs = movementsHistory.filter(m => m.product_id === foundProd.id);

      setSearchResult({
        product: foundProd,
        currentLocation: loc,
        warehouse: wh,
        zone: zn,
        history: historyLogs
      });
    } else {
      setSearchResult(null);
      showNotification('info', `Không tìm thấy sản phẩm nào khớp với "${searchQuery}"`);
    }
  };

  return (
    <div className="app-container">
      {/* Top Header Bar */}
      <header className="app-header">
        <div className="app-branding">
          <div className="logo-icon-box">
            <Sparkles size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="app-title">KHO NHỰT LÚA</h1>
            <p className="app-subtitle">Hệ thống Quản lý & Định vị Kho Chuẩn Production</p>
          </div>
        </div>

        <div className="header-status-group">
          {isDbOnline ? (
            <span className="badge badge-completed flex-center gap-sm" style={{ padding: '4px 10px' }}>
              <Database size={12} /> Supabase Realtime Online
            </span>
          ) : (
            <span className="badge badge-started flex-center gap-sm" style={{ padding: '4px 10px' }}>
              <Database size={12} /> IndexedDB Offline
            </span>
          )}

          <button
            className="btn btn-secondary flex-center gap-sm"
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
            onClick={() => { setPartitionInitialWarehouseId(undefined); setIsPartitionModalOpen(true); }}
            title="Quản lý cấu trúc phân khu & ô vị trí"
          >
            <Grid size={15} /> Phân khu & Ô
          </button>

          <button
            className="btn btn-secondary flex-center gap-sm"
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
            onClick={() => { setPrintInitialWarehouseId(undefined); setIsPrintModalOpen(true); }}
            title="In mã QR dán các ô kệ"
          >
            <Printer size={15} /> In QR Kệ
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="nav-menu">
        <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <LayoutDashboard />
          <span>Dashboard</span>
        </button>
        
        <button className={`nav-item ${activeTab === 'scanner' ? 'active' : ''}`} onClick={() => { setActiveTab('scanner'); resetScannerFlow(); }}>
          <QrCode />
          <span>Di chuyển</span>
        </button>
        
        <button className={`nav-item ${activeTab === 'maps' ? 'active' : ''}`} onClick={() => setActiveTab('maps')}>
          <MapIcon />
          <span>Bản đồ kho</span>
        </button>
        
        <button className={`nav-item ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>
          <Search />
          <span>Tìm kiếm</span>
        </button>
        
        <button className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <History />
          <span>Lịch sử</span>
        </button>
        
        <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <SettingsIcon />
          <span>Cấu hình</span>
        </button>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {/* Floating Notification */}
        {notification && (
          <div
            className="glass-card animate-fade-in"
            style={{
              position: 'fixed',
              top: '80px',
              right: '20px',
              zIndex: 1000,
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              borderColor: notification.type === 'error' ? 'var(--color-danger)' : notification.type === 'success' ? 'var(--color-success)' : 'var(--color-primary)',
              background: '#ffffff',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
            }}
          >
            {notification.type === 'error' && <XCircle className="text-danger" />}
            {notification.type === 'success' && <CheckCircle className="text-success" />}
            {notification.type === 'info' && <Info className="text-primary" />}
            <span style={{ fontWeight: 600, color: '#0f172a' }}>{notification.message}</span>
          </div>
        )}

        {/* SCREEN: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div>
            <h2 className="screen-title"><LayoutDashboard /> Bảng điều khiển Tổng quan</h2>
            
            {/* Quick Stats Grid */}
            <div className="stats-grid">
              <div className="glass-card stat-card">
                <div className="stat-icon bg-blue-glow">
                  <FileText size={22} />
                </div>
                <div className="stat-value">{products.length}</div>
                <div className="stat-label">Sản phẩm quản lý</div>
              </div>

              <div className="glass-card stat-card">
                <div className="stat-icon bg-green-glow">
                  <MapPin size={22} />
                </div>
                <div className="stat-value">{allLocations.length}</div>
                <div className="stat-label">Tổng số vị trí ô</div>
              </div>

              <div className="glass-card stat-card">
                <div className="stat-icon bg-pink-glow">
                  <MapIcon size={22} />
                </div>
                <div className="stat-value">{warehouses.length}</div>
                <div className="stat-label">Kho lưu trữ</div>
              </div>

              <div className="glass-card stat-card">
                <div className="stat-icon bg-amber-glow">
                  <RefreshCw size={22} />
                </div>
                <div className="stat-value">{syncOutbox.length}</div>
                <div className="stat-label">Chờ đồng bộ Offline</div>
              </div>
            </div>

            {/* Offline Sync Alert */}
            {syncOutbox.length > 0 && (
              <div className="glass-card flex-center justify-between" style={{ borderColor: 'var(--color-warning)', padding: '16px 24px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <AlertCircle className="text-warning" size={24} />
                  <div>
                    <h4 style={{ fontWeight: 700 }}>Có {syncOutbox.length} giao dịch ngoại tuyến chờ đồng bộ</h4>
                    <p className="text-muted" style={{ fontSize: '0.82rem' }}>Dữ liệu đã được lưu an toàn trong IndexedDB của máy và sẽ tự động đẩy lên Supabase khi có mạng.</p>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleManualSync} disabled={isLoading}>
                  <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Đồng bộ ngay
                </button>
              </div>
            )}

            {/* Quick Actions */}
            <div className="glass-card">
              <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 700 }}>Thao tác nhanh</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <button className="btn btn-primary" onClick={() => { setActiveTab('scanner'); resetScannerFlow(); }}>
                  <QrCode size={18} /> Di chuyển sản phẩm
                </button>
                <button className="btn btn-secondary" onClick={() => setActiveTab('maps')}>
                  <MapIcon size={18} /> Xem Bản đồ Vệ tinh
                </button>
                <button className="btn btn-secondary" onClick={() => { setPrintInitialWarehouseId(undefined); setIsPrintModalOpen(true); }}>
                  <Printer size={18} /> In mã QR dán ô
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN: SCANNER / MOVEMENT FLOW */}
        {activeTab === 'scanner' && (
          <div>
            <h2 className="screen-title"><QrCode /> Quy trình Di chuyển Sản phẩm (6 Bước Chuẩn)</h2>

            {/* Step 1: OCR / Select Product */}
            {movementStep === 'idle' && (
              <div className="glass-card">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px' }}>
                  📷 Bước 1 & 2: Quét nhãn sản phẩm bằng Camera / Tải ảnh
                </h3>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                  Đưa camera điện thoại về phía tem in mã sản phẩm (Ví dụ: <strong>e120.30</strong>). Hệ thống OCR sẽ tự động nhận diện mã.
                </p>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <label className="btn btn-primary" style={{ width: 'auto', cursor: 'pointer' }}>
                    <Camera size={18} /> Chụp ảnh / Quét OCR
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleOcrImageSelected(e.target.files[0]);
                        }
                      }}
                    />
                  </label>

                  <label className="btn btn-secondary" style={{ width: 'auto', cursor: 'pointer' }}>
                    <Upload size={18} /> Chọn ảnh từ máy
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleOcrImageSelected(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                </div>

                {ocrStatus === 'loading' && (
                  <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <RefreshCw size={18} className="animate-spin text-primary" />
                    <span>Đang xử lý nhận diện ký tự OCR...</span>
                  </div>
                )}

                {ocrPreviewUrl && (
                  <div style={{ marginTop: '16px' }}>
                    <img src={ocrPreviewUrl} alt="OCR Preview" style={{ maxHeight: '160px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                  </div>
                )}

                {/* Quick Select for Testing */}
                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                  <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: '8px' }}>
                    ⚡ Hoặc chọn nhanh sản phẩm có sẵn để thử nghiệm:
                  </span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {products.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => resolveProductForMovement(p.product_code)}
                      >
                        📦 {p.product_code} ({p.length_value}{p.length_unit})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Product Details & Current Location */}
            {movementStep === 'product_selected' && activeProduct && (
              <div className="glass-card animate-fade-in">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px' }}>
                  📦 Bước 3: Thông tin Sản phẩm & Vị trí Hiện tại
                </h3>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <div>
                      <span className="text-muted" style={{ fontSize: '0.78rem' }}>Mã sản phẩm:</span>
                      <h4 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>{activeProduct.product_code}</h4>
                    </div>
                    <div>
                      <span className="text-muted" style={{ fontSize: '0.78rem' }}>Tên quy cách:</span>
                      <div style={{ fontWeight: 600 }}>{activeProduct.name}</div>
                    </div>
                    <div>
                      <span className="text-muted" style={{ fontSize: '0.78rem' }}>Chiều dài:</span>
                      <div style={{ fontWeight: 700, color: '#2563eb' }}>{activeProduct.length_value} {activeProduct.length_unit}</div>
                    </div>
                    <div>
                      <span className="text-muted" style={{ fontSize: '0.78rem' }}>Vị trí lưu kho hiện tại:</span>
                      <div style={{ fontWeight: 800, color: activeFromLocation ? '#059669' : '#dc2626' }}>
                        {activeFromLocation ? `${activeFromWarehouse?.code || ''} - Ô ${activeFromLocation.code}` : 'Chưa có vị trí (Nhập mới)'}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={resetScannerFlow}>
                    Hủy & Quét lại
                  </button>
                  <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleStartMove}>
                    <ArrowRight size={16} /> BẮT ĐẦU LẤY SẢN PHẨM
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Moving & Scan Destination QR */}
            {movementStep === 'moving' && activeProduct && (
              <div className="glass-card animate-fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div className="stat-icon bg-amber-glow" style={{ width: '36px', height: '36px' }}>
                    <RefreshCw size={18} className="animate-spin" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Bước 4 & 5: Đang di chuyển [{activeProduct.product_code}]</h3>
                    <p className="text-muted" style={{ fontSize: '0.82rem' }}>Mang sản phẩm tới vị trí mới và quét mã QR dán tại ô kệ đích.</p>
                  </div>
                </div>

                {/* QR Scanner Camera Target */}
                <div id="qr-reader-target" style={{ width: '100%', maxWidth: '380px', margin: '0 auto 16px' }} />

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '16px' }}>
                  {!isQrScannerActive ? (
                    <button className="btn btn-primary" style={{ width: 'auto' }} onClick={startCameraQrScanner}>
                      <Camera size={16} /> Bật Camera Quét QR Kệ
                    </button>
                  ) : (
                    <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={stopCameraQrScanner}>
                      Tắt Camera
                    </button>
                  )}
                </div>

                {/* Manual Input or Quick Select */}
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>
                    Hoặc chọn nhanh vị trí kệ đích:
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {allLocations.map(l => (
                      <button
                        key={l.id}
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: 'auto', padding: '4px 10px', fontSize: '0.75rem' }}
                        onClick={() => resolveDestinationLocation(l.id)}
                      >
                        {l.code}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Confirm Destination & Complete */}
            {movementStep === 'destination_scanned' && activeProduct && activeToLocation && (
              <div className="glass-card animate-fade-in">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px' }}>
                  🏁 Bước 6: Xác nhận & Hoàn tất Di chuyển
                </h3>

                <div style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <div>
                      <span className="text-muted" style={{ fontSize: '0.78rem' }}>Sản phẩm:</span>
                      <h4 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{activeProduct.product_code}</h4>
                    </div>
                    <div>
                      <span className="text-muted" style={{ fontSize: '0.78rem' }}>Kho đích:</span>
                      <div style={{ fontWeight: 700 }}>{activeToWarehouse ? `${activeToWarehouse.code} - ${activeToWarehouse.name}` : ''}</div>
                    </div>
                    <div>
                      <span className="text-muted" style={{ fontSize: '0.78rem' }}>Phân khu / Dãy:</span>
                      <div style={{ fontWeight: 700, color: '#2563eb' }}>{activeToZone ? activeToZone.name : 'Mặc định'}</div>
                    </div>
                    <div>
                      <span className="text-muted" style={{ fontSize: '0.78rem' }}>Vị trí ô đích:</span>
                      <div style={{ fontWeight: 900, color: '#059669', fontSize: '1.1rem' }}>Ô {activeToLocation.code}</div>
                    </div>
                  </div>

                  {destinationGps && (
                    <div style={{ marginTop: '12px', fontSize: '0.78rem', color: '#475569', borderTop: '1px solid #d1fae5', paddingTop: '8px' }}>
                      📍 Tọa độ GPS ghi nhận: <strong>{destinationGps.lat.toFixed(6)}, {destinationGps.lng.toFixed(6)}</strong> (Độ chính xác: &plusmn;{Math.round(destinationGps.accuracy || 0)}m)
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setMovementStep('moving')}>
                    Quét vị trí khác
                  </button>
                  <button className="btn btn-success" style={{ width: 'auto' }} onClick={handleFinalizeMovement} disabled={isLoading}>
                    <CheckCircle size={16} /> KẾT THÚC & LƯU VỊ TRÍ
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Completed */}
            {movementStep === 'completed' && (
              <div className="glass-card animate-fade-in text-center" style={{ padding: '30px 20px' }}>
                <CheckCircle size={48} className="text-success" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>Giao dịch Di chuyển Thành công!</h3>
                <p className="text-muted" style={{ fontSize: '0.88rem', marginBottom: '20px' }}>
                  Dữ liệu đã được cập nhật nguyên tử (Atomic Update) vào Supabase và bộ nhớ ngoại tuyến.
                </p>
                <button className="btn btn-primary" style={{ width: 'auto', margin: '0 auto' }} onClick={resetScannerFlow}>
                  Thực hiện di chuyển khác
                </button>
              </div>
            )}
          </div>
        )}

        {/* SCREEN: MAPS */}
        {activeTab === 'maps' && (
          <div>
            <h2 className="screen-title"><MapIcon /> Bản đồ Vệ tinh Không gian Thực (Google Hybrid)</h2>
            <WarehouseSatelliteMap
              warehouses={warehouses}
              zones={zones}
              allLocations={allLocations}
              products={products}
              currentLocations={currentLocations}
              movementsHistory={movementsHistory}
              onOpenPartitionModal={(whId) => {
                setPartitionInitialWarehouseId(whId);
                setIsPartitionModalOpen(true);
              }}
              onDataChanged={loadData}
            />
          </div>
        )}

        {/* SCREEN: SEARCH */}
        {activeTab === 'search' && (
          <div>
            <h2 className="screen-title"><Search /> Tìm kiếm Sản phẩm & Vị trí Lưu kho</h2>
            
            <div className="glass-card">
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nhập mã sản phẩm (VD: e120.30, p500.45)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && triggerSearch()}
                />
                <button className="btn btn-primary" style={{ width: 'auto' }} onClick={triggerSearch}>
                  Tìm kiếm
                </button>
              </div>

              {searchResult && (
                <div style={{ marginTop: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{searchResult.product.product_code}</h3>
                    <span className="badge badge-completed">Đang lưu kho</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                    <div>
                      <span className="text-muted" style={{ fontSize: '0.78rem' }}>Tên sản phẩm:</span>
                      <div><strong>{searchResult.product.name}</strong></div>
                    </div>
                    <div>
                      <span className="text-muted" style={{ fontSize: '0.78rem' }}>Quy cách chiều dài:</span>
                      <div className="text-primary"><strong>{searchResult.product.length_value} {searchResult.product.length_unit}</strong></div>
                    </div>
                    <div>
                      <span className="text-muted" style={{ fontSize: '0.78rem' }}>Kho:</span>
                      <div><strong>{searchResult.warehouse?.name || 'N/A'}</strong></div>
                    </div>
                    <div>
                      <span className="text-muted" style={{ fontSize: '0.78rem' }}>Phân khu:</span>
                      <div><strong>{searchResult.zone?.name || 'N/A'}</strong></div>
                    </div>
                    <div>
                      <span className="text-muted" style={{ fontSize: '0.78rem' }}>Vị trí ô:</span>
                      <div className="text-success"><strong>{searchResult.currentLocation?.code || 'Chưa có'}</strong></div>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px' }}>Lịch sử luân chuyển ({searchResult.history.length} lần):</h4>
                  {searchResult.history.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>Chưa có lịch sử di chuyển.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {searchResult.history.map(h => (
                        <div key={h.id} style={{ fontSize: '0.8rem', padding: '6px 10px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                          📅 {new Date(h.created_at).toLocaleString('vi-VN')} &bull; Người thực hiện: <strong>{h.user_name}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SCREEN: HISTORY */}
        {activeTab === 'history' && (
          <div>
            <h2 className="screen-title"><History /> Nhật ký Luân chuyển Sản phẩm</h2>
            <div className="glass-card">
              {movementsHistory.length === 0 ? (
                <p className="text-muted text-center" style={{ padding: '30px 0' }}>Chưa có nhật ký di chuyển nào.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {movementsHistory.map(m => {
                    const prod = products.find(p => p.id === m.product_id);
                    const fromLoc = allLocations.find(l => l.id === m.from_location_id);
                    const toLoc = allLocations.find(l => l.id === m.to_location_id);
                    return (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <strong>📦 {prod ? prod.product_code : m.product_id.substring(0, 8)}</strong>
                          <span style={{ marginLeft: '12px', color: '#059669', fontWeight: 600 }}>
                            {fromLoc ? fromLoc.code : 'Nhập mới'} &rarr; {toLoc ? toLoc.code : 'N/A'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          {new Date(m.created_at).toLocaleString('vi-VN')} &bull; {m.user_name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SCREEN: SETTINGS */}
        {activeTab === 'settings' && (
          <div>
            <h2 className="screen-title"><SettingsIcon /> Cấu hình Hệ thống & Kết nối Supabase</h2>
            
            {/* Server Connection Status Card */}
            <div className="glass-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                  <Database size={20} className="text-primary" /> Trạng thái Máy chủ
                </h3>
                {isDbOnline ? (
                  <span className="badge badge-completed" style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
                    🟢 Đã kết nối Supabase (Realtime Online)
                  </span>
                ) : (
                  <span className="badge badge-started" style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
                    🟡 Chế độ Ngoại tuyến (IndexedDB)
                  </span>
                )}
              </div>

              {/* Data Overview Stats */}
              <div className="stats-grid" style={{ marginBottom: '16px' }}>
                <div className="glass-card stat-card" style={{ padding: '12px 16px', marginBottom: 0 }}>
                  <span className="stat-label">Tổng số kho:</span>
                  <span className="stat-value" style={{ fontSize: '1.4rem' }}>{warehouses.length}</span>
                </div>
                <div className="glass-card stat-card" style={{ padding: '12px 16px', marginBottom: 0 }}>
                  <span className="stat-label">Tổng số phân khu:</span>
                  <span className="stat-value" style={{ fontSize: '1.4rem' }}>{zones.length}</span>
                </div>
                <div className="glass-card stat-card" style={{ padding: '12px 16px', marginBottom: 0 }}>
                  <span className="stat-label">Tổng số ô vị trí:</span>
                  <span className="stat-value" style={{ fontSize: '1.4rem' }}>{allLocations.length}</span>
                </div>
                <div className="glass-card stat-card" style={{ padding: '12px 16px', marginBottom: 0 }}>
                  <span className="stat-label">Sản phẩm:</span>
                  <span className="stat-value text-success" style={{ fontSize: '1.4rem' }}>
                    {products.length}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-success"
                  style={{ width: 'auto' }}
                  onClick={async () => {
                    showNotification('info', 'Đang nạp dữ liệu sản phẩm và kho lên Supabase...');
                    await autoBootstrapSupabaseDatabase();
                    await loadData();
                    showNotification('success', 'Đã nạp dữ liệu thành công!');
                  }}
                >
                  ⚡ Nạp/Đẩy dữ liệu mẫu lên Supabase
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: 'auto', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                  onClick={async () => {
                    if (window.confirm('Khôi phục toàn bộ dữ liệu mẫu trong IndexedDB?')) {
                      await resetLocalDatabase();
                      await loadData();
                      showNotification('success', 'Đã reset IndexedDB thành công!');
                    }
                  }}
                >
                  Khôi phục Dữ liệu IndexedDB
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* QR PRINT MANAGER MODAL */}
      {isPrintModalOpen && (
        <QRPrintManager
          warehouses={warehouses}
          zones={zones}
          allLocations={allLocations}
          onClose={() => setIsPrintModalOpen(false)}
          initialWarehouseId={printInitialWarehouseId}
        />
      )}

      {/* WAREHOUSE PARTITION & LOCATION MANAGER MODAL */}
      {isPartitionModalOpen && (
        <WarehousePartitionManager
          isOpen={isPartitionModalOpen}
          onClose={() => setIsPartitionModalOpen(false)}
          warehouses={warehouses}
          zones={zones}
          allLocations={allLocations}
          products={products}
          currentLocations={currentLocations}
          initialWarehouseId={partitionInitialWarehouseId}
          onDataChanged={loadData}
        />
      )}
    </div>
  );
}

export default App;
