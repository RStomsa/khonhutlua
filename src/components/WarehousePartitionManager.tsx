import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  ArrowRightLeft,
  Check,
  LayoutGrid
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
  createWarehouseZone,
  executeProductMovement
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

  // New slot form state
  const [newSlotCode, setNewSlotCode] = useState<string>('');
  const [newSlotZoneId, setNewSlotZoneId] = useState<string>('');

  // New zone form state
  const [newZoneCode, setNewZoneCode] = useState<string>('');
  const [newZoneName, setNewZoneName] = useState<string>('');

  // Target warehouse state for individual transfer
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>({});
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const currentWhZones = zones.filter(z => z.warehouse_id === selectedWhId);
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

  // Handle Add Single Slot
  const handleAddNewSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlotCode.trim() || !selectedWhId) return;

    setIsProcessing(true);
    try {
      await createWarehouseLocation(
        selectedWhId,
        newSlotCode.trim(),
        newSlotZoneId || null
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

  // Handle Add Zone
  const handleAddNewZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneCode.trim() || !newZoneName.trim() || !selectedWhId) return;

    setIsProcessing(true);
    try {
      await createWarehouseZone(
        selectedWhId,
        newZoneCode.trim(),
        newZoneName.trim()
      );
      setNewZoneCode('');
      setNewZoneName('');
      onDataChanged();
      showMsg(`Đã tạo phân khu mới [${newZoneName.trim()}]!`);
    } catch (e: any) {
      showMsg(e.message || 'Lỗi khi thêm phân khu', 'error');
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
      <div className="partition-modal-container glass-card animate-fade-in">
        {/* Header */}
        <div className="partition-header">
          <div className="header-left">
            <div className="header-icon-box">
              <LayoutGrid size={22} className="text-primary" />
            </div>
            <div>
              <h3 className="header-title">Quản lý Cấu trúc Phân khu (Zones) & Ô Vị trí (Locations)</h3>
              <p className="header-sub">Thiết lập kiến trúc 3 cấp (Kho &rarr; Phân khu &rarr; Ô kệ) và chuyển dời ô lưu trữ</p>
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
        <div className="partition-wh-tabs">
          {warehouses.map(w => {
            const locCount = allLocations.filter(l => l.warehouse_id === w.id).length;
            return (
              <button
                key={w.id}
                className={`wh-tab-pill ${selectedWhId === w.id ? 'active' : ''}`}
                onClick={() => setSelectedWhId(w.id)}
              >
                <strong>{w.code} - {w.name}</strong>
                <span className="pill-count">{locCount} ô</span>
              </button>
            );
          })}
        </div>

        <div className="partition-body">
          {/* Top Control Panels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
            {/* Create Location Panel */}
            <div className="partition-control-panel glass-card">
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '10px' }}>➕ Thêm Ô Vị Trí Mới</h4>
              <form onSubmit={handleAddNewSlot} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Mã ô (VD: A04, B05, VIP1)..."
                  value={newSlotCode}
                  onChange={(e) => setNewSlotCode(e.target.value)}
                  className="form-input"
                  required
                />
                <select
                  value={newSlotZoneId}
                  onChange={(e) => setNewSlotZoneId(e.target.value)}
                  className="form-input"
                >
                  <option value="">Thuộc Phân khu (Tùy chọn)...</option>
                  {currentWhZones.map(z => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({z.code})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: 'auto', alignSelf: 'flex-start' }}
                  disabled={isProcessing || !newSlotCode.trim()}
                >
                  <Plus size={14} /> Thêm Ô
                </button>
              </form>
            </div>

            {/* Create Zone Panel */}
            <div className="partition-control-panel glass-card">
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '10px' }}>🏷️ Tạo Phân Khu Mới (Zone)</h4>
              <form onSubmit={handleAddNewZone} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Mã Khu (VD: KHU_120)"
                    value={newZoneCode}
                    onChange={(e) => setNewZoneCode(e.target.value)}
                    className="form-input"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Tên Khu (VD: Khu 120cm)"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  style={{ width: 'auto', alignSelf: 'flex-start' }}
                  disabled={isProcessing || !newZoneCode.trim() || !newZoneName.trim()}
                >
                  <Plus size={14} /> Tạo Phân Khu
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
