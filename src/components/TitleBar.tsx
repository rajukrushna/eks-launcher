import React from 'react'
import { Minus, Square, X, Terminal } from 'lucide-react'

export default function TitleBar() {
  const isMac = navigator.platform.toLowerCase().includes('mac')
  return (
    <div style={{
      height: 44, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: isMac ? 80 : 16, paddingRight: isMac ? 16 : 0,
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-panel)',
      WebkitAppRegion: 'drag' as any, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 22, height: 22, background: 'var(--accent-green)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Terminal size={12} color="#0d0f12" strokeWidth={2.5} />
        </div>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
          EKS Launcher
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>v1.0</span>
      </div>
      {!isMac && (
        <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' as any }}>
          <WinBtn onClick={() => window.api.window.minimize()} label="minimize"><Minus size={12} /></WinBtn>
          <WinBtn onClick={() => window.api.window.maximize()} label="maximize"><Square size={10} /></WinBtn>
          <WinBtn onClick={() => window.api.window.close()} label="close" danger><X size={12} /></WinBtn>
        </div>
      )}
    </div>
  )
}

function WinBtn({ children, onClick, label, danger = false }: { children: React.ReactNode; onClick: () => void; label: string; danger?: boolean }) {
  const [hov, setHov] = React.useState(false)
  return (
    <button aria-label={label} onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: 46, height: 44, border: 'none', background: hov ? (danger ? '#c0392b' : 'var(--bg-elevated)') : 'transparent', color: hov ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
      {children}
    </button>
  )
}
