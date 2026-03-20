# Simple NVR CCTV

A full-stack RTSP NVR/CCTV application with a Go backend, React frontend, and Go reverse proxy.

## Features

### 🔐 Authentication & Authorization
- **Secure Login**: JWT-based authentication (HS256).
- **OTP Verification**: Email-based One-Time Password verification for login.
- **Password Management**: Forgot password and reset password flows with secure email tokens.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions for Admin and User roles.

### 📊 Advanced DataTables
- **Filtering**: Advanced filtering with operators (equals, contains, greater than, etc.) via SQL-like query builder.
- **Column Customization**:
    - **Visibility**: Toggle columns on/off.
    - **Reordering**: Drag-and-drop column reordering.
    - **Resizing**: Adjustable column widths.
- **Persistence**: User preferences (visibility, order, size) are saved to the database per user/table.
- **Mass Actions**: Multi-select support for bulk operations (e.g., Mass Delete).
- **Export**: Export selected or filtered data to Excel (`.xlsx`).

### 🧭 Navigation & UI
- **Tree Sidebar**: Multi-level collapsible sidebar menu with active state highlighting.
- **Responsive Design**: Mobile-friendly layout with collapsible sidebar.
- **Internationalization (i18n)**:
    - **Multi-language Support**: Built-in support for Indonesian (`id`) and English (`en`).
    - **Easy Translation**: JSON-based locale files.

### ⚙️ Backend & Infrastructure
- **Background Jobs**: Robust job queue system for async tasks with status monitoring.
- **Email Templates**: HTML email templates for polished communication (OTP, Reset Password).
- **Docker Ready**: Production-ready `Dockerfile` and `docker-compose.yml`.

### 🎥 NVR / CCTV
- **Camera Management**: CRUD API and admin UI for RTSP cameras.
- **Recording Workers**: One FFmpeg process per enabled camera with restart backoff and startup resume.
- **Retention Policies**: Delete recordings by age or total camera size budget.
- **Recordings Playback**: List segmented MP4 files and play them in the browser.
- **Operational Views**: Runtime health and snapshot preview per camera.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Go 1.24, Echo v4, GORM, PostgreSQL |
| **Frontend** | React 19, Vite 7, TypeScript, Tailwind CSS v4 |
| **Proxy** | Go reverse proxy with static file serving |
| **Database** | PostgreSQL with schema support |
| **Auth** | JWT (HS256) + OTP via email |
| **Email** | SMTP with HTML templates |
| **Video** | FFmpeg for RTSP recording, snapshots, and segmented MP4 playback |

## Project Structure

```
boilerplate-saas-fullstack-go-react/
├── apps/
│   ├── backend/         # Go API server
│   ├── frontend/        # React SPA
│   └── reverse-proxy/   # Go reverse proxy
├── docker-compose.yml
├── .env.docker.example
├── architecture.md
└── codebase.md
```

## Quick Start

### Prerequisites

- Go 1.24+
- Node.js 22+
- PostgreSQL 16+

### Generating a New Project

Use the interactive generator to create a new SaaS application based on this boilerplate.
This will generate a complete project with **Go (Echo, GORM)** backend and **React (Vite, Tailwind)** frontend, powered by **Bun**.

```bash
bun install
bun run generate
```

Follow the prompts to configure:
1.  **App Name**: Human-readable name (e.g., "My SaaS")
2.  **Backend Module Name**: Go module name (e.g., "my-saas-backend")
3.  **Backend Port**: API server port (default: 3001)
4.  **Frontend Port**: Vite dev server port (default: 3002)
5.  **Reverse Proxy Port**: Unified entry point (default: 7777)
6.  **Target Directory**: Where to create the new project

 The script will automatically:
- Copy the boilerplate files
- Rename the module in `go.mod` and imports
- Update `docker-compose.yml`, `.env`, and `package.json` with your configuration
- Update frontend title and vite config

### Development

Running the full local stack with `bun run dev` now expects a local `go2rtc` binary to be available either:

- in `tmp-go2rtc/go2rtc.exe` (Windows) / `tmp-go2rtc/go2rtc` (Unix), or
- on your `PATH` as `go2rtc`

The `dev` script now starts the relay, backend, frontend, and reverse proxy together.

1. **Backend**:
   ```bash
   cd apps/backend
   cp .env.example .env
   # Edit .env with your database credentials
   go mod tidy
   go run .
   ```

2. **Frontend**:
   ```bash
   cd apps/frontend
   cp .env.example .env
   bun install
   bun run dev
   ```

3. **Reverse Proxy** (optional, for unified port):
   ```bash
   cd apps/reverse-proxy
   cp .env.example .env
   go run .
   ```

   Access at: http://localhost:7777

### Docker Deployment

