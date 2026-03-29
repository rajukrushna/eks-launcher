import { create } from 'zustand'
import type { Environment, LogEntry, RunStatus, MainTab, PortForward, PortForwardProcess } from '../types'

interface AppStore {
  // Environments
  environments: Environment[]
  selectedEnv: Environment | null
  setEnvironments: (envs: Environment[]) => void
  setSelectedEnv: (env: Environment | null) => void
  addEnvironment: (env: Environment) => void
  updateEnvironment: (env: Environment) => void
  removeEnvironment: (id: number) => void

  // EKS connect
  runStatus: RunStatus
  logs: LogEntry[]
  setRunStatus: (s: RunStatus) => void
  appendLog: (e: LogEntry) => void
  clearLogs: () => void

  // Port forwards — definitions from DB
  portForwards: PortForward[]
  setPortForwards: (pfs: PortForward[]) => void
  addPortForward: (pf: PortForward) => void
  updatePortForward: (pf: PortForward) => void
  removePortForward: (id: number) => void

  // Port forwards — runtime process state
  pfProcesses: Record<number, PortForwardProcess>
  setPfStatus: (id: number, status: PortForwardProcess['status']) => void
  appendPfLog: (id: number, line: string, type: string) => void
  initPfProcess: (pf: PortForward) => void
  clearPfProcess: (id: number) => void

  // UI
  mainTab: MainTab
  setMainTab: (t: MainTab) => void
  view: 'home' | 'edit' | 'create' | 'pf-manage' | 'pf-edit' | 'pf-create'
  editingEnv: Environment | null
  editingPf: PortForward | null
  setView: (v: AppStore['view'], env?: Environment, pf?: PortForward) => void
}

export const useStore = create<AppStore>((set) => ({
  environments: [],
  selectedEnv: null,
  setEnvironments: (environments) => set({ environments }),
  setSelectedEnv: (selectedEnv) => set({ selectedEnv }),
  addEnvironment: (env) => set(s => ({ environments: [...s.environments, env].sort((a, b) => a.name.localeCompare(b.name)) })),
  updateEnvironment: (env) => set(s => ({ environments: s.environments.map(e => e.id === env.id ? env : e) })),
  removeEnvironment: (id) => set(s => ({
    environments: s.environments.filter(e => e.id !== id),
    selectedEnv: s.selectedEnv?.id === id ? null : s.selectedEnv,
  })),

  runStatus: 'idle',
  logs: [],
  setRunStatus: (runStatus) => set({ runStatus }),
  appendLog: (entry) => set(s => ({ logs: [...s.logs, entry] })),
  clearLogs: () => set({ logs: [] }),

  portForwards: [],
  setPortForwards: (portForwards) => set({ portForwards }),
  addPortForward: (pf) => set(s => ({ portForwards: [...s.portForwards, pf] })),
  updatePortForward: (pf) => set(s => ({ portForwards: s.portForwards.map(p => p.id === pf.id ? pf : p) })),
  removePortForward: (id) => set(s => ({ portForwards: s.portForwards.filter(p => p.id !== id) })),

  pfProcesses: {},
  initPfProcess: (pf) => set(s => ({
    pfProcesses: {
      ...s.pfProcesses,
      [pf.id]: { id: pf.id, name: pf.name, group_name: pf.group_name, local_port: pf.local_port, command: pf.command, status: 'stopped', logs: [] }
    }
  })),
  setPfStatus: (id, status) => set(s => ({
    pfProcesses: { ...s.pfProcesses, [id]: { ...s.pfProcesses[id], status } }
  })),
  appendPfLog: (id, line, type) => set(s => {
    const proc = s.pfProcesses[id]
    if (!proc) return s
    const logs = [...proc.logs, `[${type}] ${line}`].slice(-200) // keep last 200 lines
    return { pfProcesses: { ...s.pfProcesses, [id]: { ...proc, logs } } }
  }),
  clearPfProcess: (id) => set(s => {
    const next = { ...s.pfProcesses }
    delete next[id]
    return { pfProcesses: next }
  }),

  mainTab: 'connect',
  setMainTab: (mainTab) => set({ mainTab }),

  view: 'home',
  editingEnv: null,
  editingPf: null,
  setView: (view, env, pf) => set({ view, editingEnv: env ?? null, editingPf: pf ?? null }),
}))
