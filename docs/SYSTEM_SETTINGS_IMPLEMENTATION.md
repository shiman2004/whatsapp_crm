# SYSTEM SETTINGS IMPLEMENTATION ARCHITECTURE
**Project:** Alpha Health Group WhatsApp CRM  
**Date:** November 03, 2026  
**Implementation Lead:** Master Codex Autonomous Agent  

---

## 1. Unified Enterprise Settings Engine

The System Settings subsystem is built on a unified architectural pattern combining **Optimistic Concurrency Control (OCC)**, **Multi-Brand Tenant Scoping**, **Transactional Audit Logging**, and **Zero-Knowledge Secret Encryption**.

```
       +-------------------------------------------------------------+
       |                   React Settings UI Hub                    |
       |  (SettingsLayout, CompanyBranch, SalesPipelines, Marketing) |
       +-------------------------------------------------------------+
                                      |
                           HTTP PUT / PATCH / GET
                                      v
       +-------------------------------------------------------------+
       |               RBAC & Authentication Gateway                |
       |       (JWT Bearer, requireCapability, Company Access)       |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |                 Settings Service Controller                 |
       |   - Optimistic Locking (version === expectedVersion)       |
       |   - Diff Computation (oldPayload vs newPayload)             |
       |   - Secret Masking / Encryption (AES-256-GCM)               |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |                 Prisma Interactive Transaction              |
       |   1. UPDATE "Setting" SET payload, version = version + 1    |
       |   2. INSERT INTO "SecurityAudit" (actor, diff, correlation)  |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |                   PostgreSQL 15+ Database                  |
       +-------------------------------------------------------------+
```

---

## 2. Key Architectural Guarantees

### 2.1 Optimistic Concurrency Control (OCC)
- Every setting record maintains an integer `version` field initialized to `1`.
- When updating, the frontend sends `{ version: currentVersion, data: updatedData }`.
- If another administrator has modified the record concurrently, the backend throws `VersionConflictError` (`409 Conflict`) and returns:
  ```json
  {
    "success": false,
    "error": "VERSION_CONFLICT",
    "message": "The settings for section 'company' have been modified by another administrator.",
    "currentVersion": 3,
    "expectedVersion": 2,
    "serverDiff": { "legalName": "Updated Legal Entity Name" }
  }
  ```
- The frontend triggers a conflict resolution drawer allowing the administrator to inspect the server's changes and reload or merge.

### 2.2 Scoping & Multi-Tenancy Hierarchy
1. **Global Scope (`scope: 'global'`, `scopeId: null`)**:
   - Applies holding-wide (e.g. `roles`, `security_policy`, `integrations`, `system_monitoring`).
2. **Company Scope (`scope: 'company'`, `scopeId: 'RWC' | 'CRAS' | 'AHC'`)**:
   - Company-isolated (e.g. `company`, `whatsapp_messaging`, `sales`, `marketing`, `clinical`).
   - Updates made to `CRAS` do not bleed into `RWC` or `AHC`.
3. **User Scope (`scope: 'user'`, `scopeId: user.id`)**:
   - Per-operator preferences (e.g. `appearance`, navigation shortcuts).

### 2.3 Zero-Knowledge Secret Encryption
- Credentials such as SMTP passwords and third-party Webhook HMAC keys are encrypted using AES-256-GCM before database write.
- When querying settings via GET endpoints, secrets are masked:
  ```json
  {
    "smtpHost": "smtp.sendgrid.net",
    "smtpPassword": "••••••••••••"
  }
  ```
- If an update payload submits masked asterisks, the backend preserves the existing encrypted secret without overwriting it with plain dots.

### 2.4 Transactional Audit Logging
Every mutation executes within a database transaction:
```javascript
await prisma.$transaction(async (tx) => {
  const updated = await tx.setting.update({ ... });
  await tx.securityAudit.create({
    data: {
      actorId: user.id,
      action: `settings.${section}.update`,
      resource: `${scope}:${scopeId || 'global'}`,
      outcome: 'authorized',
      metadata: JSON.stringify({ diff, version: updated.version }),
      correlationId
    }
  });
});
```

---

## 3. UI Implementation Details

### 3.1 Dynamic Tab Switching & Responsive Layout
All settings modules use the unified `SettingsLayout` component:
- Eliminates hardcoded `max-w-6xl` containers in favor of full-width responsive layout (`w-full space-y-6`).
- Reactive tab bars conditionally render dedicated views (`activeTab === 'stages'`, `activeTab === 'lost_reasons'`, `activeTab === 'sources'`, `activeTab === 'rules'`).
- Zero static dead-ends or unclickable functional elements.

### 3.2 Client-Side Image Ingestion & Processing
In `CompanyBranchSection.tsx`:
- Native file upload triggers via `<input type="file" ref={fileInputRef} accept="image/*" />`.
- Drag-and-drop listener on the emblem container.
- Image loaded onto HTML5 `<canvas>` and scaled to $512 \times 512$ maximum bounding dimensions with 90% quality JPEG/PNG compression.
- Generates a compact Base64 Data URL persisted directly into PostgreSQL `Setting` payload.

---

## 4. Rollback and Disaster Recovery

If configuration needs to be reverted to factory baseline:
1. Administrators can click **`↺ Reset to Default`** on any module to reset form state to approved company defaults.
2. Direct backend reset can be executed by purging custom rows from the `Setting` table, which triggers automatic fallback to `DEFAULT_SETTINGS` defined in `backend/src/services/settingsService.js`.

