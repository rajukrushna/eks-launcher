import React from 'react'
import { ArrowLeft, Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { PortForward } from '../types'

export default function PortForwardManageView() {
  const { portForwards, removePortForward, setView, pfProcesses } = useStore()
  const [confirmDel, setConfirmDel] = React.useState<number | null>(null)
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set())

  const groups = portForwards.reduce((acc, pf) => {
    const g = pf.group_name || 'Services'
    if (!acc[g]) acc[g] = []
    acc[g].push(pf)
    return acc
  }, {} as Record<string, PortForward[]>)

  const handleDelete = async (pf: PortForward) => {
    if (confirmDel === pf.id) {
      await window.api.pf.delete(pf.id)
      removePortForward(pf.id)
      setConfirmDel(null)
    } else {
      setConfirmDel(pf.id)
      setTimeout(() => setConfirmDel(null), 3000)
    }
  }

  const toggleGroup = (g: string) => setCollapsed(prev => {
    const next = new Set(prev)
    next.has(g) ? next.delete(g) : next.add(g)
    return next
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="animate-fade">
      {/* Header */}
      <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={() => setView('home')}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-mono)', padding: '4px 0' }}>
          <ArrowLeft size={13} /> Back
        </button>
        <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Port-Forward Management</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{portForwards.length} services configured</div>
        </div>
        <button onClick={() => setView('pf-create')}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-green)'; e.currentTarget.style.color = '#0d0f12' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent-green)' }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1px solid var(--accent-green)', borderRadius: 4, background: 'transparent', color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s', fontWeight: 600 }}>
          <Plus size={12} strokeWidth={2.5} /> Add Service
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Column headers */}
        <div style={{ padding: '8px 22px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px 80px auto', gap: 12, background: 'var(--bg-panel)', position: 'sticky', top: 0 }}>
          {['Name', 'Namespace / Service', 'Local', 'Remote', 'Status', ''].map(h => (
            <div key={h} style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</div>
          ))}
        </div>

        {Object.entries(groups).map(([group, pfs]) => {
          const isCollapsed = collapsed.has(group)
          return (
            <div key={group}>
              {/* Group row */}
              <div onClick={() => toggleGroup(group)}
                style={{ padding: '7px 22px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', userSelect: 'none' }}>
                {isCollapsed ? <ChevronRight size={11} color="var(--text-muted)" /> : <ChevronDown size={11} color="var(--text-muted)" />}
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{group}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({pfs.length})</span>
              </div>

              {!isCollapsed && pfs.map(pf => {
                const proc = pfProcesses[pf.id]
                const status = proc?.status ?? 'stopped'
                const isRunning = status === 'running'
                return (
                  <div key={pf.id} style={{ padding: '9px 22px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px 80px auto', gap: 12, alignItems: 'center', background: isRunning ? 'rgba(57,217,138,0.03)' : 'transparent', transition: 'background 0.2s' }}>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pf.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{pf.namespace}</span>
                      <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>/</span>
                      {pf.service}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: isRunning ? 'var(--accent-green)' : 'var(--text-secondary)' }}>:{pf.local_port}</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>:{pf.remote_port}</div>
                    <div>
                      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', color: isRunning ? 'var(--accent-green)' : status === 'error' ? 'var(--accent-red)' : 'var(--text-muted)', background: isRunning ? 'var(--accent-green-dim)' : status === 'error' ? 'var(--accent-red-dim)' : 'rgba(255,255,255,0.04)', padding: '2px 7px', borderRadius: 3, textTransform: 'uppercase' }}>
                        {status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <ActionBtn onClick={() => setView('pf-edit', undefined, pf)} title="Edit" color="var(--accent-blue)"><Pencil size={11} /></ActionBtn>
                      <ActionBtn onClick={() => handleDelete(pf)} title={confirmDel === pf.id ? 'Confirm?' : 'Delete'} color={confirmDel === pf.id ? 'var(--accent-red)' : 'var(--text-muted)'}><Trash2 size={11} /></ActionBtn>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}

        {portForwards.length === 0 && (
          <div style={{ padding: '48px 22px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No port-forward services yet. Click "Add Service" to get started.
          </div>
        )}
      </div>
    </div>
  )
}

function ActionBtn({ children, onClick, title, color }: { children: React.ReactNode; onClick: () => void; title: string; color: string }) {
  return (
    <button onClick={onClick} title={title}
      style={{ width: 22, height: 22, border: 'none', background: 'transparent', color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3 }}>
      {children}
    </button>
  )
}
