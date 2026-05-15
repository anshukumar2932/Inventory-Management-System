# Inventory Management System

A full-stack **Enterprise Inventory & Asset Lifecycle Management System** built with Django REST Framework and React. Manages the complete lifecycle of organizational assets — from procurement and assignment through maintenance, audits, reporting, and retirement.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     React SPA (Vite)                        │
│              frontend/ — 17 pages, routing, auth            │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP (JWT Auth)
┌────────────────────────▼────────────────────────────────────┐
│              Django REST Framework API Layer                 │
│   accounts/  assets/  procurement/  vendors/  repairs/      │
│   audits/    reports/ notifications/                        │
├─────────────────────────────────────────────────────────────┤
│              Domain Services Layer                           │
│   domains/asset_management/  vendor_management/             │
│   domains/procurement/  reporting/  auditing/               │
│   domains/compliance/  notification_management/             │
├─────────────────────────────────────────────────────────────┤
│              Async Tasks (Celery)                           │
│   reports/tasks.py  notifications/tasks.py                  │
│   Scheduled: weekly reports, hourly chart cleanup, daily    │
└─────────────────────────────────────────────────────────────┘
```

The backend follows a **domain-driven design (DDD)** pattern. Each business domain has its own service layer under `domains/`, keeping business logic separated from Django view/API concerns.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 5.2, Django REST Framework 3.15+ |
| API Auth | JWT (djangorestframework-simplejwt) with refresh token rotation & blacklisting |
| Database | PostgreSQL |
| Cache / Broker | Redis |
| Async Tasks | Celery 5.4 + django-celery-beat |
| Frontend | React 19, Vite 8, Bootstrap 5, React Router 7, Recharts |
| PDF Generation | ReportLab 4.1 |
| Excel Export | OpenPyXL 3.1 + pandas 2.2 |
| Charts | Matplotlib 3.9 + NumPy 1.26 |
| Barcode | python-barcode (Code128), qrcode |
| API Documentation | drf-yasg (Swagger) |
| Testing | pytest 8.2 + pytest-django |
| Production Server | Gunicorn + WhiteNoise |

## Features

- **Role-Based Access Control** — SUPER_ADMIN, DEPARTMENT_ADMIN, MANAGER, USER with per-department data scoping and custom permission classes
- **Asset Lifecycle Management** — Full CRUD, search, filter, pagination; statuses: ACTIVE, REPAIR, MISSING, RETIRED, BLOCKED
- **Barcode Generation** — SHA-256 based barcode strings with Code128 image and QR code generation via Celery
- **Bulk Asset Upload** — Import assets from CSV/Excel with auto-creation of related entities (categories, locations, departments, vendors)
- **Asset Assignment & Service Tracking** — Department assignments, warranty/service tracking with service types
- **Procurement Requests** — Approval workflow with email-based Approve/Reject via UUID tokens
- **Vendor Management** — Categories, contacts, bank accounts, ratings, soft-delete
- **Repair & Maintenance** — Repair tickets with cost tracking and bill document uploads
- **Audit Campaigns** — Physical inventory verification via barcode scanning, detects misplaced/missing assets with session management
- **Enterprise Reporting** — Dark-themed PDF (ReportLab), Excel (OpenPyXL), and chart (Matplotlib) generation via Celery with token-based public download links
- **Automated Email Reports** — HTML emails with inline charts, PDF/Excel attachments sent to department admins
- **In-App Notifications** — Real-time notifications on asset/procurement events with mark-as-read and bulk operations
- **Dashboard KPIs** — Aggregated metrics (total assets, active, repair, missing, retired, blocked) with Redis caching
- **Scheduled Tasks** — Weekly report generation, hourly chart cleanup, daily report retention, 90-day notification cleanup (Celery Beat)
- **React SPA Frontend** — 17 pages with routing, sidebar navigation, barcode scanner integration (html5-qrcode)

## RBAC Permission Matrix

| Role | Permissions |
|------|------------|
| SUPER_ADMIN | Full access across all departments and modules |
| DEPARTMENT_ADMIN | Full access within their department |
| MANAGER | Create/update assets, manage repairs, procurements; cannot change asset status |
| USER | Read-only access to assigned department assets |

## Project Structure

```
config/              # Django project configuration
  settings.py        #   App config, DB, JWT, Celery, CORS, DRF
  urls.py            #   Root URL routing
  celery.py          #   Celery app configuration
  wsgi.py / asgi.py  #   WSGI/ASGI entry points
