# ==============================================================================
# ExamShield LAN - Enterprise Build & Distribution Automation Script
# Version: 2.5.0
# Description: Synchronizes sources, packages clean zip distribution, and compiles
#              the Windows Setup Installer with embedded uninstaller & shortcuts.
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$SkipZip = $false,
    [switch]$SkipInstaller = $false
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step([string]$message) {
    $time = (Get-Date).ToString("HH:mm:ss")
    Write-Host ("[{0}] [>] {1}" -f $time, $message) -ForegroundColor Cyan
}

function Write-Success([string]$message) {
    $time = (Get-Date).ToString("HH:mm:ss")
    Write-Host ("[{0}] [+] {1}" -f $time, $message) -ForegroundColor Green
}

function Write-Failure([string]$message) {
    $time = (Get-Date).ToString("HH:mm:ss")
    Write-Host ("[{0}] [-] ERROR: {1}" -f $time, $message) -ForegroundColor Red
}

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

try {
    Write-Step "Resolving workspace paths and tools..."

    $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $rootDir = [System.IO.Path]::GetFullPath((Join-Path $scriptDir ".."))
    if (!(Test-Path (Join-Path $rootDir "teacher-server-app"))) {
        $rootDir = [System.IO.Path]::GetFullPath($scriptDir)
    }

    # Dynamically resolve distribution folder and zip without fragile emoji literals
    $distDirItem = Get-ChildItem -Path $rootDir -Directory -Filter "*Teacher Control Center*" | Select-Object -First 1
    if ($null -eq $distDirItem) {
        throw "Could not locate distribution directory matching *Teacher Control Center* under $rootDir"
    }
    $distFolder = [System.IO.Path]::GetFullPath($distDirItem.FullName)

    $distZipItem = Get-ChildItem -Path $rootDir -File -Filter "*Teacher Control Center.zip" | Select-Object -First 1
    if ($null -eq $distZipItem) {
        $distZipPath = [System.IO.Path]::GetFullPath((Join-Path $rootDir "ExamShield LAN - Teacher Control Center.zip"))
    } else {
        $distZipPath = [System.IO.Path]::GetFullPath($distZipItem.FullName)
    }

    $teacherServerAppDir = [System.IO.Path]::GetFullPath((Join-Path $rootDir "teacher-server-app"))
    $teacherSrcDir = [System.IO.Path]::GetFullPath((Join-Path $teacherServerAppDir "src"))
    $distTeacherSrcDir = [System.IO.Path]::GetFullPath((Join-Path $distFolder "teacher-server-app\src"))
    
    $iconPath = [System.IO.Path]::GetFullPath((Join-Path $rootDir "app.ico"))
    $setupExePath = [System.IO.Path]::GetFullPath((Join-Path $rootDir "ExamShield_LAN_v2.5.0_Setup.exe"))

    $buildTempDir = [System.IO.Path]::GetFullPath((Join-Path $rootDir "build_temp"))
    $tempZipPath = [System.IO.Path]::GetFullPath((Join-Path $buildTempDir "payload.zip"))
    $uninstallerExePath = [System.IO.Path]::GetFullPath((Join-Path $buildTempDir "Uninstall_ExamShield.exe"))

    $installerCsPath = "C:\Users\Administrator\.gemini\antigravity\brain\c33364d0-00d1-47d1-96d3-e752037162c8\scratch\Installer.cs"
    $uninstallerCsPath = "C:\Users\Administrator\.gemini\antigravity\brain\c33364d0-00d1-47d1-96d3-e752037162c8\scratch\Uninstaller.cs"

    $cscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    $sevenZipPath = "C:\Program Files\7-Zip\7z.exe"

    # Pre-flight assertions
    if (!(Test-Path $distFolder)) {
        throw ("Distribution source directory not found at: {0}" -f $distFolder)
    }
    if (!(Test-Path $sevenZipPath)) {
        throw ("7-Zip executable not found at: {0}" -f $sevenZipPath)
    }
    if (!(Test-Path $cscPath)) {
        throw ("Microsoft C# Compiler (csc.exe) not found at: {0}" -f $cscPath)
    }
    if (!(Test-Path $iconPath)) {
        throw ("Application icon not found at: {0}" -f $iconPath)
    }

    # Strict path check: never copy a file onto itself
    if ([string]::Equals($tempZipPath, $distZipPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Self-overwrite hazard: Temp ZIP and Distribution ZIP have identical paths"
    }

    Write-Success "All paths and tools resolved successfully."

    # STEP 1: Synchronize Sources
    Write-Step "Synchronizing developer src and package.json to distribution folder..."
    if (Test-Path $teacherSrcDir) {
        Copy-Item -Path "$teacherSrcDir\*" -Destination $distTeacherSrcDir -Recurse -Force
    }
    Copy-Item -Path (Join-Path $teacherServerAppDir "package.json") -Destination (Join-Path $distFolder "teacher-server-app\package.json") -Force
    Write-Success "Source tree synchronized to distribution directory."

    # Prepare temp build directory
    if (Test-Path $buildTempDir) {
        Remove-Item -Path $buildTempDir -Recurse -Force
    }
    $null = New-Item -ItemType Directory -Path $buildTempDir -Force

    # STEP 2: Compile Dedicated Uninstaller
    Write-Step "Compiling dedicated GUI Uninstaller (Uninstall_ExamShield.exe)..."
    $uninstallerArgs = @(
        "/target:winexe",
        "/optimize+",
        "`"/win32icon:$iconPath`"",
        "`"/out:$uninstallerExePath`"",
        "/r:System.dll",
        "/r:System.Windows.Forms.dll",
        "/r:System.Drawing.dll",
        "`"$uninstallerCsPath`""
    )

    $uProcess = Start-Process -FilePath $cscPath -ArgumentList $uninstallerArgs -NoNewWindow -Wait -PassThru
    if ($uProcess.ExitCode -ne 0) {
        throw ("Uninstaller compilation failed with exit code {0}" -f $uProcess.ExitCode)
    }
    if (!(Test-Path $uninstallerExePath)) {
        throw ("Uninstaller executable was not generated at: {0}" -f $uninstallerExePath)
    }
    $uSize = (Get-Item $uninstallerExePath).Length
    Write-Success ("Compiled Uninstaller: {0} ({1} bytes)" -f $uninstallerExePath, $uSize)

    # Also copy Uninstaller into distribution folder
    Copy-Item -Path $uninstallerExePath -Destination (Join-Path $distFolder "Uninstall_ExamShield.exe") -Force

    # STEP 3: Create Clean Root-Level ZIP Archive
    if (!$SkipZip) {
        Write-Step "Creating root-level ZIP payload (no nested directory wrapper)..."
        
        # We push into the distribution directory so that 7-Zip archives entries directly at root!
        Push-Location $distFolder
        try {
            $sevenZipArgs = @(
                "a",
                "-tzip",
                "`"$tempZipPath`"",
                "*",
                "-mx5"
            )
            $zProcess = Start-Process -FilePath $sevenZipPath -ArgumentList $sevenZipArgs -NoNewWindow -Wait -PassThru
            if ($zProcess.ExitCode -ne 0) {
                throw ("7-Zip failed with exit code {0}" -f $zProcess.ExitCode)
            }
        }
        finally {
            Pop-Location
        }

        if (!(Test-Path $tempZipPath)) {
            throw ("Temporary ZIP archive was not generated at: {0}" -f $tempZipPath)
        }
        $tempZipSize = (Get-Item $tempZipPath).Length
        if ($tempZipSize -eq 0) {
            throw "Generated ZIP file is empty."
        }
        $mbSize = [math]::Round($tempZipSize / 1MB, 2)
        Write-Success ("Built payload archive: {0} ({1} MB)" -f $tempZipPath, $mbSize)

        # STEP 4: Safely Update Portable Distribution ZIP
        Write-Step ("Safely deploying to distribution ZIP: {0}..." -f $distZipPath)
        
        # Defensive check: ensure normalized paths are different
        $normTemp = [System.IO.Path]::GetFullPath($tempZipPath)
        $normDest = [System.IO.Path]::GetFullPath($distZipPath)
        if ([string]::Equals($normTemp, $normDest, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Fatal safety check: Source and destination ZIP cannot be the exact same file."
        }

        Copy-Item -Path $normTemp -Destination $normDest -Force

        # Verification
        if (!(Test-Path $normDest)) {
            throw ("Failed to verify destination ZIP at: {0}" -f $normDest)
        }
        $destZipSize = (Get-Item $normDest).Length
        if ($destZipSize -ne $tempZipSize) {
            throw ("Size mismatch after copying! Source: {0} bytes, Destination: {1} bytes" -f $tempZipSize, $destZipSize)
        }
        Write-Success ("Verified distribution ZIP matches payload exactly ({0} MB)." -f $mbSize)
    }

    # STEP 5: Compile Windows Setup Installer
    if (!$SkipInstaller) {
        Write-Step ("Compiling native Windows Setup Installer ({0})..." -f $setupExePath)

        $installerArgs = @(
            "/target:winexe",
            "/optimize+",
            "`"/win32icon:$iconPath`"",
            "`"/resource:$tempZipPath,payload.zip`"",
            "`"/resource:$uninstallerExePath,Uninstall_ExamShield.exe`"",
            "`"/out:$setupExePath`"",
            "/r:System.dll",
            "/r:System.Windows.Forms.dll",
            "/r:System.Drawing.dll",
            "/r:System.IO.Compression.dll",
            "/r:System.IO.Compression.FileSystem.dll",
            "/r:Microsoft.CSharp.dll",
            "`"$installerCsPath`""
        )

        $instProcess = Start-Process -FilePath $cscPath -ArgumentList $installerArgs -NoNewWindow -Wait -PassThru
        if ($instProcess.ExitCode -ne 0) {
            throw ("Installer compilation failed with exit code {0}" -f $instProcess.ExitCode)
        }

        if (!(Test-Path $setupExePath)) {
            throw ("Setup installer was not generated at: {0}" -f $setupExePath)
        }
        $setupSize = (Get-Item $setupExePath).Length
        if ($setupSize -eq 0) {
            throw "Generated Setup.exe is empty."
        }
        $setupMb = [math]::Round($setupSize / 1MB, 2)
        Write-Success ("Compiled Windows Setup Installer: {0} ({1} MB)" -f $setupExePath, $setupMb)
    }

    # STEP 6: Clean up temporary build artifacts
    if (Test-Path $buildTempDir) {
        Remove-Item -Path $buildTempDir -Recurse -Force
    }

    $stopwatch.Stop()
    $duration = $stopwatch.Elapsed.TotalSeconds.ToString("F2")
    Write-Host ""
    Write-Host "==============================================================================" -ForegroundColor Green
    Write-Host ("   [+] EXAMSHIELD LAN BUILD COMPLETED IN {0}s" -f $duration) -ForegroundColor Green
    Write-Host "==============================================================================" -ForegroundColor Green
    Write-Host (" Distribution ZIP : {0}" -f $distZipPath) -ForegroundColor White
    Write-Host (" Setup Installer  : {0}" -f $setupExePath) -ForegroundColor White
    Write-Host ""
}
catch {
    $stopwatch.Stop()
    Write-Failure $_.Exception.Message
    exit 1
}
