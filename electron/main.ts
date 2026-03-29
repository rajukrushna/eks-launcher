import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { spawn, ChildProcess } from 'child_process'
import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

let mainWindow: BrowserWindow | null = null
let db: Database.Database | null = null

const pfProcesses = new Map<number, ChildProcess>()

// ─── Database ─────────────────────────────────────────────────────────────────

function initDb(): Database.Database {
  const dbPath = join(app.getPath('userData'), 'eks-launcher.db')
  const database = new Database(dbPath)

  database.exec(`
    CREATE TABLE IF NOT EXISTS environments (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      name                  TEXT NOT NULL UNIQUE,
      okta_profile          TEXT NOT NULL DEFAULT '',
      -- Okta config fields (written to temp file on connect)
      okta_org_url          TEXT NOT NULL DEFAULT '',
      okta_auth_server      TEXT NOT NULL DEFAULT '',
      client_id             TEXT NOT NULL DEFAULT '',
      gimme_creds_server    TEXT NOT NULL DEFAULT 'appurl',
      aws_appname           TEXT NOT NULL DEFAULT '',
      aws_rolename          TEXT NOT NULL DEFAULT '',
      okta_username         TEXT NOT NULL DEFAULT '',
      app_url               TEXT NOT NULL DEFAULT '',
      preferred_mfa_type    TEXT NOT NULL DEFAULT 'push',
      aws_default_duration  INTEGER NOT NULL DEFAULT 3600,
      -- EKS fields
      eks_cluster_name      TEXT NOT NULL DEFAULT '',
      aws_region            TEXT NOT NULL DEFAULT 'ca-central-1',
      aws_profile           TEXT NOT NULL DEFAULT '',
      eks_command           TEXT NOT NULL DEFAULT '',
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TRIGGER IF NOT EXISTS trg_env_updated
    AFTER UPDATE ON environments
    BEGIN
      UPDATE environments SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

    CREATE TABLE IF NOT EXISTS port_forwards (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      group_name  TEXT NOT NULL DEFAULT 'Services',
      namespace   TEXT NOT NULL,
      service     TEXT NOT NULL,
      local_port  INTEGER NOT NULL,
      remote_port INTEGER NOT NULL,
      command     TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TRIGGER IF NOT EXISTS trg_pf_updated
    AFTER UPDATE ON port_forwards
    BEGIN
      UPDATE port_forwards SET updated_at = datetime('now') WHERE id = NEW.id;
    END;
  `)

  // Migrate: add new okta columns if upgrading from old schema
  const cols = (database.prepare("PRAGMA table_info(environments)").all() as any[]).map(c => c.name)
  const newCols: Record<string, string> = {
    client_id:            "TEXT NOT NULL DEFAULT ''",
    gimme_creds_server:   "TEXT NOT NULL DEFAULT 'appurl'",
    app_url:              "TEXT NOT NULL DEFAULT ''",
    preferred_mfa_type:   "TEXT NOT NULL DEFAULT 'push'",
    aws_default_duration: "INTEGER NOT NULL DEFAULT 3600",
  }
  for (const [col, def] of Object.entries(newCols)) {
    if (!cols.includes(col)) {
      database.exec(`ALTER TABLE environments ADD COLUMN ${col} ${def}`)
    }
  }

  return database
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 760, minWidth: 960, minHeight: 620,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: false,
    backgroundColor: '#0d0f12',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  db = initDb()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => {
  pfProcesses.forEach(p => p.kill())
  pfProcesses.clear()
  db?.close()
  if (process.platform !== 'darwin') app.quit()
})

// ─── Window Controls ──────────────────────────────────────────────────────────

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => { mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize() })
ipcMain.on('window:close', () => { pfProcesses.forEach(p => p.kill()); mainWindow?.close() })

// ─── Environments CRUD ────────────────────────────────────────────────────────

ipcMain.handle('env:list', () => db!.prepare('SELECT * FROM environments ORDER BY name ASC').all())
ipcMain.handle('env:get',  (_e, id: number) => db!.prepare('SELECT * FROM environments WHERE id = ?').get(id))

ipcMain.handle('env:create', (_e, data: any) => {
  const r = db!.prepare(`
    INSERT INTO environments (
      name, okta_profile,
      okta_org_url, okta_auth_server, client_id, gimme_creds_server,
      aws_appname, aws_rolename, okta_username, app_url,
      preferred_mfa_type, aws_default_duration,
      eks_cluster_name, aws_region, aws_profile, eks_command
    ) VALUES (
      @name, @okta_profile,
      @okta_org_url, @okta_auth_server, @client_id, @gimme_creds_server,
      @aws_appname, @aws_rolename, @okta_username, @app_url,
      @preferred_mfa_type, @aws_default_duration,
      @eks_cluster_name, @aws_region, @aws_profile, @eks_command
    )
  `).run(data)
  return db!.prepare('SELECT * FROM environments WHERE id = ?').get(r.lastInsertRowid)
})

