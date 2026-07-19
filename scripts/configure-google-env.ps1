$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$envPath = Join-Path $projectRoot '.env.local'
if (-not (Test-Path -LiteralPath $envPath)) {
    throw '.env.local bulunamadı. Önce Spotify yerel kurulumunu çalıştır.'
}

Write-Host ''
Write-Host 'Playlist Pilot - Google / YouTube Music yerel kurulumu' -ForegroundColor Red
Write-Host 'Mevcut Spotify ayarları korunacak.' -ForegroundColor DarkGray
Write-Host ''

$clientId = (Read-Host 'Google OAuth Client ID').Trim()
if ([string]::IsNullOrWhiteSpace($clientId)) { throw 'Client ID boş bırakılamaz.' }

$secureSecret = Read-Host 'Google OAuth Client Secret (yazarken görünmez)' -AsSecureString
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)

try {
    $clientSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    if ([string]::IsNullOrWhiteSpace($clientSecret)) { throw 'Client Secret boş bırakılamaz.' }

    $lines = [Collections.Generic.List[string]]::new()
    [IO.File]::ReadAllLines($envPath) | ForEach-Object { [void]$lines.Add($_) }

    $updates = [ordered]@{
        'GOOGLE_CLIENT_ID' = $clientId
        'GOOGLE_CLIENT_SECRET' = $clientSecret
        'GOOGLE_REDIRECT_URI' = 'http://127.0.0.1:3000/api/auth/google/callback'
    }

    foreach ($key in $updates.Keys) {
        $replacement = "$key=$($updates[$key])"
        $found = $false
        for ($index = 0; $index -lt $lines.Count; $index++) {
            if ($lines[$index] -match "^$([Regex]::Escape($key))=") {
                $lines[$index] = $replacement
                $found = $true
                break
            }
        }
        if (-not $found) { [void]$lines.Add($replacement) }
    }

    [IO.File]::WriteAllLines($envPath, $lines, [Text.UTF8Encoding]::new($false))
}
finally {
    if ($secretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
    $clientSecret = $null
}

Write-Host ''
Write-Host 'Google / YouTube Music kurulumu tamamlandı.' -ForegroundColor Green
Write-Host 'Secret değeri yalnızca .env.local içinde tutuluyor.' -ForegroundColor Yellow
