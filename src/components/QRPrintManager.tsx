import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Printer,
  XCircle,
  Filter,
  CheckSquare,
  Square,
  Settings2,
  PackageCheck
} from 'lucide-react';
import type { Warehouse, WarehouseZone, WarehouseLocation } from '../lib/database';

interface QRPrintManagerProps {
  warehouses: Warehouse[];
  zones?: WarehouseZone[];
  allLocations: WarehouseLocation[];
  onClose: () => void;
  initialWarehouseId?: string;
}

interface LocationWithQR extends WarehouseLocation {
  qrDataUrl: string;
  warehouseName: string;
  zoneName?: string;
}

export const QRPrintManager: React.FC<QRPrintManagerProps> = ({
  warehouses,
  zones = [],
  allLocations,
  onClose,
  initialWarehouseId
}) => {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(
    initialWarehouseId || 'ALL'
  );
  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(new Set());
  const [locationsWithQR, setLocationsWithQR] = useState<LocationWithQR[]>([]);
  const [isGenerating, setIsGenerating] = useState(true);
  
  // Print label format settings
  const [labelSize, setLabelSize] = useState<'standard' | 'compact' | 'large'>('standard');
  const [includeCutBorders, setIncludeCutBorders] = useState(true);

  // Generate QR data URLs for all locations
  useEffect(() => {
    let isMounted = true;
    setIsGenerating(true);

    const generateQRs = async () => {
      const results: LocationWithQR[] = [];

      for (const loc of allLocations) {
        const wh = warehouses.find(w => w.id === loc.warehouse_id);
        const whName = wh ? `${wh.code} - ${wh.name}` : loc.warehouse_id;
        const zone = zones.find(z => z.id === loc.zone_id);
        const zoneName = zone ? zone.name : undefined;

        try {
          // Generate high-resolution QR code (margin 1, error correction level H)
          const dataUrl = await QRCode.toDataURL(loc.qr_payload, {
            width: 320,
            margin: 1,
            errorCorrectionLevel: 'H',
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          });

          results.push({
            ...loc,
            qrDataUrl: dataUrl,
            warehouseName: whName,
            zoneName
          });
        } catch (err) {
          console.error('Error generating QR for', loc.id, err);
        }
      }

      if (isMounted) {
        setLocationsWithQR(results);
        // By default select all generated locations
        setSelectedLocationIds(new Set(results.map(r => r.id)));
        setIsGenerating(false);
      }
    };

    generateQRs();

    return () => {
      isMounted = false;
    };
  }, [allLocations, warehouses]);

  // Filtered locations based on selected warehouse tab
  const displayedLocations = locationsWithQR.filter(loc => {
    if (selectedWarehouseId === 'ALL') return true;
    return loc.warehouse_id === selectedWarehouseId;
  });

  // Printable locations (checked checkboxes)
  const printableLocations = displayedLocations.filter(loc => selectedLocationIds.has(loc.id));

  // Toggle selection
  const toggleLocationSelect = (id: string) => {
    const next = new Set(selectedLocationIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedLocationIds(next);
  };

  // Select all in current view
  const handleSelectAll = () => {
    const next = new Set(selectedLocationIds);
    displayedLocations.forEach(loc => next.add(loc.id));
    setSelectedLocationIds(next);
  };

  // Deselect all in current view
  const handleDeselectAll = () => {
    const next = new Set(selectedLocationIds);
    displayedLocations.forEach(loc => next.delete(loc.id));
    setSelectedLocationIds(next);
  };

  // Trigger Browser Print Dialog
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="qr-print-modal-overlay">
      <div className="qr-print-container">
        {/* Screen Top Header (Hidden on Print) */}
        <div className="qr-print-header no-print">
          <div className="header-left">
            <div className="header-icon-box">
              <Printer size={22} className="text-primary" />
            </div>
            <div>
              <h3 className="header-title">In Mã QR Dán Kệ Hàng</h3>
              <p className="header-sub">
                Đã chọn <strong style={{ color: 'var(--color-primary)' }}>{printableLocations.length}</strong> / {displayedLocations.length} mã QR để in
              </p>
            </div>
          </div>

          <div className="header-actions">
            <button className="btn btn-primary" onClick={handlePrint} disabled={printableLocations.length === 0 || isGenerating}>
              <Printer size={16} /> In Tem Ngay (Ctrl + P)
            </button>
            <button className="modal-close-btn" onClick={onClose} title="Đóng cửa sổ">
              <XCircle size={24} />
            </button>
          </div>
        </div>

        {/* Toolbar & Filters (Hidden on Print) */}
        <div className="qr-print-toolbar no-print">
          {/* Warehouse Filter Tabs */}
          <div className="toolbar-group">
            <span className="toolbar-label"><Filter size={14} /> Kho:</span>
            <div className="filter-chips">
              <button
                className={`filter-chip ${selectedWarehouseId === 'ALL' ? 'active' : ''}`}
                onClick={() => setSelectedWarehouseId('ALL')}
              >
                Tất cả ({allLocations.length})
              </button>
              {warehouses.map(w => {
                const count = allLocations.filter(l => l.warehouse_id === w.id).length;
                return (
                  <button
                    key={w.id}
                    className={`filter-chip ${selectedWarehouseId === w.id ? 'active' : ''}`}
                    onClick={() => setSelectedWarehouseId(w.id)}
                  >
                    {w.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Select Actions */}
          <div className="toolbar-group">
            <button className="btn-action-text" onClick={handleSelectAll}>
              <CheckSquare size={14} /> Chọn tất cả
            </button>
            <button className="btn-action-text" onClick={handleDeselectAll}>
              <Square size={14} /> Bỏ chọn
            </button>
          </div>

          {/* Label Size & Style Options */}
          <div className="toolbar-group options-group">
            <span className="toolbar-label"><Settings2 size={14} /> Cỡ nhãn:</span>
            <select
              className="size-select"
              value={labelSize}
              onChange={(e) => setLabelSize(e.target.value as any)}
            >
              <option value="compact">Nhỏ (Tem 50x30mm)</option>
              <option value="standard">Tiêu chuẩn (Tem 70x50mm / A4)</option>
              <option value="large">Lớn (Tem 100x70mm - Nhìn từ xa)</option>
            </select>

            <label className="checkbox-toggle">
              <input
                type="checkbox"
                checked={includeCutBorders}
                onChange={(e) => setIncludeCutBorders(e.target.checked)}
              />
              <span>Viền cắt tem</span>
            </label>
          </div>
        </div>

        {/* Labels Sheet Preview & Printable Area */}
        <div className="qr-print-body">
          {isGenerating ? (
            <div className="generating-box">
              <div className="spinner" />
              <p>Đang khởi tạo mã QR độ nét cao cho {allLocations.length} vị trí kệ...</p>
            </div>
          ) : printableLocations.length === 0 ? (
            <div className="empty-selection-box no-print">
              <PackageCheck size={48} className="text-muted" />
              <h4>Chưa có mã QR nào được chọn</h4>
              <p className="text-muted">Vui lòng tích chọn ít nhất 1 vị trí kệ ở phía trên để in tem.</p>
              <button className="btn btn-primary" onClick={handleSelectAll} style={{ width: 'auto', marginTop: '12px' }}>
                Chọn tất cả {displayedLocations.length} ô kệ
              </button>
            </div>
          ) : (
            <div className={`qr-labels-grid size-${labelSize} ${includeCutBorders ? 'with-borders' : ''}`}>
              {printableLocations.map(loc => (
                <div
                  key={loc.id}
                  className={`qr-label-card ${selectedLocationIds.has(loc.id) ? 'selected' : ''}`}
                >
                  {/* Top Checkbox Overlay (Screen only) */}
                  <div
                    className="label-checkbox-wrapper no-print"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLocationSelect(loc.id);
                    }}
                  >
                    {selectedLocationIds.has(loc.id) ? (
                      <CheckSquare size={18} className="text-success" />
                    ) : (
                      <Square size={18} className="text-muted" />
                    )}
                  </div>

                  {/* Physical Label Content (Both Screen & Print) */}
                  <div className="label-content">
                    {/* Header: Warehouse Brand & Name */}
                    <div className="label-header">
                      <div className="label-brand">KHO NHỰA LÚA</div>
                      <div className="label-wh-name">{loc.warehouseName}</div>
                    </div>

                    {/* Main Body: QR Code + Large Location Code */}
                    <div className="label-main">
                      <div className="label-qr-box">
                        <img src={loc.qrDataUrl} alt={`QR ${loc.id}`} className="label-qr-img" />
                      </div>

                      <div className="label-details">
                        <div className="label-loc-code">{loc.code}</div>
                        {loc.zoneName && <div className="label-zone-name" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb' }}>{loc.zoneName}</div>}
                        <div className="label-full-id" style={{ fontSize: '0.65rem', color: '#64748b' }}>{loc.id.substring(0, 18)}...</div>
                        <div className="label-instruction">Quét khi chuyển/lấy hàng</div>
                      </div>
                    </div>

                    {/* Footer: Serial barcode & verification */}
                    <div className="label-footer">
                      <span className="footer-payload">{loc.qr_payload}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer print prompt (Screen only) */}
        <div className="qr-print-footer no-print">
          <div className="print-tips">
            💡 <strong>Mẹo in tem dán kệ:</strong> Trong hộp thoại in của trình duyệt (Ctrl + P), chọn khổ giấy <strong>A4</strong> hoặc máy in tem nhiệt Decal, tại mục <em>"Margins / Lề"</em> chọn <strong>None</strong> hoặc <strong>Minimum</strong> để tem ngay ngắn và tiết kiệm giấy nhất.
          </div>
          <div className="footer-btn-row">
            <button className="btn btn-secondary" onClick={onClose} style={{ width: 'auto' }}>
              Đóng
            </button>
            <button className="btn btn-primary" onClick={handlePrint} style={{ width: 'auto' }} disabled={printableLocations.length === 0}>
              <Printer size={16} /> In ngay {printableLocations.length} tem
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRPrintManager;
