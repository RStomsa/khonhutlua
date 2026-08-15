import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  ArrowRightLeft,
  Check,
  LayoutGrid,
  Save,
  Grid,
  Edit2,
  Sparkles
} from 'lucide-react';
import type {
  Warehouse,
  WarehouseZone,
  WarehouseLocation,
  Product,
  ProductCurrentLocation
} from '../lib/database';
import {
  createWarehouseLocation,
  deleteWarehouseLocation,
  executeProductMovement,
  updateWarehouse,
  repartitionWarehouseGrid
} from '../lib/database';

interface WarehousePartitionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  zones?: WarehouseZone[];
  allLocations: WarehouseLocation[];
  products?: Product[];
  currentLocations: ProductCurrentLocation[];
  initialWarehouseId?: string;
  onDataChanged: () => void;
}

export const WarehousePartitionManager: React.FC<WarehousePartitionManagerProps> = ({
  isOpen,
  onClose,
  warehouses,
  zones = [],
  allLocations,
  products = [],
  currentLocations,
  initialWarehouseId,
  onDataChanged
}) => {
  const [selectedWhId, setSelectedWhId] = useState<string>(
    initialWarehouseId || (warehouses.length > 0 ? warehouses[0].id : '')
  );

  const activeWh = warehouses.find(w => w.id === selectedWhId);

  // Edit Warehouse Info State
  const [editWhName, setEditWhName] = useState('');
  const [editWhCode, setEditWhCode] = useState('');
  const [editWhColor, setEditWhColor] = useState('#2563eb');
  const [editWhWidth, setEditWhWidth] = useState(15.0);
  const [editWhLength, setEditWhLength] = useState(20.0);

  // Auto Grid Partition State
  const [gridCols, setGridCols] = useState(3);
  const [gridRows, setGridRows] = useState(3);

  // Sync edit form with active warehouse
  useEffect(() => {
    if (activeWh) {
      setEditWhName(activeWh.name);
      setEditWhCode(activeWh.code);
      setEditWhColor(activeWh.color || '#2563eb');
      setEditWhWidth(activeWh.width_m || 15.0);
      setEditWhLength(activeWh.length_m || 20.0);

      // Default grid suggestion based on warehouse code
      if (activeWh.code === 'K1') { setGridCols(4); setGridRows(3); }
      else if (activeWh.code === 'K2') { setGridCols(3); setGridRows(3); }
      else if (activeWh.code === 'K3') { setGridCols(2); setGridRows(2); }
      else if (activeWh.code === 'K4') { setGridCols(3); setGridRows(4); }
    }
  }, [activeWh]);

  // New slot form state
  const [newSlotCode, setNewSlotCode] = useState<string>('');

  // Target warehouse state for individual transfer
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>({});
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const currentWhLocations = allLocations.filter(l => l.warehouse_id === selectedWhId);

  // Product by Location Map
  const productByLocMap = new Map<string, Product>();
  currentLocations.forEach(cur => {
    if (cur.location_id) {
      const prod = products.find(p => p.id === cur.product_id);
      if (prod) productByLocMap.set(cur.location_id, prod);
    }
  });

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 3500);
  };

  // Handle Save Warehouse Info
  const handleSaveWarehouseInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWhId || !editWhName.trim()) return;

    setIsProcessing(true);
    try {
      await updateWarehouse(selectedWhId, {
        name: editWhName.trim(),
        code: editWhCode.trim().toUpperCase(),
        color: editWhColor,
        width_m: editWhWidth,
        length_m: editWhLength
      });
      onDataChanged();
      showMsg(`Đã cập nhật thông tin [${editWhName.trim()}] thành công!`);
    } catch (err: any) {
      showMsg(err.message || 'Lỗi khi cập nhật kho', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Auto Repartition Grid
  const handleAutoRepartitionGrid = async () => {
    if (!selectedWhId) return;
    const totalSlots = gridRows * gridCols;
    if (!window.confirm(`Bạn có chắc muốn tự động chia lại Kho này thành ${gridRows} hàng × ${gridCols} cột = ${totalSlots} ô không? (Các ô cũ trong kho này sẽ được làm mới)`)) {
      return;
    }

    setIsProcessing(true);
    try {
      await repartitionWarehouseGrid(selectedWhId, gridRows, gridCols);
      onDataChanged();
      showMsg(`Đã chia lại lưới ${totalSlots} ô cho ${activeWh?.name} thành công!`);
    } catch (err: any) {
      showMsg(err.message || 'Lỗi khi chia lưới ô', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Add Single Slot
  const handleAddNewSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlotCode.trim() || !selectedWhId) return;

    setIsProcessing(true);
    try {
      await createWarehouseLocation(
        selectedWhId,
        newSlotCode.trim(),
        null
      );
      setNewSlotCode('');
      onDataChanged();
      showMsg(`Đã tạo vị trí ô mới [${newSlotCode.trim().toUpperCase()}] thành công!`);
    } catch (e: any) {
      showMsg(e.message || 'Lỗi khi thêm vị trí', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Delete Slot
  const handleDeleteSlot = async (locId: string, code: string) => {
    const product = productByLocMap.get(locId);
    if (product) {
      if (!window.confirm(`Ô ${code} đang chứa sản phẩm [${product.product_code}]. Bạn có chắc muốn xóa ô này không?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Xóa ô ${code}?`)) return;
    }

    setIsProcessing(true);
    try {
      await deleteWarehouseLocation(locId);
      onDataChanged();
      showMsg(`Đã xóa ô ${code}!`);
    } catch (e: any) {
      showMsg(e.message || 'Lỗi khi xóa vị trí', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Transfer Slot to Another Warehouse
  const handleTransferSlot = async (sourceLoc: WarehouseLocation) => {
    const targetWhId = transferTargets[sourceLoc.id];
    if (!targetWhId || targetWhId === selectedWhId) {
      alert('Vui lòng chọn kho đích khác kho hiện tại.');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Create matching location in target warehouse
      const newLoc = await createWarehouseLocation(targetWhId, sourceLoc.code);

      // 2. If a product was stored, execute movement to the new location
      const product = productByLocMap.get(sourceLoc.id);
      if (product) {
        await executeProductMovement(
          product.id,
          newLoc.id,
          'Transfer Admin',
          `TRANSFER_${product.id}_${newLoc.id}_${Date.now()}`
        );
      }

      // 3. Delete old location
      await deleteWarehouseLocation(sourceLoc.id);

      onDataChanged();
      showMsg(`Đã chuyển toàn bộ ô ${sourceLoc.code} sang kho đích thành công!`);
    } catch (e: any) {
      showMsg(e.message || 'Lỗi khi chuyển ô', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="partition-modal-overlay">
      <div className="partition-modal-container glass-card animate-fade-in" style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="partition-header">
          <div className="header-left">
            <div className="header-icon-box">
              <LayoutGrid size={22} className="text-primary" />
            </div>
            <div>
              <h3 className="header-title">Quản Lý Tên Kho, Kích Thước & Phân Chia Lưới Ô</h3>
              <p className="header-sub">Chỉnh sửa tên kho, chia số lượng ô riêng biệt theo hàng & cột cho từng kho</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        {/* Status Toast Message */}
        {actionMessage && (
          <div className={`partition-toast ${actionMessage.type === 'error' ? 'toast-error' : 'toast-success'} animate-fade-in`}>
            {actionMessage.type === 'success' ? <Check size={16} /> : null}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Warehouse Tabs */}
        <div className="partition-wh-tabs" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '14px' }}>
          {warehouses.map(w => {
            const locCount = allLocations.filter(l => l.warehouse_id === w.id).length;
            return (
              <button
                key={w.id}
                type="button"
                className={`wh-tab-pill ${selectedWhId === w.id ? 'active' : ''}`}
                style={{
                  borderLeft: `4px solid ${w.color || '#2563eb'}`,
                  background: selectedWhId === w.id ? '#eff6ff' : '#f8fafc'
                }}
                onClick={() => setSelectedWhId(w.id)}
              >
                <strong>{w.code} - {w.name}</strong>
                <span className="pill-count" style={{ marginLeft: '6px', background: '#e2e8f0', padding: '2px 6px', borderRadius: '10px', fontSize: '0.75rem' }}>
                  {locCount} ô
                </span>
              </button>
            );
          })}
        </div>

        <div className="partition-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* TOP SECTION: EDIT WAREHOUSE INFO & AUTO GRID PARTITION */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {/* 1. Sửa Tên & Thông Tin Kho */}
            <div className="partition-control-panel glass-card" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', padding: '16px', borderRadius: '10px' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, marginBottom: '10px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Edit2 size={16} className="text-primary" /> 1. Sửa Tên & Kích Thước {activeWh?.code}
              </h4>
              <form onSubmit={handleSaveWarehouseInfo} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Tên Kho Hiển Thị:</label>
                  <input
                    type="text"
                    value={editWhName}
                    onChange={(e) => setEditWhName(e.target.value)}
                    className="form-input"
                    placeholder="VD: Kho 1 - Xưởng Lúa Nhựt Chính"
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Mã Kho:</label>
                    <input
                      type="text"
                      value={editWhCode}
                      onChange={(e) => setEditWhCode(e.target.value)}
                      className="form-input"
                      placeholder="K1"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Rộng (m):</label>
                    <input
                      type="number"
                      value={editWhWidth}
                      onChange={(e) => setEditWhWidth(parseFloat(e.target.value) || 1)}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Dài (m):</label>
                    <input
                      type="number"
                      value={editWhLength}
                      onChange={(e) => setEditWhLength(parseFloat(e.target.value) || 1)}
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Màu sắc:</label>
                    <input
                      type="color"
                      value={editWhColor}
                      onChange={(e) => setEditWhColor(e.target.value)}
                      style={{ width: '32px', height: '28px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '6px 14px', fontSize: '0.8rem' }}
                    disabled={isProcessing}
                  >
                    <Save size={14} /> Lưu Tên Kho
                  </button>
                </div>
              </form>
            </div>

            {/* 2. Tự Động Chia Lưới Ô Theo Hàng x Cột */}
            <div className="partition-control-panel glass-card" style={{ background: '#eff6ff', border: '1.5px solid #93c5fd', padding: '16px', borderRadius: '10px' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, marginBottom: '10px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} className="text-primary" /> 2. Chia Lưới Ô Tự Động Cho {activeWh?.code}
              </h4>
              <p style={{ fontSize: '0.78rem', color: '#1e3a8a', marginBottom: '10px' }}>
                Tự động tạo ma trận ô theo số hàng $\times$ số cột:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '2px', color: '#1e40af' }}>
                    Số Cột (Columns):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={gridCols}
                    onChange={(e) => setGridCols(parseInt(e.target.value) || 1)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '2px', color: '#1e40af' }}>
                    Số Hàng (Rows):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={gridRows}
                    onChange={(e) => setGridRows(parseInt(e.target.value) || 1)}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e40af' }}>
                  👉 Tổng: <strong>{gridRows * gridCols} ô vị trí</strong> ({gridRows} hàng A.. × {gridCols} cột)
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: 'auto', padding: '7px 14px', fontSize: '0.82rem', background: '#2563eb' }}
                  disabled={isProcessing}
                  onClick={handleAutoRepartitionGrid}
                >
                  <Grid size={14} /> ⚡ Tạo Lưới Ô
                </button>
              </div>
            </div>
          </div>

          {/* Create Individual Location / Zone */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {/* Create Location Panel */}
            <div className="partition-control-panel glass-card" style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '8px' }}>➕ Thêm 1 Ô Lẻ</h4>
              <form onSubmit={handleAddNewSlot} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Mã ô (VD: A05, VIP1)..."
                  value={newSlotCode}
                  onChange={(e) => setNewSlotCode(e.target.value)}
                  className="form-input"
                  required
                />
                <button
                  type="submit"
                  className="btn btn-secondary"
                  style={{ width: 'auto', whiteSpace: 'nowrap' }}
                  disabled={isProcessing || !newSlotCode.trim()}
                >
                  <Plus size={14} /> Thêm Ô
                </button>
              </form>
            </div>
          </div>

          {/* Slot Cards List / Matrix */}
          <div className="slots-container-card glass-card">
            <div className="slots-header-row">
              <h4>Danh sách {currentWhLocations.length} ô vị trí trong {activeWh?.name}</h4>
              <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                💡 Chuyển toàn bộ ô kèm sản phẩm lưu trữ sang kho khác:
              </span>
            </div>

            {currentWhLocations.length === 0 ? (
              <div className="empty-slots-box text-center" style={{ padding: '30px 0' }}>
                <p className="text-muted">Kho này chưa có ô vị trí nào. Hãy thêm vị trí ở trên.</p>
              </div>
            ) : (
              <div className="slots-grid-cards">
                {currentWhLocations.map(loc => {
                  const product = productByLocMap.get(loc.id);
                  const hasProduct = Boolean(product);
                  const selectedTargetWh = transferTargets[loc.id] || '';
                  const zone = zones.find(z => z.id === loc.zone_id);

                  return (
                    <div key={loc.id} className={`slot-item-card ${hasProduct ? 'has-product' : 'is-empty'}`}>
                      <div className="slot-card-top">
                        <div className="slot-code-badge">
                          <strong>{loc.code}</strong>
                          {zone && <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 600, display: 'block' }}>{zone.name}</span>}
                          <span className="slot-full-id">{loc.id.substring(0, 18)}...</span>
                        </div>
                        <button
                          className="btn-del-slot"
                          onClick={() => handleDeleteSlot(loc.id, loc.code)}
                          title="Xóa ô này"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className="slot-card-mid">
                        <span className="slot-prod-label">Sản phẩm lưu trữ:</span>
                        {hasProduct && product ? (
                          <div className="slot-product-pill">
                            📦 <strong>{product.product_code}</strong> ({product.length_value}{product.length_unit})
                          </div>
                        ) : (
                          <span className="slot-empty-text">Vị trí trống</span>
                        )}
                      </div>

                      {/* Transfer to another warehouse controls */}
                      <div className="slot-card-bottom">
                        <select
                          value={selectedTargetWh}
                          onChange={(e) => setTransferTargets(prev => ({ ...prev, [loc.id]: e.target.value }))}
                          className="transfer-select"
                        >
                          <option value="">Chuyển sang kho...</option>
                          {warehouses
                            .filter(w => w.id !== selectedWhId)
                            .map(w => (
                              <option key={w.id} value={w.id}>
                                Sang {w.code} ({w.name})
                              </option>
                            ))}
                        </select>

                        <button
                          type="button"
                          className="btn-transfer-action"
                          disabled={!selectedTargetWh || isProcessing}
                          onClick={() => handleTransferSlot(loc)}
                          title="Chuyển toàn bộ ô này sang kho được chọn"
                        >
                          <ArrowRightLeft size={14} /> Chuyển
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarehousePartitionManager;
