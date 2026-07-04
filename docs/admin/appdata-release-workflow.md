# AppData Release Workflow

The workflow separates editing, compatibility testing, approval, and target assignment.

1. Load the active target through `bootstrap`.
2. Edit the complete AppData snapshot in the development panel.
3. Review validation warnings and the diff preview.
4. Save a new immutable draft through `saveVersion` with employee login, PIN, and a change reason.
5. Test an exact build/AppData pair and write `compatible` or `incompatible` through `setCompatibility`.
6. Approve a version through `approveVersion` with an approver permission and a release reason.
7. Assign a target through `assignTarget`. Production assignments require an approved version and an exact `compatible` build/AppData row.
8. Roll back by assigning an older approved compatible pair through `rollbackTarget`. Rollback creates release history; it does not delete newer versions.

Build version and AppData version are independent. A customer or target can remain on an older build while receiving only AppData versions explicitly marked compatible with that build.

Employee credentials are never persisted by the Angular UI. The login and PIN fields are cleared after each sensitive action.
