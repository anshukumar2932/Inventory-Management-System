# API Versioning Strategy

## Current: v1

All endpoints live under `/api/v1/`.

| Prefix | App |
|--------|-----|
| `/api/v1/auth/` | accounts |
| `/api/v1/assets/assets/` | assets |
| `/api/v1/assets/categories/` | assets |
| `/api/v1/assets/locations/` | assets |
| `/api/v1/assets/documents/` | assets |
| `/api/v1/assets/service-types/` | assets |
| `/api/v1/assets/asset-services/` | assets |
| `/api/v1/vendors/` | vendors |
| `/api/v1/dashboard/stats/` | dashboard |
| `/api/v1/procurements/` | procurement |
| `/api/v1/notifications/` | notifications |
| `/api/v1/repairs/` | repairs |
| `/api/v1/reports/` | reports |
| `/api/v1/audits/` | audits |

## Strategy for v2 Migration

### Approach: URL Prefix Versioning (already adopted)

New v2 endpoints go under `/api/v2/`. Old v1 endpoints remain active until deprecated.

