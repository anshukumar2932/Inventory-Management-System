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

### Migration Plan

| Change | v1 (current) | v2 (target) |
|--------|-------------|-------------|
| Flatten asset routes | `/api/v1/assets/assets/` | `/api/v2/assets/` |
| Rename routes | `/api/v1/assets/categories/` | `/api/v2/categories/` |
| Rename routes | `/api/v1/assets/locations/` | `/api/v2/locations/` |
| Namespaced vendors | `/api/v1/vendors/` | `/api/v2/vendors/` |

### Deprecation Policy

1. v1 and v2 coexist for minimum 3 months after v2 launch
2. Response header `X-API-Version: v1` on all responses
3. Sunset header on v1 after 3 months: `Sunset: Sat, 01 Nov 2026 00:00:00 GMT`
4. Migration guide published for each breaking change
