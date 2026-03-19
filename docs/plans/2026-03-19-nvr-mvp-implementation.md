# NVR/CCTV MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the existing monorepo with a working NVR MVP covering camera CRUD, recording settings, FFmpeg worker supervision, retention, recording playback, and frontend management pages.

**Architecture:** Add backend camera and recording modules that follow the existing handlers -> services -> repositories -> models structure, plus an in-process recorder supervisor and retention ticker. Extend the frontend admin UI with camera list/detail flows that use the existing providers, routes, i18n files, and DataTable patterns.

**Tech Stack:** Go 1.24, Echo, GORM, PostgreSQL, React 19, TypeScript, Tailwind/Vite, FFmpeg.

---

### Task 1: Backend tests first

**Files:**
- Create: `apps/backend/internal/services/retention_service_test.go`
- Create: `apps/backend/internal/services/recorder_supervisor_test.go`
- Create: `apps/backend/internal/handlers/camera_handler_test.go`

1. Write failing tests for retention deletion rules and supervisor start/stop/restart decisions.
2. Run targeted `go test` commands and confirm they fail for missing types/functions.
3. Add minimal production code to satisfy the tests.
4. Re-run targeted tests until green.

### Task 2: Backend camera and recording modules

**Files:**
- Create: `apps/backend/internal/models/camera.go`
- Create: `apps/backend/internal/models/recording.go`
- Create: `apps/backend/internal/repositories/db/camera_repository.go`
- Create: `apps/backend/internal/services/camera_service.go`
- Create: `apps/backend/internal/services/recording_service.go`
- Create: `apps/backend/internal/services/retention_service.go`
- Create: `apps/backend/internal/services/recorder_supervisor.go`
- Create: `apps/backend/internal/handlers/camera_handler.go`

1. Add models and DTOs.
2. Add repositories.
3. Add services and worker supervision.
4. Add handlers.
5. Re-run backend tests.

### Task 3: Startup wiring and route integration

**Files:**
- Modify: `apps/backend/main.go`
- Modify: `apps/backend/internal/routes/routes.go`

1. Add migrations for the new models.
2. Wire repositories, services, and handlers.
3. Start supervisor resume and retention loops.
4. Add routes for cameras, snapshots, recordings list, and file serving.

### Task 4: Frontend camera management UI

**Files:**
- Create: `apps/frontend/src/api/cameras.ts`
- Create: `apps/frontend/src/pages/CamerasPage.tsx`
- Create: `apps/frontend/src/pages/CameraDetailPage.tsx`
- Modify: `apps/frontend/src/App.tsx`
- Modify: `apps/frontend/src/components/Sidebar.tsx`
- Modify: locale JSON files in `apps/frontend/src/locales/`

1. Add API client helpers and types.
2. Add camera list page and create/edit flows.
3. Add camera detail page with snapshot, recordings list, and playback.
4. Wire routes and navigation.
5. Run frontend lint/build.

### Task 5: Config and docs

**Files:**
- Modify: `apps/backend/.env.example`
- Modify: `apps/frontend/.env.example` if needed
- Modify: `.env.docker.example`
- Modify: `docker-compose.yml`
- Modify: `README.md`
- Modify: `architecture.md`
- Modify: `codebase.md`

1. Add FFmpeg/recording env vars.
2. Update docker runtime config if needed for recordings volume/path behavior.
3. Update docs to describe the NVR MVP.

### Task 6: Verification

1. Run `lsp_diagnostics` on all changed files.
2. Run `go test ./...` in `apps/backend`.
3. Run backend build.
4. Run frontend `lint` and `build`.
5. Run root `build`.
6. Report any remaining pre-existing failures with evidence.

Plan saved for reference only. The user explicitly requested immediate execution in this session and no git commit.
