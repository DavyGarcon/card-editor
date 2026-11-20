import type { CSSProperties } from 'react';

/** Shared inline styles for the editor controls and dialogs. */
export const toolBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 12px',
  background: '#334155',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
};

export const smallBtnStyle: CSSProperties = {
  padding: '5px 8px',
  background: '#334155',
  color: '#f8fafc',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  fontSize: '11px',
};

export const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px',
  borderRadius: '6px',
  background: '#1e293b',
  color: '#fff',
  border: '1px solid #334155',
  boxSizing: 'border-box',
};

export const labelStyle: CSSProperties = {
  fontSize: '12px',
  color: '#94a3b8',
  display: 'block',
  marginBottom: '4px',
};

export const modalBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(2, 6, 23, 0.8)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

export const modalStyle: CSSProperties = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '10px',
  padding: '20px',
  width: '360px',
  maxWidth: '95vw',
  color: '#f8fafc',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
};
