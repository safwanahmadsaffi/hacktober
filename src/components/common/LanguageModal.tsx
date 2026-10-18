'use client';

import { useState, useRef, useEffect } from 'react';
import { X, MagnifyingGlass } from '@phosphor-icons/react';
import { useApp, SUPPORTED_LANGUAGES } from '@/lib/store';
import db from '@/lib/db';

interface Props { onClose: () => void; }

export default function LanguageModal({ onClose }: Props) {
  const { dispatch } = useApp();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = SUPPORTED_LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(query.toLowerCase()) ||
    l.nativeName.toLowerCase().includes(query.toLowerCase()) ||
    l.code.toLowerCase().includes(query.toLowerCase())
  );

  async function select(lang: typeof SUPPORTED_LANGUAGES[0]) {
    dispatch({ type: 'SET_LANGUAGE', payload: lang });
    await db.setSetting('language', lang.code);
    onClose();
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Select language" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-sm">
        <div className="modal__header">
          <span className="modal__title">Select Language</span>
          <button className="modal__close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="modal__body" style={{ padding: '1rem' }}>
          <div className="search-wrap" style={{ marginBottom: '.75rem' }}>
            <span className="search-icon"><MagnifyingGlass size={16} /></span>
            <input
              ref={inputRef}
              type="text"
              className="form-control search-input"
              placeholder="Search language…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search languages"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '320px', overflowY: 'auto' }}>
            {filtered.length === 0 && <p className="text-muted text-small" style={{ padding: '.5rem' }}>No languages found.</p>}
            {filtered.map(lang => (
              <button
                key={lang.code}
                onClick={() => select(lang)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '.625rem .75rem', border: 'none', background: 'none',
                  cursor: 'pointer', borderRadius: 'var(--radius)', width: '100%',
                  textAlign: 'left', fontFamily: 'inherit', transition: 'background var(--transition)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-soft)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ fontWeight: 500, color: 'var(--text)' }}>{lang.nativeName}</span>
                <span className="text-muted text-small">{lang.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
