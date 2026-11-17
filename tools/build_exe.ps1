param(
    [string]$Python = "python",
    [string]$Venv = ".venv-build"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (Get-Process OpenKEY -ErrorAction SilentlyContinue) {
    throw "Cerrá OpenKEY.exe antes de recompilar: Windows no permite sobrescribir un ejecutable en uso."
}

if (-not (Test-Path (Join-Path $Venv "Scripts\python.exe"))) {
    Write-Host "Creando entorno de compilación en $Venv..."
    & $Python -m venv $Venv
}

$venvPython = Join-Path $Venv "Scripts\python.exe"
$venvPyInstaller = Join-Path $Venv "Scripts\pyinstaller.exe"

Write-Host "Instalando/actualizando PyInstaller en el entorno local..."
& $venvPython -m pip install --upgrade pip
$requirements = Join-Path $root "requirements-dev.txt"
if (Test-Path $requirements) {
    & $venvPython -m pip install -r $requirements
} else {
    & $venvPython -m pip install pyinstaller
}

Write-Host "Compilando OpenKEY (onedir, sin consola)..."
& $venvPyInstaller --noconfirm --clean --noconsole --name OpenKEY --onedir `
    --icon "web\logo.ico" --add-data "web;web" --add-data "data;data" `
    --log-level WARN run.py

if (-not (Test-Path "dist\OpenKEY\OpenKEY.exe")) {
    throw "No se generó dist\OpenKEY\OpenKEY.exe"
}

# PyInstaller deja un stub parecido en build\OpenKEY. No es el ejecutable
# distribuible y falla con "Failed to load Python DLL" si se abre.
$stub = "build\OpenKEY\OpenKEY.exe"
if (Test-Path $stub) {
    Remove-Item $stub -Force
    Write-Host "Eliminado el ejecutable intermedio build\OpenKEY\OpenKEY.exe."
}

$total = (Get-ChildItem "dist\OpenKEY" -Recurse -File | Measure-Object Length -Sum).Sum
Write-Host ("Listo: {0} ({1:N1} MB en total)" -f (Resolve-Path "dist\OpenKEY\OpenKEY.exe"), ($total / 1MB))
Write-Host "Usá SIEMPRE dist\OpenKEY\OpenKEY.exe; build\OpenKEY no es la app final."
Write-Host "No muevas OpenKEY.exe solo: la carpeta _internal debe quedar al lado."
