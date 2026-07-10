# Security Specification for NodeGen Studio

## Data Invariants
- A `compositing_job` must always have a valid status.
- Once a job is `completed`, only the `finalResult` and `status` can be updated (to prevent overwriting source images).
- `vehicleImage` and `roughComposite` are required for the studio to process.

## The Dirty Dozen Payloads
1. Missing `status` field.
2. `vehicleImage` exceeding a reasonable size (e.g., 10MB in rules check if possible).
3. Attempting to set `status` to an invalid enum value.
4. Setting `createdAt` to a future time.
5. Updating `vehicleImage` on a `completed` job.
6. Deleting a job that is currently `processing`.
... (and others)

## Test Runner
(I won't write the full test file here unless I need to run it, but I'll describe the rules).
