## 2026-10-29T17:03:26Z
You are teamwork_test_writer acting as the E2E Test Suite Architect.
Your working directory is: d:\Royal Project\whatsapp_crm\.agents\teamwork\test_writer_1\

Read:
1. ORIGINAL_REQUEST.md at d:\Royal Project\whatsapp_crm\.agents\teamwork\ORIGINAL_REQUEST.md
2. PROJECT.md at d:\Royal Project\whatsapp_crm\PROJECT.md
3. Full Section 32 UAT specifications at d:\Royal Project\whatsapp_crm\.agents\teamwork\spec_miner_1\handoff.md

Your Mission:
Architect and implement the opaque-box automated test suites covering all 20 Section 32 User Acceptance Testing scenarios using the existing project test setup (`node:test`).

Instructions:
1. Create d:\Royal Project\whatsapp_crm\TEST_INFRA.md following the Project Pattern template:
   - Test philosophy: Opaque-box, requirement-driven, derived from ORIGINAL_REQUEST.md and Section 32 UAT specifications.
   - 4-Tier Test Architecture:
     - Tier 1: Feature Coverage (>=5 per feature)
     - Tier 2: Boundary & Corner Cases (>=5 per feature)
     - Tier 3: Cross-Feature Combinations (pairwise interactions)
     - Tier 4: Real-World Application Scenarios (end-to-end multi-phase scenarios)
   - Ensure explicit test files are implemented programmatically covering each of the 20 UAT scenarios (UAT 1 to UAT 20).
2. Implement automated test suites in `backend/tests/e2e/`:
   - Use Node.js built-in test runner (`node:test`, `assert/strict`).
   - Create an end-to-end test runner script (e.g. `backend/tests/e2e/run-all-uat.js` or `backend/scripts/run-e2e-tests.js`).
   - Cover backend API endpoints, state machine transitions, role security, student portal authentication, 2-device limits, maker-checker authorization, MCQ practice validation, timed mock engine scoring, and immutable audit triggers.
3. Verify test execution.
4. When the test framework and test suites are ready, create `d:\Royal Project\whatsapp_crm\TEST_READY.md` at project root with:
   - Test runner command (e.g. `node backend/tests/e2e/run-all-uat.js`)
   - Coverage summary table across Tiers 1-4 and the 20 UAT scenarios.
5. Write handoff report in `d:\Royal Project\whatsapp_crm\.agents\teamwork\test_writer_1\handoff.md`.
Send a completion message back to the orchestrator when finished.
