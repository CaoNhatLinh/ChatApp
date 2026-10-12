$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-schema.ps1')
$schemaPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'chat_app_complete.cql'
$expected = @(Get-LocalSchemaColumns $schemaPath)
if (@($expected.Table | Select-Object -Unique).Count -ne 78) { throw 'Expected all 78 canonical tables.' }
if ($expected.Count -ne 676) { throw 'Expected every canonical column.' }
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
if (@($types.Table | Select-Object -Unique).Count -ne 2 -or $types.Count -ne 20) { throw 'Expected both canonical UDTs and their fields.' }
$rows = @(ConvertFrom-CqlJsonRows @(' [json]', '---', ' {"table_name":"users_by_id","column_name":"user_id","type":"uuid","kind":"partition_key"}', '(1 rows)'))
if ($rows.Count -ne 1 -or $rows[0].column_name -ne 'user_id') { throw 'cqlsh JSON parsing failed.' }
Write-Host 'Schema guards passed: 78 tables, 676 columns, 2 UDTs; missing/type/static mismatch and cqlsh parsing checked.'