```bash
cp .env.docker.example .env.docker
# Edit .env.docker with your settings
docker compose up --build
```

Access at: http://localhost:7777

The compose stack persists CCTV footage in the named Docker volume `recordings_data`, mounted into the backend at `/app/recordings`.
For EasyPanel, attach persistent storage to the backend service at `/app/recordings` and keep `RECORDINGS_ROOT=/app/recordings`.
If you previously stored footage with `./recordings:/app/recordings`, copy that data into the named volume before switching environments or the old files will not appear automatically.
The backend runs as a non-root user in Docker, so the mounted storage must remain writable by the container user.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/verify-otp` | No | Verify OTP |
| POST | `/api/auth/forgot-password` | No | Request password reset |
| POST | `/api/auth/reset-password` | No | Reset password with token |
| GET | `/api/auth/me` | Yes | Get current user |
| POST | `/api/auth/change-password` | Yes | Change password |
| GET | `/api/users` | Yes | List all users |
| GET | `/api/users/:id` | Yes | Get user by ID |
| POST | `/api/users` | Yes | Create user |
| PUT | `/api/users/:id` | Yes | Update user |
| DELETE | `/api/users/:id` | Yes | Deactivate user |
| GET | `/api/table-settings/:module` | Yes | Get table settings |
| POST | `/api/table-settings/:module` | Yes | Save table settings |
| DELETE | `/api/table-settings/:module` | Yes | Delete table settings |
| GET | `/api/background-jobs` | Yes | List all jobs |
| GET | `/api/background-jobs/active` | Yes | List active jobs |
| GET | `/api/background-jobs/:id` | Yes | Get job by ID |
| POST | `/api/background-jobs/search` | Yes | Search jobs |
| GET | `/api/cameras` | Yes | List cameras with recording settings and runtime status |
| GET | `/api/cameras/:id` | Yes | Get one camera |
| POST | `/api/cameras` | Yes | Create camera |
| PUT | `/api/cameras/:id` | Yes | Update camera and recording settings |
| DELETE | `/api/cameras/:id` | Yes | Delete camera while keeping recordings on disk |
| GET | `/api/cameras/:id/snapshot` | Yes | Capture or return cached snapshot |
| GET | `/api/recordings?camera_id=` | Yes | List recordings for one camera |
| GET | `/api/recordings/file?camera_id=&path=` | Yes | Stream one recorded MP4 file |

## Default Admin Credentials

- **Email**: `admin@example.com`
- **Password**: `admin123`

> ⚠️ Change these in production via `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables.

## Environment Variables

See `.env.example` files in each app directory and `.env.docker.example` at the root.

Important NVR variables in `apps/backend/.env.example`:

- `RECORDINGS_ROOT`: root folder for segmented recordings
- `FFMPEG_BIN`: FFmpeg binary path or command name
- `GO2RTC_API_URL`: go2rtc HTTP API base URL used to register camera relay streams
- `GO2RTC_RTSP_URL`: go2rtc RTSP relay base URL used by recorder, snapshots, HLS, and WebRTC workers
- `GO2RTC_STREAM_PREFIX`: prefix for generated relay stream names
- `NVR_SEGMENT_SECONDS`: segment duration in seconds (default `3600` for hourly files)
- `NVR_RETENTION_INTERVAL_SECONDS`: retention sweep interval
- `NVR_HEALTH_STALE_SECONDS`: health timeout for stale workers/files
- `NVR_SNAPSHOT_CACHE_SECONDS`: snapshot cache TTL
- `NVR_SNAPSHOT_TIMEOUT_SECONDS`: snapshot command timeout
- `NVR_WORKER_INITIAL_BACKOFF_SECONDS`: first restart backoff after worker failure
- `NVR_WORKER_MAX_BACKOFF_SECONDS`: restart backoff ceiling
- `NVR_WORKER_STOP_TIMEOUT_SECONDS`: graceful stop timeout before kill

Recordings are stored under `recordings/{camera_id}/YYYY/MM/DD/*.mp4` by default.

## Relay Streaming

Live viewing and recording are designed to run through a relay stream instead of opening multiple direct RTSP sessions to the camera.

Current relay integration uses `go2rtc`:

- camera source is registered in go2rtc through its HTTP API
- recorder consumes the go2rtc RTSP output, not the raw camera RTSP URL
- snapshot, HLS, and WebRTC workers also consume the relay RTSP output
- `docker-compose.yml` now starts a `go2rtc` service automatically for the Docker stack
- the reverse proxy exposes go2rtc endpoints under `/go2rtc/*` so the frontend can consume native relay HLS/WebRTC endpoints directly

Recommended flow:

`Camera (RTSP) -> go2rtc -> recorder/live workers -> React player`