ipcMain.handle('env:update', (_e, id: number, data: any) => {
  db!.prepare(`
    UPDATE environments SET
      name=@name, okta_profile=@okta_profile,
      okta_org_url=@okta_org_url, okta_auth_server=@okta_auth_server,
      client_id=@client_id, gimme_creds_server=@gimme_creds_server,
      aws_appname=@aws_appname, aws_rolename=@aws_rolename,
      okta_username=@okta_username, app_url=@app_url,
      preferred_mfa_type=@preferred_mfa_type, aws_default_duration=@aws_default_duration,
      eks_cluster_name=@eks_cluster_name, aws_region=@aws_region,
      aws_profile=@aws_profile, eks_command=@eks_command
    WHERE id=@id
  `).run({ ...data, id })
  return db!.prepare('SELECT * FROM environments WHERE id = ?').get(id)
})

ipcMain.handle('env:delete', (_e, id: number) => {
  db!.prepare('DELETE FROM environments WHERE id = ?').run(id)
  return { success: true }
})

// ─── Okta config helpers ──────────────────────────────────────────────────────
// gimme-aws-creds has no --config flag — it always reads ~/.okta_aws_login_config
// Strategy: inject the profile section into that file, run, then restore original

function buildProfileSection(env: any): string {
  const kv = (key: string, val: string | number) => `${key} = ${val ?? ''}`
  return [
    `[${env.okta_profile}]`,
    kv('okta_org_url',         env.okta_org_url         ?? ''),
    kv('okta_auth_server',     env.okta_auth_server     ?? ''),
    kv('client_id',            env.client_id            ?? ''),
    kv('gimme_creds_server',   env.gimme_creds_server   || 'appurl'),
    kv('aws_appname',          env.aws_appname          ?? ''),
    kv('aws_rolename',         env.aws_rolename         ?? ''),
    kv('write_aws_creds',      'True'),
    kv('cred_profile',         env.okta_profile),
    kv('okta_username',        env.okta_username        ?? ''),
    kv('app_url',              env.app_url              ?? ''),
    kv('resolve_aws_alias',    'True'),
    kv('include_path',         'True'),
    kv('preferred_mfa_type',   env.preferred_mfa_type   || 'push'),
    kv('remember_device',      'True'),
    kv('aws_default_duration', env.aws_default_duration || 3600),
    kv('output_format',        ''),
    kv('open_browser',         ''),
    kv('enable_keychain',      'True'),
  ].join('\n')
}

function injectProfile(configPath: string, profileName: string, section: string): string | null {
  let original: string | null = null

  if (fs.existsSync(configPath)) {
    original = fs.readFileSync(configPath, 'utf-8')
    // Remove existing section for this profile if present
    const stripped = original.replace(
      new RegExp(`\\[${profileName}\\][^\\[]*`, 'g'), ''
    ).trimEnd()
    const updated = stripped ? `${stripped}\n\n${section}\n` : `${section}\n`
    fs.writeFileSync(configPath, updated, { mode: 0o600 })
  } else {
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
    fs.writeFileSync(configPath, `${section}\n`, { mode: 0o600 })
  }

  return original
}

function restoreConfig(configPath: string, original: string | null) {
  try {
    if (original === null) fs.unlinkSync(configPath)
    else fs.writeFileSync(configPath, original, { mode: 0o600 })
  } catch {}
}

// ─── EKS Connect ─────────────────────────────────────────────────────────────

