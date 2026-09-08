# Channel SDK startup failure — 2026-09-08 / 2026.9.4-18

## Confirmed cause

Installed package 2026.9.4-17 on OpenClaw 2026.9.2 logs
`ReferenceError: os is not defined` during Channel SDK startup.
The bundled CommonJS SDK calls `os.platform()` / `os.release()` from
`getClientInfo()` during module evaluation, without importing `os`.
A clean module load reproduces this before authentication or inbound dispatch.

`startYachLongConnection` previously swallowed SDK loading/construction errors
and returned a no-op cleanup. The gateway then waited indefinitely for abort,
leaving status at running/starting despite having no transport.

## Fix

- Explicit module-local `require("node:os")` in the bundled SDK.
- Propagate fatal credential/loading/construction failures to the gateway.
- Add clean-process SDK construction and fatal error propagation tests.
  Delete Node eval's optional global `os` in the test to avoid masking the bug.

## Verification

- `npm test`: 25 passing, 0 failing.
- `node --test test/*.test.mjs`: 25 passing, 0 failing.
- Both changed runtime files copied to the local installed extension, originals backed up.
- Safe gateway restart requested but deferred by an active `ws:wizard.start` request.
- End-to-end message receipt/reply is NOT yet verified.
- No credentials, channel admission policies, registry release, or package version changed.

Finish/close the existing setup wizard, allow the gateway to restart, and verify
Channel SDK connected / lifecycle ready before testing a fresh bot message.
The configured default DM policy remains pairing; group replies default to mentions.
