# Read-only schema compatibility checks; no automatic migrations or data deletion.
function Get-LocalSchemaColumns {
    param([string]$SchemaPath, [ValidateSet('TABLE', 'TYPE')][string]$Kind = 'TABLE')
    $source = Get-Content -LiteralPath $SchemaPath -Raw
    $source = [regex]::Replace($source, '(?s)/\*.*?\*/', '')
    $tables = [regex]::Matches($source, "(?ms)^CREATE $Kind IF NOT EXISTS (\w+) \(\r?\n(.*?)^\)")
    foreach ($table in $tables) {
        foreach ($column in [regex]::Matches($table.Groups[2].Value, '(?m)^  ([a-z][a-z0-9_]*)\s+([^\r\n]+)')) {
            $declaration = $column.Groups[2].Value.Trim().TrimEnd(',')
            [pscustomobject]@{
                Table = $table.Groups[1].Value
                Column = $column.Groups[1].Value
                Type = ([regex]::Replace($declaration, '\s+(PRIMARY KEY|static).*$', '') -replace '\s', '')
                Static = $declaration -match '\sstatic\b'
            }
        }
    }
}

function Get-LocalSchemaDifferences {
    param([object[]]$Expected, [object[]]$Actual)
    $columns = @{}
    foreach ($column in $Actual) { $columns["$($column.table_name).$($column.column_name)"] = $column }
    foreach ($column in $Expected) {
        $key = "$($column.Table).$($column.Column)"
        if (-not $columns.ContainsKey($key)) { "Missing $key"; continue }
        $current = $columns[$key]
        $currentType = $current.type -replace 'chat_app\.', '' -replace '\s', ''
        if ($currentType -ne $column.Type) { "Different type: $key" }
        if (($current.kind -eq 'static') -ne $column.Static) { "Different static column: $key" }
    }
}

function ConvertFrom-CqlJsonRows {
    param([object[]]$Output)
    foreach ($line in $Output) {
        $value = "$line".Trim()
        if ($value.StartsWith('{')) { $value | ConvertFrom-Json }
    }
}
