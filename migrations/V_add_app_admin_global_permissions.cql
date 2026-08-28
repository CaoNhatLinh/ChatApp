-- APP_ADMIN is the global operator role; room-local roles remain separate.
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at)
VALUES ('APP_ADMIN', 'SESSION_REVOKE', toTimestamp(now()));

INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at)
VALUES ('APP_ADMIN', 'ANALYTICS_READ', toTimestamp(now()));

INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at)
VALUES ('APP_ADMIN', 'ROOM_READ', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at)
VALUES ('APP_ADMIN', 'ROOM_MODERATE', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at)
VALUES ('APP_ADMIN', 'REPORT_MANAGE', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at)
VALUES ('APP_ADMIN', 'AUDIT_READ', toTimestamp(now()));
