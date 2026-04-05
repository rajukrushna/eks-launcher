import React from 'react'
import { Play, Unplug, Server, Key, Globe, Terminal, CheckCircle, XCircle, Loader, Network, Download, Upload } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { LogEntry } from '../types'

export default function HomeView() {
  const { selectedEnv, connectedEnvId, lastAttemptedEnvId, runStatus, setRunStatus, setLastAttemptedEnvId, setConnectedEnvId, logs, appendLog, clearLogs, mainTab, setMainTab, setEnvironments, setPortForwards } = useStore()
  const [exporting, setExporting] = React.useState(false)
  const [importing, setImporting] = React.useState(false)
  const logRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  React.useEffect(() => {
    const unsub = window.api.cmd.onLog((data) => {
      appendLog({ line: data.line, type: data.type as LogEntry['type'], ts: Date.now() })
    })
    return unsub
  }, [])

  const handleDisconnect = () => {
    if (!selectedEnv || connectedEnvId !== selectedEnv.id) return
    setConnectedEnvId(null)
    setRunStatus('idle')
  }

  const handleRun = async () => {
    if (!selectedEnv || runStatus === 'running' || connectedEnvId === selectedEnv.id) return
    clearLogs()
    setLastAttemptedEnvId(selectedEnv.id)
    setRunStatus('running')
    appendLog({ line: `▶ Connecting to ${selectedEnv.name}...`, type: 'cmd', ts: Date.now() })
    const result = await window.api.cmd.run(selectedEnv)
    setRunStatus(result.success ? 'success' : 'error')
    if (result.success) {
      setConnectedEnvId(selectedEnv.id)
    }
  }

  const handleConnectOrDisconnect = () => {
    if (runStatus === 'running') return
    if (selectedEnv && connectedEnvId === selectedEnv.id) handleDisconnect()
    else void handleRun()
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const result = await window.api.data.export()
      if (result.success) {
        alert(`Data exported successfully to ${result.filePath}`)
      } else {
        alert(`Export failed: ${result.error}`)
      }
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const result = await window.api.data.import()
      if (result.success) {
        // Refresh the data
        const envs = await window.api.env.list()
        const pfs = await window.api.pf.list()
        setEnvironments(envs)
        setPortForwards(pfs)
        alert(`Import successful! Added ${result.imported?.envCount ?? 0} environments and ${result.imported?.pfCount ?? 0} port-forwards.`)
      } else {
        alert(`Import failed: ${result.error}`)
      }
    } finally {
      setImporting(false)
    }
  }

  const logColor = (type: string) => {
    switch (type) {
      case 'cmd': return 'var(--accent-amber)'
      case 'success': return 'var(--accent-green)'
      case 'error': return 'var(--accent-red)'
      case 'stderr': return '#ff9580'
      default: return 'var(--text-secondary)'
    }
  }

  const badge = (() => {
    if (runStatus === 'running' && lastAttemptedEnvId === selectedEnv?.id) return { icon: <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />, label: 'Connecting...', color: 'var(--accent-amber)' }
    if (connectedEnvId === selectedEnv?.id) return { icon: <CheckCircle size={12} />, label: 'Connected', color: 'var(--accent-green)' }
    if (runStatus === 'error' && lastAttemptedEnvId === selectedEnv?.id) return { icon: <XCircle size={12} />, label: 'Failed', color: 'var(--accent-red)' }
    return null
  })()

  if (!selectedEnv) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="animate-fade">
        {/* Toolbar */}
        <div style={{ padding: '10px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)', display: 'flex', gap: 8, flexShrink: 0, justifyContent: 'flex-end' }}>
          <button onClick={handleExport} disabled={exporting}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-blue)'; e.currentTarget.style.color = '#0d0f12' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent-blue)' }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--accent-blue)', borderRadius: 4, background: 'transparent', color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: exporting ? 'not-allowed' : 'pointer', transition: 'all 0.15s', fontWeight: 600, opacity: exporting ? 0.5 : 1 }}>
            <Download size={11} /> Export
          </button>
          <button onClick={handleImport} disabled={importing}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-amber)'; e.currentTarget.style.color = '#0d0f12' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent-amber)' }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--accent-amber)', borderRadius: 4, background: 'transparent', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: importing ? 'not-allowed' : 'pointer', transition: 'all 0.15s', fontWeight: 600, opacity: importing ? 0.5 : 1 }}>
            <Upload size={11} /> Import
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, color: 'var(--text-muted)' }}>
          <div style={{ width: 60, height: 60, borderRadius: 14, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Server size={26} strokeWidth={1} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>No environment selected</div>
            <div style={{ fontSize: 12 }}>Choose one from the sidebar or create a new one</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="animate-fade">
      {/* Toolbar */}
      <div style={{ padding: '10px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)', display: 'flex', gap: 8, flexShrink: 0, justifyContent: 'flex-end' }}>
        <button onClick={handleExport} disabled={exporting}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-blue)'; e.currentTarget.style.color = '#0d0f12' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent-blue)' }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--accent-blue)', borderRadius: 4, background: 'transparent', color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: exporting ? 'not-allowed' : 'pointer', transition: 'all 0.15s', fontWeight: 600, opacity: exporting ? 0.5 : 1 }}>
          <Download size={11} /> Export
        </button>
        <button onClick={handleImport} disabled={importing}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-amber)'; e.currentTarget.style.color = '#0d0f12' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent-amber)' }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--accent-amber)', borderRadius: 4, background: 'transparent', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: importing ? 'not-allowed' : 'pointer', transition: 'all 0.15s', fontWeight: 600, opacity: importing ? 0.5 : 1 }}>
          <Upload size={11} /> Import
        </button>
      </div>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5 }}>Selected Environment</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{selectedEnv.name}</span>
              {badge && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: badge.color, background: `${badge.color}18`, padding: '3px 9px', borderRadius: 4, fontWeight: 500 }}>
                  {badge.icon} {badge.label}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleConnectOrDisconnect}
            disabled={runStatus === 'running'}
            onMouseEnter={e => { if (runStatus !== 'running') e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 20px',
              border: 'none',
              borderRadius: 4,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              fontSize: 12,
              letterSpacing: '0.04em',
              flexShrink: 0,
              transition: 'transform 0.1s',
              ...(runStatus === 'running'
                ? { background: 'var(--bg-elevated)', color: 'var(--text-muted)', cursor: 'not-allowed', boxShadow: 'none' }
                : connectedEnvId === selectedEnv.id
                  ? { background: 'var(--accent-amber)', color: '#0d0f12', cursor: 'pointer', boxShadow: '0 0 18px rgba(245, 166, 35, 0.28)' }
                  : { background: 'var(--accent-green)', color: '#0d0f12', cursor: 'pointer', boxShadow: '0 0 18px rgba(57, 217, 138, 0.22)' }),
            }}
          >
            {runStatus === 'running' ? (
              <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Connecting</>
            ) : connectedEnvId === selectedEnv.id ? (
              <><Unplug size={13} strokeWidth={2.5} /> Disconnect</>
            ) : (
              <><Play size={13} fill="currentColor" /> Connect</>
            )}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 14, flexWrap: 'wrap' }}>
          <Meta icon={<Key size={11} />} label="Okta Profile" value={selectedEnv.okta_profile} />
          <Meta icon={<Server size={11} />} label="EKS Cluster" value={selectedEnv.eks_cluster_name} />
          <Meta icon={<Globe size={11} />} label="Region" value={selectedEnv.aws_region} />
          <Meta icon={<Key size={11} />} label="AWS Profile" value={selectedEnv.aws_profile} />
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ padding: '0 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)', display: 'flex', gap: 0, flexShrink: 0 }}>
        {(['connect', 'portforward'] as const).map(tab => (
          <button key={tab} onClick={() => setMainTab(tab)}
            style={{ padding: '10px 16px', border: 'none', background: 'transparent', color: mainTab === tab ? 'var(--accent-green)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', borderBottom: `2px solid ${mainTab === tab ? 'var(--accent-green)' : 'transparent'}`, marginBottom: -1, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6, transition: 'color 0.15s' }}>
            {tab === 'connect' ? <><Terminal size={11} /> Connect</> : <><Network size={11} /> Port Forwards</>}
          </button>
        ))}
      </div>

      {/* Tab: Connect — EKS command + terminal */}
      {mainTab === 'connect' && (
        <>
          {selectedEnv.id !== connectedEnvId && runStatus !== 'running' ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, color: 'var(--text-muted)' }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Terminal size={24} strokeWidth={1} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Not connected</div>
                <div style={{ fontSize: 12 }}>Connect to {selectedEnv.name} to see command output</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ padding: '10px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg-base)', flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>EKS Command</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-amber)', background: 'var(--bg-card)', padding: '7px 11px', borderRadius: 4, border: '1px solid var(--border)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                  $ {selectedEnv.eks_command}
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '8px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                  <Terminal size={11} color="var(--text-muted)" />
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Output</span>
                  {logs.length > 0 && <button onClick={clearLogs} style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>clear</button>}
                </div>
                <div ref={logRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 22px', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.75, background: 'var(--bg-base)' }}>
                  {logs.length === 0
                    ? <div style={{ color: 'var(--text-muted)', fontSize: 11 }}><span style={{ opacity: 0.4 }}>~/eks-launcher</span> <span style={{ color: 'var(--accent-green)' }}>$</span> <span style={{ opacity: 0.3 }}>waiting...</span></div>
                    : logs.map((e, i) => <div key={i} style={{ color: logColor(e.type), whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{e.line}</div>)
                  }
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Tab: Port Forwards — redirect to PF view */}
      {mainTab === 'portforward' && <PortForwardTab connected={connectedEnvId === selectedEnv.id} />}
    </div>
  )
}

// ── Inline Port-Forward tab inside HomeView ───────────────────────────────────

import PortForwardView from './PortForwardView'

function PortForwardTab({ connected }: { connected: boolean }) {
  if (!connected) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, color: 'var(--text-muted)' }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Network size={24} strokeWidth={1} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>EKS not connected</div>
          <div style={{ fontSize: 12 }}>Connect to an environment first, then start port-forwards</div>
        </div>
      </div>
    )
  }
  return <PortForwardView />
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{icon} {label}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{value}</div>
    </div>
  )
}
