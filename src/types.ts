export interface Environment {
  id: number
  name: string
  okta_profile: string
  // Okta config file fields
  okta_org_url: string
  okta_auth_server: string
  client_id: string
  gimme_creds_server: string
  aws_appname: string
  aws_rolename: string
  okta_username: string
  app_url: string
  preferred_mfa_type: string
  aws_default_duration: number
  // EKS fields
  eks_cluster_name: string
  aws_region: string
  aws_profile: string
  eks_command: string
  created_at: string
  updated_at: string
}

export type EnvironmentFormData = Omit<Environment, 'id' | 'created_at' | 'updated_at'>

export interface PortForward {
  id: number
  name: string
  group_name: string
  namespace: string
  service: string
  local_port: number
  remote_port: number
  command: string
  created_at: string
  updated_at: string
}

export type PortForwardFormData = Omit<PortForward, 'id' | 'created_at' | 'updated_at'>

export interface PortForwardProcess {
  id: number
  name: string
  group_name: string
  local_port: number
  command: string
  status: 'running' | 'stopped' | 'error'
  logs: string[]
}

export interface LogEntry {
  line: string
  type: 'cmd' | 'stdout' | 'stderr' | 'success' | 'error'
  ts: number
}

export type RunStatus = 'idle' | 'running' | 'success' | 'error'
export type MainTab = 'connect' | 'portforward'

declare global {
  interface Window {
    api: {
      window: {
        minimize: () => void
        maximize: () => void
        close: () => void
      }
      env: {
        list: () => Promise<Environment[]>
        get: (id: number) => Promise<Environment>
        create: (data: EnvironmentFormData) => Promise<Environment>
        update: (id: number, data: EnvironmentFormData) => Promise<Environment>
        delete: (id: number) => Promise<{ success: boolean }>
      }
      cmd: {
        run: (env: Environment) => Promise<{ success: boolean }>
        onLog: (cb: (data: { line: string; type: string }) => void) => () => void
      }
      okta: {
        readProfiles: () => Promise<{ profiles: string[]; error?: string }>
      }
      pf: {
        list: () => Promise<PortForward[]>
        create: (data: PortForwardFormData) => Promise<PortForward>
        update: (id: number, data: PortForwardFormData) => Promise<PortForward>
        delete: (id: number) => Promise<{ success: boolean }>
        start: (pf: PortForward) => Promise<{ success: boolean }>
        stop: (id: number) => Promise<{ success: boolean }>
        stopAll: () => Promise<{ success: boolean }>
        onLog: (cb: (data: { id: number; line: string; type: string }) => void) => () => void
        onStatusChange: (cb: (data: { id: number; status: string }) => void) => () => void
      }
      data: {
        export: () => Promise<{ success: boolean; filePath?: string; error?: string }>
        import: () => Promise<{ success: boolean; imported?: { envCount: number; pfCount: number }; error?: string }>
      }
    }
  }
}
