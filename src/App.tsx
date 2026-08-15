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
  User,
  Plus,
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

import {
  getWarehouses,
  getWarehouseLocations,
  getCurrentProductLocations,
  getProductCurrentLocation,
  startProductMovement,
  completeProductMovement,
  getMovementsHistory,
  createCustomWarehouse,
  getSyncOutbox,
  syncOfflineQueue,
  saveSupabaseConfig,
  clearSupabaseConfig,
  getSupabaseConfig,
  isSupabaseEnabled,
  initializeSeed,
  autoBootstrapSupabaseDatabase,
  subscribeToRealtimeChanges
} from './lib/database';

import type {
  Warehouse,
  WarehouseLocation,
  ProductLocationMovement,
  ProductCurrentLocation,
  SyncAction
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
  const [allLocations, setAllLocations] = useState<WarehouseLocation[]>([]);
  const [currentLocations, setCurrentLocations] = useState<ProductCurrentLocation[]>([]);
  const [movementsHistory, setMovementsHistory] = useState<ProductLocationMovement[]>([]);
  const [syncOutbox, setSyncOutbox] = useState<SyncAction[]>([]);
  const [isDbOnline, setIsDbOnline] = useState(false);

  // --- Loading / Notification States ---
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // --- Dashboard States ---
  const [activeMovements, setActiveMovements] = useState<ProductLocationMovement[]>([]);

  // --- OCR / Scanner States ---
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [scannedProductCode, setScannedProductCode] = useState<string>('');
  const [scannedProductCurrentLoc, setScannedProductCurrentLoc] = useState<string | null>(null);
  
  // Movement Flow State: 'idle' -> 'ocr_scanned' -> 'move_started' -> 'completed'
  const [movementStep, setMovementStep] = useState<'idle' | 'ocr_scanned' | 'move_started' | 'completed'>('idle');
  const [activeMovingProduct, setActiveMovingProduct] = useState<{ code: string; from: string | null } | null>(null);
  
  // QR Camera scanner state
  const [isQrScannerActive, setIsQrScannerActive] = useState(false);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const [manualLocationInput, setManualLocationInput] = useState('');

  // --- Maps Screen States ---
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('K1');
  const [mapDisplayMode, setMapDisplayMode] = useState<'satellite' | '2d'>('satellite');
  const [selectedCellInfo, setSelectedCellInfo] = useState<{
    locationId: string;
    product: string | null;
    history: ProductLocationMovement[];
  } | null>(null);
  
  // Custom Warehouse Creator Modal
  const [isAddWarehouseModalOpen, setIsAddWarehouseModalOpen] = useState(false);
  const [newWarehouseForm, setNewWarehouseForm] = useState({
    id: '',
    name: '',
    type: 'grid' as 'grid' | 'aisle',
    columns: 3,
    rows: 3
  });

  // QR Print Manager Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printInitialWarehouseId, setPrintInitialWarehouseId] = useState<string | undefined>(undefined);

  // Warehouse Partition / Transfer Modal
  const [isPartitionModalOpen, setIsPartitionModalOpen] = useState(false);
  const [partitionInitialWarehouseId, setPartitionInitialWarehouseId] = useState<string | undefined>(undefined);

  // --- Search Screen States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{
    productCode: string;
    currentLocation: string | null;
    history: ProductLocationMovement[];
    warehouse: Warehouse | null;
    locationDetail: WarehouseLocation | null;
  } | null>(null);

  // --- Settings States ---
  const [settingsForm, setSettingsForm] = useState({
    url: '',
    key: ''
  });

  // --- Load Initial Data ---
  const loadData = async () => {
    try {
      setIsDbOnline(isSupabaseEnabled());
      const whs = await getWarehouses();
      setWarehouses(whs);

      // Fetch locations for all warehouses
      const locsPromises = whs.map(w => getWarehouseLocations(w.id));
      const locsArrays = await Promise.all(locsPromises);
      const combinedLocs = locsArrays.flat();
      setAllLocations(combinedLocs);

      const curLocs = await getCurrentProductLocations();
      setCurrentLocations(curLocs);

      const hist = await getMovementsHistory();
      setMovementsHistory(hist);

      // Started movements
      const started = hist.filter(m => m.status === 'started');
      setActiveMovements(started);

      const outbox = getSyncOutbox();
      setSyncOutbox(outbox);
    } catch (e) {
      console.error('Failed to load database content:', e);
      showNotification('error', 'Không thể kết nối cơ sở dữ liệu');
    }
  };

  useEffect(() => {
    loadData();
    autoBootstrapSupabaseDatabase();

    // Load saved Supabase configuration inputs
    const config = getSupabaseConfig();
    setSettingsForm({
      url: config.url,
      key: config.key
    });

    // Subscribe to realtime database changes
    const unsubscribe = subscribeToRealtimeChanges(() => {
      console.log('⚡ Dữ liệu trên Supabase vừa thay đổi, tự động cập nhật lại...');
      loadData();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Lock to clean light theme
  useEffect(() => {
    window.document.documentElement.classList.add('light');
  }, []);

  // Handle local notifications
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // --- Geolocation Helper ---
  const getCoordinates = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: 10.762622, lng: 106.660172 }); // Fallback to HCMC warehouse
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.warn('Geolocation access failed, returning fallback coords:', err);
          resolve({ lat: 10.762622, lng: 106.660172 });
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  // --- OCR Scanner Operations ---
  const handleOcrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrPreviewUrl(URL.createObjectURL(file));
    setOcrStatus('loading');

    try {
      const result = await performOCR(file);
      if (result.success) {
        setOcrConfidence(result.confidence);
        setScannedProductCode(result.matchedCode || result.text.substring(0, 10));
        setOcrStatus('success');
        showNotification('success', 'Nhận diện văn bản thành công!');
        
        // Find if this product already has a location
        const curLoc = await getProductCurrentLocation(result.matchedCode || result.text.substring(0, 10));
        setScannedProductCurrentLoc(curLoc ? curLoc.location_id : null);
        setMovementStep('ocr_scanned');
      } else {
        setOcrStatus('failed');
        showNotification('error', result.error || 'Nhận diện mã sản phẩm thất bại');
      }
    } catch (err) {
      setOcrStatus('failed');
      showNotification('error', 'Lỗi phân tích OCR');
    }
  };

  const simulateOCR = async (code: string = 'e120.30') => {
    setOcrStatus('loading');
    // Simulate slight delay
    await new Promise(r => setTimeout(r, 1200));
    setScannedProductCode(code);
    setOcrConfidence(95.4);
    setOcrStatus('success');
    
    // Find current location
    const curLoc = await getProductCurrentLocation(code);
    setScannedProductCurrentLoc(curLoc ? curLoc.location_id : null);
    setMovementStep('ocr_scanned');
    showNotification('success', 'Giả lập OCR thành công: ' + code);
  };

  const startMovementFlow = async () => {
    if (!scannedProductCode) return;
    setIsLoading(true);
    try {
      const code = scannedProductCode.trim().toLowerCase();
      // Start movement in DB
      await startProductMovement(code, scannedProductCurrentLoc, ocrConfidence);
      setActiveMovingProduct({
        code,
        from: scannedProductCurrentLoc
      });
      setMovementStep('move_started');
      showNotification('success', `Đã bắt đầu di chuyển mã sản phẩm ${code}`);
      loadData();
    } catch (e) {
      showNotification('error', 'Không thể ghi nhận bắt đầu di chuyển');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick action from dashboard started movements
  const continueStartedMovement = (m: ProductLocationMovement) => {
    setActiveMovingProduct({
      code: m.product_code,
      from: m.from_location_id
    });
    setScannedProductCode(m.product_code);
    setScannedProductCurrentLoc(m.from_location_id);
    setOcrConfidence(m.ocr_confidence);
    setMovementStep('move_started');
    setActiveTab('scanner');
  };

  // --- QR Reader Operations ---
  const startCameraQrScanner = async () => {
    setIsQrScannerActive(true);
    // Wait for DOM node rendering
    setTimeout(async () => {
      try {
        const html5Qrcode = new Html5Qrcode('qr-reader');
        qrScannerRef.current = html5Qrcode;
        await html5Qrcode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (qrText) => {
            // Success scanning QR
            await handleQrScanResult(qrText);
          },
          () => {
            // Quiet fail during stream
          }
        );
      } catch (err) {
        console.error('Camera scanner error:', err);
        showNotification('error', 'Không thể khởi động camera quét QR');
        setIsQrScannerActive(false);
      }
    }, 100);
  };

  const stopCameraQrScanner = async () => {
    if (qrScannerRef.current) {
      try {
        await qrScannerRef.current.stop();
      } catch (e) {}
      qrScannerRef.current = null;
    }
    setIsQrScannerActive(false);
  };

  const handleQrScanResult = async (rawText: string) => {
    const parseRes = parseQRPayload(rawText);
    if (!parseRes.isValid || !parseRes.locationId) {
      showNotification('error', 'Mã QR không đúng định dạng vị trí kho: WAREHOUSE_LOCATION:<code_kho>');
      return;
    }
    
    await stopCameraQrScanner();
    await finalizeProductMovement(parseRes.locationId);
  };

  const simulateQrScan = async (targetLocId: string) => {
    await finalizeProductMovement(targetLocId);
  };

  const finalizeProductMovement = async (toLocId: string) => {
    if (!activeMovingProduct) return;
    
    // Check if location exists
    const locExists = allLocations.some(l => l.id === toLocId);
    if (!locExists) {
      showNotification('error', `Vị trí kho ${toLocId} không tồn tại trong hệ thống!`);
      return;
    }

    setIsLoading(true);
    try {
      const gps = await getCoordinates();
      await completeProductMovement(
        activeMovingProduct.code,
        toLocId,
        gps ? gps.lat : null,
        gps ? gps.lng : null,
        'Nhân viên kho'
      );
      
      setMovementStep('completed');
      showNotification('success', `Đã chuyển ${activeMovingProduct.code} đến ${toLocId} thành công!`);
      loadData();
    } catch (e) {
      showNotification('error', 'Lỗi hoàn thành di chuyển sản phẩm');
    } finally {
      setIsLoading(false);
    }
  };

  const resetScannerFlow = () => {
    setOcrPreviewUrl(null);
    setOcrConfidence(null);
    setScannedProductCode('');
    setScannedProductCurrentLoc(null);
    setMovementStep('idle');
    setActiveMovingProduct(null);
    setManualLocationInput('');
  };

  // --- Maps Operations ---
  const handleCellClick = (locId: string) => {
    const locationObj = allLocations.find(l => l.id === locId);
    if (!locationObj) return;

    const prodMapping = currentLocations.find(c => c.location_id === locId);
    const cellHistory = movementsHistory.filter(h => h.from_location_id === locId || h.to_location_id === locId);
    
    setSelectedCellInfo({
      locationId: locId,
      product: prodMapping ? prodMapping.product_code : null,
      history: cellHistory
    });
  };

  const handleAddWarehouseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { id, name, type, columns, rows } = newWarehouseForm;
    if (!id || !name) {
      showNotification('error', 'Vui lòng điền mã và tên kho');
      return;
    }

    setIsLoading(true);
    try {
      await createCustomWarehouse(
        id.toUpperCase().trim(),
        name.trim(),
        Number(columns),
        Number(rows),
        type
      );
      showNotification('success', `Đã tạo thành công kho ${name}`);
      setIsAddWarehouseModalOpen(false);
      setSelectedWarehouseId(id.toUpperCase());
      loadData();
    } catch (err: any) {
      showNotification('error', 'Lỗi tạo kho mới: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Search Operations ---
  const triggerSearch = () => {
    if (!searchQuery) return;
    const query = searchQuery.trim().toLowerCase();
    
    // Find current location
    const curLoc = currentLocations.find(c => c.product_code === query);
    const historyLogs = movementsHistory.filter(m => m.product_code === query);
    
    if (curLoc && curLoc.location_id) {
      const locDetail = allLocations.find(l => l.id === curLoc.location_id);
      const wh = warehouses.find(w => w.id === locDetail?.warehouse_id);
      
      setSearchResult({
        productCode: query,
        currentLocation: curLoc.location_id,
        history: historyLogs,
        warehouse: wh || null,
        locationDetail: locDetail || null
      });
      
      // Auto-set the active warehouse tab so they can see it highlighted!
      if (wh) {
        setSelectedWarehouseId(wh.id);
      }
    } else {
      setSearchResult({
        productCode: query,
        currentLocation: null,
        history: historyLogs,
        warehouse: null,
        locationDetail: null
      });
      if (historyLogs.length === 0) {
        showNotification('info', `Không tìm thấy thông tin của sản phẩm ${query}`);
      }
    }
  };

  // --- Settings & Database Operations ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      saveSupabaseConfig(settingsForm.url, settingsForm.key);
      showNotification('success', 'Đã lưu cấu hình. Đang kết nối thử...');
      await loadData();
      showNotification('success', 'Đã đồng bộ thành công với Supabase!');
    } catch (e: any) {
      showNotification('error', 'Cấu hình Supabase không khả dụng: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSettings = async () => {
    clearSupabaseConfig();
    showNotification('info', 'Đã ngắt kết nối Supabase, chuyển về Local Database');
    await loadData();
  };

  const handleResetLocalDb = async () => {
    if (window.confirm('Bạn có chắc chắn muốn khôi phục dữ liệu gốc? Việc này sẽ xóa toàn bộ các sản phẩm đã di chuyển mới.')) {
      initializeSeed(true);
      showNotification('success', 'Đã reset cơ sở dữ liệu nội bộ');
      await loadData();
    }
  };

  const handleManualSync = async () => {
    setIsLoading(true);
    try {
      const res = await syncOfflineQueue();
      if (res.success) {
        showNotification('success', `Đồng bộ thành công ${res.count} hành động!`);
      } else {
        showNotification('error', `Đồng bộ thất bại: ${res.errors.join(', ')}`);
      }
      await loadData();
    } catch (err: any) {
      showNotification('error', 'Lỗi đồng bộ ngoại tuyến: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper renderer for selected warehouse layout
  const renderWarehouseLayout = () => {
    const wh = warehouses.find(w => w.id === selectedWarehouseId);
    if (!wh) return <div className="text-muted">Không tìm thấy thông tin kho.</div>;

    const locs = allLocations.filter(l => l.warehouse_id === selectedWarehouseId);
    
    if (wh.type === 'grid') {
      // Sort locations by row (A, B, C...) then column
      // To properly render a grid, we align row_index on the Y-axis and column_index on the X-axis
      const gridCells: React.ReactNode[] = [];
      const totalRows = wh.rows;
      const totalCols = wh.columns;

      for (let r = 0; r < totalRows; r++) {
        for (let c = 0; c < totalCols; c++) {
          const location = locs.find(l => l.row_index === r && l.column_index === c);
          if (!location) continue;

          // Find if there is a product currently in this cell
          const productAtLoc = currentLocations.find(cl => cl.location_id === location.id);
          const isHighlighted = searchResult && searchResult.currentLocation === location.id;
          const isSelected = selectedCellInfo && selectedCellInfo.locationId === location.id;

          gridCells.push(
            <div
              key={location.id}
              className={`grid-cell ${isHighlighted ? 'highlighted' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => handleCellClick(location.id)}
            >
              <span className="cell-code">{location.code}</span>
              {productAtLoc ? (
                <span className="cell-badge">{productAtLoc.product_code}</span>
              ) : (
                <span className="text-muted" style={{ fontSize: '0.65rem' }}>Trống</span>
              )}
            </div>
          );
        }
      }

      return (
        <div
          className={`grid-layout ${wh.id}-theme`}
          style={{ gridTemplateColumns: `repeat(${wh.columns}, 1fr)` }}
        >
          {gridCells}
        </div>
      );
    } else {
      // Rendering Aisles layout
      return (
        <div className={`aisles-layout ${wh.id}-theme`}>
          {locs.map(location => {
            const productAtLoc = currentLocations.find(cl => cl.location_id === location.id);
            const isHighlighted = searchResult && searchResult.currentLocation === location.id;
            const isSelected = selectedCellInfo && selectedCellInfo.locationId === location.id;

            return (
              <div
                key={location.id}
                className={`aisle-row ${isHighlighted ? 'highlighted' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => handleCellClick(location.id)}
              >
                <div className="aisle-info">
                  <div className="aisle-icon">
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="aisle-name">Lối đi {location.code}</div>
                    <div className="text-muted" style={{ fontSize: '0.8rem' }}>Mã QR: {location.qr_payload}</div>
                  </div>
                </div>
                <div>
                  {productAtLoc ? (
                    <span className="badge badge-completed">{productAtLoc.product_code}</span>
                  ) : (
                    <span className="text-muted">Trống</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon">K</div>
          <div>
            <h1 className="brand-name">KhoPWA</h1>
            <span className="text-muted" style={{ fontSize: '0.7rem' }}>Mobile Warehouse ERP</span>
          </div>
        </div>
        
        <div className="flex-center gap-sm">
          {isDbOnline ? (
            <span className="badge badge-completed flex-center gap-sm" style={{ padding: '4px 10px' }}>
              <Database size={12} /> Supabase Online
            </span>
          ) : (
            <span className="badge badge-started flex-center gap-sm" style={{ padding: '4px 10px' }}>
              <Database size={12} /> Local Storage
            </span>
          )}

          <button
            className="btn btn-secondary flex-center gap-sm"
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
            onClick={() => { setPartitionInitialWarehouseId(undefined); setIsPartitionModalOpen(true); }}
            title="Phân chia lại ô kệ hoặc bốc ô sang kho khác"
          >
            <Grid size={15} /> Chia lại ô
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

      {/* Navigation (Sidebar on Desktop, bottom bar on Mobile) */}
      <nav className="nav-menu">
        <div className="nav-menu-header hidden md:flex" style={{ display: 'none' }}>
          {/* Only shown on desktop sidebars */}
        </div>

        <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <LayoutDashboard />
          <span>Dashboard</span>
        </button>
        
        <button className={`nav-item ${activeTab === 'scanner' ? 'active' : ''}`} onClick={() => { setActiveTab('scanner'); stopCameraQrScanner(); }}>
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

      {/* Main Content View */}
      <main className="main-content">
        {/* Floating Notification */}
        {notification && (
          <div
            className="glass-card"
            style={{
              position: 'fixed',
              top: '80px',
              right: '20px',
              zIndex: 100,
              padding: '12px 20px',
              marginBottom: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              borderColor: notification.type === 'error' ? 'var(--color-danger)' : notification.type === 'success' ? 'var(--color-success)' : 'var(--color-primary)',
              background: 'rgba(15, 23, 42, 0.9)'
            }}
          >
            {notification.type === 'error' && <XCircle className="text-danger" />}
            {notification.type === 'success' && <CheckCircle className="text-success" />}
            {notification.type === 'info' && <Info className="text-primary" />}
            <span>{notification.message}</span>
          </div>
        )}

        {/* SCREEN: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div>
            <h2 className="screen-title"><LayoutDashboard /> Dashboard</h2>
            
            {/* Quick Stats Grid */}
            <div className="stats-grid">
              <div className="glass-card stat-card">
                <div className="stat-icon bg-blue-glow">
                  <FileText size={22} />
                </div>
                <div className="stat-value">{currentLocations.length}</div>
                <div className="stat-label">Sản phẩm lưu kho</div>
              </div>

              <div className="glass-card stat-card">
                <div className="stat-icon bg-amber-glow">
                  <RefreshCw size={22} className={activeMovements.length > 0 ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} />
                </div>
                <div className="stat-value">{activeMovements.length}</div>
                <div className="stat-label">Đang di chuyển</div>
              </div>

              <div className="glass-card stat-card">
                <div className="stat-icon bg-pink-glow">
                  <MapIcon size={22} />
                </div>
                <div className="stat-value">{warehouses.length}</div>
                <div className="stat-label">Kho hàng</div>
              </div>

              <div className="glass-card stat-card">
                <div className="stat-icon bg-green-glow">
                  <RefreshCw size={22} />
                </div>
                <div className="stat-value">{syncOutbox.length}</div>
                <div className="stat-label">Chờ đồng bộ</div>
              </div>
            </div>

            {/* Offline sync banner */}
            {syncOutbox.length > 0 && (
              <div className="glass-card flex-center justify-between" style={{ borderColor: 'var(--color-warning)', padding: '16px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <AlertCircle className="text-warning" />
                  <div>
                    <h4 style={{ fontWeight: 600 }}>Dữ liệu ngoại tuyến chưa đồng bộ</h4>
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>Có {syncOutbox.length} hành động di chuyển đang chờ được đẩy lên Supabase.</p>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleManualSync} disabled={isLoading}>
                  <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Đồng bộ ngay
                </button>
              </div>
            )}

            {/* Active movements in progress section */}
            <div className="glass-card">
              <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', fontWeight: 600 }}>Yêu cầu di chuyển dở dang</h3>
              {activeMovements.length === 0 ? (
                <div className="text-muted text-center" style={{ padding: '24px 0' }}>
                  Không có yêu cầu di chuyển nào đang diễn ra.
                </div>
              ) : (
                <div>
                  {activeMovements.map(m => (
                    <div key={m.id} className="log-item" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="log-icon-box bg-amber-glow">
                        <RefreshCw size={18} />
                      </div>
                      <div className="log-details">
                        <div className="log-header">
                          <span className="log-title">Sản phẩm: {m.product_code}</span>
                          <span className="badge badge-started">Chờ quét QR đích</span>
                        </div>
                        <div className="log-meta">
                          <span>Từ vị trí: <strong style={{ color: '#fff' }}>{m.from_location_id || 'Nhập kho'}</strong></span>
                          <span>Bắt đầu: {new Date(m.created_at).toLocaleString('vi-VN')}</span>
                          {m.ocr_confidence && <span>Độ tin cậy OCR: {m.ocr_confidence}%</span>}
                        </div>
                      </div>
                      <button
                        className="btn btn-primary"
                        style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => continueStartedMovement(m)}
                      >
                        Tiếp tục di chuyển
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions Dashboard panel */}
            <div className="glass-card">
              <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', fontWeight: 600 }}>Thao tác nhanh</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <button className="btn btn-primary" onClick={() => { setActiveTab('scanner'); resetScannerFlow(); }}>
                  <QrCode size={18} /> Bắt đầu Move mới
                </button>
                <button className="btn btn-secondary" onClick={() => setActiveTab('maps')}>
                  <MapIcon size={18} /> Xem bản đồ
                </button>
                <button className="btn btn-secondary" onClick={() => { setPrintInitialWarehouseId(undefined); setIsPrintModalOpen(true); }}>
                  <Printer size={18} /> In mã QR dán kệ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN: SCANNER / MOVE */}
        {activeTab === 'scanner' && (
          <div>
            <h2 className="screen-title"><QrCode /> Tiến trình Di chuyển Sản phẩm</h2>
            
            {/* Step indicators */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', position: 'relative' }}>
              <div style={{ flex: 1, textAlign: 'center', opacity: movementStep === 'idle' ? 1 : 0.6 }}>
                <div className="badge flex-center bg-blue-glow" style={{ width: '30px', height: '30px', margin: '0 auto 8px', borderRadius: '50%' }}>1</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>OCR Nhãn</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', opacity: movementStep === 'ocr_scanned' ? 1 : 0.6 }}>
                <div className="badge flex-center bg-blue-glow" style={{ width: '30px', height: '30px', margin: '0 auto 8px', borderRadius: '50%' }}>2</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>Xác nhận Move</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', opacity: movementStep === 'move_started' ? 1 : 0.6 }}>
                <div className="badge flex-center bg-blue-glow" style={{ width: '30px', height: '30px', margin: '0 auto 8px', borderRadius: '50%' }}>3</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>Quét QR Đích</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', opacity: movementStep === 'completed' ? 1 : 0.6 }}>
                <div className="badge flex-center bg-blue-glow" style={{ width: '30px', height: '30px', margin: '0 auto 8px', borderRadius: '50%' }}>4</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>Hoàn thành</div>
              </div>
            </div>

            {/* STEP 1: CHOOSE OCR METHOD OR SIMULATION */}
            {movementStep === 'idle' && (
              <div className="glass-card">
                <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 600 }}>Quét mã vạch/mã viết tay sản phẩm</h3>
                
                {/* Simulated file upload input for OCR */}
                <div
                  className="ocr-scanner-box"
                  onClick={() => document.getElementById('ocr-file-input')?.click()}
                >
                  <Upload size={32} style={{ marginBottom: '12px', color: 'var(--text-muted)' }} />
                  <p style={{ fontWeight: 600 }}>Tải ảnh nhãn sản phẩm lên</p>
                  <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>Nhấn để chọn ảnh từ máy hoặc chụp trực tiếp</p>
                  
                  <input
                    type="file"
                    id="ocr-file-input"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={handleOcrFileChange}
                  />
                </div>

                <div style={{ margin: '20px 0', textAlign: 'center' }} className="text-muted">Hoặc</div>

                {/* Developer instant simulation list */}
                <div>
                  <span className="input-label">Giả lập nhanh cho nhà phát triển (Click chọn mã):</span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                    <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 12px' }} onClick={() => simulateOCR('e120.30')}>
                      e120.30
                    </button>
                    <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 12px' }} onClick={() => simulateOCR('p500.45')}>
                      p500.45
                    </button>
                    <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 12px' }} onClick={() => simulateOCR('a100.99')}>
                      a100.99
                    </button>
                    <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 12px' }} onClick={() => simulateOCR('t999.99')}>
                      Mã mới (t999.99)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* OCR PROCESSING LOADING */}
            {ocrStatus === 'loading' && (
              <div className="glass-card text-center" style={{ padding: '40px 20px' }}>
                <RefreshCw size={40} className="animate-spin text-primary" style={{ marginBottom: '16px' }} />
                <h4 style={{ fontWeight: 600 }}>Tesseract OCR đang quét hình ảnh...</h4>
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>Quá trình chạy hoàn toàn offline trên trình duyệt của thiết bị di động.</p>
              </div>
            )}

            {/* STEP 2: CONFIRM SCANNED OCR CODE */}
            {movementStep === 'ocr_scanned' && (
              <div className="glass-card">
                <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 600 }}>Xác nhận mã sản phẩm</h3>
                
                {ocrPreviewUrl && (
                  <img src={ocrPreviewUrl} alt="Nhãn đã chụp" className="scanned-image-preview" />
                )}

                <div className="input-group">
                  <label className="input-label">Mã nhận diện (Kiểm tra lại và sửa nếu cần):</label>
                  <input
                    type="text"
                    className="form-input"
                    value={scannedProductCode}
                    onChange={(e) => setScannedProductCode(e.target.value)}
                  />
                  {ocrConfidence && (
                    <span className="text-muted" style={{ fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                      Độ tin cậy của thuật toán OCR: <strong style={{ color: 'var(--color-success)' }}>{ocrConfidence.toFixed(1)}%</strong>
                    </span>
                  )}
                </div>

                <div className="input-group" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <span className="input-label">Vị trí hiện tại được lưu trong hệ thống:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <MapPin size={16} className="text-primary" />
                    <strong>{scannedProductCurrentLoc ? `Kho ${scannedProductCurrentLoc}` : 'Không xác định / Nhập kho mới'}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button className="btn btn-secondary" onClick={resetScannerFlow}>Hủy bỏ</button>
                  <button className="btn btn-primary" onClick={startMovementFlow} disabled={isLoading}>
                    Bắt đầu Di chuyển <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: PERFORM MOVEMENT & SCAN QR CODE FOR DESTINATION */}
            {movementStep === 'move_started' && activeMovingProduct && (
              <div>
                <div className="glass-card" style={{ borderColor: 'var(--color-warning)' }}>
                  <h3 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw className="animate-spin text-warning" size={20} /> Đang di chuyển sản phẩm
                  </h3>
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>Hãy mang sản phẩm đến vị trí kho mới và quét mã QR cố định ở đó để hoàn thành.</p>
                  
                  <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.9rem' }}>
                    <div>Mã sản phẩm: <strong>{activeMovingProduct.code}</strong></div>
                    <div>Từ vị trí: <strong>{activeMovingProduct.from || 'Nhập kho'}</strong></div>
                  </div>
                </div>

                {/* QR CAMERA SCANNER */}
                <div className="glass-card">
                  <h4 style={{ marginBottom: '12px', fontWeight: 600 }}>Quét mã QR vị trí bằng Camera:</h4>
                  
                  {!isQrScannerActive ? (
                    <button className="btn btn-primary flex-center gap-sm" onClick={startCameraQrScanner}>
                      <Camera size={18} /> Khởi động Camera quét QR
                    </button>
                  ) : (
                    <div>
                      <div className="qr-scanner-container">
                        <div id="qr-reader"></div>
                        <div className="scanning-line"></div>
                      </div>
                      <button className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={stopCameraQrScanner}>
                        Dừng Camera
                      </button>
                    </div>
                  )}
                </div>

                {/* SIMULATE SCANNING */}
                <div className="glass-card">
                  <h4 style={{ marginBottom: '12px', fontWeight: 600 }}>Hoặc Giả lập quét QR (Chọn kệ đích):</h4>
                  
                  <div className="input-group">
                    <label className="input-label">Chọn vị trí kệ kho thực tế:</label>
                    <select
                      className="form-input"
                      value={manualLocationInput}
                      onChange={(e) => setManualLocationInput(e.target.value)}
                    >
                      <option value="">-- Chọn vị trí kệ kho --</option>
                      {warehouses.map(w => (
                        <optgroup key={w.id} label={`${w.name} (${w.type})`}>
                          {allLocations
                            .filter(l => l.warehouse_id === w.id)
                            .map(l => (
                              <option key={l.id} value={l.id}>{l.id}</option>
                            ))
                          }
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <button
                    className="btn btn-success"
                    onClick={() => simulateQrScan(manualLocationInput)}
                    disabled={!manualLocationInput || isLoading}
                  >
                    Xác nhận giả lập quét QR kệ {manualLocationInput}
                  </button>
                </div>

                <button className="btn btn-secondary" style={{ marginTop: '10px' }} onClick={resetScannerFlow}>
                  Hủy yêu cầu di chuyển này
                </button>
              </div>
            )}

            {/* STEP 4: SUCCESS COMPLETED */}
            {movementStep === 'completed' && (
              <div className="glass-card text-center" style={{ padding: '32px 20px', borderColor: 'var(--color-success)' }}>
                <CheckCircle className="text-success" size={56} style={{ margin: '0 auto 16px' }} />
                <h3 style={{ fontWeight: 700, marginBottom: '8px' }}>Di chuyển Hoàn tất!</h3>
                <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '24px' }}>
                  Thông tin di chuyển, toạ độ định vị GPS và độ tin cậy OCR đã được lưu trữ thành công vào hệ thống.
                </p>
                
                <button className="btn btn-primary" onClick={resetScannerFlow}>
                  Di chuyển sản phẩm khác
                </button>
              </div>
            )}
          </div>
        )}

        {/* SCREEN: WAREHOUSE MAPS */}
        {activeTab === 'maps' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h2 className="screen-title" style={{ marginBottom: 0 }}><MapIcon /> Sơ đồ Kho hàng</h2>
                
                {/* Switch between Satellite overlay and 2D Grid view */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', padding: '3px', borderRadius: 'var(--radius-sm)' }}>
                  <button
                    className={`btn ${mapDisplayMode === 'satellite' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '4px 12px', fontSize: '0.78rem', width: 'auto' }}
                    onClick={() => setMapDisplayMode('satellite')}
                  >
                    🛰️ Vệ tinh thực địa
                  </button>
                  <button
                    className={`btn ${mapDisplayMode === '2d' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '4px 12px', fontSize: '0.78rem', width: 'auto' }}
                    onClick={() => setMapDisplayMode('2d')}
                  >
                    📐 Bàn cờ 2D
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ width: 'auto' }}
                  onClick={() => { setPrintInitialWarehouseId(selectedWarehouseId); setIsPrintModalOpen(true); }}
                >
                  <Printer size={16} /> In mã QR kệ
                </button>
                <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setIsAddWarehouseModalOpen(true)}>
                  <Plus size={16} /> Tạo Kho mới (K5...)
                </button>
              </div>
            </div>

            {/* SATELLITE MAP VIEW (DRAWN DIRECTLY OVER SATELLITE IMAGERY) */}
            {mapDisplayMode === 'satellite' ? (
              <WarehouseSatelliteMap
                warehouses={warehouses}
                allLocations={allLocations}
                currentLocations={currentLocations}
                movementsHistory={movementsHistory}
                onSelectLocation={(locId) => handleCellClick(locId)}
                selectedLocationId={selectedCellInfo?.locationId}
                highlightProductCode={searchResult?.productCode}
                onOpenPartitionModal={(whId) => {
                  setPartitionInitialWarehouseId(whId);
                  setIsPartitionModalOpen(true);
                }}
                onDataChanged={loadData}
              />
            ) : (
              /* TRADITIONAL 2D GRID VIEW */
              <div>
                {/* Warehouse tabs */}
                <div className="map-controls">
                  {warehouses.map(w => (
                    <button
                      key={w.id}
                      className={`map-tab ${selectedWarehouseId === w.id ? 'active' : ''}`}
                      onClick={() => { setSelectedWarehouseId(w.id); setSelectedCellInfo(null); }}
                    >
                      {w.name}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', alignItems: 'start' }}>
                  {/* Map grid renderer */}
                  <div className="glass-card" style={{ flex: 1 }}>
                    <div className="warehouse-meta-info">
                      <span>Kho: <strong>{warehouses.find(w => w.id === selectedWarehouseId)?.name}</strong></span>
                      <span>Kiểu kệ: <strong>{warehouses.find(w => w.id === selectedWarehouseId)?.type === 'grid' ? 'Grid Ô/Cột' : 'Aisle Lối đi'}</strong></span>
                    </div>
                    
                    {renderWarehouseLayout()}
                    
                    <p className="text-muted" style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: '12px' }}>
                      * Nhấp chuột vào bất kỳ ô vị trí kệ nào để xem lịch sử log di chuyển và chi tiết kệ.
                    </p>
                  </div>

                  {/* Cell Side Details Info Panel */}
                  {selectedCellInfo && (
                    <div className="glass-card">
                      <h3 style={{ marginBottom: '12px', fontSize: '1.15rem', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
                        Kệ hàng: {selectedCellInfo.locationId}
                      </h3>
                      
                      <div className="input-group" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                        <span className="input-label">Sản phẩm hiện đang lưu tại đây:</span>
                        <strong style={{ fontSize: '1.1rem', color: selectedCellInfo.product ? 'var(--color-success)' : 'var(--text-muted)' }}>
                          {selectedCellInfo.product || 'Trống'}
                        </strong>
                      </div>

                      <h4 style={{ margin: '18px 0 10px', fontSize: '0.95rem', fontWeight: 600 }}>Lịch sử giao dịch tại kệ:</h4>
                      {selectedCellInfo.history.length === 0 ? (
                        <div className="text-muted" style={{ fontSize: '0.85rem' }}>Chưa có giao dịch di chuyển nào liên quan đến kệ này.</div>
                      ) : (
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {selectedCellInfo.history.map(h => (
                            <div key={h.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.8rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Sản phẩm: <strong>{h.product_code}</strong></span>
                                <span className={h.status === 'completed' ? 'text-success' : 'text-warning'}>
                                  {h.status === 'completed' ? 'Hoàn thành' : 'Đang chuyển'}
                                </span>
                              </div>
                              <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                                {h.from_location_id === selectedCellInfo.locationId ? 'Chuyển đi' : 'Chuyển đến'} | {new Date(h.created_at).toLocaleString('vi-VN')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CREATE CUSTOM WAREHOUSE MODAL */}
            {isAddWarehouseModalOpen && (
              <div className="modal-overlay" onClick={() => setIsAddWarehouseModalOpen(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3 style={{ fontWeight: 700 }}>Tạo Kho hàng Mới</h3>
                    <button className="modal-close" onClick={() => setIsAddWarehouseModalOpen(false)}>
                      <XCircle size={22} />
                    </button>
                  </div>
                  
                  <form onSubmit={handleAddWarehouseSubmit}>
                    <div className="modal-body">
                      <div className="input-group">
                        <label className="input-label">Mã Kho (Ví dụ: K5, KV2):</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Mã kho viết tắt..."
                          required
                          value={newWarehouseForm.id}
                          onChange={(e) => setNewWarehouseForm({ ...newWarehouseForm, id: e.target.value })}
                        />
                      </div>

                      <div className="input-group">
                        <label className="input-label">Tên Kho (Ví dụ: K5 Purple):</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Tên đầy đủ của kho..."
                          required
                          value={newWarehouseForm.name}
                          onChange={(e) => setNewWarehouseForm({ ...newWarehouseForm, name: e.target.value })}
                        />
                      </div>

                      <div className="input-group">
                        <label className="input-label">Kiểu cách kệ hàng:</label>
                        <select
                          className="form-input"
                          value={newWarehouseForm.type}
                          onChange={(e) => setNewWarehouseForm({ ...newWarehouseForm, type: e.target.value as 'grid' | 'aisle' })}
                        >
                          <option value="grid">Grid (Bàn cờ Ô Dòng x Cột)</option>
                          <option value="aisle">Aisles (Các lối đi dài song song)</option>
                        </select>
                      </div>

                      {newWarehouseForm.type === 'grid' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="input-group">
                            <label className="input-label">Số Cột (Trục X):</label>
                            <input
                              type="number"
                              className="form-input"
                              min="1"
                              max="10"
                              required
                              value={newWarehouseForm.columns}
                              onChange={(e) => setNewWarehouseForm({ ...newWarehouseForm, columns: Number(e.target.value) })}
                            />
                          </div>

                          <div className="input-group">
                            <label className="input-label">Số Hàng Dòng (Trục Y):</label>
                            <input
                              type="number"
                              className="form-input"
                              min="1"
                              max="10"
                              required
                              value={newWarehouseForm.rows}
                              onChange={(e) => setNewWarehouseForm({ ...newWarehouseForm, rows: Number(e.target.value) })}
                            />
                          </div>
                        </div>
                      )}

                      {newWarehouseForm.type === 'aisle' && (
                        <div className="input-group">
                          <label className="input-label">Số lối đi (Kệ song song):</label>
                          <input
                            type="number"
                            className="form-input"
                            min="1"
                            max="20"
                            required
                            value={newWarehouseForm.columns}
                            onChange={(e) => setNewWarehouseForm({ ...newWarehouseForm, columns: Number(e.target.value), rows: 1 })}
                          />
                        </div>
                      )}
                    </div>
                    
                    <div style={{ padding: '16px 20px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: '10px' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setIsAddWarehouseModalOpen(false)}>Hủy</button>
                      <button type="submit" className="btn btn-primary" disabled={isLoading}>Tạo Kho & Kệ</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCREEN: SEARCH PRODUCT */}
        {activeTab === 'search' && (
          <div>
            <h2 className="screen-title"><Search /> Tìm kiếm Vị trí Sản phẩm</h2>
            
            <div className="glass-card">
              <span className="input-label">Tìm theo mã sản phẩm (Ví dụ: e120.30):</span>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nhập mã sản phẩm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && triggerSearch()}
                />
                <button className="btn btn-primary" style={{ width: 'auto' }} onClick={triggerSearch}>
                  Tìm vị trí
                </button>
              </div>
            </div>

            {/* SEARCH RESULTS VIEW */}
            {searchResult && (
              <div className="search-result-box">
                <div className="glass-card" style={{ borderColor: searchResult.currentLocation ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <span className="text-muted" style={{ fontSize: '0.8rem' }}>MÃ SẢN PHẨM</span>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '2px 0 8px' }}>{searchResult.productCode}</h3>
                    </div>
                    <span className={`badge ${searchResult.currentLocation ? 'badge-completed' : 'badge-started'}`}>
                      {searchResult.currentLocation ? 'Đang lưu kho' : 'Không có vị trí kệ'}
                    </span>
                  </div>

                  <div className="input-group" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-lg)', marginTop: '12px' }}>
                    <span className="input-label">Vị trí hiện tại:</span>
                    {searchResult.currentLocation ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <MapPin className="text-success" size={20} />
                        <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                          {searchResult.currentLocation} ({searchResult.warehouse?.name})
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <XCircle className="text-danger" size={20} />
                        <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          Sản phẩm chưa được xếp kệ hoặc đã xuất kho.
                        </span>
                      </div>
                    )}
                  </div>

                  {searchResult.currentLocation && searchResult.warehouse && (
                    <div style={{ marginTop: '20px' }}>
                      <h4 style={{ fontWeight: 600, marginBottom: '10px' }}>Vị trí trực quan trên bản đồ {searchResult.warehouse.name}:</h4>
                      {renderWarehouseLayout()}
                    </div>
                  )}
                </div>

                {/* History logs specific to searched product */}
                <div className="glass-card">
                  <h4 style={{ fontWeight: 600, marginBottom: '12px' }}>Lịch sử chuyển kệ sản phẩm này:</h4>
                  {searchResult.history.length === 0 ? (
                    <div className="text-muted">Chưa có giao dịch di chuyển nào.</div>
                  ) : (
                    <div>
                      {searchResult.history.map(h => (
                        <div key={h.id} className="log-item">
                          <div className={`log-icon-box ${h.status === 'completed' ? 'bg-green-glow' : 'bg-amber-glow'}`}>
                            <MapPin size={18} />
                          </div>
                          <div className="log-details">
                            <div className="log-header">
                              <span className="log-title">
                                {h.from_location_id || 'Nhập kho'} <ArrowRight size={14} style={{ display: 'inline', margin: '0 4px' }} /> {h.to_location_id || 'Đang di chuyển'}
                              </span>
                              <span className={`badge ${h.status === 'completed' ? 'badge-completed' : 'badge-started'}`}>
                                {h.status === 'completed' ? 'Hoàn thành' : 'Đang đi'}
                              </span>
                            </div>
                            <div className="log-meta">
                              {h.user_name && <span>Nhân viên: {h.user_name}</span>}
                              <span>Thời gian: {new Date(h.created_at).toLocaleString('vi-VN')}</span>
                              {h.gps_lat && (
                                <a
                                  href={`https://www.google.com/maps?q=${h.gps_lat},${h.gps_lng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                                >
                                  <MapPin size={12} /> GPS ({h.gps_lat.toFixed(5)}, {h.gps_lng?.toFixed(5)})
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCREEN: HISTORY LOGS */}
        {activeTab === 'history' && (
          <div>
            <h2 className="screen-title"><History /> Nhật ký Giao dịch Di chuyển</h2>
            
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              {movementsHistory.length === 0 ? (
                <div className="text-muted text-center" style={{ padding: '40px 0' }}>
                  Chưa ghi nhận bất kỳ lịch sử di chuyển nào.
                </div>
              ) : (
                <div>
                  {movementsHistory.map(h => (
                    <div key={h.id} className="log-item">
                      <div className={`log-icon-box ${h.status === 'completed' ? 'bg-green-glow' : 'bg-amber-glow'}`}>
                        {h.status === 'completed' ? <CheckCircle size={18} /> : <RefreshCw size={18} className="animate-spin" style={{ animationDuration: '3s' }} />}
                      </div>
                      
                      <div className="log-details">
                        <div className="log-header">
                          <span className="log-title">Sản phẩm: <strong style={{ color: 'var(--color-primary)' }}>{h.product_code}</strong></span>
                          <span className={`badge ${h.status === 'completed' ? 'badge-completed' : 'badge-started'}`}>
                            {h.status === 'completed' ? 'Hoàn tất' : 'Bắt đầu di chuyển'}
                          </span>
                        </div>
                        
                        <div className="log-meta">
                          <span>Từ: <strong style={{ color: '#fff' }}>{h.from_location_id || 'Nhập kho'}</strong></span>
                          <span>Đến: <strong style={{ color: '#fff' }}>{h.to_location_id || 'Đang đi'}</strong></span>
                          <span>Thời gian: {new Date(h.created_at).toLocaleString('vi-VN')}</span>
                        </div>

                        <div className="log-meta" style={{ marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '4px' }}>
                          {h.user_name && <span><User size={12} /> {h.user_name}</span>}
                          {h.ocr_confidence && <span><Sparkles size={12} /> OCR: {h.ocr_confidence}%</span>}
                          {h.gps_lat && (
                            <a
                              href={`https://www.google.com/maps?q=${h.gps_lat},${h.gps_lng}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                            >
                              <MapPin size={12} /> Định vị GPS ({h.gps_lat.toFixed(5)}, {h.gps_lng?.toFixed(5)})
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
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
                    🟡 Chế độ Ngoại tuyến (Local Storage)
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
                  <span className="stat-label">Tổng số ô kệ:</span>
                  <span className="stat-value" style={{ fontSize: '1.4rem' }}>{allLocations.length}</span>
                </div>
                <div className="glass-card stat-card" style={{ padding: '12px 16px', marginBottom: 0 }}>
                  <span className="stat-label">Hàng đang lưu:</span>
                  <span className="stat-value text-success" style={{ fontSize: '1.4rem' }}>
                    {currentLocations.filter(c => c.location_id).length}
                  </span>
                </div>
                <div className="glass-card stat-card" style={{ padding: '12px 16px', marginBottom: 0 }}>
                  <span className="stat-label">Nhật ký luân chuyển:</span>
                  <span className="stat-value" style={{ fontSize: '1.4rem' }}>{movementsHistory.length}</span>
                </div>
              </div>

              <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                Hệ thống tự động đọc cấu hình từ file <code style={{ color: 'var(--color-primary)' }}>.env</code> (hoặc Vercel Environment Variables). Khi kết nối thành công, mọi thay đổi trên điện thoại hoặc máy tính đều được đồng bộ tức thì.
              </p>

              {getSupabaseConfig().isFromEnv && (
                <div className="glass-card" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle className="text-success" size={18} />
                  <span style={{ fontSize: '0.82rem', color: '#065f46' }}>
                    Đang tự động nạp cấu hình trực tiếp từ file <strong>.env</strong> trong mã nguồn!
                  </span>
                </div>
              )}

              <form onSubmit={handleSaveSettings}>
                <div className="input-group">
                  <label className="input-label">Supabase Project URL:</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://xxxxxx.supabase.co"
                    required
                    value={settingsForm.url}
                    onChange={(e) => setSettingsForm({ ...settingsForm, url: e.target.value })}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Supabase Publishable Anon Key:</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="eyJhbGciOi..."
                    required
                    value={settingsForm.key}
                    onChange={(e) => setSettingsForm({ ...settingsForm, key: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                  {isDbOnline && (
                    <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={handleClearSettings}>
                      Ngắt kết nối Supabase
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={isLoading}>
                    {isLoading ? 'Đang kết nối...' : 'Lưu & Kết nối Supabase'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-success"
                    style={{ width: 'auto' }}
                    onClick={async () => {
                      showNotification('info', 'Đang đẩy dữ liệu mẫu lên Supabase...');
                      await autoBootstrapSupabaseDatabase();
                      await loadData();
                      showNotification('success', 'Đã nạp dữ liệu kho & sản phẩm mẫu lên Supabase thành công!');
                    }}
                  >
                    ⚡ Nạp/Đẩy dữ liệu mẫu lên Supabase
                  </button>
                </div>
              </form>
            </div>

            {/* SQL Migration Script Copy Box */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                  📜 Mã SQL Khởi tạo Database (Chạy trong Supabase SQL Editor)
                </h3>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '6px 14px', fontSize: '0.82rem' }}
                  onClick={() => {
                    const sqlText = `-- Supabase Migration: 001_warehouse_schema.sql
CREATE TABLE IF NOT EXISTS public.warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    columns INTEGER NOT NULL DEFAULT 1,
    rows INTEGER NOT NULL DEFAULT 1,
    type TEXT NOT NULL DEFAULT 'grid',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.warehouse_locations (
    id TEXT PRIMARY KEY,
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    column_index INTEGER NOT NULL DEFAULT 0,
    row_index INTEGER NOT NULL DEFAULT 0,
    qr_payload TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_current_locations (
    product_code TEXT PRIMARY KEY,
    location_id TEXT REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS public.product_location_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code TEXT NOT NULL,
    from_location_id TEXT REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
    to_location_id TEXT REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('started', 'completed')),
    ocr_confidence NUMERIC,
    ocr_image_path TEXT,
    gps_lat NUMERIC,
    gps_lng NUMERIC,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.warehouse_settings (
    id TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.warehouses, public.warehouse_locations, public.product_current_locations, public.product_location_movements, public.warehouse_settings;
`;
                    navigator.clipboard.writeText(sqlText);
                    showNotification('success', 'Đã sao chép toàn bộ mã SQL vào bộ nhớ đệm (Clipboard)! Hãy dán vào SQL Editor của Supabase.');
                  }}
                >
                  📋 Sao chép mã SQL
                </button>
              </div>

              <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '10px' }}>
                💡 Nếu tạo mới một dự án trên <strong>Supabase Dashboard</strong>: Vào mục <strong>SQL Editor</strong> ➔ Tạo <strong>New query</strong> ➔ Bấm nút <em>"Sao chép mã SQL"</em> ở trên ➔ Dán vào và bấm <strong>RUN</strong>.
              </p>

              <pre style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '8px', fontSize: '0.75rem', maxHeight: '180px', overflowY: 'auto', color: '#334155' }}>
                {`CREATE TABLE IF NOT EXISTS public.warehouses (id TEXT PRIMARY KEY, name TEXT NOT NULL, columns INT, rows INT, type TEXT);
CREATE TABLE IF NOT EXISTS public.warehouse_locations (id TEXT PRIMARY KEY, warehouse_id TEXT, code TEXT, qr_payload TEXT);
CREATE TABLE IF NOT EXISTS public.product_current_locations (product_code TEXT PRIMARY KEY, location_id TEXT);
CREATE TABLE IF NOT EXISTS public.product_location_movements (id UUID PRIMARY KEY, product_code TEXT, from_location_id TEXT, to_location_id TEXT, status TEXT);
CREATE TABLE IF NOT EXISTS public.warehouse_settings (id TEXT PRIMARY KEY, value JSONB);
ALTER PUBLICATION supabase_realtime ADD TABLE public.warehouses, public.warehouse_locations, public.product_current_locations, public.product_location_movements, public.warehouse_settings;`}
              </pre>
            </div>

            {/* Offline sync diagnostics panel */}
            <div className="glass-card">
              <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', fontWeight: 600 }}>Quản lý Dữ liệu Ngoại tuyến (Offline Queue)</h3>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                Nếu thiết bị của bạn bị mất mạng trong lúc di chuyển sản phẩm, giao dịch sẽ được đưa vào hàng đợi offline và tự động đẩy lên máy chủ khi có mạng trở lại.
              </p>
              
              <div className="input-group" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className="input-label" style={{ marginBottom: 0 }}>Giao dịch đang xếp hàng:</span>
                  <strong>{syncOutbox.length} giao dịch chờ gửi</strong>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: 'auto' }}
                  onClick={handleManualSync}
                  disabled={syncOutbox.length === 0 || isLoading || !isDbOnline}
                >
                  Đẩy đồng bộ ngay
                </button>
              </div>
            </div>

            {/* Reset mock database */}
            <div className="glass-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
              <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', fontWeight: 600, color: 'var(--color-danger)' }}>Xóa dữ liệu & Reset hệ thống</h3>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                Xóa sạch dữ liệu đã lưu trong Local Storage của trình duyệt và nạp lại dữ liệu 4 kho ban đầu (K1-K4) để bắt đầu kiểm thử từ đầu.
              </p>
              
              <button className="btn btn-secondary" style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)', width: 'auto' }} onClick={handleResetLocalDb}>
                Reset dữ liệu Local
              </button>
            </div>
          </div>
        )}
      </main>

      {/* QR PRINT MANAGER MODAL (Available globally on any tab) */}
      {isPrintModalOpen && (
        <QRPrintManager
          warehouses={warehouses}
          allLocations={allLocations}
          onClose={() => setIsPrintModalOpen(false)}
          initialWarehouseId={printInitialWarehouseId}
        />
      )}

      {/* WAREHOUSE PARTITION & SLOT TRANSFER MANAGER MODAL */}
      {isPartitionModalOpen && (
        <WarehousePartitionManager
          isOpen={isPartitionModalOpen}
          onClose={() => setIsPartitionModalOpen(false)}
          warehouses={warehouses}
          allLocations={allLocations}
          currentLocations={currentLocations}
          initialWarehouseId={partitionInitialWarehouseId}
          onDataChanged={loadData}
        />
      )}
    </div>
  );
}

export default App;
