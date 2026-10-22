$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot -Parent)
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$runtimeNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if ($nodeCommand) { $previewNode = $nodeCommand.Source }
elseif (Test-Path -LiteralPath $runtimeNode) { $previewNode = $runtimeNode }
else { Write-Host '请先安装 Node.js 22 或更新版本，再运行本脚本。'; Read-Host '按回车退出'; exit 1 }
& $previewNode scripts/dev.mjs
if ($LASTEXITCODE -ne 0) { Read-Host '启动失败，按回车退出' }
