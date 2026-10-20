# Security Verification Status

| Control | Status |
|---|---|
| JWT verification and server-side role lookup | Implemented and locally tested |
| Legacy identity headers in frontend requests/tests | Removed from frontend and lead-assignment fixtures; remaining repository references are intentional negative tests/comments |
| Shared login rate limiting | Implemented; live multi-instance behavior unverified |
| Meta webhook HMAC verification | Implemented in maintained server; standalone launcher delegates to it |
| Trusted CORS and proxy handling | Implemented in maintained server |
| Private media authorization/migration | Implemented with migration tooling; live migration unverified |
| Client-provided Meta token rejection | Implemented in maintained server and inherited by standalone launcher |
| Correlation IDs and structured audit events | Implemented for core security/access paths; full mutation coverage incomplete |
| SQL injection protections | Dynamic stage keys validated; live injection regression coverage incomplete |

Deployment must set real secrets, use a private media bucket, run the migration with verification, and disable the standalone webhook process unless it is rewritten to share the maintained security boundary.
