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
  Grid,
  PackagePlus,
  Box
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
  getSupabaseConfig,
  saveCustomSupabaseConfig,
  initializeProductionSeed,
  autoBootstrapSupabaseDatabase,
  subscribeToRealtimeChanges,
  resetLocalDatabase
} from './lib/database';

import { performOCR } from './lib/ocr';
import { parseQRPayload } from './lib/qr';
import { WarehouseSatelliteMap } from './components/WarehouseSatelliteMap';
import { QRPrintManager } from './components/QRPrintManager';
import { WarehousePartitionManager } from './components/WarehousePartitionManager';
import { ProductImportManager } from './components/ProductImportManager';

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

  // Product Input Modes for Step 1: 'manual' | 'ocr' | 'barcode' | 'catalog'
  const [productInputMode, setProductInputMode] = useState<'manual' | 'ocr' | 'barcode' | 'catalog'>('manual');
  const [manualProductCodeInput, setManualProductCodeInput] = useState('');
  const [isProductBarcodeScannerActive, setIsProductBarcodeScannerActive] = useState(false);
  const productBarcodeScannerRef = useRef<Html5Qrcode | null>(null);

  // QR Camera scanner state for Destination (Step 4 & 5)
  const [isQrScannerActive, setIsQrScannerActive] = useState(false);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);

  // Modals
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printInitialWarehouseId, setPrintInitialWarehouseId] = useState<string | undefined>(undefined);
  const [isPartitionModalOpen, setIsPartitionModalOpen] = useState(false);
  const [partitionInitialWarehouseId, setPartitionInitialWarehouseId] = useState<string | undefined>(undefined);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [prefilledImportCode, setPrefilledImportCode] = useState<string>('');

  // --- Search Screen States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{
    product: Product;
    currentLocation: WarehouseLocation | null;
    warehouse: Warehouse | null;
    zone: WarehouseZone | null;
    history: ProductLocationMovement[];
  } | null>(null);

  // --- Settings Form State ---
  const [supabaseForm, setSupabaseForm] = useState({
    url: getSupabaseConfig().url,
    key: getSupabaseConfig().key
  });

  // --- Load Initial Data ---
  const loadData = async () => {
    try {
      await initializeProductionSeed();
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
      const knownCodes = products.map(p => p.product_code);
      const result = await performOCR(file, knownCodes);
      if (result.matchedCode) {
        setOcrConfidence(result.confidence);
        setOcrStatus('success');
        resolveProductForMovement(result.matchedCode);
      } else {
        setOcrStatus('failed');
        showNotification('error', `Không nhận diện được mã sản phẩm từ ảnh. Văn bản phát hiện: ${result.text || 'trống'}`);
      }
    } catch (err: any) {
      setOcrStatus('failed');
      showNotification('error', 'Lỗi xử lý OCR: ' + err.message);
    }
  };

  const startProductBarcodeScanner = async () => {
    setIsProductBarcodeScannerActive(true);
    try {
      const html5QrCode = new Html5Qrcode('product-barcode-target');
      productBarcodeScannerRef.current = html5QrCode;
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          stopProductBarcodeScanner();
          resolveProductForMovement(decodedText);
        },
        () => {}
      );
    } catch (e) {
      console.warn('Product Barcode camera failed:', e);
      setIsProductBarcodeScannerActive(false);
      showNotification('error', 'Không thể mở Camera. Vui lòng cho phép quyền Camera.');
    }
  };

  const stopProductBarcodeScanner = async () => {
    if (productBarcodeScannerRef.current && isProductBarcodeScannerActive) {
      try {
        await productBarcodeScannerRef.current.stop();
        productBarcodeScannerRef.current.clear();
      } catch (e) {}
      setIsProductBarcodeScannerActive(false);
    }
  };

  const handleManualProductSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualProductCodeInput.trim()) {
      showNotification('info', 'Vui lòng nhập mã sản phẩm');
      return;
    }
    resolveProductForMovement(manualProductCodeInput.trim());
  };

  const resolveProductForMovement = (productCodeOrQuery: string) => {
    const cleanQuery = productCodeOrQuery.trim().toLowerCase();
    
    // Exact or substring match
    const foundProd = products.find(
      p => p.product_code.toLowerCase() === cleanQuery ||
           p.product_code.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanQuery.replace(/[^a-z0-9]/g, '') ||
           p.name.toLowerCase().includes(cleanQuery)
    );

    if (!foundProd) {
      showNotification('error', `Không tìm thấy sản phẩm [${productCodeOrQuery}] trong danh sách!`);
      return;
    }

    stopProductBarcodeScanner();
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
    showNotification('success', `Đã chọn sản phẩm: ${foundProd.product_code} (${foundProd.name})`);
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
    stopProductBarcodeScanner();
    stopCameraQrScanner();
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
    setManualProductCodeInput('');
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
    <div className="page">
      {/* Top Main Navbar */}
      <header className="navbar navbar-expand-md d-print-none navbar-light bg-white border-bottom shadow-sm sticky-top">
        <div className="container-xl d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-3">
            <a href="#" className="navbar-brand-logo" onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); }}>
              <div className="navbar-brand-icon">
                <Sparkles size={18} />
              </div>
              <div className="d-flex flex-column">
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0054a6', lineHeight: 1.1 }}>KHO NHỰT LÚA</span>
                <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500 }}>Hệ thống Quản lý & Định vị Vệ tinh</span>
              </div>
            </a>

            {isDbOnline ? (
              <span className="badge bg-success-lt text-success d-none d-sm-inline-flex" style={{ padding: '5px 10px' }}>
                <Database size={13} className="me-1" /> Supabase Realtime Online
              </span>
            ) : (
              <span className="badge bg-warning-lt text-warning d-none d-sm-inline-flex" style={{ padding: '5px 10px' }}>
                <Database size={13} className="me-1" /> IndexedDB Offline
              </span>
            )}
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setPrefilledImportCode(''); setIsImportModalOpen(true); }}
              title="Nhập sản phẩm mới hoặc dán danh sách hàng loạt vào kho"
            >
              <PackagePlus size={15} /> <span className="d-none d-sm-inline">Nhập Hàng / SP Mới</span>
            </button>

            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => { setPartitionInitialWarehouseId(undefined); setIsPartitionModalOpen(true); }}
              title="Quản lý cấu trúc phân khu & ô vị trí"
            >
              <Grid size={15} /> <span className="d-none d-sm-inline">Phân khu & Ô</span>
            </button>

            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => { setPrintInitialWarehouseId(undefined); setIsPrintModalOpen(true); }}
              title="In mã QR dán các ô kệ"
            >
              <Printer size={15} /> <span className="d-none d-sm-inline">In QR Kệ</span>
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Horizontal Navigation Bar (Desktop) */}
      <header className="navbar-expand-md bg-white border-bottom d-none d-md-block">
        <div className="container-xl">
          <div className="d-flex align-items-center py-1 gap-1">
            <button className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
              <LayoutDashboard size={17} /> Dashboard Tổng quan
            </button>
            <button className={`nav-link ${activeTab === 'scanner' ? 'active' : ''}`} onClick={() => { setActiveTab('scanner'); resetScannerFlow(); }}>
              <QrCode size={17} /> Di chuyển kho
            </button>
            <button className={`nav-link ${activeTab === 'maps' ? 'active' : ''}`} onClick={() => setActiveTab('maps')}>
              <MapIcon size={17} /> Bản đồ Vệ tinh
            </button>
            <button className={`nav-link ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>
              <Search size={17} /> Tra cứu vị trí
            </button>
            <button className={`nav-link ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
              <History size={17} /> Nhật ký xuất nhập
            </button>
            <button className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              <SettingsIcon size={17} /> Cấu hình Supabase
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <div className="page-wrapper">
        {/* Floating Notification */}
        {notification && (
          <div
            className="alert alert-important alert-dismissible fade show position-fixed shadow-lg"
            style={{
              top: '80px',
              right: '20px',
              zIndex: 2000,
              maxWidth: '380px',
              backgroundColor: notification.type === 'error' ? '#d63939' : notification.type === 'success' ? '#2fb344' : '#0054a6',
              color: '#ffffff',
              borderRadius: '8px'
            }}
          >
            <div className="d-flex align-items-center gap-2">
              {notification.type === 'error' && <XCircle size={20} />}
              {notification.type === 'success' && <CheckCircle size={20} />}
              {notification.type === 'info' && <Info size={20} />}
              <span className="font-weight-medium">{notification.message}</span>
            </div>
          </div>
        )}

        {/* SCREEN: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="page-header d-print-none">
              <div className="container-xl">
                <div className="row g-2 align-items-center">
                  <div className="col">
                    <div className="page-pretitle">HỆ THỐNG QUẢN LÝ KHO NHỰT LÚA</div>
                    <h2 className="page-title d-flex align-items-center gap-2">
                      <LayoutDashboard size={24} className="text-primary" /> Bảng điều khiển Tổng quan
                    </h2>
                  </div>
                  <div className="col-auto ms-auto d-print-none">
                    <div className="btn-list">
                      <button className="btn btn-outline-secondary btn-sm" onClick={loadData} disabled={isLoading}>
                        <RefreshCw size={14} className={isLoading ? 'animate-spin me-1' : 'me-1'} /> Làm mới
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={() => { setPrefilledImportCode(''); setIsImportModalOpen(true); }}>
                        <PackagePlus size={14} className="me-1" /> Nhập Lô Mới
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <main className="page-body">
              <div className="container-xl">
                {/* 4 Canonical Tabler Stat Cards */}
                <div className="row row-cards mb-4">
                  <div className="col-sm-6 col-lg-3">
                    <div className="card card-sm">
                      <div className="card-body">
                        <div className="row align-items-center">
                          <div className="col-auto">
                            <span className="avatar bg-primary-lt">
                              <FileText size={22} />
                            </span>
                          </div>
                          <div className="col">
                            <div className="font-weight-bold" style={{ fontSize: '1.4rem', color: '#0f172a' }}>{products.length}</div>
                            <div className="text-secondary" style={{ fontSize: '0.8rem' }}>Sản phẩm quản lý</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-sm-6 col-lg-3">
                    <div className="card card-sm">
                      <div className="card-body">
                        <div className="row align-items-center">
                          <div className="col-auto">
                            <span className="avatar bg-success-lt">
                              <MapPin size={22} />
                            </span>
                          </div>
                          <div className="col">
                            <div className="font-weight-bold" style={{ fontSize: '1.4rem', color: '#0f172a' }}>{allLocations.length}</div>
                            <div className="text-secondary" style={{ fontSize: '0.8rem' }}>Tổng ô vị trí trên kệ</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-sm-6 col-lg-3">
                    <div className="card card-sm">
                      <div className="card-body">
                        <div className="row align-items-center">
                          <div className="col-auto">
                            <span className="avatar bg-azure-lt">
                              <MapIcon size={22} />
                            </span>
                          </div>
                          <div className="col">
                            <div className="font-weight-bold" style={{ fontSize: '1.4rem', color: '#0f172a' }}>{warehouses.length}</div>
                            <div className="text-secondary" style={{ fontSize: '0.8rem' }}>Khu kho định vị GPS</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-sm-6 col-lg-3">
                    <div className="card card-sm">
                      <div className="card-body">
                        <div className="row align-items-center">
                          <div className="col-auto">
                            <span className="avatar bg-warning-lt">
                              <RefreshCw size={22} />
                            </span>
                          </div>
                          <div className="col">
                            <div className="font-weight-bold" style={{ fontSize: '1.4rem', color: '#0f172a' }}>{syncOutbox.length}</div>
                            <div className="text-secondary" style={{ fontSize: '0.8rem' }}>Chờ đồng bộ Offline</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Offline Sync Alert */}
                {syncOutbox.length > 0 && (
                  <div className="card border-warning mb-4" style={{ background: '#fffbeb' }}>
                    <div className="card-body d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <div className="d-flex align-items-center gap-3">
                        <AlertCircle className="text-warning" size={26} />
                        <div>
                          <h4 className="card-title text-warning m-0">Có {syncOutbox.length} giao dịch ngoại tuyến chờ đồng bộ</h4>
                          <div className="text-secondary" style={{ fontSize: '0.8rem' }}>
                            Dữ liệu đã được lưu an toàn trong IndexedDB của máy và sẽ tự động đẩy lên Supabase khi có mạng.
                          </div>
                        </div>
                      </div>
                      <button className="btn btn-warning btn-sm" onClick={handleManualSync} disabled={isLoading}>
                        <RefreshCw size={14} className={isLoading ? 'animate-spin me-1' : 'me-1'} /> Đồng bộ ngay
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Actions & Warehouse Capacity Overview Bento Grid */}
                <div className="row row-cards mb-4">
                  {/* Warehouse Capacity Utilization Card */}
                  <div className="col-lg-8">
                    <div className="card h-100">
                      <div className="card-header d-flex justify-content-between align-items-center">
                        <h3 className="card-title">
                          <MapIcon size={18} className="text-primary me-2" /> Tỷ lệ Sử dụng & Sức chứa Các Kho
                        </h3>
                        <span className="badge bg-azure-lt">
                          {currentLocations.filter(c => c.location_id).length} / {allLocations.length} Ô đã chứa hàng
                        </span>
                      </div>
                      <div className="card-body">
                        <div className="row g-3">
                          {warehouses.map(wh => {
                            const whLocs = allLocations.filter(l => l.warehouse_id === wh.id);
                            const whOccupied = whLocs.filter(l => currentLocations.some(c => c.location_id === l.id)).length;
                            const percent = whLocs.length > 0 ? Math.round((whOccupied / whLocs.length) * 100) : 0;

                            return (
                              <div key={wh.id} className="col-sm-6">
                                <div className="p-3 bg-light rounded border">
                                  <div className="d-flex justify-content-between align-items-center mb-2">
                                    <div className="d-flex align-items-center gap-2">
                                      <span
                                        style={{
                                          width: '10px',
                                          height: '10px',
                                          borderRadius: '50%',
                                          backgroundColor: wh.color
                                        }}
                                      />
                                      <strong style={{ color: '#0f172a' }}>{wh.code} - {wh.name}</strong>
                                    </div>
                                    <span className="small font-weight-bold" style={{ color: wh.color }}>
                                      {whOccupied}/{whLocs.length} ô ({percent}%)
                                    </span>
                                  </div>
                                  <div className="progress progress-sm" style={{ height: '6px' }}>
                                    <div
                                      className="progress-bar"
                                      style={{
                                        width: `${percent}%`,
                                        backgroundColor: wh.color
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Hub */}
                  <div className="col-lg-4">
                    <div className="card h-100">
                      <div className="card-header">
                        <h3 className="card-title">
                          <Sparkles size={18} className="text-primary me-2" /> Trung tâm Thao tác
                        </h3>
                      </div>
                      <div className="card-body d-flex flex-column justify-content-between gap-2">
                        <button className="btn btn-primary w-100 py-2 justify-content-start" onClick={() => { setActiveTab('scanner'); resetScannerFlow(); }}>
                          <QrCode size={18} className="me-2" /> Di chuyển & Nhập xuất Kho
                        </button>
                        <button className="btn btn-outline-primary w-100 py-2 justify-content-start" onClick={() => { setPrefilledImportCode(''); setIsImportModalOpen(true); }}>
                          <PackagePlus size={18} className="me-2" /> Nhập Sản Phẩm / Lô Mới
                        </button>
                        <button className="btn btn-outline-secondary w-100 py-2 justify-content-start" onClick={() => setActiveTab('maps')}>
                          <MapIcon size={18} className="me-2" /> Bản đồ Vệ tinh Quảng Nam
                        </button>
                        <button className="btn btn-outline-secondary w-100 py-2 justify-content-start" onClick={() => { setPrintInitialWarehouseId(undefined); setIsPrintModalOpen(true); }}>
                          <Printer size={18} className="me-2" /> In Mã QR Dán Ô Kệ
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Realtime Inventory Snapshot Table */}
                <div className="card">
                  <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <h3 className="card-title">
                      <FileText size={18} className="text-primary me-2" /> Danh mục & Vị trí Lưu kho ({products.length} sản phẩm)
                    </h3>
                    <div className="d-flex gap-2">
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => setActiveTab('search')}>
                        <Search size={14} className="me-1" /> Tra cứu chi tiết
                      </button>
                    </div>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-vcenter card-table table-striped table-hover">
                      <thead>
                        <tr>
                          <th>Mã Sản Phẩm</th>
                          <th>Tên Quy Cách</th>
                          <th>Chiều dài</th>
                          <th>Kho</th>
                          <th>Ô Kệ Đang Lưu</th>
                          <th className="w-1 text-end">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-4 text-muted">
                              Chưa có sản phẩm nào trong kho. Bấm "Nhập Hàng / SP Mới" để thêm ngay.
                            </td>
                          </tr>
                        ) : (
                          products.slice(0, 15).map((p) => {
                            const curBinding = currentLocations.find(c => c.product_id === p.id);
                            const curLoc = curBinding?.location_id ? allLocations.find(l => l.id === curBinding.location_id) : null;
                            const curWh = curLoc ? warehouses.find(w => w.id === curLoc.warehouse_id) : null;

                            return (
                              <tr key={p.id}>
                                <td>
                                  <strong className="text-primary">{p.product_code}</strong>
                                </td>
                                <td>{p.name}</td>
                                <td>
                                  <span className="badge bg-azure-lt">{p.length_value} {p.length_unit}</span>
                                </td>
                                <td>
                                  {curWh ? (
                                    <span className="badge bg-secondary-lt" style={{ borderLeft: `3px solid ${curWh.color}` }}>
                                      {curWh.code} - {curWh.name}
                                    </span>
                                  ) : (
                                    <span className="text-muted">—</span>
                                  )}
                                </td>
                                <td>
                                  {curLoc ? (
                                    <span className="badge bg-success-lt font-weight-bold">Ô {curLoc.code}</span>
                                  ) : (
                                    <span className="badge bg-danger-lt">Chưa có ô</span>
                                  )}
                                </td>
                                <td className="text-end">
                                  <button
                                    className="btn btn-outline-primary btn-sm"
                                    onClick={() => {
                                      setActiveTab('scanner');
                                      resolveProductForMovement(p.product_code);
                                    }}
                                  >
                                    Di chuyển
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </main>
          </div>
        )}

        {/* SCREEN: SCANNER / MOVEMENT FLOW */}
        {activeTab === 'scanner' && (
          <div>
            <div className="page-header d-print-none">
              <div className="container-xl">
                <div className="row g-2 align-items-center">
                  <div className="col">
                    <div className="page-pretitle">QUY TRÌNH LUÂN CHUYỂN KHO</div>
                    <h2 className="page-title d-flex align-items-center gap-2">
                      <QrCode size={24} className="text-primary" /> Di chuyển & Nhập xuất Vị trí
                    </h2>
                  </div>
                  <div className="col-auto ms-auto d-print-none">
                    <button className="btn btn-outline-secondary btn-sm" onClick={resetScannerFlow}>
                      <RefreshCw size={14} className="me-1" /> Làm lại từ đầu
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <main className="page-body">
              <div className="container-xl">
                {/* Visual Movement Step Progress Bar */}
                <div className="card card-sm mb-3">
                  <div className="card-body p-2">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <span className={`badge ${movementStep === 'idle' ? 'bg-primary' : 'bg-success-lt'} p-2`}>
                        1. Chọn sản phẩm
                      </span>
                      <ArrowRight size={13} className="text-muted" />
                      <span className={`badge ${movementStep === 'product_selected' ? 'bg-primary' : movementStep === 'idle' ? 'bg-secondary-lt text-muted' : 'bg-success-lt'} p-2`}>
                        2. Xác nhận SP & Vị trí
                      </span>
                      <ArrowRight size={13} className="text-muted" />
                      <span className={`badge ${movementStep === 'moving' ? 'bg-primary' : movementStep === 'destination_scanned' || movementStep === 'completed' ? 'bg-success-lt' : 'bg-secondary-lt text-muted'} p-2`}>
                        3. Di chuyển & Quét QR đích
                      </span>
                      <ArrowRight size={13} className="text-muted" />
                      <span className={`badge ${movementStep === 'destination_scanned' ? 'bg-primary' : movementStep === 'completed' ? 'bg-success-lt' : 'bg-secondary-lt text-muted'} p-2`}>
                        4. Kiểm tra & Lưu GPS
                      </span>
                      <ArrowRight size={13} className="text-muted" />
                      <span className={`badge ${movementStep === 'completed' ? 'bg-success' : 'bg-secondary-lt text-muted'} p-2`}>
                        5. Hoàn tất
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 1: Multi-Modal Product Identification */}
                {movementStep === 'idle' && (
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">
                        <Box size={18} className="text-primary me-2" /> Chọn hoặc Quét Sản Phẩm Cần Di Chuyển
                      </h3>
                    </div>
                    <div className="card-body">
                      <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                        Hỗ trợ <strong>Điền mã bằng tay</strong>, <strong>AI Vision OCR Chụp tem</strong>, <strong>Camera Barcode/QR</strong> hoặc <strong>Chọn danh mục</strong>.
                      </p>

                      {/* Sub-mode Tabs */}
                      <div className="btn-list mb-3">
                        <button
                          type="button"
                          className={`btn ${productInputMode === 'manual' ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => { stopProductBarcodeScanner(); setProductInputMode('manual'); }}
                        >
                          <FileText size={15} className="me-1" /> Điền mã tay
                        </button>
                        <button
                          type="button"
                          className={`btn ${productInputMode === 'ocr' ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => { stopProductBarcodeScanner(); setProductInputMode('ocr'); }}
                        >
                          <Camera size={15} className="me-1" /> AI OCR Chụp tem
                        </button>
                        <button
                          type="button"
                          className={`btn ${productInputMode === 'barcode' ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => { setProductInputMode('barcode'); }}
                        >
                          <QrCode size={15} className="me-1" /> Quét Barcode/QR
                        </button>
                        <button
                          type="button"
                          className={`btn ${productInputMode === 'catalog' ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => { stopProductBarcodeScanner(); setProductInputMode('catalog'); }}
                        >
                          <Grid size={15} className="me-1" /> Danh mục có sẵn
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-primary"
                          onClick={() => {
                            setPrefilledImportCode(manualProductCodeInput.trim());
                            setIsImportModalOpen(true);
                          }}
                        >
                          <PackagePlus size={15} className="me-1" /> Nhập Lô / SP Mới
                        </button>
                      </div>

                      {/* SUB-MODE 1: MANUAL TEXT INPUT */}
                      {productInputMode === 'manual' && (
                        <div className="p-3 bg-light rounded border">
                          <form onSubmit={handleManualProductSubmit}>
                            <label className="form-label required">
                              Nhập mã sản phẩm hoặc tên quy cách:
                            </label>
                            <div className="d-flex gap-2 mb-3">
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Ví dụ: e120.30, e100, p500.45..."
                                value={manualProductCodeInput}
                                onChange={(e) => setManualProductCodeInput(e.target.value)}
                                autoFocus
                              />
                              <button type="submit" className="btn btn-primary text-nowrap">
                                <CheckCircle size={16} className="me-1" /> Chọn mã
                              </button>
                            </div>
                          </form>

                          {/* Live Suggestion Chips */}
                          {manualProductCodeInput.trim() && (
                            <div className="mt-2">
                              <span className="form-hint mb-2">Gợi ý tìm kiếm nhanh:</span>
                              <div className="d-flex gap-1 flex-wrap mb-3">
                                {products
                                  .filter(p =>
                                    p.product_code.toLowerCase().includes(manualProductCodeInput.trim().toLowerCase()) ||
                                    p.name.toLowerCase().includes(manualProductCodeInput.trim().toLowerCase())
                                  )
                                  .map(p => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      className="btn btn-outline-primary btn-sm"
                                      onClick={() => resolveProductForMovement(p.product_code)}
                                    >
                                      👉 <strong>{p.product_code}</strong> ({p.name})
                                    </button>
                                  ))}
                              </div>

                              {/* Quick Inbound Shortcut */}
                              <div className="p-2 bg-white rounded border d-flex justify-content-between align-items-center flex-wrap gap-2">
                                <span style={{ fontSize: '0.82rem', color: '#0054a6' }}>
                                  ✨ Chưa có mã <strong>[{manualProductCodeInput.trim()}]</strong> trong kho?
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => {
                                    setPrefilledImportCode(manualProductCodeInput.trim());
                                    setIsImportModalOpen(true);
                                  }}
                                >
                                  <PackagePlus size={14} className="me-1" /> ➕ Nhập Mới Sản Phẩm Này
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* SUB-MODE 2: AI OCR CAMERA / UPLOAD */}
                      {productInputMode === 'ocr' && (
                        <div>
                          <div className="d-flex gap-2 flex-wrap mb-3">
                            <label className="btn btn-primary cursor-pointer">
                              <Camera size={18} className="me-1" /> Chụp tem sản phẩm
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

                            <label className="btn btn-outline-secondary cursor-pointer">
                              <Upload size={18} className="me-1" /> Chọn ảnh từ bộ nhớ
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
                            <div className="alert alert-info d-flex align-items-center gap-2">
                              <RefreshCw size={18} className="animate-spin text-primary" />
                              <span className="font-weight-medium">AI Vision đang đọc & nhận diện ký tự tem...</span>
                            </div>
                          )}

                          {ocrPreviewUrl && (
                            <div className="mt-3">
                              <img src={ocrPreviewUrl} alt="OCR Preview" className="img-thumbnail" style={{ maxHeight: '180px' }} />
                            </div>
                          )}
                        </div>
                      )}

                      {/* SUB-MODE 3: LIVE BARCODE / QR SCANNER */}
                      {productInputMode === 'barcode' && (
                        <div className="text-center py-2">
                          <div id="product-barcode-target" style={{ width: '100%', maxWidth: '360px', margin: '0 auto 12px' }} />

                          {!isProductBarcodeScannerActive ? (
                            <button className="btn btn-primary" onClick={startProductBarcodeScanner}>
                              <Camera size={16} className="me-1" /> Bật Camera Quét Barcode / QR
                            </button>
                          ) : (
                            <button className="btn btn-outline-secondary" onClick={stopProductBarcodeScanner}>
                              Tắt Camera Quét
                            </button>
                          )}
                        </div>
                      )}

                      {/* SUB-MODE 4: CATALOG LIST */}
                      {productInputMode === 'catalog' && (
                        <div>
                          <span className="form-hint mb-3 d-block">
                            Bấm vào sản phẩm bên dưới để bắt đầu di chuyển:
                          </span>
                          <div className="row g-2">
                            {products.map(p => {
                              const curBinding = currentLocations.find(c => c.product_id === p.id);
                              const curLoc = curBinding?.location_id ? allLocations.find(l => l.id === curBinding.location_id) : null;
                              const curWh = curLoc ? warehouses.find(w => w.id === curLoc.warehouse_id) : null;

                              return (
                                <div key={p.id} className="col-sm-6 col-md-4 col-lg-3">
                                  <div
                                    className="card card-sm h-100 cursor-pointer"
                                    onClick={() => resolveProductForMovement(p.product_code)}
                                    style={{ border: '1px solid #cbd5e1' }}
                                  >
                                    <div className="card-body p-3">
                                      <div className="d-flex justify-content-between align-items-center mb-1">
                                        <strong className="text-primary" style={{ fontSize: '0.95rem' }}>{p.product_code}</strong>
                                        <span className="badge bg-azure-lt">{p.length_value} {p.length_unit}</span>
                                      </div>
                                      <div className="text-muted small mb-2">{p.name}</div>
                                      <div className="small font-weight-bold" style={{ color: curLoc ? '#2fb344' : '#d63939' }}>
                                        📍 {curLoc ? `${curWh?.code || ''} - Ô ${curLoc.code}` : 'Chưa có vị trí'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 2: Product Details & Current Location */}
                {movementStep === 'product_selected' && activeProduct && (
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">📦 Bước 3: Thông tin Sản phẩm & Vị trí Hiện tại</h3>
                    </div>
                    <div className="card-body">
                      <div className="p-3 bg-light rounded border mb-3">
                        <div className="row g-3">
                          <div className="col-6 col-md-3">
                            <span className="form-hint">Mã sản phẩm:</span>
                            <div className="font-weight-bold text-primary" style={{ fontSize: '1.2rem' }}>{activeProduct.product_code}</div>
                          </div>
                          <div className="col-6 col-md-3">
                            <span className="form-hint">Tên quy cách:</span>
                            <div className="font-weight-medium">{activeProduct.name}</div>
                          </div>
                          <div className="col-6 col-md-3">
                            <span className="form-hint">Chiều dài:</span>
                            <div className="font-weight-bold text-azure">{activeProduct.length_value} {activeProduct.length_unit}</div>
                          </div>
                          <div className="col-6 col-md-3">
                            <span className="form-hint">Vị trí lưu kho hiện tại:</span>
                            <div className="font-weight-bold" style={{ color: activeFromLocation ? '#2fb344' : '#d63939' }}>
                              {activeFromLocation ? `${activeFromWarehouse?.code || ''} - Ô ${activeFromLocation.code}` : 'Chưa có vị trí (Nhập mới)'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="btn-list">
                        <button className="btn btn-outline-secondary" onClick={resetScannerFlow}>
                          Hủy & Quét lại
                        </button>
                        <button className="btn btn-primary" onClick={handleStartMove}>
                          <ArrowRight size={16} className="me-1" /> BẮT ĐẦU LẤY SẢN PHẨM
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Moving & Scan Destination QR */}
                {movementStep === 'moving' && activeProduct && (
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title text-warning">
                        <RefreshCw size={18} className="animate-spin me-2" /> Bước 4 & 5: Đang di chuyển [{activeProduct.product_code}]
                      </h3>
                    </div>
                    <div className="card-body">
                      <p className="text-muted mb-3">
                        Mang sản phẩm tới vị trí mới và quét mã QR dán tại ô kệ đích.
                      </p>

                      {/* QR Scanner Camera Target */}
                      <div id="qr-reader-target" style={{ width: '100%', maxWidth: '380px', margin: '0 auto 16px' }} />

                      <div className="d-flex justify-content-center mb-3">
                        {!isQrScannerActive ? (
                          <button className="btn btn-primary" onClick={startCameraQrScanner}>
                            <Camera size={16} className="me-1" /> Bật Camera Quét QR Kệ
                          </button>
                        ) : (
                          <button className="btn btn-outline-secondary" onClick={stopCameraQrScanner}>
                            Tắt Camera
                          </button>
                        )}
                      </div>

                      {/* Manual Input or Quick Select */}
                      <div className="p-3 bg-light rounded border">
                        <span className="form-hint mb-2 d-block">Hoặc chọn nhanh vị trí kệ đích:</span>
                        <div className="d-flex gap-1 flex-wrap">
                          {allLocations.map(l => (
                            <button
                              key={l.id}
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => resolveDestinationLocation(l.id)}
                            >
                              {l.code}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Confirm Destination & Complete */}
                {movementStep === 'destination_scanned' && activeProduct && activeToLocation && (
                  <div className="card border-success">
                    <div className="card-header bg-success-lt">
                      <h3 className="card-title text-success">🏁 Bước 6: Xác nhận & Hoàn tất Di chuyển</h3>
                    </div>
                    <div className="card-body">
                      <div className="p-3 bg-light rounded border mb-3">
                        <div className="row g-3">
                          <div className="col-6 col-md-3">
                            <span className="form-hint">Sản phẩm:</span>
                            <div className="font-weight-bold" style={{ fontSize: '1.15rem' }}>{activeProduct.product_code}</div>
                          </div>
                          <div className="col-6 col-md-3">
                            <span className="form-hint">Kho đích:</span>
                            <div className="font-weight-bold">{activeToWarehouse ? `${activeToWarehouse.code} - ${activeToWarehouse.name}` : ''}</div>
                          </div>
                          <div className="col-6 col-md-3">
                            <span className="form-hint">Phân khu / Dãy:</span>
                            <div className="font-weight-bold text-azure">{activeToZone ? activeToZone.name : 'Mặc định'}</div>
                          </div>
                          <div className="col-6 col-md-3">
                            <span className="form-hint">Vị trí ô đích:</span>
                            <div className="font-weight-bold text-success" style={{ fontSize: '1.2rem' }}>Ô {activeToLocation.code}</div>
                          </div>
                        </div>

                        {destinationGps && (
                          <div className="mt-3 pt-2 border-top small text-muted">
                            📍 Tọa độ GPS ghi nhận: <strong>{destinationGps.lat.toFixed(6)}, {destinationGps.lng.toFixed(6)}</strong> (Độ chính xác: &plusmn;{Math.round(destinationGps.accuracy || 0)}m)
                          </div>
                        )}
                      </div>

                      <div className="btn-list">
                        <button className="btn btn-outline-secondary" onClick={() => setMovementStep('moving')}>
                          Quét vị trí khác
                        </button>
                        <button className="btn btn-success" onClick={handleFinalizeMovement} disabled={isLoading}>
                          <CheckCircle size={16} className="me-1" /> KẾT THÚC & LƯU VỊ TRÍ
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 5: Completed */}
                {movementStep === 'completed' && (
                  <div className="card text-center py-4">
                    <div className="card-body">
                      <CheckCircle size={52} className="text-success mb-3" />
                      <h3 className="card-title justify-content-center mb-2" style={{ fontSize: '1.3rem' }}>
                        Giao dịch Di chuyển Thành công!
                      </h3>
                      <p className="text-muted mb-4">
                        Dữ liệu đã được cập nhật nguyên tử (Atomic Update) vào Supabase và bộ nhớ ngoại tuyến.
                      </p>
                      <button className="btn btn-primary" onClick={resetScannerFlow}>
                        Thực hiện di chuyển khác
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>
        )}

        {/* SCREEN: MAPS */}
        {activeTab === 'maps' && (
          <div>
            <div className="page-header d-print-none">
              <div className="container-xl">
                <div className="row g-2 align-items-center">
                  <div className="col">
                    <div className="page-pretitle">BẢN ĐỒ KHÔNG GIAN THỰC</div>
                    <h2 className="page-title d-flex align-items-center gap-2">
                      <MapIcon size={24} className="text-primary" /> Bản đồ Vệ tinh Kho & Ô Kệ (Google Hybrid)
                    </h2>
                  </div>
                </div>
              </div>
            </div>

            <main className="page-body">
              <div className="container-xl">
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
            </main>
          </div>
        )}

        {/* SCREEN: SEARCH */}
        {activeTab === 'search' && (
          <div>
            <div className="page-header d-print-none">
              <div className="container-xl">
                <div className="row g-2 align-items-center">
                  <div className="col">
                    <div className="page-pretitle">TRA CỨU VỊ TRÍ & LỊCH SỬ</div>
                    <h2 className="page-title d-flex align-items-center gap-2">
                      <Search size={24} className="text-primary" /> Tra cứu Vị trí Sản phẩm & Tồn kho
                    </h2>
                  </div>
                </div>
              </div>
            </div>

            <main className="page-body">
              <div className="container-xl">
                <div className="card mb-4">
                  <div className="card-body">
                    <div className="d-flex gap-2">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Nhập mã sản phẩm (VD: e120.30, p500.45)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && triggerSearch()}
                      />
                      <button className="btn btn-primary text-nowrap" onClick={triggerSearch}>
                        <Search size={16} className="me-1" /> Tìm kiếm
                      </button>
                    </div>

                    {searchResult && (
                      <div className="mt-4 p-3 bg-light rounded border">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h3 className="font-weight-bold text-primary m-0" style={{ fontSize: '1.25rem' }}>
                            {searchResult.product.product_code}
                          </h3>
                          <span className="badge bg-success-lt">Đang lưu kho</span>
                        </div>
                        <div className="row g-3 mb-3">
                          <div className="col-6 col-md-3">
                            <span className="form-hint">Tên sản phẩm:</span>
                            <div className="font-weight-medium">{searchResult.product.name}</div>
                          </div>
                          <div className="col-6 col-md-3">
                            <span className="form-hint">Quy cách chiều dài:</span>
                            <div className="font-weight-bold text-azure">{searchResult.product.length_value} {searchResult.product.length_unit}</div>
                          </div>
                          <div className="col-6 col-md-3">
                            <span className="form-hint">Kho:</span>
                            <div className="font-weight-medium">{searchResult.warehouse?.name || 'N/A'}</div>
                          </div>
                          <div className="col-6 col-md-3">
                            <span className="form-hint">Vị trí ô:</span>
                            <div className="font-weight-bold text-success">{searchResult.currentLocation?.code || 'Chưa có'}</div>
                          </div>
                        </div>

                        <h4 className="card-title mb-2">Lịch sử luân chuyển ({searchResult.history.length} lần):</h4>
                        {searchResult.history.length === 0 ? (
                          <p className="text-muted small m-0">Chưa có lịch sử di chuyển.</p>
                        ) : (
                          <div className="d-flex flex-column gap-1">
                            {searchResult.history.map(h => (
                              <div key={h.id} className="p-2 bg-white rounded border small">
                                📅 {new Date(h.created_at).toLocaleString('vi-VN')} &bull; Người thực hiện: <strong>{h.user_name}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </main>
          </div>
        )}

        {/* SCREEN: HISTORY */}
        {activeTab === 'history' && (
          <div>
            <div className="page-header d-print-none">
              <div className="container-xl">
                <div className="row g-2 align-items-center">
                  <div className="col">
                    <div className="page-pretitle">NHẬT KÝ KIỂM TOÁN</div>
                    <h2 className="page-title d-flex align-items-center gap-2">
                      <History size={24} className="text-primary" /> Nhật ký Luân chuyển & Xuất Nhập Kho
                    </h2>
                  </div>
                  <div className="col-auto ms-auto d-print-none">
                    <button className="btn btn-outline-secondary btn-sm" onClick={loadData}>
                      <RefreshCw size={14} className="me-1" /> Tải lại
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <main className="page-body">
              <div className="container-xl">
                <div className="card">
                  <div className="table-responsive">
                    <table className="table table-vcenter card-table table-striped table-hover">
                      <thead>
                        <tr>
                          <th>Thời gian</th>
                          <th>Mã Sản Phẩm</th>
                          <th>Hành trình Di chuyển</th>
                          <th>Người thực hiện</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movementsHistory.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-4 text-muted">
                              Chưa có lịch sử di chuyển nào được ghi nhận.
                            </td>
                          </tr>
                        ) : (
                          movementsHistory.map(m => {
                            const prod = products.find(p => p.id === m.product_id);
                            const fromLoc = allLocations.find(l => l.id === m.from_location_id);
                            const toLoc = allLocations.find(l => l.id === m.to_location_id);

                            return (
                              <tr key={m.id}>
                                <td className="text-muted small">
                                  {new Date(m.created_at).toLocaleString('vi-VN')}
                                </td>
                                <td>
                                  <strong className="text-primary">
                                    {prod ? prod.product_code : m.product_id.substring(0, 8)}
                                  </strong>
                                </td>
                                <td>
                                  <span className="font-weight-medium text-success">
                                    {fromLoc ? `Ô ${fromLoc.code}` : 'Nhập mới'} &rarr; {toLoc ? `Ô ${toLoc.code}` : 'N/A'}
                                  </span>
                                </td>
                                <td>
                                  <span className="badge bg-secondary-lt">{m.user_name || 'Hệ thống'}</span>
                                </td>
                                <td>
                                  <span className="badge bg-success-lt">Thành công</span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </main>
          </div>
        )}

        {/* SCREEN: SETTINGS */}
        {activeTab === 'settings' && (
          <div>
            <div className="page-header d-print-none">
              <div className="container-xl">
                <div className="row g-2 align-items-center">
                  <div className="col">
                    <div className="page-pretitle">HỆ THỐNG & ĐỒNG BỘ</div>
                    <h2 className="page-title d-flex align-items-center gap-2">
                      <SettingsIcon size={24} className="text-primary" /> Cấu hình Kết nối Supabase & Bộ nhớ Ngoại tuyến
                    </h2>
                  </div>
                </div>
              </div>
            </div>

            <main className="page-body">
              <div className="container-xl">
                <div className="card mb-4">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <h3 className="card-title">
                      <Database size={18} className="text-primary me-2" /> Trạng thái Máy chủ & Cơ sở dữ liệu
                    </h3>
                    {isDbOnline ? (
                      <span className="badge bg-success-lt font-weight-bold">
                        🟢 Đã kết nối Supabase (Realtime Online)
                      </span>
                    ) : (
                      <span className="badge bg-warning-lt font-weight-bold">
                        🟡 Chế độ Ngoại tuyến (IndexedDB)
                      </span>
                    )}
                  </div>
                  <div className="card-body">
                    {/* Data Overview Stats */}
                    <div className="row row-cards mb-4">
                      <div className="col-6 col-md-3">
                        <div className="card card-sm">
                          <div className="card-body p-3">
                            <span className="form-hint">Tổng số kho:</span>
                            <div className="font-weight-bold" style={{ fontSize: '1.3rem' }}>{warehouses.length}</div>
                          </div>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="card card-sm">
                          <div className="card-body p-3">
                            <span className="form-hint">Tổng số phân khu:</span>
                            <div className="font-weight-bold" style={{ fontSize: '1.3rem' }}>{zones.length}</div>
                          </div>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="card card-sm">
                          <div className="card-body p-3">
                            <span className="form-hint">Tổng số ô vị trí:</span>
                            <div className="font-weight-bold" style={{ fontSize: '1.3rem' }}>{allLocations.length}</div>
                          </div>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="card card-sm">
                          <div className="card-body p-3">
                            <span className="form-hint">Sản phẩm:</span>
                            <div className="font-weight-bold text-success" style={{ fontSize: '1.3rem' }}>{products.length}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Supabase Connection Settings Form */}
                    <div className="p-3 bg-light rounded border">
                      <h4 className="card-title mb-3">⚙️ Cấu hình API Supabase:</h4>
                      
                      <div className="row g-3 mb-3">
                        <div className="col-12 col-md-6">
                          <label className="form-label required">Project URL:</label>
                          <input
                            type="text"
                            className="form-control"
                            value={supabaseForm.url}
                            onChange={(e) => setSupabaseForm({ ...supabaseForm, url: e.target.value })}
                            placeholder="https://xyzcompany.supabase.co"
                          />
                        </div>

                        <div className="col-12 col-md-6">
                          <label className="form-label required">Anon Public API Key:</label>
                          <input
                            type="text"
                            className="form-control"
                            value={supabaseForm.key}
                            onChange={(e) => setSupabaseForm({ ...supabaseForm, key: e.target.value })}
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                          />
                        </div>
                      </div>

                      <div className="btn-list">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={async () => {
                            saveCustomSupabaseConfig(supabaseForm.url, supabaseForm.key);
                            showNotification('info', 'Đang kết nối lại Supabase...');
                            await autoBootstrapSupabaseDatabase();
                            await loadData();
                            showNotification('success', 'Đã lưu cấu hình và kết nối Supabase thành công!');
                          }}
                        >
                          💾 Lưu & Kết nối Supabase
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline-primary"
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
                          className="btn btn-outline-danger"
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
                </div>
              </div>
            </main>
          </div>
        )}

        {/* Tabler Footer */}
        <footer className="footer footer-transparent d-print-none py-3 text-muted">
          <div className="container-xl">
            <div className="row text-center align-items-center flex-row-reverse">
              <div className="col-lg-auto ms-lg-auto">
                <span className="badge bg-blue-lt me-2">Production v2.4</span>
                <span>Tabler Dashboard Standard</span>
              </div>
              <div className="col-12 col-lg-auto mt-3 mt-lg-0">
                &copy; 2026 Kho Nhựt Lúa &bull; Hệ thống Quản trị & Bản đồ Vệ tinh Không gian Thực
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Mobile Bottom Tab Navigation */}
      <div className="mobile-bottom-nav">
        <button className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <LayoutDashboard size={18} />
          <span>Tổng quan</span>
        </button>
        <button className={`mobile-nav-item ${activeTab === 'scanner' ? 'active' : ''}`} onClick={() => { setActiveTab('scanner'); resetScannerFlow(); }}>
          <QrCode size={18} />
          <span>Di chuyển</span>
        </button>
        <button className={`mobile-nav-item ${activeTab === 'maps' ? 'active' : ''}`} onClick={() => setActiveTab('maps')}>
          <MapIcon size={18} />
          <span>Bản đồ</span>
        </button>
        <button className={`mobile-nav-item ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>
          <Search size={18} />
          <span>Tra cứu</span>
        </button>
        <button className={`mobile-nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <History size={18} />
          <span>Lịch sử</span>
        </button>
        <button className={`mobile-nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <SettingsIcon size={18} />
          <span>Cấu hình</span>
        </button>
      </div>

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

      {/* PRODUCT IMPORT & BULK INBOUND MODAL */}
      {isImportModalOpen && (
        <ProductImportManager
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          warehouses={warehouses}
          allLocations={allLocations}
          currentLocations={currentLocations}
          initialProductCode={prefilledImportCode}
          onDataChanged={loadData}
        />
      )}
    </div>
  );
}

export default App;
