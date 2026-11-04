# F2 transport foundation — verification, 2026-10-20

## Result and boundaries

While integrating F2, inspection found that the frontend had no canonical point
read for the complete attachment snapshot of one source message. The ordinary
message response contains only hasAttachments, and the ordinary send adapter
does not preserve every attachment dimension. Using either as a forward snapshot
would silently omit data or fail the F1 exact-source checks. A room-library scan
is not an acceptable substitute.

Added the missing source-authorized preparation read and a typed forward client.
No DOM/layout/composer/dialog was changed; **F2 user-facing send/source UI is not
complete**. There are no new screenshots or visual-review claims in this slice.
The existing Signal Relay UI guidance was consulted but no surface was shipped.

## Implementation

- Backend `MessageForwardPolicy.prepare` reads the exact authorized source and a
  bounded attachment list. Existing resolve and preparation reuse the same
  private source lookup/attachment-boundary helpers. Preparation never allocates
  a command or persists a draft. Unsupported POLL/SYSTEM, missing/deleted/blocked
  sources and incomplete/over-limit attachments remain explicit errors.
- `GET /conversations/{room}/messages/{id}/forward-draft?bucket=...` returns the
  public source message plus at most50 canonical attachment records, with all
  metadata preserved. It is not an authorization token: send revalidates source
  membership and snapshot using F1. Forward chains stay private.
- `forward.api.ts` validates exact source identity, allowed types, attachment
  bounds/uniqueness/completeness, private-key exclusion, GIF identity and public
  available/unavailable source responses. Nullable canonical filename/MIME/size
  remain null; the adapter does not invent metadata or discard dimensions.
- A forward command owns one immutable snapshot: copied primitive fields,
  frozen GIF identity, attachment rows/list and payload. An uncertain retry sends
  that same payload object and clientMessageId, not a source refreshed underneath
  the attempt. The caller supplies the attempt ID; UI persistence/recovery is
  still an F2 consumer responsibility, not implemented by this adapter.
- Send acknowledgment must match actor, target and command identity plus the
  expected live snapshot. An already committed destination tombstone can also
  acknowledge the same command, without manufacturing another send. There is no
  optimistic success, provider call or toast in the transport layer.

## Files changed in this increment

| File | Reason |
| --- | --- |
| `chat-service/.../canonical/message/MessageForwardPolicy.java` | Shared authorized source/snapshot preparation and bounded attachment helper |
| `chat-service/.../canonical/controller/MessageForwardSourceController.java` | Bind preparation point read alongside source resolution |
| `chat-service/.../message/MessageForwardPolicyTest.java` | Preparation/no-allocation, missing/deleted source and attachment preservation |
| `chat-service/.../message/MessageForwardControllerTest.java` | Current actor/full source key, complete dimensions and private-chain serialization |
| `chatapp_frontend/src/features/messenger/api/forward.api.ts` | Typed reads, immutable command and verified send acknowledgment |
| `chatapp_frontend/scripts/forward-api-smoke.mjs`, `package.json` | Executable transport/command regression suite |
| `docs/api/openapi.yaml`, `docs/contracts/canonical-api.yaml` | Precise endpoint, attachment/nullability and error contract |
| This report, `tasks/todo.md`, `docs/TESTING.md` | Evidence and still-open consumer/runtime gates |

Backend abbreviated paths are under
`src/{main,test}/java/com/chatapp/chat_service/`. No schema, dependency, credential,
provider setting, database data, commit or push was changed. Existing dirty
worktree changes are preserved, not attributed to this increment.

## Verification

- RED: preparation policy tests failed compilation before the method existed;
  frontend test failed ENOENT before the adapter existed.
- RED: adapter rejected a legitimate committed tombstone; malformed GIF identity
  with a missing ID was accepted. Both have passing regressions after correction.
- GREEN: Java20 `./mvnw.cmd -q test`:429 tests/87 suites,0 failures/errors/skips,
  excluding opt-in IT reports. After the controller fixture gained a consistent
  hasAttachments flag, its focused test passed again; no backend production code
  changed after the full suite.
- GREEN: `npm run test:forwards:api`:20 controlled groups, exact path/bucket/abort,
  snapshot immutability, same-object retry, wrong acknowledgment rejection,
  tombstone acknowledgment, unavailable privacy, invalid source/attachment/GIF
  rejection and nullable metadata/dimension preservation.
- GREEN: `npm run validate`: TypeScript/ESLint exit0, no warnings; `npm run build`:
  exit0, all17 routes. Earlier strict-equality lint errors were corrected before
  this final validation/build.
- GREEN regressions: thread API13, GIF message flow15, send-attempt19 groups.
- OpenAPI and canonical-manifest YAML parse with existing js-yaml;
  `git diff --check` has no whitespace errors.

All transport tests use controlled IO; MVC is standalone binding/serialization,
not live JWT/Cassandra/provider execution. No browser UI is claimed tested here.

## Next required consumer work

Connect the actual forward menu, paginated/searchable target chooser, frozen
attempt retry/discard behavior and source panel. Keep main draft and focus intact,
guard actor/room/session changes and do not acknowledge the covered timeline.
Verify source revocation/stale responses, VI/EN, keyboard and four-width themes
in production Chromium. Live Cassandra/two-client/crash remains open; Docker
installation was deferred by the user.