accounts/            # User authentication, departments, RBAC
assets/              # Core asset management
  views/             #   asset, category, location, document, service, dashboard views
  services/          #   asset_service, barcode_service, upload_service, send_email
  models.py          #   Asset, Category, Location, Document, ServiceType models
procurement/         # Procurement requests & email-based approval workflow
vendors/             # Vendor management with categories, contacts, bank accounts
repairs/             # Repair & maintenance tickets
audits/              # Audit campaigns & barcode scanning sessions
reports/             # Reporting engine (PDF/Excel/Charts/Email)
  services.py        #   generate_weekly_report (1532 lines) — all report logic
  tasks.py           #   Celery tasks for async report generation & email
  views.py           #   API endpoints for generate, status, download, token serve
notifications/       # In-app notifications with email fallback
  tasks.py           #   Celery tasks for async notification creation & email
helper/              # Shared utilities
  barcode_generator.py  #   SHA-256 barcode + Code128 image generation
  cache.py              #   Redis caching helpers
domains/             # Domain-driven service layer (separated business logic)
  asset_management/  #   Asset domain services
  vendor_management/ #   Vendor domain services
  procurement/       #   Procurement domain services
  reporting/         #   Reporting domain services
  auditing/          #   Audit domain services
  compliance/        #   Compliance domain services
  notification_management/  #   Notification domain services
frontend/            # React SPA (Vite + Bootstrap 5)
media/reports/       # Generated reports (PDFs, Excel, charts)
docs/                # Documentation
  api_versioning.md  #   API versioning strategy
  ERROR_HANDLING.md  #   Comprehensive error handling documentation
```

## API Endpoints

All endpoints are namespaced under `/api/v1/`:

### Authentication (`/api/v1/auth/`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/login/` | JWT login (access + refresh token) |
| POST | `/api/v1/auth/refresh/` | Refresh access token |
| POST | `/api/v1/auth/logout/` | Logout (blacklist refresh token) |
| GET | `/api/v1/auth/profile/` | Get current user profile |
| GET | `/api/v1/auth/users/` | List users |
| POST | `/api/v1/auth/users/` | Create user |
| GET | `/api/v1/auth/departments/` | List departments |
| POST | `/api/v1/auth/departments/` | Create department |

### Assets (`/api/v1/assets/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/assets/` | List assets (filterable, paginated) |
| POST | `/api/v1/assets/` | Create asset |
| GET | `/api/v1/assets/{id}/` | Retrieve asset |
| PUT/PATCH | `/api/v1/assets/{id}/` | Update asset |
| DELETE | `/api/v1/assets/{id}/` | Delete asset (MANAGER+) |
| POST | `/api/v1/assets/add/` | Bulk add asset |
| POST | `/api/v1/assets/update_asset/` | Update asset by name |
| POST | `/api/v1/assets/scan/` | Lookup asset by barcode |
| POST | `/api/v1/assets/generate-barcodes/` | Generate barcode images (async) |
| GET | `/api/v1/assets/assets/export/` | Export assets to Excel |
| POST | `/api/v1/assets/bulk-upload/` | Upload CSV/Excel for bulk import |
| POST | `/api/v1/assets/approve-email/` | Approve asset via email token |
| POST | `/api/v1/assets/reject-email/` | Reject asset via email token |
| GET | `/api/v1/assets/categories/` | List categories |
| GET | `/api/v1/assets/locations/` | List locations |
| GET | `/api/v1/assets/documents/` | List documents |
| GET | `/api/v1/assets/documents/{id}/download/` | Download document |
| GET | `/api/v1/assets/service-types/` | List service types |
| GET | `/api/v1/assets/asset-services/` | List asset services |

### Dashboard (`/api/v1/dashboard/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/dashboard/stats/` | Aggregated KPI metrics (cached) |

### Procurement (`/api/v1/procurements/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/procurements/` | List procurement requests |
| POST | `/api/v1/procurements/` | Create procurement request |
| GET | `/api/v1/procurements/{id}/` | Retrieve procurement |
| POST | `/api/v1/procurements/{id}/approve/` | Approve procurement |
| POST | `/api/v1/procurements/{id}/reject/` | Reject procurement |
| GET | `/api/v1/procurements/approve-email/` | Approve via email token |
| GET | `/api/v1/procurements/reject-email/` | Reject via email token |

