# Security & Privacy Audit Report

## 🔴 CRITICAL Issues

### 1. Shell Injection Vulnerability in Configuration Updates
**Location:** `electron/main.ts` - `injectProfile()` function (line ~197)

**Issue:** The environment name is used in a regex pattern without proper escaping:
```typescript
const stripped = original.replace(
  new RegExp(`\\[${profileName}\\][^\\[]*`, 'g'), ''
).trimEnd()
```

If environment name contains regex special characters like `.*+?^$()[]{}|\\`, it could break the regex or cause unexpected behavior.

**Risk:** Medium to High - could corrupt config file or expose information

**Fix:** Escape the profileName before using in regex:
```typescript
const escaped = profileName.replace(/[.*+?^$()[\]{}|\\]/g, '\\$&')
const stripped = original.replace(
  new RegExp(`\\[${escaped}\\][^\\[]*`, 'g'), ''
).trimEnd()
```

---

### 2. Shell Command Injection via User-Provided Commands
**Location:** `electron/main.ts` - `cmd:run` handler (line ~240) and `pf:start` handler (line ~329)

**Issue:** User-provided commands are executed directly in shell without validation:
```typescript
// From cmd:run:
const eksSpawnCmd = isWindows ? env.eks_command : `bash -l 2>/dev/null -c ${JSON.stringify(env.eks_command)}`
const eks = spawn(eksSpawnCmd, [], { shell: true, env: { ...process.env } })

// From pf:start:
const proc = spawn(pf.command, [], { shell: true, env: { ...process.env } })
```

**Risk:** CRITICAL - Allows arbitrary command execution if user input is compromised or malicious

**Details:**
- If `env.eks_command` contains malicious commands (e.g., `aws eks update-kubeconfig ...; rm -rf /`), they will be executed
- Similarly, `pf.command` has no validation
- While `shell: false` with argument array would be ideal, the user needs flexibility for complex commands

**Fix:** Implement command validation:
```typescript
function validateCommand(cmd: string): { valid: boolean; error?: string } {
  // Only allow aws, kubectl, gimme-aws-creds commands
  const allowedStart = cmd.trim().match(/^(aws|kubectl|gimme-aws-creds|bash)\s/)
  if (!allowedStart) {
    return { valid: false, error: 'Command must start with: aws, kubectl, gimme-aws-creds, or bash' }
  }
  
  // Reject commands with dangerous patterns
  const dangerous = [';', '&&', '||', '|', '>', '<', '`', '$', '&']
  if (dangerous.some(char => cmd.includes(char))) {
    // Allow pipes and redirection ONLY in kubectl/aws commands, not bash
    if (!cmd.startsWith('aws') && !cmd.startsWith('kubectl')) {
      return { valid: false, error: 'Shell operators not allowed in this command type' }
    }
  }
  
  return { valid: true }
}
```

---

### 3. Unvalidated Import Data Can Corrupt Database
**Location:** `electron/main.ts` - `data:import` handler (line ~380)

**Issue:** The imported JSON is not validated for structure or content:
```typescript
const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'))

if (!data.environments || !data.portForwards) {
  return { success: false, error: 'Invalid backup format' }
}

// Directly inserts without validation
for (const env of data.environments) {
  const { id, created_at, updated_at, ...envData } = env
  try {
    db!.prepare(`INSERT INTO environments (...) VALUES (...)`).run(envData)
  } catch (e) {
    // Silently fails
  }
}
```

**Risk:** HIGH - Malicious JSON file could:
- Insert invalid data into database
- Large arrays could cause DoS (memory exhaustion)
- No checksum verification - any JSON file is accepted

**Fix:**
```typescript
function validateEnvironmentData(env: any): { valid: boolean; error?: string } {
  const required = ['name', 'okta_profile', 'okta_org_url']
  for (const field of required) {
    if (!env[field] || typeof env[field] !== 'string') {
      return { valid: false, error: `Missing or invalid field: ${field}` }
    }
  }
  
  // Validate data types
  if (typeof env.aws_default_duration !== 'number' || env.aws_default_duration < 0) {
    return { valid: false, error: 'Invalid aws_default_duration' }
  }
  
  // Check for excessively long values
  for (const field of Object.keys(env)) {
    if (typeof env[field] === 'string' && env[field].length > 10000) {
      return { valid: false, error: `Field too long: ${field}` }
    }
  }
  
  return { valid: true }
}
```

---

## 🟡 HIGH Issues

### 4. Sensitive Data in Application Logs
**Location:** `electron/main.ts` - All stdout/stderr handlers (lines ~245, ~253, ~340, ~341)

**Issue:** All output from AWS CLI and gimme-aws-creds is sent to frontend and stored in memory:
```typescript
okta.stdout.on('data', d => emit(d.toString().trimEnd(), 'stdout'))
okta.stderr.on('data', d => emit(d.toString().trimEnd(), 'stderr'))
```

**Risk:** HIGH - Logs can contain:
- AWS credentials/tokens
- Okta session information
- Private cluster names or infrastructure details
- These are stored in `logs: LogEntry[]` in Zustand state indefinitely

**Fix:** 
- Filter sensitive patterns from logs before sending to frontend
- Limit log retention (currently port-forwards limit to 200 lines, but cmd logs don't)
- Never log full AWS credentials

```typescript
function sanitizeLog(line: string): string {
  // Mask AWS credentials
  line = line.replace(/AKIA[0-9A-Z]{16}/g, 'AKIA***REDACTED***')
  // Mask tokens
  line = line.replace(/sk_[a-zA-Z0-9_-]{20,}/g, 'sk_***REDACTED***')
  // Remove full command output with sensitive env vars
  if (line.includes('AWS_SESSION_TOKEN') || line.includes('AWS_SECRET')) {
    return '[Sensitive credential data - redacted]'
  }
  return line
}

okta.stdout.on('data', d => emit(sanitizeLog(d.toString().trimEnd()), 'stdout'))
```

---

### 5. All Environment Variables Leaked to Child Processes
**Location:** `electron/main.ts` - spawn calls (lines ~240, ~329)

**Issue:** Entire `process.env` is passed to child processes:
```typescript
const okta = spawn(spawnCmd, [], { shell: true, env: { ...process.env } })
const proc = spawn(pf.command, [], { shell: true, env: { ...process.env } })
```

**Risk:** HIGH - Child processes can access:
- User's environment variables (AWS credentials, API keys, auth tokens)
- User's shell configuration
- User's PATH, HOME, and other private settings

**Fix:** Explicitly define only needed environment variables:
```typescript
const baseEnv = {
  PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
  HOME: process.env.HOME,
  USER: process.env.USER,
  SHELL: process.env.SHELL,
  // Only add AWS-related if explicitly needed
  ...(process.env.AWS_PROFILE && { AWS_PROFILE: process.env.AWS_PROFILE }),
}

const okta = spawn(spawnCmd, [], { shell: true, env: baseEnv })
```

---

### 6. No Input Validation/Sanitization on Environment Names
**Location:** `electron/main.ts` - `buildProfileSection()` (line ~173)

**Issue:** While frontend does some validation (space → hyphen), backend doesn't validate:
```typescript
function buildProfileSection(env: any): string {
  return [
    `[${env.name}]`,  // User input directly in INI section header
    kv('okta_org_url', env.okta_org_url ?? ''),
    ...
  ].join('\n')
}
```

**Risk:** MEDIUM - If frontend validation is bypassed or invalid data sent via IPC:
- Newlines in `env.name` could break INI file format
- Special characters could cause gimme-aws-creds to fail
- Could inject additional config sections

**Fix:** Validate on backend:
```typescript
ipcMain.handle('env:create', (_e, data: any) => {
  // Validate environment name
  if (!data.name || !/^[a-zA-Z0-9_-]+$/.test(data.name)) {
    throw new Error('Invalid environment name: only alphanumeric, dash, underscore allowed')
  }
  if (data.name.length > 100) {
    throw new Error('Environment name too long')
  }
  
  // ... rest of validation
})
```

---

## 🟡 MEDIUM Issues

### 7. No Rate Limiting on IPC Handlers
**Location:** `electron/main.ts` - All `ipcMain.handle()` calls

**Issue:** Frontend can call handlers repeatedly without limits:
- `cmd:run` could be called 1000x in a loop
- `data:export`/`data:import` could cause file system spam
- Port-forward `start` could spawn unlimited processes

**Risk:** MEDIUM - DoS attack against the application

**Fix:** Add rate limiting:
```typescript
const cmdRunLimiter = new Map<string, number>()

ipcMain.handle('cmd:run', (_e, env: any) => {
  const now = Date.now()
  const lastRun = cmdRunLimiter.get('cmd:run') || 0
  if (now - lastRun < 5000) { // 5 second minimum between runs
    throw new Error('CMD:RUN called too frequently')
  }
  cmdRunLimiter.set('cmd:run', now)
  
  // ... rest of handler
})
```

---

### 8. No Limits on Log Data in Memory
**Location:** `src/store/useStore.ts` (line ~42)

**Issue:** Command logs grow unbounded:
```typescript
appendLog: (entry) => set(s => ({ logs: [...s.logs, entry] })),  // No limit!
```

Port-forward logs limit to 200 lines, but command logs don't.

**Risk:** MEDIUM - Memory exhaustion if user leaves app running with continuous logs

**Fix:**
```typescript
appendLog: (entry) => set(s => {
  const newLogs = [...s.logs, entry].slice(-500) // Keep last 500 lines
  return { logs: newLogs }
}),
```

---

### 9. Database File Location Not Encrypted
**Location:** `electron/main.ts` - `initDb()` (line ~11)

**Issue:** SQLite database stored in userData without encryption:
```typescript
const dbPath = join(app.getPath('userData'), 'eks-launcher.db')
const database = new Database(dbPath)
```

**Risk:** MEDIUM - Database contains:
- Okta configuration (usernames, org URLs, etc.)
- EKS cluster information
- Credentials stored by gimme-aws-creds

On macOS, userData is typically `~/Library/Application Support/eks-launcher/`, which is readable by user.

**Note:** Full encryption is complex in Electron + SQLite, but consider:
- Warn users about storing sensitive configs
- Use `better-sqlite3` encryption plugin if available
- Document security considerations

---

### 10. DevTools Opened in Development Mode
**Location:** `electron/main.ts` - `createWindow()` (line ~127)

**Issue:**
```typescript
if (process.env.NODE_ENV === 'development') {
  mainWindow.loadURL('http://localhost:5173')
  mainWindow.webContents.openDevTools()  // Always opens!
}
```

**Risk:** LOW in dev mode, but CRITICAL if `NODE_ENV` is accidentally left as 'development' in production

**Fix:** Add explicit check:
```typescript
if (process.env.NODE_ENV === 'development' && !app.isPackaged) {
  mainWindow.webContents.openDevTools()
}
```

---

### 11. Insufficient Error Handling in Port-Forward Start
**Location:** `electron/main.ts` - `pf:start` handler (line ~329)

**Issue:** If spawn fails, error is logged but process might still be tracked:
```typescript
proc.on('error', (err) => {
  pfProcesses.delete(pf.id)  // Good
  emit(`Error: ${err.message}`, 'error')
})
```

**Risk:** LOW, but could expose system errors

**Fix:** Sanitize error messages:
```typescript
proc.on('error', (err) => {
  pfProcesses.delete(pf.id)
  const safeMsg = err.code === 'ENOENT' 
    ? 'Command not found' 
    : 'Failed to start process'
  emit(`Error: ${safeMsg}`, 'error')
})
```

---

## 🟢 Security Best Practices (Currently Implemented)

✅ Context isolation enabled (`contextIsolation: true`)
✅ Node integration disabled (`nodeIntegration: false`)
✅ Uses preload script for secure IPC
✅ Parameterized SQL queries (no SQL injection)
✅ Config file permissions set to `0o600`
✅ Config file is restored after gimme-aws-creds
✅ Frame disabled for custom title bar
✅ Proper preload script usage pattern

---

## Summary of Fixes by Priority

| Priority | Issue | Fix Time | Impact |
|----------|-------|----------|--------|
| 🔴 CRITICAL | Shell injection in regex | 5 min | Prevent config corruption |
| 🔴 CRITICAL | Shell commands not validated | 30 min | Prevent arbitrary code execution |
| 🔴 CRITICAL | Unvalidated import data | 15 min | Prevent database corruption |
| 🟡 HIGH | Sensitive data in logs | 20 min | Prevent credential leaks |
| 🟡 HIGH | Env vars leaked to processes | 10 min | Hide private environment |
| 🟡 HIGH | No backend input validation | 30 min | Defense in depth |
| 🟡 MEDIUM | No rate limiting | 20 min | Prevent DoS |
| 🟡 MEDIUM | Unbounded logs in memory | 5 min | Prevent memory leak |
| 🟡 MEDIUM | DevTools in production | 5 min | Prevent debug access |

---

## Recommendations for Next Steps

1. **Immediate (This Week)**
   - Add command validation for `eks_command` and `pf.command`
   - Add regex escaping in `injectProfile()`
   - Add validation to import handler
   - Sanitize sensitive data from logs

2. **Short Term (Next Sprint)**
   - Add backend input validation on all IPC handlers
   - Implement rate limiting
   - Limit log retention to prevent OOM
   - Document security model for users

3. **Long Term**
   - Consider encrypting database using better-sqlite3 extensions
   - Implement audit logging for sensitive operations
   - Add security headers if web server is ever exposed
   - Regular security audits
