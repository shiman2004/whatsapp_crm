# SYSTEM SETTINGS API CONTRACT MATRIX
**Project:** Alpha Health Group WhatsApp CRM  
**Date:** November 03, 2026  

---

## 1. REST Endpoint Specifications

| Endpoint Path | HTTP Method | Scope | Auth Required | Permission Required | Request Payload Summary | Expected Response Code & Schema |
|---|---|---|---|---|---|---|
| `/api/settings/sections` | `GET` | Global | Yes (Bearer) | `system.settings.view` | None | `200 OK`: `{ success: true, sections: Array<SectionMetadata> }` |
| `/api/settings/:section` | `GET` | Global / Company | Yes (Bearer) | `system.settings.view` | Query: `?scope=company&scopeId=RWC` | `200 OK`: `{ success: true, section, version, data }` |
| `/api/settings/:section` | `PUT` | Global / Company | Yes (Bearer) | `system.settings.manage` | `{ version: number, data: object }` | `200 OK`: `{ success: true, version: number, data: object }`<br>`409 Conflict`: OCC mismatch |
| `/api/companies/:id/settings/:section` | `GET` | Company | Yes (Bearer) | `staff.view` | None | `200 OK`: `{ success: true, section, scopeId, version, data }` |
| `/api/companies/:id/settings/:section` | `PUT` | Company | Yes (Bearer) | `system.settings.manage` | `{ version: number, data: object }` | `200 OK`: `{ success: true, version, data }`<br>`409 Conflict`: `{ success: false, error: "VERSION_CONFLICT" }` |
| `/api/companies/:id/branches` | `GET` | Company | Yes (Bearer) | `staff.view` | Query: `?search=colombo` | `200 OK`: `{ success: true, branches: Array<Branch> }` |
| `/api/companies/:id/branches` | `POST` | Company | Yes (Bearer) | `system.settings.manage` | `{ name, code, city, phone, address, capacity }` | `201 Created`: `{ success: true, branch: Branch }` |
| `/api/companies/:id/branches/:branchId` | `PATCH` | Company | Yes (Bearer) | `system.settings.manage` | `{ name?, phone?, active?, address? }` | `200 OK`: `{ success: true, branch: Branch }` |
| `/api/users/me/preferences` | `GET` | User | Yes (Bearer) | None (Self) | None | `200 OK`: `{ success: true, preferences: object }` |
| `/api/users/me/preferences` | `PATCH` | User | Yes (Bearer) | None (Self) | `{ preferences: object }` | `200 OK`: `{ success: true, preferences: object }` |
| `/api/settings/audit-logs` | `GET` | Global / Company | Yes (Bearer) | `system.audit.view` | Query: `?section=company&limit=50` | `200 OK`: `{ success: true, logs: Array<AuditLog> }` |
| `/api/settings/monitoring/health` | `GET` | Global | Yes (Bearer) | `system.settings.view` | None | `200 OK`: `{ success: true, status: "healthy", database: { status: "connected" } }` |

---

## 2. Standardized HTTP Status Code Mapping

| Status Code | Description | Scenario |
|---|---|---|
| `200 OK` | Successful Read / Mutation | Data retrieved or existing setting updated successfully. |
| `201 Created` | Successful Resource Creation | New branch, webhook endpoint, or API key created. |
| `400 Bad Request` | Payload Validation Error | Missing mandatory fields (e.g. branch name, invalid URL). |
| `401 Unauthorized` | Missing / Invalid Token | Request missing Bearer JWT or token signature invalid. |
| `403 Forbidden` | Insufficient Permissions | Non-admin user attempting to modify enterprise settings. |
| `404 Not Found` | Unknown Resource | Non-existent section ID or unknown company identifier. |
| `409 Conflict` | Optimistic Concurrency Conflict | Stale version submitted while concurrent edit occurred. |
| `429 Too Many Requests`| Rate Limit Exceeded | Client exceeded API requests per minute threshold. |
| `500 Server Error` | Unhandled Server Failure | Database disconnection or runtime execution error. |

---

## 3. Security Audit Event Emission

Every write to the above endpoints produces an audit record in `SecurityAudit`:
```json
{
  "id": "3e524fbc-7f92-4de9-8dd1-6b6a630fac09",
  "actorId": "jahan-admin-id",
  "action": "settings.company.update",
  "resource": "company:RWC",
  "outcome": "authorized",
  "metadata": "{\"diff\":{\"legalName\":\"Royal Wellness Center (Pvt) Ltd\"},\"version\":2}",
  "correlationId": "b9834d10-345c-4c93-bfd4-76149f25fe7d",
  "createdAt": "2026-11-03T10:46:43.594Z"
}
```
Sensitive data such as raw passwords or WhatsApp auth keys are filtered from diff payloads prior to writing to the audit log.

