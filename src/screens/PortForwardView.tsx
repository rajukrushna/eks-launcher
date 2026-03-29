import React from 'react'
import { Play, Square, StopCircle, Plus, Pencil, Trash2, Settings, ChevronDown, ChevronRight, Activity } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { PortForward } from '../types'

const STATUS_COLOR: Record<string, string> = {
  running: 'var(--accent-green)',
  stopped: 'var(--text-muted)',
  error:   'var(--accent-red)',
}

const STATUS_BG: Record<string, string> = {
  running: 'var(--accent-green-dim)',
  stopped: 'rgba(255,255,255,0.04)',
  error:   'var(--accent-red-dim)',
}

export default function PortForwardView() {
  const { portForwards, pfProcesses, initPfProcess, setPfStatus, appendPfLog, setView } = useStore()
  const [expandedId, setExpandedId] = React.useState<number | null>(null)
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(new Set())
  const [confirmDel, setConfirmDel] = React.useState<number | null>(null)
  const logRefs = React.useRef<Record<number, HTMLDivElement>>({})

  // Subscribe to log + status streams from main process
  React.useEffect(() => {
    const unsubLog = window.api.pf.onLog(({ id, line, type }) => appendPfLog(id, line, type))
    const unsubStatus = window.api.pf.onStatusChange(({ id, status }) => setPfStatus(id, status as any))
    return () => { unsubLog(); unsubStatus() }
  }, [appendPfLog, setPfStatus])

  // Init process state for all port-forwards
  React.useEffect(() => {
    portForwards.forEach(pf => { if (!pfProcesses[pf.id]) initPfProcess(pf) })
  }, [portForwards])

  // Auto-scroll logs
  React.useEffect(() => {
    if (expandedId && logRefs.current[expandedId]) {
      logRefs.current[expandedId].scrollTop = logRefs.current[expandedId].scrollHeight
    }
  }, [pfProcesses, expandedId])

  const start = async (pf: PortForward) => {
    if (!pfProcesses[pf.id]) initPfProcess(pf)
    setPfStatus(pf.id, 'running')
    await window.api.pf.start(pf)
  }

  const stop = async (id: number) => {
    await window.api.pf.stop(id)
  }

  const stopAll = async () => {
    await window.api.pf.stopAll()
  }

  const startAll = async () => {
    for (const pf of portForwards) {
      const proc = pfProcesses[pf.id]
      if (!proc || proc.status !== 'running') await start(pf)
    }
  }

  const handleDelete = async (e: React.MouseEvent, pf: PortForward) => {
    e.stopPropagation()
    if (confirmDel === pf.id) {
      await window.api.pf.delete(pf.id)
      useStore.getState().removePortForward(pf.id)
      setConfirmDel(null)
    } else {
      setConfirmDel(pf.id)
      setTimeout(() => setConfirmDel(null), 3000)
    }
  }

  // Group port-forwards
  const groups = portForwards.reduce((acc, pf) => {
    const g = pf.group_name || 'Services'
    if (!acc[g]) acc[g] = []
    acc[g].push(pf)
    return acc
  }, {} as Record<string, PortForward[]>)

  const runningCount = Object.values(pfProcesses).filter(p => p.status === 'running').length

  const toggleGroup = (g: string) => setCollapsedGroups(prev => {
    const next = new Set(prev)
    next.has(g) ? next.delete(g) : next.add(g)
    return next
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ padding: '10px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: runningCount > 0 ? 'var(--accent-green)' : 'var(--text-muted)', boxShadow: runningCount > 0 ? '0 0 6px var(--accent-green)' : 'none', animation: runningCount > 0 ? 'pulse-dot 1.5s ease-in-out infinite' : 'none' }} />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {runningCount} / {portForwards.length} running
          </span>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Btn onClick={startAll} color="var(--accent-green)" icon={<Play size={11} fill="currentColor" />}>Start All</Btn>
          <Btn onClick={stopAll} color="var(--accent-red)" icon={<StopCircle size={11} />}>Stop All</Btn>
          <Btn onClick={() => setView('pf-manage')} color="var(--text-secondary)" icon={<Settings size={11} />}>Manage</Btn>
        </div>
      </div>

      {/* Service groups */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {Object.entries(groups).map(([group, pfs]) => {
          const isCollapsed = collapsedGroups.has(group)
          const groupRunning = pfs.filter(pf => pfProcesses[pf.id]?.status === 'running').length
          return (
            <div key={group} style={{ marginBottom: 4 }}>
              {/* Group header */}
              <div onClick={() => toggleGroup(group)}
                style={{ padding: '6px 22px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                {isCollapsed ? <ChevronRight size={12} color="var(--text-muted)" /> : <ChevronDown size={12} color="var(--text-muted)" />}
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{group}</span>
                {groupRunning > 0 && (
                  <span style={{ fontSize: 9, color: 'var(--accent-green)', background: 'var(--accent-green-dim)', padding: '1px 6px', borderRadius: 3 }}>{groupRunning} up</span>
                )}
              </div>

              {!isCollapsed && pfs.map(pf => {
                const proc = pfProcesses[pf.id]
                const status = proc?.status ?? 'stopped'
                const isExpanded = expandedId === pf.id
                const isRunning = status === 'running'

                return (
                  <div key={pf.id} style={{ margin: '1px 12px', borderRadius: 5, border: `1px solid ${isRunning ? 'rgba(57,217,138,0.2)' : 'var(--border)'}`, background: isExpanded ? 'var(--bg-card)' : 'transparent', transition: 'border-color 0.2s' }}>
                    {/* Row */}
                    <div onClick={() => setExpandedId(isExpanded ? null : pf.id)}
                      style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      {/* Status dot */}
                      <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: STATUS_COLOR[status], animation: isRunning ? 'pulse-dot 1.5s ease-in-out infinite' : 'none', boxShadow: isRunning ? `0 0 5px var(--accent-green)` : 'none' }} />

                      {/* Name + ports */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: isRunning ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pf.name}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{pf.namespace}</span>
                        </div>
                      </div>

                      {/* Port badge */}
                      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: isRunning ? 'var(--accent-green)' : 'var(--text-muted)', background: isRunning ? 'var(--accent-green-dim)' : 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 3 }}>
                          :{pf.local_port}→:{pf.remote_port}
                        </span>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        {isRunning
                          ? <ActionBtn onClick={() => stop(pf.id)} title="Stop" color="var(--accent-red)"><Square size={11} fill="currentColor" /></ActionBtn>
                          : <ActionBtn onClick={() => start(pf)} title="Start" color="var(--accent-green)"><Play size={11} fill="currentColor" /></ActionBtn>
                        }
                        <ActionBtn onClick={e => { e.stopPropagation(); setView('pf-edit', undefined, pf) }} title="Edit" color="var(--accent-blue)"><Pencil size={11} /></ActionBtn>
                        <ActionBtn onClick={e => handleDelete(e, pf)} title={confirmDel === pf.id ? 'Confirm?' : 'Delete'} color={confirmDel === pf.id ? 'var(--accent-red)' : 'var(--text-muted)'}><Trash2 size={11} /></ActionBtn>
                      </div>
                    </div>

                    {/* Expanded log */}
                    {isExpanded && (
                      <div>
                        <div style={{ borderTop: '1px solid var(--border)', padding: '6px 12px', background: 'var(--bg-base)' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Command</div>
                          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>$ {pf.command}</div>
                        </div>
                        <div ref={el => { if (el) logRefs.current[pf.id] = el }}
                          style={{ borderTop: '1px solid var(--border)', maxHeight: 140, overflowY: 'auto', padding: '8px 12px', background: 'var(--bg-base)', fontFamily: 'var(--font-mono)', fontSize: 10, lineHeight: 1.7 }}>
                          {!proc?.logs.length
                            ? <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>No output yet</span>
                            : proc.logs.map((l, i) => (
                                <div key={i} style={{ color: l.startsWith('[error]') ? 'var(--accent-red)' : l.startsWith('[stdout]') ? 'var(--text-secondary)' : 'var(--accent-amber)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{l}</div>
                              ))
                          }
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}

        {portForwards.length === 0 && (
          <div style={{ padding: '40px 22px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Activity size={28} style={{ opacity: 0.25, marginBottom: 10 }} />
            <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>No port-forwards configured</div>
            <div style={{ fontSize: 12 }}>Click Manage to add services</div>
          </div>
        )}
      </div>
    </div>
  )
}

function Btn({ children, onClick, color, icon }: { children: React.ReactNode; onClick: () => void; color: string; icon: React.ReactNode }) {
  const [hov, setHov] = React.useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', border: `1px solid ${hov ? color : 'var(--border)'}`, borderRadius: 4, background: hov ? `${color}18` : 'transparent', color: hov ? color : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.04em' }}>
      {icon} {children}
    </button>
  )
}

function ActionBtn({ children, onClick, title, color }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void; title: string; color: string }) {
  return (
    <button onClick={onClick} title={title}
      style={{ width: 22, height: 22, border: 'none', background: 'transparent', color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3 }}>
      {children}
    </button>
  )
}
