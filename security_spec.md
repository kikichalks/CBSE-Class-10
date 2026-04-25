# Security Specification

## Data Invariants
1. A user's progress can only be read, created, or updated by the user themself (userId matches request.auth.uid).
2. The `chapterId` in the path must match the `chapterId` in the document body.
3. Only valid counts (numbers >= 0) and `masteryScore` can be written.
4. Timestamps (`updatedAt`) must strictly be server timestamps on creation and update.

## The Dirty Dozen Payloads
1. Null body
2. Wrong user modifying another's data (path mismatch)
3. Invalid document ID (e.g. string > 128 chars)
4. Incorrect data types (e.g. easyCount as a string)
5. Missing required fields (e.g. no `hardCount`)
6. Shadow fields (extra field `isAdmin` or `role`)
7. Modifying `updatedAt` with client time
8. Updating `chapterId` on an existing document (immortal field violation)
9. Large arrays or strings (strings > 1000 chars) in `chapterId`
10. Unauthenticated request
11. Blanket list request on all `users` or another user's progress
12. Attempt to write negative values for counts

## Test Runner
The test runner will verify these payloads in `firestore.rules.test.ts`.
