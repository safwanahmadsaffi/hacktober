'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Microphone, PaperPlaneRight, Globe } from '@phosphor-icons/react';
import { useApp, SUPPORTED_LANGUAGES } from '@/lib/store';
import { isRealSale } from '@/lib/financial';

interface Props {
  onLangClick: () => void;
}

interface AssistantReply {
  text: string;
  href?: string;
  label?: string;
}

const PLACEHOLDERS: Record<string, string> = {
  ur: 'اردو میں پوچھیں یا بولیں… (مثلاً "کم اسٹاک"، "آج کی سیل"، "آٹا")',
  en: 'Ask in your language… (e.g. "low stock", "today\'s sales", "5 kg atta")',
  pa: 'پنجابی چ پچھو… (مثلاً "تھوڑا مال"، "اج دی سیل")',
  sd: 'سنڌي ۾ پڇو… (مثال: "گهٽ اسٽاڪ"، "اڄ جو وڪرو")',
  ps: 'پښتو کې وپوښتئ… (مثال: "کم مال"، "د نن ورځې پلور")',
};

export default function AssistantBar({ onLangClick }: Props) {
  const { state } = useApp();
  const lang = state.selectedLanguage;
  const [query, setQuery] = useState('');
  const [recording, setRecording] = useState(false);
  const [response, setResponse] = useState<AssistantReply | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const placeholder = PLACEHOLDERS[lang.code] ?? PLACEHOLDERS.ur ?? PLACEHOLDERS.en;

  function handleAsk() {
    if (!query.trim()) return;
    const q = query.toLowerCase();
    if (
      q.includes('low stock') ||
      q.includes('کم اسٹاک') ||
      q.includes('تھوڑا مال') ||
      q.includes('گهٽ اسٽاڪ') ||
      q.includes('کم مال')
    ) {
      const low = state.products.filter(p => p.stock <= p.lowStockThreshold && p.isActive);
      setResponse({
        text:
          low.length === 0
            ? 'کوئی بھی سامان کم اسٹاک پر نہیں ہے۔ تمام اشیاء وافر مقدار میں ہیں۔'
            : `${low.length} مصنوعات کا اسٹاک کم ہے: ${low.slice(0, 3).map(p => p.name).join('، ')}${low.length > 3 ? '…' : ''}`,
        href: '/products',
        label: 'Open Products',
      });
    } else if (
      q.includes('sales') ||
      q.includes('sale') ||
      q.includes('سیل') ||
      q.includes('فروخت') ||
      q.includes('وڪرو') ||
      q.includes('پلور')
    ) {
      const sales = state.transactions.filter(t => t.status === 'confirmed' && isRealSale(t));
      setResponse({
        text: `کل ${sales.length} تصدیق شدہ فروخت درج ہیں۔`,
        href: '/reports',
        label: 'Open Reports',
      });
    } else if (q.includes('udhaar') || q.includes('ادھار') || q.includes('قرض')) {
      const totalUdhaar = state.customers.reduce((sum, c) => sum + (c.balancePaise > 0 ? c.balancePaise : 0), 0);
      setResponse({
        text: `مارکیٹ میں کل بقایا ادھار: Rs. ${(totalUdhaar / 100).toLocaleString('en-PK')} ہے (${state.customers.length} گاہک)۔`,
        href: '/udhaar',
        label: 'Open Udhaar Khata',
      });
    } else {
      setResponse({
        text: 'حکم سمجھ لیا گیا ہے — مکمل جواب کے لیے منشی سے پوچھیں۔',
        href: '/munshi',
        label: 'Ask Munshi AI',
      });
    }
    setQuery('');
  }

  function toggleMic() {
    if (!recording) {
      setRecording(true);
      setTimeout(() => {
        setRecording(false);
        setQuery('Voice input: "show low stock items"');
        inputRef.current?.focus();
      }, 2000);
    } else {
      setRecording(false);
    }
  }

  return (
    <div className="assistant-bar" role="search" aria-label="Multilingual assistant">
      <span className="assistant-bar__label">
        🌍 Assistant
      </span>

      <div className="assistant-bar__input-wrap" style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          id="assistant-input"
          type="text"
          className="assistant-bar__input"
          placeholder={placeholder}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAsk()}
          aria-label="Assistant command input"
        />
        <button
          className={`assistant-bar__mic${recording ? ' recording' : ''}`}
          onClick={toggleMic}
          aria-label={recording ? 'Stop recording' : 'Start voice input'}
          title={recording ? 'Stop recording' : 'Voice input'}
        >
          <Microphone weight={recording ? 'fill' : 'regular'} size={18} />
        </button>
        {response && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius)', padding: '.625rem .875rem',
              fontSize: '.875rem', color: 'var(--text)', zIndex: 60,
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <span>{response.text}</span>
            {response.href && response.label && (
              <Link
                href={response.href}
                className="related-link"
                style={{ marginLeft: '.5rem' }}
                onClick={() => setResponse(null)}
              >
                {response.label}
              </Link>
            )}
            <button
              onClick={() => setResponse(null)}
              style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem' }}
              aria-label="Dismiss"
            >×</button>
          </div>
        )}
      </div>

      <button className="assistant-bar__ask" onClick={handleAsk} disabled={!query.trim()}>
        <PaperPlaneRight weight="fill" size={16} />
        Ask
      </button>

      <button className="assistant-bar__lang" onClick={onLangClick} aria-label="Change language">
        <Globe size={16} />
        <span>{lang.nativeName} ({lang.code.toUpperCase()})</span>
      </button>
    </div>
  );
}
