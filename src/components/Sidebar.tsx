import React from 'react'
import { Plus, Server, Pencil, Trash2, Copy, ChevronRight } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { Environment } from '../types'

function envTier(name: string) {
  if (name.includes('prod'))  return { label: 'PROD', color: 'var(--accent-red)',   bg: 'var(--accent-red-dim)' }
  if (name.includes('uat') || name.includes('stage')) return { label: 'UAT', color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)' }
  if (name.includes('qa') || name.includes('test') || name.includes('sit')) return { label: 'QA', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' }
  return { label: 'DEV', color: 'var(--accent-green)', bg: 'var(--accent-green-dim)' }
}

export default function Sidebar() {
  const { environments, selectedEnv, setSelectedEnv, setView, removeEnvironment, runStatus } = useStore()
  const [hovId, setHovId] = React.useState<number | null>(null)
  const [confirmDel, setConfirmDel] = React.useState<number | null>(null)

  const handleDelete = async (e: React.MouseEvent, env: Environment) => {
    e.stopPropagation()
    if (confirmDel === env.id) {
      await window.api.env.delete(env.id)
      removeEnvironment(env.id)
      setConfirmDel(null)
    } else {
      setConfirmDel(env.id)
      setTimeout(() => setConfirmDel(null), 3000)
    }
  }

  const handleDuplicate = (e: React.MouseEvent, env: Environment) => {
    e.stopPropagation()
    // Open create form pre-filled with a cloned env — name cleared so user must rename
    const clone = { ...env, name: `${env.name}-copy`, id: 0 as any, created_at: '', updated_at: '' }
    setView('create', clone as Environment)
  }

  return (
    <aside style={{ width: 252, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--bg-panel)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>Environments</div>
          <div style={{ fontSize: 17, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {environments.length} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, fontFamily: 'var(--font-mono)' }}>configured</span>
          </div>
        </div>
        <button onClick={() => setView('create')} title="Add environment"
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-green-dim)'; e.currentTarget.style.borderColor = 'var(--accent-green)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)' }}
          style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--accent-green)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
          <Plus size={13} strokeWidth={2.5} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {environments.length === 0 && (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            <Server size={26} style={{ opacity: 0.25, marginBottom: 8 }} />
            <div>No environments yet</div>
            <div style={{ marginTop: 3, fontSize: 11 }}>Click + to add one</div>
          </div>
        )}
        {environments.map((env, i) => {
          const isSelected = selectedEnv?.id === env.id
          const isHov = hovId === env.id
          const tag = envTier(env.name)
          const isRunning = runStatus === 'running' && isSelected
          return (
            <div key={env.id} onClick={() => { setSelectedEnv(env); setView('home') }}
              onMouseEnter={() => setHovId(env.id)} onMouseLeave={() => setHovId(null)}
              className="animate-slide"
              style={{ animationDelay: `${i * 25}ms`, margin: '1px 7px', padding: '9px 10px', borderRadius: 5, background: isSelected ? 'var(--bg-elevated)' : isHov ? 'rgba(255,255,255,0.03)' : 'transparent', border: `1px solid ${isSelected ? 'var(--border-active)' : 'transparent'}`, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 9 }}>

              {/* Status dot */}
              <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: isRunning ? 'var(--accent-amber)' : isSelected ? 'var(--accent-green)' : 'var(--text-muted)', animation: isRunning ? 'pulse-dot 1s ease-in-out infinite' : 'none', boxShadow: isSelected && !isRunning ? '0 0 5px var(--accent-green)' : 'none' }} />

              {/* Name + cluster */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{env.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{env.eks_cluster_name}</div>
              </div>

              {/* Actions / tag */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {(isHov || isSelected) ? (
                  <div style={{ display: 'flex', gap: 2 }}>
                    <IconBtn
                      onClick={e => { e.stopPropagation(); setView('edit', env) }}
                      title="Edit"
                      color="var(--accent-blue)"
                    >
                      <Pencil size={11} />
                    </IconBtn>
                    <IconBtn
                      onClick={e => handleDuplicate(e, env)}
                      title="Duplicate"
                      color="var(--accent-amber)"
                    >
                      <Copy size={11} />
                    </IconBtn>
                    <IconBtn
                      onClick={e => handleDelete(e, env)}
                      title={confirmDel === env.id ? 'Confirm?' : 'Delete'}
                      color={confirmDel === env.id ? 'var(--accent-red)' : 'var(--text-muted)'}
                    >
                      <Trash2 size={11} />
                    </IconBtn>
                  </div>
                ) : (
                  <span style={{ fontSize: 9, letterSpacing: '0.08em', color: tag.color, background: tag.bg, padding: '2px 5px', borderRadius: 3, fontWeight: 600 }}>{tag.label}</span>
                )}
                {isSelected && <ChevronRight size={11} color="var(--text-muted)" />}
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

function IconBtn({ children, onClick, title, color }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void; title: string; color: string }) {
  return (
    <button onClick={onClick} title={title}
      style={{ width: 20, height: 20, border: 'none', background: 'transparent', color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3 }}>
      {children}
    </button>
  )
}
