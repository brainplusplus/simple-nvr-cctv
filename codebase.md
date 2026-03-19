# Codebase

## Backend (`apps/backend/`)

| File | Purpose |
|------|---------|
| `main.go` | Entry point, DB init, migration, admin seed, Echo server |
| `go.mod` | Go module with dependencies |
| `Dockerfile` | Multi-stage Docker build |
| `.env.example` | Environment variable template |
| `email/forgot-password.html` | Forgot password email template |
| `email/verify-otp.html` | OTP verification email template |
| `locales/email_forgot_password.json` | Forgot password email translations |
| `locales/email_verify_otp.json` | OTP email translations |
| `internal/domain/identity/uuid.go` | UUID v5 generation core |
| `internal/domain/identity/uuid_generators.go` | Model-specific UUID generators |
| `internal/infrastructure/database.go` | GORM/PostgreSQL connection + pooling |
| `internal/infrastructure/smtp.go` | SMTP client (STARTTLS + implicit TLS) |
| `internal/models/user.go` | User model + UserResponse DTO |
| `internal/models/table_setting.go` | TableSetting model (JSONB) |
| `internal/models/background_job.go` | BackgroundJob model + search types |
| `internal/models/filter.go` | FilterGroup, Filter, SortField types |
| `internal/models/camera.go` | Camera, recording setting, and runtime status DTOs |
| `internal/models/recording.go` | Recording file and snapshot result types |
| `internal/repositories/db/filter_helper.go` | Shared filter/sort/pagination |
| `internal/repositories/db/user_repository.go` | User CRUD |
| `internal/repositories/db/table_setting_repository.go` | TableSetting get/upsert/delete |
| `internal/repositories/db/background_job_repository.go` | BackgroundJob CRUD + search |
| `internal/repositories/db/camera_repository.go` | Camera CRUD + preload recording settings |
| `internal/repositories/email/email_auth_repository.go` | OTP + forgot password emails |
| `internal/services/auth_service.go` | Auth logic, JWT, user CRUD |
| `internal/services/table_setting_service.go` | TableSetting service |
| `internal/services/background_job_service.go` | BackgroundJob service |
| `internal/services/camera_service.go` | Camera CRUD + runtime orchestration |
| `internal/services/recorder_supervisor.go` | FFmpeg worker lifecycle and restart backoff |
| `internal/services/retention_service.go` | Delete-by-days and delete-by-size retention logic |
| `internal/services/recording_service.go` | Recording listing, file serving, and snapshot capture/cache |
| `internal/handlers/auth_handler.go` | Auth API endpoints |
| `internal/handlers/user_handler.go` | User CRUD endpoints |
| `internal/handlers/table_setting_handler.go` | Table settings endpoints |
| `internal/handlers/background_job_handler.go` | Background job endpoints |
| `internal/handlers/camera_handler.go` | Camera CRUD endpoints |
| `internal/handlers/recording_handler.go` | Recording list/file/snapshot endpoints |
| `internal/middleware/auth.go` | JWT middleware |
| `internal/routes/routes.go` | DI wiring + route registration |
| `internal/utils/password.go` | Bcrypt hash/verify |
| `internal/utils/localization.go` | JSON locale loading + translation |

## Frontend (`apps/frontend/`)

| File | Purpose |
|------|---------|
| `package.json` | Dependencies + scripts |
| `vite.config.ts` | Vite + React SWC + Tailwind v4 |
| `tsconfig.json` | TypeScript config |
| `index.html` | HTML entry point |
| `.env.example` | Frontend environment template |
| `src/main.tsx` | React entry with LanguageProvider |
| `src/App.tsx` | Router + providers |
| `src/index.css` | Tailwind import + animations |
| `src/vite-env.d.ts` | Vite type declarations |
| `src/api/client.ts` | Axios with auth interceptor |
| `src/api/auth.ts` | Auth API calls |
| `src/api/users.ts` | User CRUD API |
| `src/store/auth-context.tsx` | Auth state management |
| `src/contexts/ToastContext.tsx` | Toast notifications |
| `src/contexts/LanguageContext.tsx` | i18n language state |
| `src/hooks/useTranslation.ts` | Translation hook |
| `src/locales/auth.json` | Auth translations |
| `src/locales/general.json` | General translations |
| `src/locales/sidebar.json` | Sidebar translations |
| `src/locales/dashboard.json` | Dashboard translations |
| `src/locales/users.json` | Users page translations |
| `src/locales/background_jobs.json` | Background jobs translations |
| `src/locales/cameras.json` | Camera and recordings translations |
| `src/routes/ProtectedRoute.tsx` | Auth guard |
| `src/routes/AdminRoute.tsx` | Admin guard |
| `src/layouts/AdminLayout.tsx` | Sidebar + topbar layout |
| `src/pages/LoginPage.tsx` | Login + OTP |
| `src/pages/ForgotPasswordPage.tsx` | Forgot password |
| `src/pages/ResetPasswordPage.tsx` | Reset password |
| `src/pages/ChangePasswordPage.tsx` | Change password |
| `src/pages/DashboardPage.tsx` | Dashboard |
| `src/pages/UsersPage.tsx` | User management |
| `src/pages/BackgroundJobsPage.tsx` | Background job monitoring |
| `src/pages/CamerasPage.tsx` | Camera management list, form, and toggles |
| `src/pages/CameraDetailPage.tsx` | Snapshot, recordings list, and playback |
| `src/api/cameras.ts` | Camera, recordings, and snapshot API client |

## Reverse Proxy (`apps/reverse-proxy/`)

| File | Purpose |
|------|---------|
| `main.go` | Proxy server (dev/prod mode) |
| `go.mod` | Go module |
| `Dockerfile` | Standalone proxy build |
| `Dockerfile.combined` | Frontend + proxy combined build |
| `.env.example` | Proxy environment template |

## Root Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Service orchestration |
| `.env.docker.example` | Docker environment template |
| `.gitignore` | Git ignore rules |
| `docs/plans/2026-03-19-nvr-mvp-design.md` | Approved sprint design artifact |
| `docs/plans/2026-03-19-nvr-mvp-implementation.md` | Implementation handoff plan |
| `README.md` | Project documentation |
| `architecture.md` | Architecture documentation |
| `codebase.md` | This file |
