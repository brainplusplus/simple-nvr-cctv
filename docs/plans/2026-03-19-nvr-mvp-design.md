# NVR/CCTV MVP Design

## Goal

Extend the existing monorepo into a simple RTSP-based NVR MVP with low-CPU recording, playback, and camera administration while preserving the current backend layering and frontend admin patterns.

## Decisions

- Record direct MP4 segments with FFmpeg using stream copy when possible.
- Serve recorded files from the backend over authenticated HTTP endpoints.
- Keep deleted-camera recordings on disk and keep them accessible by camera ID for MVP.
- Use in-process Go workers, tickers, and supervision only; no OS cron or job queue.

## Backend Shape

- Add `Camera` and `RecordingSetting` models under `apps/backend/internal/models`.
- Add repositories for camera/settings CRUD under `apps/backend/internal/repositories/db`.
- Add services for camera business logic, recording listing/file serving, retention, snapshots, and worker supervision under `apps/backend/internal/services`.
- Keep Echo handlers thin and route wiring in `apps/backend/internal/routes/routes.go`.
- Start recorder supervision and retention loops from backend startup after migrations.

## Recording Model

- One FFmpeg process per enabled camera.
- Output path: `recordings/{camera_id}/YYYY/MM/DD/HHMMSS.mp4`.
- Supervisor tracks runtime state in memory: running/stopped, pid, last start, last exit, backoff, last segment time, last error.
- Unexpected exits trigger exponential backoff restart.
- Disable/delete stops the worker gracefully.
- Startup resumes all enabled cameras from the database.

## Retention

- Run on a configurable ticker every 5-10 minutes.
- `days`: delete files older than N days.
- `size`: compute total bytes under the camera folder and delete oldest files until under limit.

## API Surface

- `GET/POST /api/cameras`
- `GET/PUT/DELETE /api/cameras/:id`
- `GET /api/recordings?camera_id=...`
- `GET /api/recordings/file/:camera_id/*`
- `GET /api/cameras/:id/snapshot`

Responses include camera settings and pragmatic runtime status for the UI.

## Frontend Shape

- Add camera list and camera detail pages within the existing admin layout.
- Use the existing `DataTable`, toasts, and locale JSON patterns.
- Camera form supports name, RTSP URL, enabled state, retention type/value, and mode.
- Detail page shows snapshot, runtime status, recordings list, and HTML5 playback.

## Verification

- Backend tests first for retention logic, service behavior, and key handlers.
- Run diagnostics on changed files.
- Run backend tests and builds, frontend lint/build, and root build.
- Update env and docs for new recording/FFmpeg settings.

## Notes

- No commit is created because the user explicitly requested no commit.