### Vendors (`/api/v1/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/vendors/` | List vendors |
| POST | `/api/v1/vendors/add/` | Create vendor (or return existing) |
| POST | `/api/v1/vendors/{id}/soft-delete/` | Soft delete vendor |
| GET | `/api/v1/vendors/contacts/` | List contacts |
| GET | `/api/v1/vendors/bank-details/` | List bank details |

### Repairs (`/api/v1/repairs/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/repairs/` | List repair tickets |
| POST | `/api/v1/repairs/` | Create repair ticket |
| GET | `/api/v1/repairs/{id}/` | Retrieve repair ticket |

### Audits (`/api/v1/audits/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/audits/` | List audit sessions |
| POST | `/api/v1/audits/` | Create audit session |
| GET | `/api/v1/audits/{id}/` | Retrieve audit session |
| POST | `/api/v1/audits/{id}/scan/` | Scan asset barcode in session |
| POST | `/api/v1/audits/{id}/complete/` | Complete audit session |

### Reports (`/api/v1/reports/`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/reports/generate/` | Trigger report generation (async) |
| GET | `/api/v1/reports/{id}/status/` | Check report generation status |
| GET | `/api/v1/reports/{id}/download-pdf/` | Download PDF report |
| GET | `/api/v1/reports/{id}/download-excel/` | Download Excel report |
| GET | `/api/v1/reports/{id}/download-chart/` | Download chart image |
| GET | `/api/v1/reports/token/{token}/` | Public download via token (PDF) |
| GET | `/api/v1/reports/token/{token}/excel/` | Public download via token (Excel) |

### Notifications (`/api/v1/notifications/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/notifications/` | List user notifications |
| POST | `/api/v1/notifications/{id}/mark-read/` | Mark single notification as read |
| POST | `/api/v1/notifications/bulk-mark-read/` | Bulk mark notifications as read |
| DELETE | `/api/v1/notifications/{id}/` | Delete notification |
| POST | `/api/v1/notifications/bulk-delete/` | Bulk delete notifications |

## Celery Scheduled Tasks (Beat Schedule)

| Task | Schedule | Description |
|------|----------|-------------|
| `generate-weekly-report` | Every 7 days | Generate and email weekly asset report to all admins |
| `clear-expired-charts` | Every hour | Remove expired chart images from disk |
| `delete-old-reports` | Every day | Remove reports older than configured retention period |
| `clean-old-notifications` | Every day | Delete notifications older than 90 days |

## Environment Variables

The application uses `python-decouple` for configuration. Create a `.env` file in the project root with these variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | Yes | — | Django secret key (generate with `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`) |
| `DEBUG` | No | `False` | Debug mode (`True`/`False`) |
| `DB_NAME` | Yes | — | PostgreSQL database name |
| `DB_USER` | Yes | — | PostgreSQL user |
| `DB_PASSWORD` | Yes | — | PostgreSQL password |
| `DB_HOST` | No | `localhost` | PostgreSQL host |
| `DB_PORT` | No | `5432` | PostgreSQL port |
| `ORIGINS` | No | — | Comma-separated allowed CORS origins |
| `BASE_URL` | No | `http://localhost:8000` | Base URL for email links |
| `ACCESS_TOKEN_LIFETIME_MINUTES` | No | `60` | JWT access token expiry |
| `REFRESH_TOKEN_LIFETIME_DAYS` | No | `7` | JWT refresh token expiry |
| `CHART_EXPIRY_HOURS` | No | `24` | Chart image retention |
| `REPORT_RETENTION_MONTHS` | No | `3` | Report file retention |
| `EMAIL_HOST` | No | — | SMTP server (e.g., smtp.gmail.com) |
| `EMAIL_PORT` | No | `587` | SMTP port |
| `EMAIL_HOST_USER` | No | — | SMTP username |
| `EMAIL_HOST_PASSWORD` | No | — | SMTP password (or app password) |
| `EMAIL_USE_TLS` | No | `True` | TLS for SMTP |

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### Backend Setup

```bash
# Clone the repository
git clone <repository-url>
cd Inventory-Management-System

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables (.env)
cp .env.example .env  # or create manually (see table above)
# Edit .env with your database credentials and secret key

# Create PostgreSQL database
sudo -u postgres createdb inventory_db
sudo -u postgres psql -c "CREATE USER inventory_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "ALTER ROLE inventory_user SET client_encoding TO 'utf8';"
sudo -u postgres psql -c "ALTER ROLE inventory_user SET default_transaction_isolation TO 'read committed';"
sudo -u postgres psql -c "ALTER ROLE inventory_user SET timezone TO 'UTC';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE inventory_db TO inventory_user;"

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start development server
python manage.py runserver
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server runs at `http://localhost:5173` by default and proxies API requests to `http://localhost:8000`.

