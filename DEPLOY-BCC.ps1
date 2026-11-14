# Run from this extracted folder. No browser OAuth needed.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (!(Test-Path './functions/api/checkin.js') -or !(Test-Path './index.html')) { throw 'Missing BCC website or Pages Functions.' }
if (-not $env:CLOUDFLARE_API_TOKEN) {
  $secure = Read-Host 'Cloudflare API token (input hidden)' -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $env:CLOUDFLARE_API_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
Write-Host 'Checking Cloudflare account...'
npx.cmd --yes wrangler@latest whoami
if ($LASTEXITCODE -ne 0) { throw 'Cloudflare API token authentication failed. Deployment cancelled.' }
Write-Host 'Deployment is about to update the EXISTING BCC Pages site.'
$confirm = Read-Host 'Type DEPLOY to continue'
if ($confirm -cne 'DEPLOY') { Write-Host 'Cancelled'; exit 0 }
npx.cmd --yes wrangler@latest pages deploy . --project-name=baptistcitychurch --branch=main
if ($LASTEXITCODE -ne 0) { throw 'Deployment failed. Check Wrangler output.' }
Write-Host 'Verify API endpoint returns JSON (not HTML):'
try { $r = Invoke-WebRequest 'https://baptistcitychurch.pages.dev/api/attendees?q=sa' -UseBasicParsing; Write-Host "Status: $($r.StatusCode) Type: $($r.Headers['Content-Type'])"; Write-Host $r.Content.Substring(0,[Math]::Min(250,$r.Content.Length)) } catch { Write-Warning $_.Exception.Message }
