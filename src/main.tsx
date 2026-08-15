import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('PWA Application Crash Caught:', error, errorInfo);
  }

  handleHardReset = () => {
    // Clear caches & local storage then reload
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
    }
    sessionStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#0f172a',
          color: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center'
        }}>
          <div style={{
            background: 'rgba(30, 41, 59, 0.9)',
            border: '1px solid #ef4444',
            padding: '32px 24px',
            borderRadius: '16px',
            maxWidth: '480px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px', color: '#f87171' }}>
              Ứng Dụng Đang Cần Khởi Động Lại
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: '24px', lineHeight: 1.5 }}>
              Hệ thống đã nhận bản cập nhật mới trên Vercel. Vui lòng bấm nút bên dưới để xóa bộ nhớ đệm và tải phiên bản mới nhất.
            </p>
            <button
              type="button"
              onClick={this.handleHardReset}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
              }}
            >
              🔄 Tải Lại & Làm Mới Dữ Liệu
            </button>
            {this.state.error && (
              <details style={{ marginTop: '20px', textAlign: 'left', fontSize: '0.72rem', color: '#64748b' }}>
                <summary style={{ cursor: 'pointer', color: '#94a3b8' }}>Chi tiết lỗi kỹ thuật</summary>
                <pre style={{ marginTop: '8px', overflowX: 'auto', background: '#020617', padding: '8px', borderRadius: '6px' }}>
                  {this.state.error.stack || this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
