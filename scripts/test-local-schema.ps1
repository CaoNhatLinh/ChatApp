$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-schema.ps1')
$schemaPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'chat_app_complete.cql'
$expected = @(Get-LocalSchemaColumns $schemaPath)
$tableCount = @($expected.Table | Select-Object -Unique).Count
$columnCount = $expected.Count
if ($tableCount -ne 91 -or $columnCount -ne 765) {
    throw "Expected 91 canonical tables and 765 columns, found $tableCount and $columnCount."
}
$requiredRecoveryColumns = @(
    @{ Table = 'media_upload_recovery_by_shard'; Column = 'upload_id'; Type = 'uuid' }
    @{ Table = 'media_deletion_recovery_by_shard'; Column = 'asset_id'; Type = 'uuid' }
    @{ Table = 'media_orphan_candidates_by_shard'; Column = 'owner_id'; Type = 'uuid' }
    @{ Table = 'media_assets_by_id'; Column = 'upload_purpose'; Type = 'text' }
    @{ Table = 'media_assets_by_id'; Column = 'retention_locked'; Type = 'boolean' }
    @{ Table = 'email_review_candidates_by_day'; Column = 'notification_id'; Type = 'timeuuid' }
    @{ Table = 'report_decision_work_by_shard'; Column = 'previous_status'; Type = 'text' }
    @{ Table = 'report_create_commands'; Column = 'created_at'; Type = 'timeuuid' }
    @{ Table = 'report_create_preparation_by_shard'; Column = 'report_id'; Type = 'uuid' }
    @{ Table = 'report_create_preparation_by_shard'; Column = 'message_id'; Type = 'timeuuid' }
)
foreach ($required in $requiredRecoveryColumns) {
    if (@($expected | Where-Object { $_.Table -eq $required.Table -and $_.Column -eq $required.Column -and $_.Type -eq $required.Type }).Count -ne 1) {
        throw "Missing recovery column $($required.Table).$($required.Column) of type $($required.Type)."
    }
}
if (@($expected | Where-Object { $_.Table -eq 'media_assets_by_id' -and $_.Column -eq 'upload_receipt' -and $_.Type -eq 'text' }).Count -ne 1) {
    throw 'Media upload completion requires its immutable receipt on the asset authority.'
}
foreach ($column in @('entry_type', 'command_id', 'revision', 'command_json', 'audit_exported')) {
    if (@($expected | Where-Object { $_.Table -eq 'system_settings_by_key' -and $_.Column -eq $column }).Count -ne 1) {
        throw "System setting state and durable audit intent require $column."
    }
}
if (@($expected | Where-Object { $_.Table -eq 'pinned_message_slots_by_conversation' -and $_.Column -eq 'pin_revision' -and $_.Type -eq 'bigint' -and $_.Static }).Count -ne 1) {
    throw 'Message pins require one static bigint revision per conversation partition.'
}
$actual = @($expected | ForEach-Object {
    [pscustomobject]@{ table_name = $_.Table; column_name = $_.Column; type = $_.Type; kind = $(if ($_.Static) { 'static' } else { 'regular' }) }
})
if (@(Get-LocalSchemaDifferences $expected $actual).Count) { throw 'Current schema should pass.' }
if (@(Get-LocalSchemaDifferences $expected $actual[1..($actual.Count - 1)]).Count -ne 1) { throw 'Missing column was not detected.' }
$actual[0].type = 'int'
if (@(Get-LocalSchemaDifferences $expected $actual).Count -ne 1) { throw 'Wrong type was not detected.' }
$actual[0].type = $expected[0].Type
$staticIndex = 0
while (-not $expected[$staticIndex].Static) { $staticIndex++ }
$actual[$staticIndex].kind = 'regular'
if (@(Get-LocalSchemaDifferences $expected $actual).Count -ne 1) { throw 'Static column mismatch was not detected.' }
$types = @(Get-LocalSchemaColumns $schemaPath -Kind TYPE)
if (@($types.Table | Select-Object -Unique).Count -ne 2 -or $types.Count -ne 21) { throw 'Expected both canonical UDTs and their fields.' }
if (@($types | Where-Object { $_.Table -eq 'message_summary' -and $_.Column -eq 'message_bucket' -and $_.Type -eq 'text' }).Count -ne 1) {
    throw 'Message preview must carry its exact canonical bucket.'
}
$rows = @(ConvertFrom-CqlJsonRows @(' [json]', '---', ' {"table_name":"users_by_id","column_name":"user_id","type":"uuid","kind":"partition_key"}', '(1 rows)'))
if ($rows.Count -ne 1 -or $rows[0].column_name -ne 'user_id') { throw 'cqlsh JSON parsing failed.' }
Write-Host "Schema guards passed: $tableCount tables, $columnCount columns, 2 UDTs; recovery columns, missing/type/static mismatch and cqlsh parsing checked."
