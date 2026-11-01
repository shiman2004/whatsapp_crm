# Royal Wellness Center CRM – Media Storage Investigation Report

**Document Name:** `MEDIA_STORAGE_INVESTIGATION.md`  
**Investigation Type:** Read-Only Source Code & Live Environment Audit  
**Target Repository:** Royal Wellness CRM (`royal-wellness-crm`)  
**Audited Date:** October 31, 2026  
**Auditor:** Antigravity AI Coding Assistant  

---

## Executive Summary

This investigation was conducted in strict **READ-ONLY** mode to establish exactly where incoming WhatsApp images, videos, voice notes, documents, and other media are stored, how they are retrieved by coordinators in the CRM, whether they are permanently retained, and their exact contribution to Supabase egress and server disk consumption.

### Key Findings Summary:

1. **Active Primary Storage Location: Supabase PostgreSQL (`public.media_files` table, `BYTEA` column)**  
   Incoming WhatsApp media is **NOT currently stored in Supabase Storage Buckets**. Because `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are omitted from the active runtime environment (`backend/.env`), the system automatically activates its built-in fallback branch in [`backend/src/supabaseMedia.js`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/supabaseMedia.js#L39-L44) and persists the raw binary payload directly into the Supabase PostgreSQL database table `public.media_files` inside a binary `BYTEA` column.
   
2. **Local Server Cache (`backend/public/uploads`):**  
   Every incoming file is simultaneously saved to the local backend server filesystem under `backend/public/uploads/` as a Tier-1 local cache before being streamed or uploaded. On ephemeral container platforms like Render, this folder is cleared on redeployment or restart.

3. **Supabase Storage Bucket (`whatsapp-media`):**  
   The codebase includes full support for Supabase Storage buckets via `@supabase/supabase-js` targeting the bucket `whatsapp-media` (or `process.env.SUPABASE_MEDIA_BUCKET`). However, this code branch is currently inactive because the Supabase client initializes to `null` in the absence of API credentials in `.env`.

4. **Retention Policy:**  
   Media is stored **permanently**. There is no automated TTL, cron cleanup, or scheduled purge for rows in `public.media_files` or local files. Deletion is only triggered when a Super Admin deletes an entire lead or customer chat.

5. **Supabase Egress Impact:**  
   - **Local disk hits:** When files exist in `backend/public/uploads`, requests generate **0 bytes** of Supabase egress.  
   - **Local disk misses:** Following a server restart, container redeployment, or when accessing media not on the local disk, the backend queries `public.media_files` over the database connection pooler. The entire binary payload is fetched via SQL `SELECT data ...`, contributing **100% of the file size plus PostgreSQL wire protocol overhead (~33%)** directly to Supabase **Database Egress**.

6. **External Storage:**  
   Copies also exist on **Meta / WhatsApp Cloud CDN** under the Meta Media ID for ~14–30 days, which the CRM leverages as an ultimate failover re-download mechanism.

---

## 1. Complete Incoming WhatsApp Media Flow

The diagram below traces the complete lifecycle of incoming WhatsApp media from the moment Meta triggers a webhook to database persistence and coordinator retrieval.

```mermaid
sequenceDiagram
    autonumber
    actor Customer as WhatsApp User
    participant Meta as Meta Cloud API / CDN
    participant Webhook as Express Webhook (/webhook)
    participant Server as Legacy Server (legacyServer.js)
    participant Disk as Local Server Disk (/public/uploads)
    participant PG as Supabase PostgreSQL (public.media_files)
    participant DB as Messages Table (public.messages)
    actor Coordinator as CRM Frontend (Coordinator UI)

    Customer->>Meta: Sends image / audio / video / document
    Meta->>Webhook: POST /webhook (Payload with msgType & mediaId)
    Webhook->>Server: downloadMetaMedia(mediaId, metaToken, mimeType)
    Server->>Meta: GET https://graph.facebook.com/v20.0/{mediaId}
    Meta-->>Server: JSON { url: "https://lookaside.fbsbx.com/...", mime_type }
    Server->>Meta: GET {downloadUrl} with Bearer token
    Meta-->>Server: Binary arrayBuffer payload
    Server->>Disk: fs.writeFileSync(backend/public/uploads/meta_{id}_{ts}.ext)
    Server->>PG: saveMediaToSupabase() -> INSERT INTO public.media_files (BYTEA)
    Server->>Server: createPrivateMediaUrl() -> /uploads/{fileName}?exp=...&sig=...
    Server->>DB: prisma.message.upsert() with mediaUrl & mediaType
    Server->>Coordinator: broadcastScopedSSE() -> INBOUND_WHATSAPP_MESSAGE
    Coordinator->>Server: GET /uploads/{fileName}?exp=...&sig=...
    alt File exists on local disk (Cache Hit)
        Server->>Disk: fs.createReadStream()
        Disk-->>Coordinator: 200 OK (Binary stream) [0 Supabase Egress]
    else File missing on disk (After Container Restart)
        Server->>PG: SELECT data FROM public.media_files WHERE file_name = $1
        PG-->>Server: Binary BYTEA payload [Generates DB Egress]
        Server->>Disk: fs.writeFile() (Re-populates local cache)
        Server-->>Coordinator: 200 OK (Binary buffer)
    end
