import React from 'react'
import { ArrowLeft, Save, Zap, ChevronDown, FileText, Copy } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { EnvironmentFormData } from '../types'

const AWS_REGIONS = [
  'ca-central-1','us-east-1','us-east-2','us-west-1','us-west-2',
  'eu-west-1','eu-west-2','eu-central-1','ap-southeast-1','ap-southeast-2',
  'ap-northeast-1','ap-south-1',
]

const MFA_TYPES = ['push', 'token:software:totp', 'token:hardware', 'sms', 'call', 'email']

const EMPTY_FORM: EnvironmentFormData = {
  name:                 '',
  okta_profile:         '',
  okta_org_url:         '',
  okta_auth_server:     '',
  client_id:            '',
  gimme_creds_server:   'appurl',
  aws_appname:          '',
  aws_rolename:         '',
  okta_username:        '',
  app_url:              '',
  preferred_mfa_type:   'push',
  aws_default_duration: 3600,
  eks_cluster_name:     '',
  aws_region:           'ca-central-1',
  aws_profile:          '',
  eks_command:          '',
}

export default function EnvFormView() {
  const { view, editingEnv, setView, addEnvironment, updateEnvironment } = useStore()
  const isEdit = view === 'edit'
  // Duplicate: view is 'create' but editingEnv is pre-filled as a clone source
  const isDuplicate = view === 'create' && !!editingEnv

  const [form, setForm] = React.useState<EnvironmentFormData>(
    editingEnv ? { ...EMPTY_FORM, ...editingEnv } : { ...EMPTY_FORM }
  )
  const [saving, setSaving] = React.useState(false)
  const [errors, setErrors] = React.useState<Partial<Record<keyof EnvironmentFormData, string>>>({})
  const [autoGenCmd, setAutoGenCmd] = React.useState(false)

  // Live preview of the config file that will be written
  const configPreview = `[${form.name || '<environment_name>'}]
okta_org_url = ${form.okta_org_url}
okta_auth_server = ${form.okta_auth_server}
client_id = ${form.client_id}
gimme_creds_server = ${form.gimme_creds_server || 'appurl'}
aws_appname = ${form.aws_appname}
aws_rolename = ${form.aws_rolename}
write_aws_creds = True
cred_profile = ${form.okta_profile || '<profile>'}
okta_username = ${form.okta_username}
app_url = ${form.app_url}
resolve_aws_alias = True
include_path = True
preferred_mfa_type = ${form.preferred_mfa_type || 'push'}
remember_device = True
aws_default_duration = ${form.aws_default_duration || 3600}
output_format = 
open_browser = 
enable_keychain = True`

  const buildEksCmd = (f: typeof form) =>
    f.eks_cluster_name && f.aws_region && f.aws_profile
      ? `aws eks update-kubeconfig --name ${f.eks_cluster_name} --region ${f.aws_region} --profile ${f.aws_profile}`
      : f.eks_command

  const parseOktaConfig = (text: string) => {
    const lines = text.split('\n')
    const updated = { ...form }
    lines.forEach(line => {
      // Parse section header [environment_name]
      const sectionMatch = line.match(/^\s*\[(.+?)\]\s*$/)
      if (sectionMatch) {
        updated.name = sectionMatch[1]
        return
      }
      
      // Parse key=value pairs
      const match = line.match(/^\s*(\w+)\s*=\s*(.*)$/)
      if (!match) return
      const [, key, value] = match
      const trimmedValue = value.trim()
      
      switch (key) {
        case 'okta_org_url': updated.okta_org_url = trimmedValue; break
        case 'okta_auth_server': updated.okta_auth_server = trimmedValue; break
        case 'client_id': updated.client_id = trimmedValue; break
        case 'gimme_creds_server': updated.gimme_creds_server = trimmedValue; break
        case 'aws_appname': updated.aws_appname = trimmedValue; break
        case 'aws_rolename': updated.aws_rolename = trimmedValue; break
        case 'okta_username': updated.okta_username = trimmedValue; break
        case 'app_url': updated.app_url = trimmedValue; break
        case 'preferred_mfa_type': updated.preferred_mfa_type = trimmedValue; break
        case 'aws_default_duration': updated.aws_default_duration = parseInt(trimmedValue) || 3600; break
        case 'cred_profile': updated.okta_profile = trimmedValue; break
      }
    })
    return updated
  }

  const parseEksCommand = (cmd: string) => {
    const updated = { ...form }
    // Match: aws eks update-kubeconfig --name CLUSTER --region REGION --profile PROFILE
    const nameMatch = cmd.match(/--name\s+(\S+)/)
    const regionMatch = cmd.match(/--region\s+(\S+)/)
    const profileMatch = cmd.match(/--profile\s+(\S+)/)
    
    if (nameMatch) updated.eks_cluster_name = nameMatch[1]
    if (regionMatch) updated.aws_region = regionMatch[1]
    if (profileMatch) updated.aws_profile = profileMatch[1]
    
    return updated
  }

  const handleChange = (field: keyof EnvironmentFormData, value: string | number) => {
    let finalValue = value
    // Remove spaces from name field
    if (field === 'name' && typeof value === 'string') {
      finalValue = value.replace(/\s+/g, '-')
    }
    const updated = { ...form, [field]: finalValue }
    if (field === 'name' && !form.okta_profile) updated.okta_profile = String(finalValue)
    if (['eks_cluster_name', 'aws_region', 'aws_profile'].includes(field)) {
      updated.eks_command = buildEksCmd(updated)
      setAutoGenCmd(true)
    }
    setForm(updated)
    setErrors(e => ({ ...e, [field]: undefined }))
  }

  const validate = () => {
    const e: typeof errors = {}
    if (!form.name.trim())        e.name = 'Required'
    if (form.name.includes(' '))  e.name = 'Spaces not allowed (use hyphens instead)'
    if (!form.okta_profile.trim()) e.okta_profile = 'Required'
    if (!form.okta_org_url.trim()) e.okta_org_url = 'Required'
    if (!form.eks_command.trim()) e.eks_command = 'Required'
    return e
  }

  const handleSave = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      if (isEdit && editingEnv) {
        const updated = await window.api.env.update(editingEnv.id, form)
        updateEnvironment(updated)
      } else {
        const created = await window.api.env.create(form)
        addEnvironment(created)
      }
      setView('home')
    } finally { setSaving(false) }
  }

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
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {isEdit ? 'Edit Environment' : isDuplicate ? 'Duplicate Environment' : 'New Environment'}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
            {isEdit ? editingEnv?.name : isDuplicate ? `Copy of ${editingEnv?.name}` : 'Configure a new EKS target'}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
        <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Duplicate banner */}
          {isDuplicate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--accent-amber-dim)', border: '1px solid var(--accent-amber)', borderRadius: 6 }}>
              <Copy size={13} color="var(--accent-amber)" />
              <div style={{ fontSize: 11, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                Duplicated from <strong>{editingEnv?.name}</strong> — update the name and any values that differ, then save.
              </div>
            </div>
          )}

          {/* ── Identity ── */}
          <Section title="Identity" subtitle="Environment name and Okta profile section name">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Environment Name" error={errors.name} required>
                <Input value={form.name} onChange={v => handleChange('name', v)} placeholder="e.g. skyhive-prod" error={!!errors.name} />
              </Field>
              <Field label="Okta Profile Name" error={errors.okta_profile} required hint="[section] in the config file">
                <Input value={form.okta_profile} onChange={v => handleChange('okta_profile', v)} placeholder="e.g. skyhive-prod" error={!!errors.okta_profile} />
              </Field>
            </div>
          </Section>

          {/* ── Okta Configuration ── */}
          <Section title="Okta Configuration" subtitle="All fields written to a temp config file passed to gimme-aws-creds">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

              <Field label="okta_org_url" error={errors.okta_org_url} required style={{ gridColumn: '1 / -1' }}>
                <Input value={form.okta_org_url} onChange={v => handleChange('okta_org_url', v)} placeholder="https://yourcompany.okta.com" error={!!errors.okta_org_url} />
              </Field>

              <Field label="okta_auth_server">
                <Input value={form.okta_auth_server} onChange={v => handleChange('okta_auth_server', v)} placeholder="(leave blank if not used)" />
              </Field>

              <Field label="client_id">
                <Input value={form.client_id} onChange={v => handleChange('client_id', v)} placeholder="(leave blank if not used)" />
              </Field>

              <Field label="gimme_creds_server">
                <Input value={form.gimme_creds_server} onChange={v => handleChange('gimme_creds_server', v)} placeholder="appurl" />
              </Field>

              <Field label="app_url">
                <Input value={form.app_url} onChange={v => handleChange('app_url', v)} placeholder="https://yourcompany.okta.com/home/amazon_aws/..." />
              </Field>

              <Field label="aws_appname">
                <Input value={form.aws_appname} onChange={v => handleChange('aws_appname', v)} placeholder="Amazon Web Services" />
              </Field>

              <Field label="aws_rolename">
                <Input value={form.aws_rolename} onChange={v => handleChange('aws_rolename', v)} placeholder="all  (or full role ARN)" />
              </Field>

              <Field label="okta_username">
                <Input value={form.okta_username} onChange={v => handleChange('okta_username', v)} placeholder="you@company.com" />
              </Field>

              <Field label="preferred_mfa_type">
                <SelectField value={form.preferred_mfa_type} onChange={v => handleChange('preferred_mfa_type', v)} options={MFA_TYPES} />
              </Field>

              <Field label="aws_default_duration" hint="seconds">
                <Input value={String(form.aws_default_duration)} onChange={v => handleChange('aws_default_duration', parseInt(v) || 3600)} placeholder="3600" />
              </Field>

            </div>

            {/* Fixed fields info */}
            <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, padding: '7px 10px', lineHeight: 1.8 }}>
              The following are always written as fixed values:{' '}
              <code style={{ color: 'var(--accent-amber)' }}>write_aws_creds = True</code> ·{' '}
              <code style={{ color: 'var(--accent-amber)' }}>resolve_aws_alias = True</code> ·{' '}
              <code style={{ color: 'var(--accent-amber)' }}>include_path = True</code> ·{' '}
              <code style={{ color: 'var(--accent-amber)' }}>remember_device = True</code> ·{' '}
              <code style={{ color: 'var(--accent-amber)' }}>enable_keychain = True</code>
            </div>

            {/* Live config file preview */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <FileText size={10} /> Config file (editable)
              </div>
              <textarea value={configPreview} onChange={e => {
                setForm(parseOktaConfig(e.target.value))
                setErrors({})
              }}
                rows={11} spellCheck={false}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontSize: 10, padding: '8px 11px', outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--border-active)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                Written to a temp path and passed via{' '}
                <code style={{ color: 'var(--accent-green)' }}>gimme-aws-creds --profile {form.okta_profile || '<profile>'} --config &lt;tmpfile&gt;</code>,
                then deleted immediately.
              </div>
            </div>
          </Section>

          {/* ── AWS & EKS ── */}
          <Section title="AWS & EKS" subtitle="Cluster name, region, and IAM profile for kubeconfig">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="EKS Cluster Name">
                <Input value={form.eks_cluster_name} onChange={v => handleChange('eks_cluster_name', v)} placeholder="e.g. vcloud-prod-eks" />
              </Field>
              <Field label="AWS Region">
                <SelectField value={form.aws_region} onChange={v => handleChange('aws_region', v)} options={AWS_REGIONS} />
              </Field>
              <Field label="AWS Profile (IAM)" style={{ gridColumn: '1 / -1' }}>
                <Input value={form.aws_profile} onChange={v => handleChange('aws_profile', v)} placeholder="e.g. US-Int-SRE-EngineerPrivileged" />
              </Field>
            </div>
          </Section>

          {/* ── EKS Command ── */}
          <Section title="EKS Command" subtitle="Run after Okta auth to update kubeconfig"
            action={
              <button onClick={() => { handleChange('eks_command', buildEksCmd(form)); setAutoGenCmd(true) }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--accent-green-dim)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', borderRadius: 3, padding: '3px 9px', fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>
                <Zap size={10} /> Auto-generate
              </button>
            }>
            {autoGenCmd && <div style={{ fontSize: 10, color: 'var(--accent-green)', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 4 }}><Zap size={10} /> Generated from cluster / region / profile above</div>}
            <Field label="" error={errors.eks_command}>
              <textarea value={form.eks_command} onChange={e => { 
                const parsed = parseEksCommand(e.target.value)
                setForm(parsed)
                setAutoGenCmd(false)
                setErrors(err => ({ ...err, eks_command: undefined }))
              }}
                rows={2} spellCheck={false}
                style={{ width: '100%', background: 'var(--bg-input)', border: `1px solid ${errors.eks_command ? 'var(--accent-red)' : 'var(--border)'}`, borderRadius: 4, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '8px 11px', outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--border-active)'}
                onBlur={e => e.currentTarget.style.borderColor = errors.eks_command ? 'var(--accent-red)' : 'var(--border)'} />
            </Field>
          </Section>

        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', background: 'var(--bg-panel)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
        <button onClick={() => setView('home')} style={{ padding: '7px 18px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: '7px 20px', background: saving ? 'var(--bg-elevated)' : 'var(--accent-green)', border: 'none', borderRadius: 4, color: saving ? 'var(--text-muted)' : '#0d0f12', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          <Save size={12} /> {saving ? 'Saving...' : isEdit ? 'Save Changes' : isDuplicate ? 'Save Duplicate' : 'Create Environment'}
        </button>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>{children}</div>
    </div>
  )
}

function Field({ label, error, required, hint, children, style }: { label: string; error?: string; required?: boolean; hint?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      {label && (
        <div style={{ marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
          {required && <span style={{ color: 'var(--accent-red)', marginLeft: 3, fontSize: 9 }}>*</span>}
          {hint && <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 6, opacity: 0.6 }}>— {hint}</span>}
        </div>
      )}
      {children}
      {error && <div style={{ fontSize: 10, color: 'var(--accent-red)', marginTop: 3 }}>{error}</div>}
    </div>
  )
}

function Input({ value, onChange, placeholder, error }: { value: string; onChange: (v: string) => void; placeholder?: string; error?: boolean }) {
  const [focused, setFocused] = React.useState(false)
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', background: 'var(--bg-input)', border: `1px solid ${error ? 'var(--accent-red)' : focused ? 'var(--border-active)' : 'var(--border)'}`, borderRadius: 4, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, padding: '7px 10px', outline: 'none', transition: 'border-color 0.15s' }}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
  )
}

function SelectField({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', appearance: 'none', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, padding: '7px 28px 7px 10px', outline: 'none', cursor: 'pointer' }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={11} color="var(--text-muted)" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
    </div>
  )
}
