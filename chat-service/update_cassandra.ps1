param (
    [string]$SqlFile = "..\chat_app_master.cql"
)

Write-Host "🚀 Bắt đầu cập nhật lại toàn bộ Cassandra Database..." -ForegroundColor Cyan

if (-Not (Test-Path $SqlFile)) {
    Write-Host "❌ Không tìm thấy file SQL/CQL: $SqlFile" -ForegroundColor Red
    Write-Host "Sử dụng: .\update_cassandra.ps1 -SqlFile <file_cql>" -ForegroundColor Yellow
    exit 1
}

Write-Host "📦 1. Xóa container cũ và dữ liệu hiện tại..." -ForegroundColor Cyan
docker compose stop cassandra
docker compose rm -f cassandra

Write-Host "🔄 2. Khởi tạo lại Cassandra container..." -ForegroundColor Cyan
docker compose up -d cassandra

Write-Host "⏳ 3. Đang chờ Cassandra khởi động hoàn tất (Có thể mất 30-60 giây)..." -ForegroundColor Cyan
$ready = $false
while (-Not $ready) {
    # Check if cqlsh works
    $result = docker exec cassandra cqlsh -e "DESCRIBE KEYSPACES" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $ready = $true
    } else {
        Write-Host -NoNewline "."
        Start-Sleep -Seconds 3
    }
}
Write-Host ""
Write-Host "✅ Cassandra đã sẵn sàng!" -ForegroundColor Green

Write-Host "📥 4. Đang nạp lại dữ liệu (Mới nhất) từ file $SqlFile..." -ForegroundColor Cyan
docker cp $SqlFile cassandra:/tmp/init_db.cql
docker exec cassandra cqlsh -f /tmp/init_db.cql

Write-Host "🎉 Hoàn tất quá trình cập nhật Cassandra!" -ForegroundColor Green
