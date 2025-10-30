#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'

$baseUrl = $env:BASE_URL
if (-not $baseUrl) {
    $baseUrl = 'http://127.0.0.1:5590'
}

function Invoke-SmokeCheck {
    param (
        [string]$Path,
        [string]$ExpectedContentType
    )

    $url = "$baseUrl$Path"
    Write-Host "→ GET $url"
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing

    if ($response.StatusCode -ne 200) {
        throw "${Path} returned status $($response.StatusCode)"
    }

    $contentType = $response.Headers['Content-Type']
    if (-not $contentType.StartsWith($ExpectedContentType)) {
        throw "${Path} returned Content-Type $contentType (expected $ExpectedContentType)"
    }

    Write-Host "✅ $Path (Content-Type: $contentType)"
}

Invoke-SmokeCheck -Path '/' -ExpectedContentType 'text/html'
Invoke-SmokeCheck -Path '/app.js' -ExpectedContentType 'text/javascript'

$health = Invoke-WebRequest -Uri "$baseUrl/api/health" -UseBasicParsing -Headers @{ 'Accept' = 'application/json' }
if ($health.Content -notmatch '"ok"\s*:\s*true') {
    throw "/api/health response invalid: $($health.Content)"
}

Write-Host '✅ /api/health responded with ok=true'
Write-Host 'All smoke checks passed.'
