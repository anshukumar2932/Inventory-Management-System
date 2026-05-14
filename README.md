# Inventory Management System

A full-stack **Enterprise Inventory & Asset Lifecycle Management System** built with Django REST Framework and React. Manages the complete lifecycle of organizational assets — from procurement and assignment through maintenance, audits, reporting, and retirement.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 5.2, Django REST Framework 3.15+ |
| API Auth | JWT (djangorestframework-simplejwt) |
| Database | PostgreSQL |
| Cache / Broker | Redis |
| Async Tasks | Celery 5.4 + django-celery-beat |
| Frontend | React 19, Vite 8, Bootstrap 5 |
| PDF | ReportLab 4.1 |
| Excel | OpenPyXL 3.1 + pandas 2.2 |
| Charts | Matplotlib 3.9 + NumPy 1.26 |
| Barcode | python-barcode (Code128), qrcode |
| API Docs | drf-yasg (Swagger) |
| Testing | pytest 8.2 + pytest-django |
| Production | Gunicorn, WhiteNoise |

## Features

- **Role-Based Access Control** — SUPER_ADMIN, DEPARTMENT_ADMIN, MANAGER, USER with per-department data scoping
- **Asset Lifecycle Management** — Full CRUD, search, filter, pagination; statuses: ACTIVE, REPAIR, MISSING, RETIRED, BLOCKED
- **Barcode Generation** — SHA-256 based barcode strings with Code128 image generation
- **Bulk Asset Upload** — Import assets from CSV/Excel with auto-creation of related entities
- **Asset Assignment & Service Tracking** — Department assignments, warranty/service tracking
- **Procurement Requests** — Approval workflow with email-based Approve/Reject via UUID tokens
- **Vendor Management** — Categories, contacts, bank accounts, ratings, soft-delete
- **Repair & Maintenance** — Repair tickets with cost tracking and bill documents
- **Audit Campaigns** — Physical inventory verification via barcode scanning, detects misplaced/missing assets
- **Enterprise Reporting** — Dark-themed PDF (ReportLab), Excel (OpenPyXL), and chart (Matplotlib) generation via Celery
- **Automated Email Reports** — HTML emails with inline charts, PDF/Excel attachments
- **In-App Notifications** — Real-time notifications on asset/procurement events
- **Dashboard KPIs** — Aggregated metrics with Redis caching
- **Scheduled Tasks** — Weekly report generation, hourly chart cleanup, daily report retention (Celery Beat)
- **React SPA Frontend** — 17 pages with routing, sidebar navigation, barcode scanner integration

## Project Structure

```
config/              # Django project config (settings, urls, celery, wsgi, asgi)
accounts/            # User auth, roles, departments
assets/              # Core asset management (models, views, services, signals)
procurement/         # Procurement requests & approvals
vendors/             # Vendor management
repairs/             # Repair & maintenance tickets
audits/              # Audit campaigns & barcode scanning
reports/             # Reporting (PDF/Excel/Charts/Email) via Celery
notifications/       # In-app notifications
helper/              # Shared utilities (barcode generator, cache)
frontend/            # React SPA (Vite)
media/reports/       # Generated reports (PDFs, Excel, charts)
docs/                # Documentation (API versioning)
```

## API Endpoints

All endpoints are namespaced under `/api/v1/`:

| Prefix | Description |
|--------|-------------|
| `/api/v1/auth/` | Authentication & user management |
| `/api/v1/assets/` | Asset CRUD, categories, locations, services |
| `/api/v1/dashboard/` | Aggregated KPI stats |
| `/api/v1/procurements/` | Procurement requests & approvals |
| `/api/v1/vendors/` | Vendor management |
| `/api/v1/repairs/` | Repair tickets |
| `/api/v1/audits/` | Audit sessions & barcode scanning |
| `/api/v1/reports/` | Report generation & download |
| `/api/v1/notifications/` | In-app notifications |

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL
- Redis

### Backend Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables (.env)
# See .env file for required variables (DB, JWT, Email, Redis)

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

### Celery (for background tasks)

```bash
# Start Celery worker
celery -A config worker --loglevel=info

# Start Celery beat (for scheduled tasks)
celery -A config beat --loglevel=info

# Monitor with Flower
celery -A config flower --port=5555
```

## Development Roadmap

The project follows a 10-phase development roadmap (see `phases.md`):

1. Foundation Setup (Django project, PostgreSQL, Redis)
2. Authentication & Authorization (JWT, RBAC)
3. Asset Management (CRUD, barcodes, bulk upload)
4. Procurement & Vendor Management
5. Repairs & Maintenance
6. Audit Campaigns
7. Notifications
8. Advanced Reporting (PDF, Excel, Charts, Email)
9. Frontend React SPA
10. Production Deployment

## License

Proprietary — All rights reserved.