### Celery (Background Tasks)

```bash
# Start Celery worker (terminal 1)
DEBUG=True celery -A config worker --loglevel=info

# Start Celery beat for scheduled tasks (terminal 2)
DEBUG=True celery -A config beat --loglevel=info

# Monitor with Flower (optional)
celery -A config flower --port=5555
```

### Complete Development Workflow

Open 4 terminals:

```bash
# Terminal 1: Redis (if not running as a service)
redis-server

# Terminal 2: Celery Worker
DEBUG=True celery -A config worker -l info

# Terminal 3: Celery Beat
DEBUG=True celery -A config beat -l info

# Terminal 4: Django Server
DEBUG=True python manage.py runserver
```

Then open `http://localhost:5173` for the frontend or `http://localhost:8000/api/v1/` for the API.

## Testing

```bash
# Run all tests
pytest

# Run tests with coverage report
pytest --cov=. --cov-report=term-missing

# Run specific app tests
pytest assets/tests/
pytest vendors/tests/
pytest notifications/tests/
```

## Deployment

### Production Checklist

1. Set `DEBUG=False` in `.env`
2. Generate a strong `SECRET_KEY`
3. Set `ALLOWED_HOSTS` in `config/settings.py`
4. Configure a production database (PostgreSQL)
5. Set up Redis as a service
6. Configure HTTPS reverse proxy (nginx/Caddy)
7. Collect static files: `python manage.py collectstatic`
8. Use Gunicorn as WSGI server

### Gunicorn

```bash
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4
```

### Docker (Recommended for Production)

A `Dockerfile` and `docker-compose.yml` can be added for containerized deployment with PostgreSQL, Redis, and Celery workers.

## Development Roadmap

The project follows a 10-phase development roadmap (see `phases.md`):

1. **Foundation Setup** — Django project, PostgreSQL, Redis configuration
2. **Authentication & Authorization** — JWT, RBAC, department scoping
3. **Asset Management** — CRUD, barcodes, bulk upload, service tracking
4. **Procurement & Vendor Management** — Approval workflows, vendor catalog
5. **Repairs & Maintenance** — Ticket tracking, cost tracking, bill documents
6. **Audit Campaigns** — Barcode scanning sessions, discrepancy detection
7. **Notifications** — In-app notifications, email fallback, preferences
8. **Advanced Reporting** — PDF, Excel, Charts, automated email reports
9. **Frontend React SPA** — 17 pages, routing, barcode scanner integration
10. **Production Deployment** — Hardening, monitoring, documentation

## Error Handling

The codebase is comprehensively documented with an error handling catalog at `docs/ERROR_HANDLING.md`. It covers:

- 5 different error response formats currently in use
- 8 identified silent failure points
- Standardized error handling recommendations
- Complete per-file error pattern catalog

## API Documentation

Interactive Swagger documentation is available at `/swagger/` (via drf-yasg) when the development server is running.

## Troubleshooting

### Redis

```bash
pgrep -af redis            # Check if Redis is running
redis-cli ping             # Should return PONG
```

### Celery

```bash
pgrep -af celery           # Check running Celery processes
DEBUG=True celery -A config inspect ping      # Check worker connectivity
DEBUG=True celery -A config inspect active    # Currently running tasks
DEBUG=True celery -A config inspect reserved  # Queued tasks
```

### Common Issues

- **`DEBUG=release` in shell**: The shell may have `DEBUG=release` exported, which causes Django/Celery to fail. Run commands with `DEBUG=True` prefix or `unset DEBUG`.
- **Celery tasks not executing**: Ensure both `celery worker` and `celery beat` are running. The worker executes tasks, the beat scheduler triggers scheduled tasks.
- **Email not sending**: Verify `EMAIL_HOST_PASSWORD` is correct. Gmail users need an App Password (not your account password).

## Default Test Credentials

| Username | Role | Department | Password |
|----------|------|------------|----------|
| admin | SUPER_ADMIN | Organization | admin123 |
| it_admin | DEPARTMENT_ADMIN | IT | admin123 |

## License

Proprietary — All rights reserved.
