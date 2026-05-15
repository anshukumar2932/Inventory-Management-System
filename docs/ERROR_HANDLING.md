# Error Handling & Exception Documentation
## Enterprise Inventory & Asset Lifecycle Management System

> **Last Updated:** 2026-05-15
> **Scope:** All backend Python source files across every Django app and domain module.

---

## Table of Contents

1. [Global Response Envelope](#1-global-response-envelope)
2. [Centralized Error Helpers](#2-centralized-error-helpers)
3. [Authentication & Authorization Errors](#3-authentication--authorization-errors)
4. [Account & Department Errors](#4-account--department-errors)
5. [Asset Management Errors](#5-asset-management-errors)
6. [Bulk Upload Errors](#6-bulk-upload-errors)
7. [Barcode & Document Errors](#7-barcode--document-errors)
8. [Procurement Errors](#8-procurement-errors)
9. [Vendor Errors](#9-vendor-errors)
10. [Repair & Maintenance Errors](#10-repair--maintenance-errors)
11. [Audit Errors](#11-audit-errors)
12. [Reporting Errors](#12-reporting-errors)
13. [Report Celery Task Errors](#13-report-celery-task-errors)
14. [Notification Errors](#14-notification-errors)
15. [Notification Celery Task Errors](#15-notification-celery-task-errors)
16. [Email Sending Errors](#16-email-sending-errors)
17. [Inconsistent Error Patterns](#17-inconsistent-error-patterns)
18. [Silent Failure Points](#18-silent-failure-points)
19. [Recommended Error Handling Standards](#19-recommended-error-handling-standards)

---

## 1. Global Response Envelope

All API responses follow a **generic envelope** pattern defined in two helper functions:

**File:** `assets/response.py`

### Success Envelope
```python
{
    "success": True,
    "message": "Success",          # customizable
    "data": { ... }                # only present if data is not None
}
```
HTTP status defaults to `200 OK`.

### Error Envelope
```python
{
    "success": False,
    "message": "Error",            # customizable
    "errors": { ... }              # only present if errors is not None
}
```
HTTP status defaults to `400 Bad Request`.

### Known Limitation
- `success_response()` does not support returning arrays at the top level — only objects. If you need to return a list, you must wrap it in a `"data"` key.
- `error_response()` defaults to `400`. Endpoints that need a different status code (404, 401, 403, 500) **must** explicitly pass `http_status`.

---

## 2. Centralized Error Helpers

**File:** `assets/response.py` (lines 1-22)

Two functions are used across the entire backend:

| Function | Purpose | Default Status | Used In |
|----------|---------|----------------|---------|
| `success_response(data, message, http_status)` | Wrap successful results | 200 | Most view actions |
| `error_response(message, errors, http_status)` | Wrap error payloads | 400 | ~15 endpoints |

**Important:** Not all endpoints use these helpers. Several views use raw `Response()` dictionaries directly (see [Inconsistent Error Patterns](#17-inconsistent-error-patterns)).

---

## 3. Authentication & Authorization Errors

### 3.1 JWT Login
**File:** `accounts/views.py` — `CustomTokenObtainPairView.post()`

| Scenario | HTTP Status | Response Body |
|----------|-------------|---------------|
| Invalid credentials (handled by SimpleJWT) | `401 Unauthorized` | `{"non_field_errors": ["No active account found with the given credentials"]}` |
| Missing `username` or `password` (handled by DRF serializer) | `400 Bad Request` | `{"non_field_errors": ["..."]}` |

No custom error handling — delegated entirely to `djangorestframework-simplejwt`.

### 3.2 Cookie-Based Token Refresh
**File:** `accounts/views.py` — `CookieTokenRefreshView.post()`

| Scenario | HTTP Status | Response Body |
|----------|-------------|---------------|
| No `refresh_token` cookie | `401 Unauthorized` | `{"detail": "No refresh token provided"}` |
| Invalid or expired refresh token | `401 Unauthorized` | `{"detail": "Invalid or expired refresh token"}` |
| Valid refresh token | `200 OK` | `{"access": "<new_token>"}` + cookie set |

**Edge Case:** The `except Exception` on line 74 catches **all** exceptions during token refresh (including `TokenError`, `InvalidToken`, etc.) and returns a generic 401. The refresh token cookie is deleted on failure.

### 3.3 Token Blacklist on Logout
**File:** `accounts/views.py` — `LogoutView.post()`

| Scenario | Behavior |
|----------|----------|
| Valid refresh token provided | Blacklists the token, deletes cookie, returns `{"detail": "Logged Out"}` |
| Invalid/malformed refresh token | **Silently ignores** the exception (`except Exception: pass`), still deletes the cookie |
| No refresh token | Returns success `{"detail": "Logged Out"}` regardless |

**Risk:** Any exception during blacklisting is swallowed — the user is logged out from the cookie side regardless of blacklist state.

### 3.4 Permission Denied (RBAC)
**File:** `assets/views/permissions.py`

Four custom permission classes:

| Class | Allowed Roles |
|-------|---------------|
| `IsAuth` | Any authenticated user |
| `IsManagerOrAbove` | MANAGER, DEPARTMENT_ADMIN, SUPER_ADMIN |
| `IsDeptAdminOrAbove` | DEPARTMENT_ADMIN, SUPER_ADMIN |
| `IsSuperAdmin` | SUPER_ADMIN only |

When permission is denied, DRF raises `PermissionDenied` → HTTP `403 Forbidden`.

**Additional in `assets/views/asset_views.py` line 69-70:**
```python
raise PermissionDenied("Managers cannot change asset status")
```
| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| MANAGER tries to change `status` field | `403 Forbidden` | `{"detail": "Error - Managers cannot change asset status."}` |

**Additional in `notifications/models.py` / `NotificationActionService.mark_read()`:**
```python
raise PermissionDenied("You can only mark your own notifications as read.")
```
| Scenario | HTTP Status |
|----------|-------------|
| User tries to mark another user's notification as read | `403 Forbidden` |

**Additional in `notifications/views.py` / `perform_destroy()`:**
```python
raise PermissionDenied("You can only delete your own notifications.")
```
| Scenario | HTTP Status |
|----------|-------------|
| User tries to delete another user's notification | `403 Forbidden` |

---

## 4. Account & Department Errors

### 4.1 Department Serializer Validation
**File:** `accounts/serializers.py` — `DepartmentSerializer.validate_services()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Duplicate service names in `services` list | `400 Bad Request` | `{"services": ["Services already exist: Payroll"]}` |

### 4.2 Department Tree
**File:** `accounts/views.py` — `DepartmentViewSet.tree()`

No explicit error handling. If database errors occur (e.g., corrupted tree structure with circular references), DRF will return a `500 Internal Server Error`.

---

## 5. Asset Management Errors

### 5.1 Asset Creation (Standard Path)
**File:** `assets/views/asset_views.py` — `AssetViewSet.perform_create()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Missing required fields (asset_code, asset_name, etc.) | `400 Bad Request` | DRF serializer validation errors |
| Duplicate `asset_code` | `400 Bad Request` | `{"asset_code": ["Asset with this Asset code already exists."]}` |

### 5.2 Asset Creation (Bulk Upload Action)
**File:** `assets/views/asset_views.py` — `AssetViewSet.add()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Missing required field (e.g., `asset_name`) | `400 Bad Request` | `{"success": false, "message": "asset_name is required"}` (note: inconsistent - uses `error_response` on update but not on add) |

Actually, the `add` action uses `serializer.is_valid(raise_exception=True)` which will raise a `400` with DRF validation errors.

### 5.3 Asset Update by Name
**File:** `assets/views/asset_views.py` — `AssetViewSet.update_asset()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Missing `asset_name` in request body | `400 Bad Request` | `{"success": false, "message": "asset_name is required"}` |
| Asset not found by name | `404 Not Found` | `{"success": false, "message": "Asset not found"}` |
| Invalid/missing fields in update data | `400 Bad Request` | DRF serializer validation errors |

### 5.4 Asset Deletion
**File:** `assets/views/asset_views.py` — `AssetViewSet.destroy()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| User lacks MANAGER or higher role | `403 Forbidden` | DRF PermissionDenied |
| Asset not found | `404 Not Found` | DRF default |

### 5.5 Asset Retrieval
**File:** `assets/views/asset_views.py` — `AssetViewSet.retrieve()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Asset not found | `404 Not Found` | DRF default |

### 5.6 Asset Search / Scan
**File:** `assets/views/asset_views.py` — `AssetViewSet.scan()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Missing `barcode` field | `400 Bad Request` | `{"error": "barcode required"}` |
| Barcode not found in database | `404 Not Found` | `{"error": "Asset not found"}` |

**Note:** This endpoint does NOT use the `success_response` / `error_response` helpers — it uses raw `Response()` dicts.

### 5.7 Barcode Generation
**File:** `assets/views/asset_views.py` — `AssetViewSet.generate_barcodes()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Missing or invalid `asset_ids` (not a list) | `400 Bad Request` | `{"error": "asset_ids list is required"}` |
| Valid request | `202 Accepted` | `{"task_id": "...", "message": "Barcode generation started"}` |

### 5.8 Asset Availability (Internal Service)
**File:** `assets/services/asset_service.py`

No explicit error handling. Returns empty querysets for users without departments or for non-matching roles.

### 5.9 Duplicate Approval/Rejection via Email
**File:** `assets/views/asset_views.py` — `approve_email()`, `reject_email()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Invalid approval token (UUID not found) | `404 Not Found` | `{"success": false, "message": "Invalid token"}` |
| Asset already approved/rejected (status ≠ PENDING) | `400 Bad Request` | `{"success": false, "message": "Asset is not pending approval"}` / `"Asset is not pending approval"` |

---

## 6. Bulk Upload Errors

**File:** `assets/services/upload_service.py`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Unsupported file format (not CSV, XLSX, or XLS) | `400 Bad Request` (via `ValueError`) | `{"error": "Unsupported file format"}` |
| No file in request | `400 Bad Request` | `{"error": "No file provided"}` |
| All rows have errors (zero assets created) | `400 Bad Request` | `{"error": "No assets created", "details": [<errors>]}` |
| Individual row validation failure | Collected in `errors` array returned with barcode Excel |
| Row references missing category/location/department | Auto-created (no error) |
| Row references invalid vendor | Auto-created with placeholder email (no error) |
| Exception during row processing | Row-level error captured: `{"row": N, "message": "<exception>"}` |
| Missing required column headers | Pandas will read `None` → validation errors per row |

**Note:** The endpoint `bulk_upload` uses raw `Response()` dicts, NOT the `error_response()` helper.

---

## 7. Barcode & Document Errors

### 7.1 Barcode Image Generation
**File:** `assets/services/barcode_service.py` — `BarcodeService.generate_barcode_image()`

| Scenario | Behavior |
|----------|----------|
| Valid barcode string | Returns `io.BytesIO` with PNG image |
| Any exception (invalid chars, library error) | **Returns `None`** (silently swallows exception) |
| Empty assets list for Excel export | Returns `b""` (empty bytes) |

### 7.2 Document Upload
**File:** `assets/views/document_views.py` — `DocumentViewSet.create()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| No file provided | `400 Bad Request` | `{"error": "No file provided"}` |
| File saves successfully | `201 Created` + serializer data |

### 7.3 Document Download
**File:** `assets/views/document_views.py` — `DocumentViewSet.download()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Document not found (invalid pk) | `404 Not Found` (DRF default) | — |

---

## 8. Procurement Errors

### 8.1 Procurement Approval/Rejection (API)
**File:** `procurement/views.py` — `ProcurementViewSet.approve()`, `.reject()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Request is not in PENDING status | `400 Bad Request` | `{"error": "Request is not pending"}` |
| Request not found (invalid pk) | `404 Not Found` (DRF `get_object()` default) | — |

### 8.2 Procurement Approval/Rejection (Email Token)
**File:** `procurement/views.py` — `approve_email()`, `reject_email()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Invalid approval token (UUID not found) | `404 Not Found` | `{"error": "Invalid token"}` |
| Request not in PENDING status | `400 Bad Request` | `{"error": "Request is not pending"}` |
| Valid token, successful approval | `200 OK` | `{"message": "Procurement approved successfully"}` |
| Valid token, successful rejection | `200 OK` | `{"message": "Procurement rejected"}` |

### 8.3 Procurement Model (Internal)
**File:** `procurement/models.py` — `ProcurementRequest.save()`

| Scenario | Behavior |
|----------|----------|
| Auto-generating `request_number` when `id` is `None` | Could fail if `last` is `None` AND `last.id` is accessed (but `last` would be `None` so fallback to `num=1`) |
| Duplicate `request_number` | IntegrityError at database level (not caught) |

---

## 9. Vendor Errors

### 9.1 Vendor Creation
**File:** `vendors/views.py` — `VendorViewSet.add()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Missing `vendor_name` | `400 Bad Request` | `{"error": "vendor_name is required"}` |
| Invalid `vendor_category` ID | `400 Bad Request` | `{"error": "Invalid vendor category"}` |
| Duplicate `vendor_name` | `200 OK` (get_or_create returns existing) | `{"created": false, "data": ...}` |

### 9.2 Vendor Soft Delete
**File:** `vendors/views.py` — `VendorViewSet.soft_delete()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Vendor not found | `404 Not Found` (DRF `get_object()` default) | — |

### 9.3 Vendor Code Generation
**File:** `vendors/views.py` — `VendorViewSet._generate_vendor_code()`

| Scenario | Behavior |
|----------|----------|
| No existing vendors | Returns `"VEND0001"` |
| Existing vendor code cannot be parsed to int | Falls back to `last.id` |

### 9.4 Vendor Model (Internal)
**File:** `domains/vendor_management/services.py`

No error handling — empty file.

---

## 10. Repair & Maintenance Errors

### 10.1 Repair Ticket CRUD
**File:** `repairs/views.py` — `RepairViewSet`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| User unauthenticated | `401 Unauthorized` | DRF default |
| User not in correct department | Empty queryset (200 with no results) | — |
| Ticket not found | `404 Not Found` (DRF default) | — |

**Note:** The repair views have **no custom error handling** — they rely entirely on DRF defaults.

### 10.2 Repair Model
**File:** `repairs/models.py`

No validation on `status` field values at the model level — any string can be saved.

---

## 11. Audit Errors

### 11.1 Scan Action
**File:** `audits/views.py` — `AuditSessionViewSet.scan()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Audit session is not OPEN | `400 Bad Request` | `{"error": "Audit session is closed"}` |
| Missing barcode | `400 Bad Request` | `{"error": "barcode required"}` |
| Asset not found by barcode | `404 Not Found` | `{"found": false, "error": "Asset not found"}` |
| Asset already scanned in this session | `200 OK` | `{"found": true, "duplicate": true, ...}` (not an error, but flagged) |

### 11.2 Complete Action
**File:** `audits/views.py` — `AuditSessionViewSet.complete()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Session already completed | `400 Bad Request` | `{"error": "Already completed"}` |

### 11.3 Audit Session Access
**File:** `audits/views.py`

| Scenario | Behavior |
|----------|----------|
| SUPER_ADMIN | Can access all sessions |
| Department user | Can only access own department's sessions |
| User with no department | Empty queryset |

**Note:** No explicit 403 — users without access simply get empty results (silent denial).

### 11.4 Audit Model
**File:** `audits/models.py`

No `status` validation at model level — `AuditSession` status accepts any string, not just `OPEN`/`COMPLETED`.

---

## 12. Reporting Errors

### 12.1 Report Generation Endpoint
**File:** `reports/views.py` — `ReportViewSet.generate()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Successful generation start | `202 Accepted` | `{"report_id": N, "task_id": "..."}` |
| Database error creating Report | Unhandled — propagates as `500` | — |

### 12.2 Report Status Check
**File:** `reports/views.py` — `ReportViewSet.status()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Report not found | `404 Not Found` (DRF default) | — |
| Task ID present but task lost | `200 OK` with `task_status: null` | — |

### 12.3 Report Download (PDF/Excel/Chart)
**File:** `reports/views.py`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| No PDF data | `404 Not Found` | `{"error": "No PDF data"}` |
| No Excel data | `404 Not Found` | `{"error": "No Excel data"}` |
| Chart expired or missing | `404 Not Found` | `{"error": "Chart expired or not available"}` |

### 12.4 Report Download by Token (Public)
**File:** `reports/views.py` — `_serve_report_by_token()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Invalid UUID token | `404 Not Found` | `Http404("Report not found")` |
| Report not found by token | `404 Not Found` | `Http404("Report not found")` |
| Report exists but no data (PDF/Excel) | `404 Not Found` | `Http404("No data available")` |

**Note:** These use Django's `Http404`, which returns HTML, NOT JSON. Inconsistent with the rest of the API.

### 12.5 Latest KPI Endpoint
**File:** `reports/views.py` — `latest_kpi()`

No error handling. Relies on `collect_kpi_metrics()` which never raises exceptions (handles empty states internally).

---

## 13. Report Celery Task Errors

### 13.1 Generate Report Task
**File:** `reports/tasks.py` — `generate_report_task()`

| Scenario | Behavior |
|----------|----------|
| User not found | Unhandled `User.DoesNotExist` → task fails → retry up to 2 times |
| Report not found | Unhandled `Report.DoesNotExist` → task fails → retry |
| Any exception during `generate_weekly_report()` | Marks report status as `'FAILED'` in DB, retries with `countdown=60s` |
| Max retries exceeded | Task permanently fails; report stays in `'FAILED'` status |

### 13.2 Send Report Email Task
**File:** `reports/tasks.py` — `send_report_email_task()`

| Scenario | Behavior |
|----------|----------|
| Report not found | Returns `"Report not found"` (string, no error raised) |
| Email not configured | Returns `"Email not configured"` (string) |
| SMTP failure | Logs error, **re-raises** the exception (task will retry up to 3 times) |

### 13.3 Send Report to Admins Task
**File:** `reports/tasks.py` — `send_report_to_admins_task()`

| Scenario | Behavior |
|----------|----------|
| Report not found | Returns `"Report not found"` (string) |
| No admin users found | Returns `"No admin users found"` (string) |
| Individual admin email fails | Logs error for that admin, **continues** to next admin |
| SMTP connection failure | Unhandled — will propagate as task failure |

### 13.4 Scheduled Tasks (Celery Beat)
**File:** `config/settings.py` — `CELERY_BEAT_SCHEDULE`

| Task | Schedule | Error Handling |
|------|----------|----------------|
| `generate-weekly-report` | Every 7 days | Same as `generate_report_task` above |
| `clear-expired-charts` | Every hour | No error handling — unhandled exceptions fail silently |
| `delete-old-reports` | Every day | No error handling — unhandled exceptions fail silently |
| `clean-old-notifications` | Every day (90-day retention) | No error handling — unhandled exceptions fail silently |

---

## 14. Notification Errors

### 14.1 List Notifications
**File:** `notifications/views.py` — `NotificationViewSet.list()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Any exception during listing | `500 Internal Server Error` | `{"detail": "Failed to fetch notifications", "error": "<exception>"}` |

**Note:** This is the **only** endpoint in the entire project with a catch-all `500` handler. This is good practice but inconsistent — other list endpoints have no error handling.

### 14.2 Mark as Read
**File:** `notifications/views.py` — `NotificationViewSet.mark_read()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Non-owner tries to mark another's notification | `403 Forbidden` | `{"detail": "You can only mark your own notifications as read."}` |

### 14.3 Bulk Mark as Read
**File:** `notifications/views.py` — `NotificationViewSet.bulk_mark_read()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Missing `ids` in request body | `400 Bad Request` | `{"error": "No ids provided"}` |

### 14.4 Bulk Delete
**File:** `notifications/views.py` — `NotificationViewSet.bulk_delete()`

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Missing `ids` in request body | `400 Bad Request` | `{"error": "No ids provided"}` |

### 14.5 Notification Preference Bulk Update
**File:** `notifications/views.py` — `NotificationPreferenceViewSet.bulk_update()`

| Scenario | Behavior |
|----------|----------|
| Missing keys in preference object | **Unhandled** — `KeyError` will return `500` |
| Invalid notification type | Created anyway (no validation on type) |

---

## 15. Notification Celery Task Errors

### 15.1 Create Notification Task
**File:** `notifications/tasks.py` — `create_notification_task()`

| Scenario | Behavior |
|----------|----------|
| User ID provided but user not found | Returns `"User {id} not found"` (string, no error raised) |
| Department ID provided but department not found | Returns `"Department {id} not found"` (string) |
| Email sending condition check fails | No error — silently skips email |

### 15.2 Send Notification Email Task
**File:** `notifications/tasks.py` — `send_notification_email()`

| Scenario | Behavior |
|----------|----------|
| User not found | **Returns silently** (`return` with no value) |
| No user email or no EMAIL_HOST_USER configured | **Returns silently** |
| SMTP failure | Logs exception, does NOT re-raise — **email fails silently** |

### 15.3 Clean Old Notifications Task
**File:** `notifications/tasks.py` — `clean_old_notifications()`

No error handling. Bulk delete operation proceeds without protection.

---

## 16. Email Sending Errors

### 16.1 Report Email (HTML with attachments)
**File:** `assets/services/send_email.py` — `send_report_email()`

| Scenario | Behavior |
|----------|----------|
| No email config (`EMAIL_HOST_USER` or recipients missing) | Returns `False` immediately |
| SMTP connection/auth failure | Logs error, returns `False` |
| Invalid report data (missing attributes) | **Unhandled** — may raise `AttributeError` |

### 16.2 Procurement Approval Email
**File:** `assets/services/send_email.py` — `send_procurement_approval_email()`

| Scenario | Behavior |
|----------|----------|
| No `EMAIL_HOST_USER` | Returns `False` |
| SMTP failure | Logs error, returns `False` |

### 16.3 New Asset Notification Email
**File:** `assets/services/send_email.py` — `send_new_asset_email()`

| Scenario | Behavior |
|----------|----------|
| No `EMAIL_HOST_USER` | Returns `False` |
| No department provided | Returns `False` |
| No admins in department | Returns `False` |
| No assets in queryset | Returns `False` |
| SMTP failure | Logs error, returns `False` |

---

## 17. Inconsistent Error Patterns

The codebase uses **five different error response formats**. This makes frontend error handling unreliable.

### Format A — `error_response()` helper (correct pattern)
```python
return error_response("Asset not found", http_status=status.HTTP_404_NOT_FOUND)
# → {"success": False, "message": "Asset not found"}
```
**Used in:** `assets/views/asset_views.py` (approve/reject email actions)

### Format B — Raw `Response()` with `"error"` key
```python
return Response({"error": "barcode required"}, status=400)
```
**Used in:** `scan()`, `generate_barcodes()`, `bulk_upload()`, `audit/scan()`, `notifications/bulk_mark_read()`, `notifications/bulk_delete()`, `procurement/approve/reject`

### Format C — Raw `Response()` with `"detail"` key
```python
return Response({"detail": "No refresh token provided"}, status=401)
```
**Used in:** `CookieTokenRefreshView`, `LogoutView`, `notification/list` catch-all

### Format D — Raw `Response()` with nested `"error"` key + custom content
```python
return Response({"error": "No PDF data"}, status=404)
```
**Used in:** `reports/download_pdf`, `reports/download_excel`, `reports/download_chart`

### Format E — Django `Http404` (returns HTML, not JSON)
```python
raise Http404("Report not found")
```
**Used in:** `_serve_report_by_token()` (two endpoints)

### Format F — DRF `PermissionDenied`
```python
raise PermissionDenied("Managers cannot change asset status")
```
**Used in:** Asset update, notification mark_read, notification delete

### Summary of Inconsistencies

| Issue | Impact |
|-------|--------|
| Some endpoints use `error_response()`, others use raw `Response()` | Frontend must check multiple response shapes |
| `Http404` returns HTML, not JSON | Frontend AJAX calls break on token-based download URLs |
| `"error"` vs `"detail"` vs `"message"` keys vary by endpoint | Frontend cannot use a single error parser |
| Some endpoints return 200 with error info inside (`audit/scan` duplicate) | Frontend must inspect body to detect errors |
| String error returns from Celery tasks (`"Report not found"`) | No structured error data for programmatic handling |

---

## 18. Silent Failure Points

These locations **swallow errors without logging or alerting**:

| Location | Code | Risk |
|----------|------|------|
| `accounts/views.py:189` | `except Exception: pass` during token blacklist | Token not blacklisted on logout failure |
| `assets/services/barcode_service.py:36` | `except Exception: return None` | Barcode image silently fails; no indication to user |
| `assets/services/send_email.py:all` | `except Exception` → `return False` | All email sending fails silently |
| `notifications/tasks.py:73-76` | `except User.DoesNotExist: return` | Notification discarded if user deleted |
| `notifications/tasks.py:75-76` | `if not user.email: return` | Notification silently dropped |
| `notifications/tasks.py:96-99` | `except Exception` → log only | Email send failure not re-raised |
| `vendors/views.py:50` | `except Exception: num = last.id` | Vendor code may produce unexpected values |
| `reports/tasks.py:57-61` | `except Exception: raise` (SMTP) | Email task retries but no structured error to user |

---

## 19. Recommended Error Handling Standards

Based on analysis of the entire codebase, here are recommendations for consistent error handling:

### 19.1 Use `error_response()` Everywhere
Replace all raw `Response({"error": ...})` calls with the centralized helper:
```python
from assets.response import error_response
return error_response("Asset not found", http_status=status.HTTP_404_NOT_FOUND)
```

### 19.2 Never Use Django `Http404` in API Views
Replace with:
```python
return error_response("Report not found", http_status=status.HTTP_404_NOT_FOUND)
```

### 19.3 Add Catch-All Error Handler in `views.py`
Wrap every list/retrieve method with try/except to return structured 500 errors (as done in `notifications/views.py`).

### 19.4 Log All Silent Failures
Every `except Exception: pass` or `except Exception: return None` should log:
```python
import logging
logger = logging.getLogger(__name__)
logger.exception("Description of what failed")
```

### 19.5 Add Retry Configuration to Celery Tasks
Tasks that perform I/O (email, HTTP calls) should use `max_retries` and `countdown`:
```python
@shared_task(bind=True, max_retries=3, default_retry_delay=60)
```

### 19.6 Validate Celery Task Inputs
Add input validation at the start of Celery tasks instead of relying on runtime exceptions:
```python
if not user_id or not report_id:
    raise ValueError("user_id and report_id are required")
```

### 19.7 Standardize Status Codes
| Condition | Status Code |
|-----------|-------------|
| Resource not found | `404` |
| Invalid input / validation | `400` |
| Permission denied | `403` |
| Authentication required | `401` |
| Action not applicable (e.g., approve non-pending) | `409 Conflict` or `400` |
| Server error | `500` |
| Async task accepted | `202` |
| Successful creation | `201` |
| Successful update | `200` |
| Successful delete | `204` |

### 19.8 Add Global Exception Handler
In `config/views.py` or a middleware, catch unhandled exceptions and return structured JSON:
```python
from rest_framework.views import exception_handler

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        response.data = {
            "success": False,
            "message": response.detail if hasattr(response, 'detail') else str(exc),
            "errors": response.data if hasattr(response, 'data') else None,
        }
    return response
```
Set in settings: `'EXCEPTION_HANDLER': 'config.views.custom_exception_handler'`

---

## Appendix: Complete Error Catalog by File

| File | Lines | Error Patterns Found |
|------|-------|---------------------|
| `assets/response.py` | 1-22 | Central helpers (`success_response`, `error_response`) |
| `accounts/views.py` | 50-80 | 401 for missing/invalid refresh token; silent exception on logout blacklist |
| `accounts/serializers.py` | 23-29 | ValidationError for duplicate services |
| `assets/views/asset_views.py` | 69-107 | PermissionDenied (managers); 404 (not found); 400 (missing params) |
| `assets/views/asset_views.py` | 111-146 | 400 (no file); ValueError (bad format); raw Response dicts |
| `assets/views/asset_views.py` | 181-220 | Raw 400/404 for scan, generate_barcodes |
| `assets/views/asset_views.py` | 208-235 | 404 (invalid token); 400 (not pending) |
| `assets/views/location_views.py` | 24-56 | 400 (missing name); 404 (not found) |
| `assets/views/category_views.py` | 23-74 | 400 (missing name); 404 (not found) |
| `assets/services/upload_service.py` | 52-147 | ValueError (bad format); row-level errors collected |
| `assets/services/barcode_service.py` | 20-37 | Returns None on exception (silent) |
| `assets/services/send_email.py` | 1-396 | Returns False on config/email failure; logs SMTP errors |
| `assets/services/asset_service.py` | 1-108 | No error handling; returns empty querysets |
| `procurement/views.py` | 73-130 | 400 (not pending); 404 (invalid token); raw Response dicts |
| `vendors/views.py` | 54-112 | 400 (missing name); 400 (invalid category); exception swallowed |
| `repairs/views.py` | 1-33 | No custom error handling; DRF defaults only |
| `audits/views.py` | 29-77 | 400 (closed session, missing barcode); 404 (asset not found) |
| `reports/views.py` | 33-145 | 404 (no data); Http404 (token endpoints); 202 (async) |
| `reports/services.py` | 100-1532 | No exceptions raised; handles None/empty gracefully |
| `reports/tasks.py` | 1-192 | Marks FAILED on exception; returns strings on failure; re-raises SMTP |
| `notifications/views.py` | 36-107 | 500 (catch-all); 400 (missing ids); 403 (permission) |
| `notifications/tasks.py` | 1-109 | Returns strings on failure; silently drops missing user/email |
| `config/settings.py` | 1-251 | Celery Beat schedule defines 4 recurring tasks |

---

*This documentation covers all error handling patterns found across the complete codebase as of 2026-05-15.*