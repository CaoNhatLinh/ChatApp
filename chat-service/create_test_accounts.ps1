# ==================================================================================
# Script tao 2 tai khoan mau de test ChatApp
# Chay sau khi backend (port 8084) da khoi dong
# ==================================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ChatApp - Tao tai khoan mau" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:8084/api/auth"

# Account 1: alice / 123456
Write-Host "`n[1/2] Tao tai khoan: alice..." -ForegroundColor Yellow
try {
    $body1 = @{
        username = "alice"
        password = "123456"
        display_name = "Alice Nguyen"
    } | ConvertTo-Json

    $response1 = Invoke-RestMethod -Uri "$baseUrl/register" -Method POST -Body $body1 -ContentType "application/json" -ErrorAction Stop
    Write-Host "  -> Thanh cong! User ID: $($response1.userId)" -ForegroundColor Green
} catch {
    $errorMsg = $_.Exception.Message
    if ($errorMsg -like "*already exists*" -or $errorMsg -like "*409*" -or $errorMsg -like "*400*") {
        Write-Host "  -> Tai khoan da ton tai (OK)" -ForegroundColor DarkYellow
    } else {
        Write-Host "  -> Loi: $errorMsg" -ForegroundColor Red
    }
}

# Account 2: bob / 123456
Write-Host "`n[2/2] Tao tai khoan: bob..." -ForegroundColor Yellow
try {
    $body2 = @{
        username = "bob"
        password = "123456"
        display_name = "Bob Tran"
    } | ConvertTo-Json

    $response2 = Invoke-RestMethod -Uri "$baseUrl/register" -Method POST -Body $body2 -ContentType "application/json" -ErrorAction Stop
    Write-Host "  -> Thanh cong! User ID: $($response2.userId)" -ForegroundColor Green
} catch {
    $errorMsg = $_.Exception.Message
    if ($errorMsg -like "*already exists*" -or $errorMsg -like "*409*" -or $errorMsg -like "*400*") {
        Write-Host "  -> Tai khoan da ton tai (OK)" -ForegroundColor DarkYellow
    } else {
        Write-Host "  -> Loi: $errorMsg" -ForegroundColor Red
    }
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Thong tin dang nhap:" -ForegroundColor Cyan
Write-Host "  ---------------------------" -ForegroundColor Cyan
Write-Host "  Account 1: alice / 123456" -ForegroundColor White
Write-Host "  Account 2: bob   / 123456" -ForegroundColor White
Write-Host "========================================`n" -ForegroundColor Cyan
