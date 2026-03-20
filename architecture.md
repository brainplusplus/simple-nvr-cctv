# Architecture

## Overview

Semi-hexagonal architecture: layered backend (handlers → services → repositories) with a React SPA frontend, connected through a Go reverse proxy.

The backend also hosts an RTSP NVR subsystem: PostgreSQL stores cameras and recording settings, a go2rtc relay fan-outs each camera stream, an in-process Go supervisor spawns FFmpeg recorders against the relay output, recordings are written to disk, and authenticated APIs expose snapshots, recording metadata, and playback.

## Backend Architecture

```
main.go → routes.go (DI wiring) → handlers → services → repositories → DB/SMTP
```

### Layers

| Layer | Path | Responsibility |
|-------|------|---------------|
| **Domain** | `internal/domain/identity` | UUID generation (deterministic v5) |
| **Infrastructure** | `internal/infrastructure` | Database (GORM/PostgreSQL), SMTP client |
| **Models** | `internal/models` | Data structures, DTOs, filter types |
| **Repositories** | `internal/repositories/db` | Database CRUD, filter/sort/pagination, camera persistence |
| | `internal/repositories/email` | Email composition + sending |
| **Services** | `internal/services` | Business logic, JWT, auth flows, recorder supervision, retention, recordings access |
| **Handlers** | `internal/handlers` | HTTP request/response, validation, recording file serving |
| **Middleware** | `internal/middleware` | JWT auth extraction |
| **Routes** | `internal/routes` | DI wiring + route registration |
| **Utils** | `internal/utils` | Password hashing, i18n localization |

### Design Rules

1. **Context Propagation**: Use `context.Background()` for all handler/service calls (prevents request context cancellation)
2. **No Hardcoding**: All config via environment variables
3. **UTC Timestamps**: GORM `NowFunc` configured for UTC; all `time.Now()` calls use `.UTC()`
4. **Deterministic UUIDs**: User IDs generated via UUID v5 from email; BackgroundJob IDs use UUID v7 (time-ordered)
5. **Soft Deletion**: Users deactivated (not deleted) via `IsActive` flag
6. **Generic Error Messages**: Forgot password always returns success (prevents email enumeration)
7. **Cross-Platform Scheduling**: Recording retention and worker restart logic use Go goroutines/tickers only

### NVR Flow

1. Camera and recording settings are stored in PostgreSQL.
2. On startup, enabled cameras are registered into go2rtc and resumed by the recorder supervisor.
3. Each enabled camera uses the go2rtc RTSP relay output as the source for recording/live FFmpeg workers.
4. Recordings are written under `recordings/{camera_id}/YYYY/MM/DD/*.mp4`.
5. Retention runs on a configurable Go ticker and prunes by age or total camera folder size.
6. The backend serves recording metadata, MP4 playback, and snapshots while live workers source media from the relay instead of the raw camera URL.

### Authentication Flow

1. **Login** → validate credentials → if OTP enabled: generate OTP, email it, return `requires_otp: true` → else: return JWT
2. **Verify OTP** → validate code + expiry → return JWT
3. **Forgot Password** → generate token, email it → always return generic success
4. **Reset Password** → validate token + expiry → update password

## Frontend Architecture

React 19 + Vite + TypeScript + Tailwind CSS v4.

### State Management

| Context | Purpose |
|---------|---------|
| `AuthProvider` | JWT token, user state, login/logout |
| `ToastProvider` | Toast notifications (success/error/info/warning) |
| `LanguageProvider` | i18n language switching (id/en) |

### i18n Pattern

- Locale files: `src/locales/*.json` with structure `{ "key": { "id": "...", "en": "..." } }`
- Hook: `useTranslation(module)` → returns `t(key, params?)` with module scoping + global fallback
- Variable interpolation: `{{name}}` syntax

### Standards

1. **Toast Notifications**: Always use `useToast()` hook, never `window.alert()`
2. **Protected Routes**: Wrap with `<ProtectedRoute>` (auth) and `<AdminRoute>` (admin-only)
3. **401 Handling**: Axios interceptor auto-redirects to /login on 401
4. **DataTables**:
    - MUST use `DataTable` component.
    - MUST use `QueryBuilder` (server-side filtering preferred, client-side if necessary).
    - MUST support persistent settings via `api/table-settings.ts`.
    - MUST enable column visibility, reordering, and resizing.

## Reverse Proxy

Dual-mode Go proxy:
- **Development**: Proxies `/api/*` → backend, `/*` → frontend dev server
- **Production**: Serves static files from `STATIC_DIR`, proxies `/api/*` → backend

Features: in-memory file cache with fsnotify watcher, runtime config injection (`window.__RUNTIME_CONFIG__`).

## Deployment

```
docker compose up --build
```

Two services: `backend` (Go API, port 3001) + `proxy` (reverse proxy + static files, port 7777).