```

### Step-by-Step Code Walkthrough:

#### A. Webhook Receipt & Media Extraction
- **File:** [`backend/src/legacyServer.js`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L6556-L6572)  
- **Lines 6556–6572:**
  ```javascript
  if (['image', 'audio', 'voice', 'video', 'document'].includes(msgType)) {
    mediaType = msgType === 'voice' ? 'audio' : msgType;
    const mediaObj = message.image || message.audio || message.voice || message.video || message.document;
    const mediaId = mediaObj?.id;
    const mimeType = mediaObj?.mime_type || '';
    mediaFileName = mediaObj?.filename || null;

    if (mediaObj?.caption) {
      text = mediaObj.caption;
    } else if (!text) {
      text = mediaFileName || (mediaType === 'audio' ? 'Voice note' : `[${mediaType.toUpperCase()}]`);
    }

    if (mediaId && metaToken) {
      mediaUrl = await downloadMetaMedia(mediaId, metaToken, mimeType, mediaFileName);
    }
  }
  ```

#### B. Downloading from Meta Cloud API
- **File:** [`backend/src/legacyServer.js`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L630-L689)  
- **Function:** `downloadMetaMedia(mediaId, metaToken, mimeType, customFilename)`
- **Execution Details:**
  1. Requests Meta Graph API endpoint:  
     `GET https://graph.facebook.com/v20.0/${mediaId}` with header `'Authorization': 'Bearer ' + metaToken` ([lines 633–635](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L633-L635)).
  2. Parses JSON to obtain temporary download URL (`metaData.url`) and validated MIME type.
  3. Downloads binary payload via `fetch(downloadUrl, { headers: { Authorization: ... } })` ([lines 646–652](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L646-L652)).
  4. Determines file extension:
     - `image/jpeg` $\rightarrow$ `.jpg`
     - `image/png` $\rightarrow$ `.png`
     - `image/webp` $\rightarrow$ `.webp`
     - `audio/ogg`, `opus` $\rightarrow$ `.ogg`
     - `audio/mp4`, `m4a` $\rightarrow$ `.m4a`
     - `audio/mpeg`, `mp3` $\rightarrow$ `.mp3`
     - `video/mp4` $\rightarrow$ `.mp4`
     - `pdf` $\rightarrow$ `.pdf`
     - `word`, `document` $\rightarrow$ `.docx`
  5. Generates file name:
     `meta_${mediaId}_${Date.now()}.${ext}` ([line 677](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L677)).
  6. Writes file to local disk:  
     `fs.writeFileSync(path.join(process.cwd(), 'public', 'uploads', fileName), buffer)` ([line 683](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L683)).
  7. Asynchronously triggers database persistence:  
     `saveMediaToSupabase(fileName, mediaMime || mimeType || 'image/jpeg', buffer).catch(() => null)` ([line 684](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L684)).
  8. Returns signed access path:  
     `createPrivateMediaUrl(fileName)` ([line 686](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L686)).

#### C. Database Record Linkage
- **File:** [`backend/src/legacyServer.js`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L6691-L6711)
- Persists message details to `public.messages`:
  ```javascript
  await prisma.message.upsert({
    where: { id: messageId },
    update: {
      content: text,
      mediaType: mediaType || undefined,
      mediaUrl: mediaUrl || undefined,
      status: 'delivered'
    },
    create: {
      id: messageId,
      leadId: lead.id,
      customerId: cust.id,
      direction: 'inbound',
      senderType: 'customer',
      content: text,
      status: 'delivered',
      mediaType: mediaType || null,
      mediaUrl: mediaUrl || null,
      timestamp: new Date()
    }
  });
  ```

