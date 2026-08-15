import React, { useState } from 'react';
import {
  Grid,
  Plus,
  Trash2,
  ArrowRightLeft,
  Check,
  RefreshCw,
  LayoutGrid
} from 'lucide-react';
import type {
  Warehouse,
  WarehouseLocation,
  ProductCurrentLocation
} from '../lib/database';
import {
  updateWarehousePartitionGrid,
  addWarehouseSlot,
  deleteWarehouseSlot,
  transferSlotToWarehouse
} from '../lib/database';

interface WarehousePartitionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  allLocations: WarehouseLocation[];
  currentLocations: ProductCurrentLocation[];
  initialWarehouseId?: string;
  onDataChanged: () => void;
}

export const WarehousePartitionManager: React.FC<WarehousePartitionManagerProps> = ({
  isOpen,
  onClose,
  warehouses,
  allLocations,
  currentLocations,
  initialWarehouseId,
  onDataChanged
}) => {
  const [selectedWhId, setSelectedWhId] = useState<string>(
    initialWarehouseId || (warehouses.length > 0 ? warehouses[0].id : 'K1')
  );

  const activeWh = warehouses.find(w => w.id === selectedWhId);

  // Partition Grid form states
  const [gridRows, setGridRows] = useState<number>(activeWh?.rows || 4);
  const [gridCols, setGridCols] = useState<number>(activeWh?.columns || 3);
  const [gridType, setGridType] = useState<'grid' | 'aisle'>(activeWh?.type || 'grid');

  // New slot form state
  const [newSlotCode, setNewSlotCode] = useState<string>('');

  // Target warehouse state for individual transfer
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>({});
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const currentWhLocations = allLocations.filter(l => l.warehouse_id === selectedWhId);

  const productMap = new Map<string, string>();
  currentLocations.forEach(p => {
    if (p.location_id) productMap.set(p.location_id, p.product_code);
  });

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 3500);
  };

  // Handle Partition Re-generate
  const handleApplyPartition = async (regenerate: boolean) => {
    if (!activeWh) return;
    if (regenerate && !window.confirm(`Bạn có chắc muốn tạo lại toàn bộ ${gridRows * gridCols} ô kệ cho Kho ${activeWh.name}? Các ô cũ sẽ được làm mới.`)) {
      return;
    }

    setIsProcessing(true);
    try {
      await updateWarehousePartitionGrid(
        activeWh.id,
        gridCols,
        gridRows,
        gridType,
        regenerate
      );
      onDataChanged();
      showMsg(
        regenerate
          ? `Đã tạo lại lưới ${gridRows}x${gridCols} (${gridRows * gridCols} ô) cho Kho ${activeWh.name}!`
          : `Đã cập nhật kích thước lưới ${gridRows}x${gridCols}!`
      );
    } catch (e: any) {
      showMsg(e.message || 'Lỗi khi cập nhật cấu trúc ô', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Add Single Slot
  const handleAddNewSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlotCode.trim()) return;

    setIsProcessing(true);
    try {
      await addWarehouseSlot(selectedWhId, newSlotCode.trim());
      setNewSlotCode('');
      onDataChanged();
      showMsg(`Đã thêm ô mới [${selectedWhId}-${newSlotCode.trim().toUpperCase()}]!`);
    } catch (e: any) {
      showMsg(e.message || 'Lỗi khi thêm ô', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Delete Slot
  const handleDeleteSlot = async (locId: string, code: string) => {
    const hasProduct = productMap.has(locId);
    if (hasProduct) {
      if (!window.confirm(`Ô ${code} đang có hàng [${productMap.get(locId)}]. Bạn có chắc muốn xóa ô này không?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Xóa ô ${code}?`)) return;
    }

    setIsProcessing(true);
    try {
      await deleteWarehouseSlot(locId);
      onDataChanged();
      showMsg(`Đã xóa ô ${code}!`);
    } catch (e: any) {
      showMsg(e.message || 'Lỗi khi xóa ô', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Transfer Slot to Another Warehouse
  const handleTransferSlot = async (sourceLocId: string) => {
    const targetWhId = transferTargets[sourceLocId];
    if (!targetWhId || targetWhId === selectedWhId) {
      alert('Vui lòng chọn kho đích khác kho hiện tại.');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await transferSlotToWarehouse(sourceLocId, targetWhId);
      onDataChanged();
      showMsg(`Đã bốc nguyên ô sang Kho ${targetWhId} (Mã mới: ${res.newLocationId})!`);
    } catch (e: any) {
      showMsg(e.message || 'Lỗi khi chuyển kho', 'error');
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
              <h3 className="header-title">Phân Chia Lại Ô & Bốc Ô Sang Kho Khác</h3>
              <p className="header-sub">Tự do chia hàng/cột, thêm ô kệ mới hoặc chuyển nguyên ô kèm hàng tồn sang kho khác</p>
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
                onClick={() => {
                  setSelectedWhId(w.id);
                  setGridRows(w.rows);
                  setGridCols(w.columns);
                  setGridType(w.type);
                }}
              >
                <strong>{w.name}</strong>
                <span className="pill-count">{locCount} ô</span>
              </button>
            );
          })}
        </div>

        <div className="partition-body">
          {/* Top Partition & Grid Controls */}
          <div className="partition-control-panel glass-card">
            <div className="panel-title-row">
              <Grid size={18} className="text-primary" />
              <h4>Cấu trúc ô của {activeWh?.name}</h4>
            </div>

            <div className="partition-form-grid">
              <div className="form-group-item">
                <label>Loại bố trí:</label>
                <select
                  value={gridType}
                  onChange={(e) => setGridType(e.target.value as 'grid' | 'aisle')}
                  className="form-input"
                >
                  <option value="grid">Lưới Ô (Hàng x Cột: A01, A02...)</option>
                  <option value="aisle">Lối đi Aisle (Dãy D1, D2...)</option>
                </select>
              </div>

              <div className="form-group-item">
                <label>Số Hàng (Rows):</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={gridRows}
                  onChange={(e) => setGridRows(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="form-input"
                />
              </div>

              <div className="form-group-item">
                <label>Số Cột (Columns):</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={gridCols}
                  onChange={(e) => setGridCols(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="form-input"
                />
              </div>

              <div className="form-group-item btn-group-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '8px 14px' }}
                  disabled={isProcessing}
                  onClick={() => handleApplyPartition(false)}
                  title="Cập nhật cấu hình hàng x cột"
                >
                  Lưu cấu hình
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: 'auto', padding: '8px 16px' }}
                  disabled={isProcessing}
                  onClick={() => handleApplyPartition(true)}
                  title="Tự động sinh lại tất cả các ô theo số hàng x cột mới"
                >
                  <RefreshCw size={14} className={isProcessing ? 'animate-spin' : ''} />
                  Tạo lại lưới {gridRows}x{gridCols} ({gridRows * gridCols} ô)
                </button>
              </div>
            </div>

            {/* Add Custom Slot */}
            <form onSubmit={handleAddNewSlot} className="add-slot-form">
              <span className="add-slot-label">Thêm 1 ô lẻ:</span>
              <input
                type="text"
                placeholder="Mã ô (VD: A04, E01, VIP1)..."
                value={newSlotCode}
                onChange={(e) => setNewSlotCode(e.target.value)}
                className="form-input slot-code-input"
              />
              <button
                type="submit"
                className="btn btn-success"
                style={{ width: 'auto', padding: '8px 16px' }}
                disabled={isProcessing || !newSlotCode.trim()}
              >
                <Plus size={15} /> Thêm ô
              </button>
            </form>
          </div>

          {/* Slot Cards List / Matrix */}
          <div className="slots-container-card glass-card">
            <div className="slots-header-row">
              <h4>Danh sách {currentWhLocations.length} ô kệ trong {activeWh?.name}</h4>
              <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                💡 Chọn kho đích để bốc nguyên một ô sang kho khác:
              </span>
            </div>

            {currentWhLocations.length === 0 ? (
              <div className="empty-slots-box text-center">
                <p className="text-muted">Kho này hiện chưa có ô nào. Hãy bấm "Tạo lại lưới" hoặc "Thêm ô" ở trên.</p>
              </div>
            ) : (
              <div className="slots-grid-cards">
                {currentWhLocations.map(loc => {
                  const product = productMap.get(loc.id);
                  const hasProduct = Boolean(product);
                  const selectedTargetWh = transferTargets[loc.id] || '';

                  return (
                    <div key={loc.id} className={`slot-item-card ${hasProduct ? 'has-product' : 'is-empty'}`}>
                      <div className="slot-card-top">
                        <div className="slot-code-badge">
                          <strong>{loc.code}</strong>
                          <span className="slot-full-id">{loc.id}</span>
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
                        <span className="slot-prod-label">Hàng hóa:</span>
                        {hasProduct ? (
                          <div className="slot-product-pill">
                            📦 <strong>{product}</strong>
                          </div>
                        ) : (
                          <span className="slot-empty-text">Trống</span>
                        )}
                      </div>

                      {/* Transfer to another warehouse controls */}
                      <div className="slot-card-bottom">
                        <select
                          value={selectedTargetWh}
                          onChange={(e) => setTransferTargets(prev => ({ ...prev, [loc.id]: e.target.value }))}
                          className="transfer-select"
                        >
                          <option value="">Bốc sang kho...</option>
                          {warehouses
                            .filter(w => w.id !== selectedWhId)
                            .map(w => (
                              <option key={w.id} value={w.id}>
                                Sang {w.name}
                              </option>
                            ))}
                        </select>

                        <button
                          type="button"
                          className="btn-transfer-action"
                          disabled={!selectedTargetWh || isProcessing}
                          onClick={() => handleTransferSlot(loc.id)}
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
