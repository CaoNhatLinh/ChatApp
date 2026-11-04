# Admin room identity images

Approved continuation: complete the admin image gap identified in the visual
workbench review, preserving existing operator permissions and workflows.

- Add nullable `avatarUrl` to the existing admin room summary/detail responses.
  It is read from `conversations_by_id.avatar_url`, never invented from room
  name/description or copied from a synthetic frontend fixture.
- Monthly list stays bounded at200 server-side (current UI requests100). Read
  only the IDs already found by that directory, in groups of at most32. Preserve
  directory order, do not scan, add a new table/column, or issue one query/room.
- Missing canonical image/row returns null; database failures remain failures,
  not a successful list of fabricated absence. Detail and mutation responses
  preserve the image field. Existing ROOM_READ / ROOM_MODERATE gates remain.
- Authorized GET list/detail responses are no-store. This does not revoke or
  alter the caching of an already public image URL.
- Shared room portrait renders the returned image with no referrer, preserving
  its space while loading. Missing/failed images use a local recognizable
  fallback. Changing the URL retries it, rather than retaining a failed state.
- Overview/list/detail all use that same identity; image enlargement is an
  explicit keyboard/touch action, not a hover-only capability. It must not
  select, archive or edit a different room or drop a draft.
- Verify repository bounds/bindings/error propagation, serialization/cache and
  permission boundary, UI available/missing/corrupt/replaced-image states in
  both themes and320/768/1024/1440px. Fixtures are not real Cassandra/provider
  proof. The broader app roadmap and live gates stay open.

Sources: existing canonical schema and conversation avatar write path;
https://cassandra.apache.org/doc/4.1/cassandra/cql/dml.html#select
(partition-key IN is equality, not a table scan). The32-ID cap is an explicit
application bound, not a claim that production performance has been measured.