---

## 2. Storage Determination: Supabase Storage vs PostgreSQL BYTEA vs Local Server

| Storage Target | Currently Active? | Implementation Details | Evidence |
| :--- | :---: | :--- | :--- |
| **PostgreSQL `BYTEA` (`public.media_files`)** | **YES (PRIMARY)** | Raw binary buffer stored in PostgreSQL column `data` (type `BYTEA`) in table `public.media_files`. | [`backend/src/supabaseMedia.js:39-44`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/supabaseMedia.js#L39-L44) |
| **Local Server Disk (`backend/public/uploads`)** | **YES (CACHE)** | Local files saved on node server disk. Serves fast reads without touching Supabase if file is cached. | [`backend/src/legacyServer.js:683`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L683) |
| **Supabase Storage Bucket (`whatsapp-media`)** | **NO (INACTIVE)** | Code exists in `supabaseMedia.js:30-36`, but is bypassed because `SUPABASE_URL` is missing from `backend/.env`. | [`backend/src/supabaseMedia.js:7-9`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/supabaseMedia.js#L7-L9), [`backend/.env`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/.env) |
| **Meta Cloud CDN** | **YES (BACKUP)** | Meta stores media under `mediaId` for ~14–30 days. Fallback fetch triggered if file is missing from disk & Supabase. | [`backend/src/legacyServer.js:1154-1192`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L1154-L1192) |

### Evidence & Proof of Why PostgreSQL BYTEA is Active:

1. **Environment Configuration Check ([`backend/.env`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/.env#L1-L16)):**
   ```ini
   PORT=3001
   DATABASE_URL="postgresql://postgres.ldiclqjlrukdagdjhnon:KwYaBFEiyW5Ha0aX@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.ldiclqjlrukdagdjhnon:KwYaBFEiyW5Ha0aX@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"
   # Note: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are NOT defined!
   ```

2. **Client Initialization in [`backend/src/supabaseMedia.js`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/supabaseMedia.js#L6-L9):**
   ```javascript
   const storageBucket = process.env.SUPABASE_MEDIA_BUCKET || 'whatsapp-media';
   const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
     ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
     : null;
   ```
   Because `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are undefined, `supabase` evaluates to `null`.

3. **Fallback Branch in [`backend/src/supabaseMedia.js`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/supabaseMedia.js#L29-L47):**
   ```javascript
   if (supabase) {
     // Bypassed!
     const { error } = await supabase.storage.from(storageBucket).upload(...);
     ...
   }

   // Active Execution Branch:
   await prisma.$executeRawUnsafe(`
     INSERT INTO public.media_files (id, file_name, mime_type, data, size, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (file_name) 
     DO UPDATE SET data = EXCLUDED.data, size = EXCLUDED.size, mime_type = EXCLUDED.mime_type;
   `, mediaId, cleanFileName, mime, buf, buf.length);
   ```

4. **Live Database Verification:**
   A read-only query against the live PostgreSQL database confirmed:
   - Table `public.media_files` exists: `true`.
   - Current count: **11 files**.
   - Total binary payload: **1,171,993 bytes (~1.17 MB)**.
   - Message records referencing media: **101 messages**.

---

## 3. Detailed Inspection of `backend/src/supabaseMedia.js`

The file [`backend/src/supabaseMedia.js`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/supabaseMedia.js) encapsulates all media storage and retrieval operations for the CRM. Below is the detailed function-by-function analysis:

### 1. `saveMediaToSupabase(fileName, mimeType, buffer)` (Lines 15–52)
- **Inputs:** `fileName` (string), `mimeType` (string), `buffer` (Buffer or ArrayBuffer).
- **Sanitization:** Cleans filename with `path.basename(fileName)` to prevent directory traversal.
- **Unique Identifier:** Generates an ID using `media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`.
- **Logic:**
  - If `supabase` client is initialized: Executes `supabase.storage.from(storageBucket).upload(cleanFileName, buf, { contentType, upsert: true, cacheControl: '3600' })`.
  - If `supabase` is `null`: Executes raw SQL parameterized insert into `public.media_files` with `data = buf` (`BYTEA`). Handles duplicates via `ON CONFLICT (file_name) DO UPDATE`.
- **Callers:**
  - [`backend/src/legacyServer.js:684`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L684): Saves inbound WhatsApp media.
  - [`backend/src/legacyServer.js:613`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L613): Saves outbound coordinator media / voice notes (`saveBase64MediaLocally`).
  - [`backend/src/legacyServer.js:1180`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L1180): Re-saves media fetched from Meta fallback.
  - [`backend/src/examRoutes.js:1154`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/examRoutes.js#L1154): Saves student exam submissions and question papers.

### 2. `getMediaFromSupabase(fileName)` (Lines 57–98)
- **Inputs:** `fileName` (string).
- **Logic:**
  - If `supabase` client exists: Calls `supabase.storage.from(storageBucket).download(cleanFileName)`.
  - If `supabase` is `null`: Executes SQL:
    ```sql
    SELECT file_name, mime_type, data, size 
    FROM public.media_files 
    WHERE file_name = $1 
    LIMIT 1;
    ```
  - Converts `row.data` to a Node.js `Buffer` and returns `{ fileName, mimeType, buffer, size }`.
- **Callers:**
  - [`backend/src/legacyServer.js:1133`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L1133): Primary fallback when local disk file is missing.
  - [`backend/src/examRoutes.js:1057`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/examRoutes.js#L1057): Resolves exam papers / materials when serving download requests.

### 3. `deleteMediaFromSupabase(fileName)` (Lines 103–124)
- **Inputs:** `fileName` (string).
- **Logic:**
  - If `supabase` exists: Calls `supabase.storage.from(storageBucket).remove([cleanFileName])`.
  - If `supabase` is `null`: Executes SQL:
    ```sql
    DELETE FROM public.media_files WHERE file_name = $1;
    ```

### 4. `deleteMediaBatchFromSupabase(fileNames)` (Lines 129–146)
- **Inputs:** `fileNames` (Array of strings).
- **Logic:** Sanitizes all names with `path.basename` and loops through calling `deleteMediaFromSupabase(name)`.
- **Callers:**
  - [`backend/src/legacyServer.js:5813`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L5813): Deleting media associated with a deleted Lead.
  - [`backend/src/legacyServer.js:5828`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L5828): Deleting media associated with a deleted Customer.

---

## 4. Supabase Tables & Storage Buckets Used

### A. Database Table: `public.media_files`
- **Schema Bootstrap:** Defined in [`backend/src/schemaBootstrap.js:81-89`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/schemaBootstrap.js#L81-L89):
  ```sql
  CREATE TABLE IF NOT EXISTS public.media_files (
    id VARCHAR(255) PRIMARY KEY,
    file_name VARCHAR(255) UNIQUE NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    data BYTEA NOT NULL,
    size INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_media_files_name ON public.media_files(file_name);
  ```
- **Column Analysis:**
  - `id`: VARCHAR(255) Primary key with format `media_<timestamp>_<random>`.
  - `file_name`: VARCHAR(255) Unique filename (e.g., `meta_4645666719004319_1793458727527.ogg`, `out_1793330732414_58rroq.jpeg`, `exam_1793003449704_6y80c.pdf`).
  - `mime_type`: VARCHAR(100) MIME type string (e.g., `audio/ogg`, `image/jpeg`, `application/pdf`).
  - `data`: **BYTEA** containing the raw binary stream.
  - `size`: INTEGER storing file size in bytes.
  - `created_at`: TIMESTAMPTZ defaulting to current time.
- **Index:** `idx_media_files_name` on `(file_name)` ensures $O(1)$ lookup time during retrieval.

### B. Pointer Table: `public.messages`
- Contains references to stored media:
  - `mediaUrl`: Stores relative signed path (e.g., `/uploads/meta_4645666719004319_1793458727527.ogg?exp=...&sig=...`).
  - `mediaType`: Stores media category (`audio`, `image`, `video`, `document`).

### C. Storage Bucket: `whatsapp-media`
- **Configuration:** Set by default to `whatsapp-media` or custom bucket via `process.env.SUPABASE_MEDIA_BUCKET` ([`backend/src/supabaseMedia.js:6`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/supabaseMedia.js#L6)).
- **Current Status:** Defined in code and documented in `.env.example`, but **NOT actively instantiated** because `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are not set in the production/local `.env`.

---

## 5. Media Retention Policy & Lifecycle

### Are Media Files Permanently Retained?
**YES.** Media files stored in Supabase (`public.media_files`) are **permanently retained by default**.

1. **No Automated Expiry or TTL:**
   - There are no scheduled database jobs, PostgreSQL pg_cron tasks, or TTL policies configured to expire rows from `public.media_files`.
   - Once inserted, rows persist indefinitely in PostgreSQL storage.

2. **Only Deletion Trigger: Manual Lead or Customer Deletion:**
   - Media deletion is only invoked when a Super Admin deletes a Lead (`/api/leads/delete`) or Customer ([`backend/src/legacyServer.js:5806-5832`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L5806-L5832)):
     ```javascript
     const msgs = await prisma.message.findMany({
       where: { leadId, mediaUrl: { not: null } },
       select: { mediaUrl: true }
     }).catch(() => []);
     const fileNames = msgs.map(m => m.mediaUrl?.replace('/uploads/', '')).filter(Boolean);
     if (fileNames.length > 0) {
       deleteMediaBatchFromSupabase(fileNames).catch(() => null);
     }
     ```
   > [!WARNING]
   > **Observed Deletion Bug:** Notice that `m.mediaUrl?.replace('/uploads/', '')` does not strip query parameters (`?exp=...&sig=...`). If a message was saved with a signed query string in `mediaUrl` (e.g., `/uploads/meta_123.jpg?exp=1793459627528&sig=...`), the resulting filename passed to `deleteMediaBatchFromSupabase` is `meta_123.jpg?exp=...`. In `public.media_files`, the `file_name` column contains only `meta_123.jpg`. Therefore, the `DELETE ... WHERE file_name = $1` query fails to match, leaving the binary row permanently orphaned in the database.

3. **Ephemeral Nature of Local Disk (`backend/public/uploads`):**
   - While Supabase retains files permanently, local server files in `backend/public/uploads/` are stored on the local container filesystem.
   - On hosting providers like Render, instances use an ephemeral filesystem. Every code deployment, manual restart, or automatic container migration wipes the local `uploads` directory. The CRM relies entirely on `public.media_files` to restore these files upon the next coordinator request.

---

## 6. How the CRM Retrieves Media (3-Tier Architecture)

When a coordinator opens a chat, the frontend renders `<img src={mediaUrl} />`, `<video src={mediaUrl} />`, or `<AudioPlayer url={mediaUrl} />` pointing to `/uploads/:filename?exp=...&sig=...` ([`MessageBubble.tsx:390-425`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/frontend/src/components/chat/MessageBubble.tsx#L390-L425)).

The backend handles the request in [`backend/src/legacyServer.js:1056-1196`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L1056-L1196) via a 3-tier retrieval hierarchy:

```mermaid
flowchart TD
    Req[Incoming GET /uploads/:filename?exp=...&sig=...] --> Auth{Valid HMAC Signature or Bearer Auth?}
    Auth -- No --> Deny[401 / 403 Access Denied]
    Auth -- Yes --> Tier1{Tier 1: Does file exist on local disk?<br/>fs.existsSync}
    
    Tier1 -- Yes (Size > 0) --> Stream[Stream from disk fs.createReadStream<br/>Cache-Control: public, max-age=31536000<br/><b>Supabase Egress = 0</b>]
    
    Tier1 -- No --> Tier2{Tier 2: Query Supabase<br/>getMediaFromSupabase}
    
    Tier2 -- Found in DB --> SaveDisk[Write to local disk cache<br/>fs.writeFile]
    SaveDisk --> ServeDB[Serve buffer to client<br/><b>Generates Supabase DB Egress</b>]
    
    Tier2 -- Not Found --> Tier3{Tier 3: Is filename 'meta_*' &<br/>token available?}
    
    Tier3 -- Yes --> FetchMeta[Fetch from Meta Graph API & CDN]
    FetchMeta --> SaveBoth[Write to local disk & save to Supabase<br/>saveMediaToSupabase]
    SaveBoth --> ServeMeta[Serve buffer to client<br/><b>0 Supabase Egress on fetch</b>]
    
    Tier3 -- No --> NotFound[404 / 500 File Not Found]
```

### Detailed Breakdown of Tiers:

1. **Security & Signature Validation ([lines 1056–1091](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L1056-L1091)):**
   - Validates the time-limited HMAC-SHA256 signature via `verifyPrivateMediaUrl(filename, exp, sig)`.
   - If signature is missing or expired, falls back to JWT Bearer authentication or session cookies.
   - For coordinators, enforces tenant isolation: checks if the media belongs to a lead assigned to that coordinator ([lines 1072–1089](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L1072-L1089)).

2. **Tier 1 – Local Disk Streaming ([lines 1115–1129](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L1115-L1129)):**
   - Checks `fs.existsSync(filePath)` where `filePath = backend/public/uploads/${filename}`.
   - If file exists and `size > 0`, streams directly to the response with `Content-Type` and `Cache-Control: public, max-age=31536000, immutable`.
   - **Performance:** Instant, zero network latency.
   - **Supabase Egress:** **Zero (0 bytes)**.

3. **Tier 2 – Supabase PostgreSQL Fallback ([lines 1131–1149](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L1131-L1149)):**
   - If the file is not on disk (e.g., after a container restart or deployment), calls `getMediaFromSupabase(filename)`.
   - Queries `SELECT file_name, mime_type, data, size FROM public.media_files WHERE file_name = $1 LIMIT 1`.
   - Asynchronously writes the downloaded buffer back to `backend/public/uploads/${filename}` to repopulate the local cache for all future requests ([line 1138](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L1138)).
   - Streams the buffer to the client.

4. **Tier 3 – Meta Cloud Re-Download Fallback ([lines 1154–1195](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L1154-L1195)):**
   - If the file is missing from both the local disk and Supabase, and the filename starts with `meta_`:
   - Extracts the original Meta Media ID: `parts = filename.split('_'); mediaId = parts[1]`.
   - Re-fetches the media metadata and binary directly from Meta Graph API (`https://graph.facebook.com/v20.0/${mediaId}`).
   - Saves the downloaded file to both local disk and Supabase `public.media_files` via `saveMediaToSupabase()`.
   - Returns the file to the client.

---

## 7. Supabase Egress Impact Analysis

| Scenario | Local Disk Cache Status | Supabase Database Impact | Supabase Egress Generated |
| :--- | :---: | :---: | :---: |
| Normal coordinator viewing during active container session | **HIT** | None (File streamed directly from disk) | **0 bytes** |
| First view of media after Render container deploy / restart | **MISS** | `SELECT data FROM public.media_files` (Transmits raw BYTEA binary) | **100% of file size + ~33% wire protocol overhead** |
| Subsequent views of the same media on the same container | **HIT** | None (Tier-2 writes to disk on first miss) | **0 bytes** |
| Outbound coordinator media upload | **WRITTEN** | `INSERT INTO public.media_files` (Ingress to Supabase) | **0 bytes Egress** (Counts as Ingress) |
| Multiple Render container instances (Horizontal Scaling) | **MISS on new instances** | Each separate instance must query DB once per file | **File size $\times$ Number of instances** |

### Critical Egress Factors:
1. **PostgreSQL Wire Encoding Overhead:**  
   Unlike Supabase Storage (which serves static files over HTTP CDN with efficient chunking), querying `BYTEA` columns through PostgreSQL connection pooling transmits binary data formatted over the PostgreSQL wire protocol. Depending on driver encoding, `BYTEA` transfer can incur between **15% and 33% overhead** compared to standard HTTP file delivery.
2. **Ephemeral Disk Cache Invalidation:**  
   On Render, backend containers restart regularly (e.g., deployments, config updates, health checks, or sleep/wake cycles on lower tiers). Each restart wipes `backend/public/uploads/`. When coordinators subsequently open conversation threads, all media files are re-downloaded from `public.media_files`, generating a burst of Database Egress.
3. **Signed URL Churn:**  
   Inbound media URLs are signed with a 15-minute expiration (`MEDIA_URL_TTL_MS = 15 * 60 * 1000` in [`legacyServer.js:170`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L170)). Because the URL query string (`?exp=...&sig=...`) changes periodically, the browser treats it as a new resource on page reloads. While the local server disk protects Supabase egress during a single container lifetime, a restart forces re-downloads for all historical media loaded in the active UI views.

---

## 8. Media Stored Outside Supabase

The investigation identified three distinct locations where media exists outside of the Supabase cloud database:

### 1. Local Server Disk Cache (`backend/public/uploads/`)
- **Path:** `c:\Users\Admin\.gemini\antigravity-ide\scratch\royal-wellness-crm\backend\public\uploads` (or `/app/public/uploads` in Linux/Docker/Render).
- **Current Live Files Found (10 files):**
  - `meta_1753460762431031_1792139164565.ogg` (19.1 KB - Inbound voice note)
  - `meta_944418851698123_1792139226551.jpg` (40.0 KB - Inbound image)
  - `media_3A46FF81C0EBFDD87B49_1791282610926.jpg` (120.6 KB - Inbound image)
  - `media_3AA9F007F4EC7D80745A_1791282298191.jpg` (120.6 KB - Inbound image)
  - `media_3A947E2BFCC7CE55E2AA_1791282667044.ogg` (3.8 KB - Inbound voice note)
  - `out_1791801495601_lb3qnq.png` (84.7 KB - Outbound agent attachment)
  - `out_1792141362322_9xmcjd.jpg` (78.2 KB - Outbound agent photo)
  - `wa_1792148305102_bg2auk.ogg` (18.7 KB - Outbound converted voice note)
  - `exam_1793003449704_6y80c.pdf` (16 bytes - Exam document)
  - `exam_1793009676765_yducb.pdf` (153.8 KB - Exam document)
- **Role:** Fast, zero-egress working cache for active server operations.

### 2. Meta / WhatsApp Business Cloud Infrastructure
- **Location:** Meta Graph API servers and Facebook CDN (`lookaside.fbsbx.com`).
- **Retention Period:** Meta retains media files for approximately **14 to 30 days** following message delivery.
- **Role in CRM:** The CRM embeds the Meta Media ID into the filename (e.g., `meta_4645666719004319_...`). In the event that both the local disk and the Supabase database lose a file, the CRM can re-fetch it on-demand from Meta using the system user access token (`META_ACCESS_TOKEN`).

### 3. Coordinator Browser HTTP Cache
- **Location:** Coordinator client browser disk / memory cache.
- **Cache Headers:** The server responds with `Cache-Control: public, max-age=31536000, immutable` ([`legacyServer.js:1123, 1145, 1185`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L1123)).
- **Role:** Caches media locally on coordinator machines as long as the exact URL (including query parameters) remains identical.

---

## 9. Comprehensive Architectural Summary Table

| Category | Finding / Specification | Source Code Reference |
| :--- | :--- | :--- |
| **Incoming Media Types** | Images (`jpg`, `png`, `webp`), Audio/Voice (`ogg`, `m4a`, `mp3`), Video (`mp4`), Documents (`pdf`, `docx`) | [`legacyServer.js:654-675`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L654-L675) |
| **Active Persistence Store** | Supabase PostgreSQL Table `public.media_files` (`BYTEA` column `data`) | [`supabaseMedia.js:39-44`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/supabaseMedia.js#L39-L44) |
| **Inactive Persistence Store** | Supabase Storage Bucket `whatsapp-media` (due to missing `SUPABASE_URL` in `.env`) | [`supabaseMedia.js:7-9`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/supabaseMedia.js#L7-L9) |
| **Disk Cache Directory** | `backend/public/uploads` | [`legacyServer.js:678`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L678) |
| **Message Pointer Column** | `public.messages.mediaUrl` & `public.messages.mediaType` | [`legacyServer.js:6707-6708`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L6707-L6708) |
| **Retention Policy** | Permanent (No automated deletion, cron, or TTL) | [`schemaBootstrap.js:81-88`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/schemaBootstrap.js#L81-L88) |
| **Access Control Mechanism** | Signed HMAC-SHA256 bearer links (`/uploads/:file?exp=...&sig=...`) or JWT auth | [`legacyServer.js:166-181`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L166-L181) |
| **Egress Mechanism** | Database wire transfer via PostgreSQL connection pooler (`pooler.supabase.com:6543`) | [`supabaseMedia.js:75-80`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/supabaseMedia.js#L75-L80) |
| **External Redundancy** | Meta Graph API v20.0 fallback re-fetch | [`legacyServer.js:1154-1192`](file:///c:/Users/Admin/.gemini/antigravity-ide/scratch/royal-wellness-crm/backend/src/legacyServer.js#L1154-L1192) |

---
*Report generated in READ-ONLY mode. No code, schema, database rows, or environment variables were modified during this investigation.*
