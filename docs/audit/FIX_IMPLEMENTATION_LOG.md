# Fix Implementation Log

| Issue | Root cause | Implementation | Verification |
|---|---|---|---|
| AUD-001 | Frontend loaded only first 200 lead page | Added `hasMore` page loading in `CrmContext.tsx` | Frontend build passed; backend pagination suite passed |
| AUD-002 | Table default page size hid loaded leads | Added `All`/500 rows option and made it default | Frontend build passed |
| AUD-003 | Duplicate table Action column | Removed appointment-status column and corrected empty-state colspan | Frontend build passed; diff check passed |
| AUD-004 | Contact drawer opened external WhatsApp | Wired button to CRM lead-selection/chat flow | Frontend build passed |
| AUD-005 | New assignment set stage without acceptance timestamp | Assignment now sets `acceptedAt` for new assignments and clears it on unassignment | Backend syntax, full 19-suite run, and frontend build passed |
| AUD-006 | Live catalog/serial gaps | Added SQL backfill migrations; corrected category table mapping after Supabase error | Serial/category live result supplied; treatment remained 15 missing at last check |