ipcMain.handle('cmd:run', (_e, env: any) => {
  return new Promise((resolve) => {
    const emit = (line: string, type: string) =>
      mainWindow?.webContents.send('cmd:log', { line, type })

    if (!env.okta_org_url) {
      emit('✗ No Okta Org URL configured. Edit this environment and fill in the Okta Configuration section.', 'error')
      return resolve({ success: false })
    }

    const configPath = path.join(os.homedir(), '.okta_aws_login_config')
    const section = buildProfileSection(env)
    const original = injectProfile(configPath, env.okta_profile, section)
    emit(`✎ Injected [${env.okta_profile}] into ${configPath}`, 'stdout')

    // On Windows, gimme-aws-creds is typically not on PATH — invoke via Python directly.
    // On Mac/Linux use the gimme-aws-creds binary directly.
    const isWindows = process.platform === 'win32'
    const oktaCmd = isWindows
      ? `python -c "from gimme_aws_creds.main import GimmeAWSCreds; GimmeAWSCreds().run()" --profile ${env.okta_profile}`
      : `gimme-aws-creds --profile ${env.okta_profile}`

    if (isWindows) emit('ℹ Running via Python on Windows', 'stdout')
    emit(`\n$ ${oktaCmd}`, 'cmd')

    const okta = spawn(oktaCmd, [], { shell: true, env: { ...process.env } })
    okta.stdout.on('data', d => emit(d.toString().trimEnd(), 'stdout'))
    okta.stderr.on('data', d => emit(d.toString().trimEnd(), 'stderr'))

    okta.on('close', (code) => {
      // Always restore the original config file regardless of outcome
      restoreConfig(configPath, original)

      if (code !== 0) {
        if (isWindows && code === 1) {
          emit('ℹ If Python was not found, ensure Python is on your PATH or install gimme-aws-creds via pip', 'stderr')
        }
        emit(`\n✗ gimme-aws-creds failed (exit ${code})`, 'error')
        return resolve({ success: false })
      }

      emit('✓ AWS credentials obtained', 'success')
      emit(`\n$ ${env.eks_command}`, 'cmd')

      const eks = spawn(env.eks_command, [], { shell: true, env: { ...process.env } })
      eks.stdout.on('data', d => emit(d.toString().trimEnd(), 'stdout'))
      eks.stderr.on('data', d => emit(d.toString().trimEnd(), 'stderr'))
      eks.on('close', (eksCode) => {
        if (eksCode === 0) {
          emit('\n✓ kubeconfig updated successfully', 'success')
          resolve({ success: true })
        } else {
          emit(`\n✗ eks update-kubeconfig failed (exit ${eksCode})`, 'error')
          resolve({ success: false })
        }
      })
    })
  })
})


ipcMain.handle('okta:read-profiles', () => ({ profiles: [] }))

// ─── Port-Forwards CRUD ───────────────────────────────────────────────────────

ipcMain.handle('pf:list', () => db!.prepare('SELECT * FROM port_forwards ORDER BY group_name ASC, name ASC').all())

ipcMain.handle('pf:create', (_e, data: any) => {
  const r = db!.prepare(`
    INSERT INTO port_forwards (name, group_name, namespace, service, local_port, remote_port, command)
    VALUES (@name, @group_name, @namespace, @service, @local_port, @remote_port, @command)
  `).run(data)
  return db!.prepare('SELECT * FROM port_forwards WHERE id = ?').get(r.lastInsertRowid)
})

ipcMain.handle('pf:update', (_e, id: number, data: any) => {
  db!.prepare(`
    UPDATE port_forwards SET
      name=@name, group_name=@group_name, namespace=@namespace,
      service=@service, local_port=@local_port, remote_port=@remote_port, command=@command
    WHERE id=@id
  `).run({ ...data, id })
  return db!.prepare('SELECT * FROM port_forwards WHERE id = ?').get(id)
})

ipcMain.handle('pf:delete', (_e, id: number) => {
  const proc = pfProcesses.get(id)
  if (proc) { proc.kill(); pfProcesses.delete(id) }
  db!.prepare('DELETE FROM port_forwards WHERE id = ?').run(id)
  return { success: true }
})

// ─── Port-Forward Process Management ─────────────────────────────────────────

ipcMain.handle('pf:start', (_e, pf: any) => {
  const existing = pfProcesses.get(pf.id)
  if (existing) { existing.kill(); pfProcesses.delete(pf.id) }

  const emit    = (line: string, type: string) => mainWindow?.webContents.send('pf:log',    { id: pf.id, line, type })
  const emitSts = (status: string)             => mainWindow?.webContents.send('pf:status', { id: pf.id, status })

  const proc = spawn(pf.command, [], { shell: true, env: { ...process.env } })
  pfProcesses.set(pf.id, proc)
  emitSts('running')
  emit(`$ ${pf.command}`, 'cmd')

  proc.stdout.on('data', d => emit(d.toString().trimEnd(), 'stdout'))
  proc.stderr.on('data', d => emit(d.toString().trimEnd(), 'stderr'))
  proc.on('close', (code) => {
    pfProcesses.delete(pf.id)
    if (code === 0 || code === null) { emitSts('stopped'); emit('Process exited', 'stdout') }
    else { emitSts('error'); emit(`Process exited with code ${code}`, 'error') }
  })
  proc.on('error', (err) => {
    pfProcesses.delete(pf.id)
    emitSts('error')
    emit(`Error: ${err.message}`, 'error')
  })

  return { success: true }
})

ipcMain.handle('pf:stop', (_e, id: number) => {
  const proc = pfProcesses.get(id)
  if (proc) { proc.kill(); pfProcesses.delete(id); mainWindow?.webContents.send('pf:status', { id, status: 'stopped' }) }
  return { success: true }
})

ipcMain.handle('pf:stopAll', () => {
  pfProcesses.forEach((proc, id) => { proc.kill(); mainWindow?.webContents.send('pf:status', { id, status: 'stopped' }) })
  pfProcesses.clear()
  return { success: true }
})
