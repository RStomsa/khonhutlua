import React, { useState } from 'react';
import {
  PackagePlus,
  Sparkles,
  CheckCircle,
  Plus,
  ListPlus,
  Box,
  MapPin
} from 'lucide-react';
import type {
  Warehouse,
  WarehouseLocation,
  ProductCurrentLocation
} from '../lib/database';
import { createProduct, bulkImportProducts } from '../lib/database';

interface ProductImportManagerProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  allLocations: WarehouseLocation[];
  currentLocations: ProductCurrentLocation[];
  onDataChanged: () => void;
  initialProductCode?: string;
}

export const ProductImportManager: React.FC<ProductImportManagerProps> = ({
  isOpen,
  onClose,
  warehouses,
  allLocations,
  currentLocations,
  onDataChanged,
  initialProductCode = ''
}) => {
  const [activeMode, setActiveMode] = useState<'single' | 'bulk'>('single');

  // Single Form State
  const [singleCode, setSingleCode] = useState(initialProductCode);
  const [singleName, setSingleName] = useState('');
  const [singleLength, setSingleLength] = useState<number | string>(120);
  const [singleUnit, setSingleUnit] = useState('cm');
  const [singleWarehouseId, setSingleWarehouseId] = useState(warehouses[0]?.id || '');
  const [singleLocationId, setSingleLocationId] = useState('');

  // Bulk Form State
  const [bulkText, setBulkText] = useState('');
  const [bulkWarehouseId, setBulkWarehouseId] = useState(warehouses[0]?.id || '');
  const [autoAssignEmptySlots, setAutoAssignEmptySlots] = useState(true);
  const [parsedPreview, setParsedPreview] = useState<Array<{ code: string; length: number; unit: string }>>([]);

  // Status
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  // Occupied locations set
  const occupiedLocIds = new Set(
    currentLocations.filter(c => c.location_id).map(c => c.location_id!)
  );

  // Filter available empty locations for single warehouse
  const availableLocationsForSingleWh = allLocations.filter(
    l => l.warehouse_id === singleWarehouseId
  );

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Helper: Extract length from product code (e.g. e120.30 -> 120, e80.12 -> 80)
  const extractLengthFromCode = (code: string): number => {
    const match = code.match(/^[a-zA-Z]*(\d+)/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return 120;
  };

  const handleSingleCodeChange = (code: string) => {
    setSingleCode(code);
    const len = extractLengthFromCode(code);
    setSingleLength(len);
    setSingleName(`Thanh Nhựa ${code.trim()}`);
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleCode.trim()) return;

    setIsProcessing(true);
    try {
      const lenVal = typeof singleLength === 'number' ? singleLength : (parseFloat(String(singleLength)) || 120);
      const res = await createProduct(
        singleCode.trim(),
        singleName.trim() || `Thanh Nhựa ${singleCode.trim()}`,
        lenVal,
        singleUnit,
        singleLocationId || null,
        'Admin'
      );

      onDataChanged();
      showToast(`Đã thêm sản phẩm [${res.product.product_code}] vào kho thành công!`);
      setSingleCode('');
      setSingleName('');
      setSingleLocationId('');
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi nhập sản phẩm', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Parse bulk text into items
  const handleParseBulk = () => {
    if (!bulkText.trim()) {
      setParsedPreview([]);
      return;
    }

    // Split by newlines, commas, semicolons or spaces
    const lines = bulkText.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    const parsed = lines.map(line => {
      const parts = line.split(/\s+/);
      const code = parts[0];
      const length = parts[1] ? (parseFloat(parts[1]) || extractLengthFromCode(code)) : extractLengthFromCode(code);
      const unit = parts[2] || 'cm';
      return { code, length, unit };
    });

    setParsedPreview(parsed);
  };

  const handleBulkSubmit = async () => {
    if (parsedPreview.length === 0) {
      handleParseBulk();
      if (parsedPreview.length === 0) return;
    }

    setIsProcessing(true);
    try {
      // Find empty location slots in selected warehouse
      const emptyLocations = allLocations.filter(
        l => l.warehouse_id === bulkWarehouseId && !occupiedLocIds.has(l.id)
      );

      const itemsToImport = parsedPreview.map((item, idx) => {
        let assignedLocId: string | null = null;
        if (autoAssignEmptySlots && idx < emptyLocations.length) {
          assignedLocId = emptyLocations[idx].id;
        }
        return {
          product_code: item.code,
          name: `Thanh Nhựa ${item.code}`,
          length_value: item.length,
          length_unit: item.unit,
          location_id: assignedLocId
        };
      });

      const res = await bulkImportProducts(itemsToImport, 'Admin');
      onDataChanged();
      showToast(`🚀 Đã nhập thành công ${res.successCount} sản phẩm vào kho!`);
      setBulkText('');
      setParsedPreview([]);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi nhập danh sách hàng loạt', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="partition-modal-overlay">
      <div className="partition-modal-container glass-card animate-fade-in" style={{ maxWidth: '780px', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="partition-header">
          <div className="header-left">
            <div className="header-icon-box" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
              <PackagePlus size={22} />
            </div>
            <div>
              <h3 className="header-title">Nhập Sản Phẩm Mới & Danh Sách Hàng Loạt Vào Kho</h3>
              <p className="header-sub">Thêm sản phẩm mới hoặc dán danh sách hàng loạt tự động xếp vào ô trống</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        {/* Status Toast Message */}
        {toastMsg && (
          <div className={`partition-toast ${toastMsg.type === 'error' ? 'toast-error' : 'toast-success'} animate-fade-in`}>
            {toastMsg.type === 'success' ? <CheckCircle size={16} /> : null}
            <span>{toastMsg.text}</span>
          </div>
        )}

        {/* Mode Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
          <button
            type="button"
            className={`wh-tab-pill ${activeMode === 'single' ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setActiveMode('single')}
          >
            <Plus size={16} /> <strong>1. Nhập Lẻ 1 Sản Phẩm Mới</strong>
          </button>
          <button
            type="button"
            className={`wh-tab-pill ${activeMode === 'bulk' ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setActiveMode('bulk')}
          >
            <ListPlus size={16} /> <strong>2. ⚡ Nhập Danh Sách Hàng Loạt</strong>
          </button>
        </div>

        {/* TAB 1: SINGLE PRODUCT INBOUND */}
        {activeMode === 'single' && (
          <form onSubmit={handleSingleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="glass-card" style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1.5px solid #cbd5e1' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1e293b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Box size={16} className="text-primary" /> Thông Tin Sản Phẩm Mới
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                    Mã Sản Phẩm (*):
                  </label>
                  <input
                    type="text"
                    placeholder="VD: e120.35, e80.12, m100..."
                    value={singleCode}
                    onChange={(e) => handleSingleCodeChange(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                    Tên / Quy Cách Mô Tả:
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Thanh Nhựa e120 bản 35mm"
                    value={singleName}
                    onChange={(e) => setSingleName(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                      Chiều Dài:
                    </label>
                    <input
                      type="number"
                      value={singleLength}
                      onChange={(e) => setSingleLength(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                      Đơn vị:
                    </label>
                    <select
                      value={singleUnit}
                      onChange={(e) => setSingleUnit(e.target.value)}
                      className="form-input"
                    >
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                      <option value="mm">mm</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Placement in Warehouse */}
            <div className="glass-card" style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1e293b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={16} className="text-primary" /> Xếp Ngay Vào Ô Vị Trí Kho (Tùy chọn)
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                    1. Chọn Kho:
                  </label>
                  <select
                    value={singleWarehouseId}
                    onChange={(e) => {
                      setSingleWarehouseId(e.target.value);
                      setSingleLocationId('');
                    }}
                    className="form-input"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.code} - {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                    2. Chọn Ô Vị Trí:
                  </label>
                  <select
                    value={singleLocationId}
                    onChange={(e) => setSingleLocationId(e.target.value)}
                    className="form-input"
                  >
                    <option value="">-- Chưa xếp vào ô (để trống) --</option>
                    {availableLocationsForSingleWh.map(l => {
                      const isOccupied = occupiedLocIds.has(l.id);
                      return (
                        <option key={l.id} value={l.id}>
                          {l.code} {isOccupied ? '(⚠️ Đang có hàng)' : '(Trống)'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: 'auto' }}
                onClick={onClose}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: 'auto', padding: '8px 20px' }}
                disabled={isProcessing || !singleCode.trim()}
              >
                <PackagePlus size={16} /> {isProcessing ? 'Đang lưu...' : '💾 Nhập Sản Phẩm Này'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: BULK LIST INBOUND */}
        {activeMode === 'bulk' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="glass-card" style={{ background: '#eff6ff', border: '1.5px solid #93c5fd', padding: '16px', borderRadius: '12px' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1e40af', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} className="text-primary" /> Dán Danh Sách Hàng Loạt
              </h4>
              <p style={{ fontSize: '0.78rem', color: '#1e3a8a', marginBottom: '10px' }}>
                Dán danh sách mã sản phẩm bên dưới (mỗi dòng 1 mã, hoặc cách nhau bởi dấu phẩy):
              </p>

              <textarea
                rows={6}
                className="form-input"
                style={{ fontFamily: 'monospace', fontSize: '0.88rem', width: '100%', resize: 'vertical' }}
                placeholder={`e120.31\ne120.32\ne120.33\ne100.40\ne80.15\n...`}
                value={bulkText}
                onChange={(e) => {
                  setBulkText(e.target.value);
                  setParsedPreview([]);
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  💡 Hệ thống tự động nhận dạng chiều dài từ mã (VD: <code>e120.31</code> &rarr; <code>120cm</code>)
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '4px 12px', fontSize: '0.78rem' }}
                  onClick={handleParseBulk}
                  disabled={!bulkText.trim()}
                >
                  ⚡ Xem trước danh sách ({parsedPreview.length || '...'})
                </button>
              </div>
            </div>

            {/* Warehouse destination & Auto slot filling */}
            <div className="glass-card" style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1e293b', marginBottom: '10px' }}>
                Cấu Hình Xếp Kho Tự Động
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                    Kho Đích Nhập Hàng:
                  </label>
                  <select
                    value={bulkWarehouseId}
                    onChange={(e) => setBulkWarehouseId(e.target.value)}
                    className="form-input"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.code} - {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ paddingTop: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={autoAssignEmptySlots}
                      onChange={(e) => setAutoAssignEmptySlots(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    Tự động xếp lần lượt vào các ô còn TRỐNG của kho này
                  </label>
                </div>
              </div>
            </div>

            {/* Preview Matrix */}
            {parsedPreview.length > 0 && (
              <div className="glass-card" style={{ background: '#ffffff', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '8px', color: '#0f172a' }}>
                  📋 Danh Sách Đã Phân Tích ({parsedPreview.length} sản phẩm):
                </h4>
                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '6px' }}>
                  {parsedPreview.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#f1f5f9',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <strong>{item.code}</strong>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.length}{item.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: 'auto' }}
                onClick={onClose}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: 'auto', padding: '8px 22px', background: '#2563eb' }}
                disabled={isProcessing || !bulkText.trim()}
                onClick={handleBulkSubmit}
              >
                <Sparkles size={16} /> {isProcessing ? 'Đang nhập hàng loạt...' : `🚀 Nhập ${parsedPreview.length || ''} Sản Phẩm Vào Kho`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
