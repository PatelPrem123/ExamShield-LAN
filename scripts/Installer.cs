using System;
using System.IO;
using System.IO.Compression;
using System.Drawing;
using System.Reflection;
using System.Threading;
using System.Diagnostics;
using System.Windows.Forms;
using Microsoft.Win32;

namespace ExamShieldSetup
{
    public class SetupForm : Form
    {
        private Panel headerPanel;
        private Label titleLabel;
        private Label subtitleLabel;
        private Label welcomeLabel;
        private GroupBox folderGroup;
        private TextBox pathTextBox;
        private Button browseButton;
        private GroupBox optionsGroup;
        private CheckBox desktopShortcutChk;
        private CheckBox startMenuShortcutChk;
        private CheckBox launchAfterChk;
        private ProgressBar progressBar;
        private Label statusLabel;
        private Button installButton;
        private Button cancelButton;

        private bool isInstalled = false;

        public SetupForm()
        {
            InitializeComponent();
        }

        private void InitializeComponent()
        {
            this.Text = "ExamShield LAN - Teacher Control Center Setup (v2.5.0)";
            this.Size = new Size(580, 485);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = true;
            this.BackColor = Color.FromArgb(248, 250, 252);
            this.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);

            try
            {
                if (File.Exists("app.ico"))
                {
                    this.Icon = new Icon("app.ico");
                }
            }
            catch { }

            // Header Panel
            headerPanel = new Panel();
            headerPanel.Dock = DockStyle.Top;
            headerPanel.Height = 85;
            headerPanel.BackColor = Color.FromArgb(30, 27, 75);

            titleLabel = new Label();
            titleLabel.Text = "🛡️ ExamShield LAN";
            titleLabel.Font = new Font("Segoe UI", 16F, FontStyle.Bold, GraphicsUnit.Point);
            titleLabel.ForeColor = Color.White;
            titleLabel.Location = new Point(24, 15);
            titleLabel.AutoSize = true;

            subtitleLabel = new Label();
            subtitleLabel.Text = "Teacher Control Center  •  Version 2.5.0 (Enterprise Hardened Edition)";
            subtitleLabel.Font = new Font("Segoe UI", 9.5F, FontStyle.Regular, GraphicsUnit.Point);
            subtitleLabel.ForeColor = Color.FromArgb(165, 180, 252);
            subtitleLabel.Location = new Point(26, 48);
            subtitleLabel.AutoSize = true;

            headerPanel.Controls.Add(titleLabel);
            headerPanel.Controls.Add(subtitleLabel);

            // Welcome
            welcomeLabel = new Label();
            welcomeLabel.Text = "This setup wizard will install ExamShield LAN Teacher Control Center on your computer. All components are 100% offline and air-gapped.";
            welcomeLabel.Location = new Point(24, 98);
            welcomeLabel.Size = new Size(520, 36);
            welcomeLabel.ForeColor = Color.FromArgb(51, 65, 85);

            // Destination Folder Group
            folderGroup = new GroupBox();
            folderGroup.Text = " Destination Directory ";
            folderGroup.Location = new Point(24, 140);
            folderGroup.Size = new Size(516, 75);
            folderGroup.ForeColor = Color.FromArgb(30, 27, 75);

            pathTextBox = new TextBox();
            pathTextBox.Text = @"C:\ExamShield LAN";
            pathTextBox.Location = new Point(16, 30);
            pathTextBox.Size = new Size(385, 23);
            pathTextBox.ForeColor = Color.FromArgb(15, 23, 42);

            browseButton = new Button();
            browseButton.Text = "Browse...";
            browseButton.Location = new Point(410, 28);
            browseButton.Size = new Size(90, 27);
            browseButton.BackColor = Color.White;
            browseButton.FlatStyle = FlatStyle.System;
            browseButton.Click += BrowseButton_Click;

            folderGroup.Controls.Add(pathTextBox);
            folderGroup.Controls.Add(browseButton);

            // Options Group
            optionsGroup = new GroupBox();
            optionsGroup.Text = " Installation Options ";
            optionsGroup.Location = new Point(24, 225);
            optionsGroup.Size = new Size(516, 110);
            optionsGroup.ForeColor = Color.FromArgb(30, 27, 75);

            desktopShortcutChk = new CheckBox();
            desktopShortcutChk.Text = "Create a Desktop shortcut (ExamShield LAN - Teacher Control Center)";
            desktopShortcutChk.Location = new Point(16, 24);
            desktopShortcutChk.Size = new Size(480, 22);
            desktopShortcutChk.Checked = true;
            desktopShortcutChk.ForeColor = Color.FromArgb(30, 41, 59);

            startMenuShortcutChk = new CheckBox();
            startMenuShortcutChk.Text = "Create a Start Menu program shortcut & folder";
            startMenuShortcutChk.Location = new Point(16, 50);
            startMenuShortcutChk.Size = new Size(480, 22);
            startMenuShortcutChk.Checked = true;
            startMenuShortcutChk.ForeColor = Color.FromArgb(30, 41, 59);

            launchAfterChk = new CheckBox();
            launchAfterChk.Text = "Launch ExamShield Teacher Server immediately after installation";
            launchAfterChk.Location = new Point(16, 76);
            launchAfterChk.Size = new Size(480, 22);
            launchAfterChk.Checked = true;
            launchAfterChk.ForeColor = Color.FromArgb(30, 41, 59);

            optionsGroup.Controls.Add(desktopShortcutChk);
            optionsGroup.Controls.Add(startMenuShortcutChk);
            optionsGroup.Controls.Add(launchAfterChk);

            // Progress Bar & Status
            statusLabel = new Label();
            statusLabel.Text = "Ready to install.";
            statusLabel.Location = new Point(24, 348);
            statusLabel.Size = new Size(516, 20);
            statusLabel.ForeColor = Color.FromArgb(71, 85, 105);

            progressBar = new ProgressBar();
            progressBar.Location = new Point(24, 370);
            progressBar.Size = new Size(516, 22);
            progressBar.Minimum = 0;
            progressBar.Maximum = 100;
            progressBar.Value = 0;

            // Action Buttons
            cancelButton = new Button();
            cancelButton.Text = "Cancel";
            cancelButton.Location = new Point(440, 404);
            cancelButton.Size = new Size(100, 30);
            cancelButton.BackColor = Color.White;
            cancelButton.FlatStyle = FlatStyle.System;
            cancelButton.Click += (s, e) => this.Close();

            installButton = new Button();
            installButton.Text = "Install";
            installButton.Font = new Font("Segoe UI", 9.5F, FontStyle.Bold, GraphicsUnit.Point);
            installButton.Location = new Point(330, 404);
            installButton.Size = new Size(100, 30);
            installButton.BackColor = Color.FromArgb(4, 120, 87);
            installButton.ForeColor = Color.White;
            installButton.FlatStyle = FlatStyle.Flat;
            installButton.FlatAppearance.BorderSize = 0;
            installButton.Click += InstallButton_Click;

            this.Controls.Add(headerPanel);
            this.Controls.Add(welcomeLabel);
            this.Controls.Add(folderGroup);
            this.Controls.Add(optionsGroup);
            this.Controls.Add(statusLabel);
            this.Controls.Add(progressBar);
            this.Controls.Add(installButton);
            this.Controls.Add(cancelButton);
        }

        private void BrowseButton_Click(object sender, EventArgs e)
        {
            using (FolderBrowserDialog fbd = new FolderBrowserDialog())
            {
                fbd.Description = "Select target directory for ExamShield LAN installation:";
                fbd.SelectedPath = pathTextBox.Text;
                if (fbd.ShowDialog() == DialogResult.OK)
                {
                    pathTextBox.Text = fbd.SelectedPath;
                }
            }
        }

        private void InstallButton_Click(object sender, EventArgs e)
        {
            if (isInstalled)
            {
                if (launchAfterChk.Checked)
                {
                    LaunchTeacherServer(pathTextBox.Text);
                }
                this.Close();
                return;
            }

            string targetDir = pathTextBox.Text.Trim();
            if (string.IsNullOrEmpty(targetDir))
            {
                MessageBox.Show("Please choose a valid destination directory.", "Validation Error", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            pathTextBox.Enabled = false;
            browseButton.Enabled = false;
            desktopShortcutChk.Enabled = false;
            startMenuShortcutChk.Enabled = false;
            launchAfterChk.Enabled = false;
            installButton.Enabled = false;
            cancelButton.Enabled = false;

            Thread workerThread = new Thread(() => PerformInstallation(targetDir));
            workerThread.IsBackground = true;
            workerThread.Start();
        }

        private StringWriter logWriter = new StringWriter();

        private void Log(string msg)
        {
            logWriter.WriteLine(string.Format("[{0:yyyy-MM-dd HH:mm:ss}] {1}", DateTime.Now, msg));
        }

        private void PerformInstallation(string targetDir)
        {
            try
            {
                Log("Starting installation into: " + targetDir);
                UpdateStatus("Preparing destination directory...", 5);

                if (!Directory.Exists(targetDir))
                {
                    Directory.CreateDirectory(targetDir);
                    Log("Created directory: " + targetDir);
                }

                UpdateStatus("Extracting core application binaries...", 15);

                Assembly asm = Assembly.GetExecutingAssembly();
                string zipResource = null;
                string uninstallerResource = null;

                foreach (string name in asm.GetManifestResourceNames())
                {
                    if (name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                    {
                        zipResource = name;
                    }
                    else if (name.EndsWith("Uninstall_ExamShield.exe", StringComparison.OrdinalIgnoreCase))
                    {
                        uninstallerResource = name;
                    }
                }

                if (string.IsNullOrEmpty(zipResource))
                {
                    throw new Exception("Embedded application payload was not found inside the installer.");
                }

                using (Stream resStream = asm.GetManifestResourceStream(zipResource))
                using (ZipArchive archive = new ZipArchive(resStream, ZipArchiveMode.Read))
                {
                    // Detect common prefix across archive entries (e.g. "ExamShield LAN .../")
                    string commonPrefix = null;
                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        int slashIndex = entry.FullName.IndexOf('/');
                        if (slashIndex > 0)
                        {
                            string prefix = entry.FullName.Substring(0, slashIndex + 1);
                            if (commonPrefix == null) commonPrefix = prefix;
                            else if (!string.Equals(commonPrefix, prefix, StringComparison.OrdinalIgnoreCase))
                            {
                                commonPrefix = "";
                                break;
                            }
                        }
                        else
                        {
                            commonPrefix = "";
                            break;
                        }
                    }

                    if (string.IsNullOrEmpty(commonPrefix)) commonPrefix = "";
                    Log("Archive detected root prefix: '" + commonPrefix + "'");

                    int total = archive.Entries.Count;
                    int count = 0;

                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        count++;
                        int percent = 15 + (int)((double)count / total * 70.0);

                        string relative = entry.FullName;
                        if (!string.IsNullOrEmpty(commonPrefix) && relative.StartsWith(commonPrefix, StringComparison.OrdinalIgnoreCase))
                        {
                            relative = relative.Substring(commonPrefix.Length);
                        }

                        if (string.IsNullOrEmpty(relative)) continue;

                        string destFile = Path.Combine(targetDir, relative.Replace('/', Path.DirectorySeparatorChar));

                        if (string.IsNullOrEmpty(entry.Name))
                        {
                            if (!Directory.Exists(destFile))
                            {
                                Directory.CreateDirectory(destFile);
                            }
                        }
                        else
                        {
                            string parentDir = Path.GetDirectoryName(destFile);
                            if (!Directory.Exists(parentDir))
                            {
                                Directory.CreateDirectory(parentDir);
                            }
                            entry.ExtractToFile(destFile, true);
                        }

                        if (count % 40 == 0 || count == total)
                        {
                            UpdateStatus(string.Format("Extracting: {0} ({1}/{2})", entry.Name, count, total), percent);
                        }
                    }
                }

                Log("All files extracted successfully.");
                UpdateStatus("Configuring shortcuts and environment...", 90);

                // Locate ExamShield_Teacher_Server.exe
                string exePath = Path.Combine(targetDir, "ExamShield_Teacher_Server.exe");
                if (!File.Exists(exePath))
                {
                    // Search recursively just in case
                    string[] candidates = Directory.GetFiles(targetDir, "ExamShield_Teacher_Server.exe", SearchOption.AllDirectories);
                    if (candidates.Length > 0)
                    {
                        exePath = candidates[0];
                        Log("Located server executable in subfolder: " + exePath);
                    }
                }

                string iconPath = Path.Combine(targetDir, "app.ico");
                if (!File.Exists(iconPath))
                {
                    string[] iconCandidates = Directory.GetFiles(targetDir, "app.ico", SearchOption.AllDirectories);
                    if (iconCandidates.Length > 0) iconPath = iconCandidates[0];
                }

                Log("Resolved Server Executable: " + exePath + " (Exists: " + File.Exists(exePath) + ")");

                // Extract embedded Uninstaller if provided
                string uninstallerExePath = Path.Combine(targetDir, "Uninstall_ExamShield.exe");
                if (!string.IsNullOrEmpty(uninstallerResource))
                {
                    try
                    {
                        using (Stream uStream = asm.GetManifestResourceStream(uninstallerResource))
                        using (FileStream fs = new FileStream(uninstallerExePath, FileMode.Create, FileAccess.Write))
                        {
                            uStream.CopyTo(fs);
                        }
                        Log("Extracted dedicated Uninstaller executable: " + uninstallerExePath);
                    }
                    catch (Exception ex)
                    {
                        Log("Could not extract uninstaller resource: " + ex.Message);
                    }
                }

                // 1. Desktop Shortcuts
                if (desktopShortcutChk.Checked && File.Exists(exePath))
                {
                    string workingDir = Path.GetDirectoryName(exePath);

                    string[] desktopFolders = new string[]
                    {
                        Environment.GetFolderPath(Environment.SpecialFolder.Desktop),
                        Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory)
                    };

                    foreach (string df in desktopFolders)
                    {
                        if (string.IsNullOrEmpty(df) || !Directory.Exists(df)) continue;
                        string scPath = Path.Combine(df, "ExamShield LAN - Teacher Control Center.lnk");
                        bool created = CreateWindowsShortcut(scPath, exePath, workingDir, iconPath, "ExamShield LAN - Teacher Control Center");
                        Log("Desktop shortcut created at '" + scPath + "': " + created);
                    }
                }

                // 2. Start Menu Shortcuts
                if (startMenuShortcutChk.Checked && File.Exists(exePath))
                {
                    string workingDir = Path.GetDirectoryName(exePath);
                    string programsDir = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
                    string menuDir = Path.Combine(programsDir, "ExamShield LAN");
                    if (!Directory.Exists(menuDir))
                    {
                        Directory.CreateDirectory(menuDir);
                    }

                    string scMain = Path.Combine(menuDir, "ExamShield LAN - Teacher Control Center.lnk");
                    bool mainCreated = CreateWindowsShortcut(scMain, exePath, workingDir, iconPath, "ExamShield LAN - Teacher Control Center");
                    Log("Start menu shortcut created at '" + scMain + "': " + mainCreated);

                    if (File.Exists(uninstallerExePath))
                    {
                        string scUninst = Path.Combine(menuDir, "Uninstall ExamShield LAN.lnk");
                        CreateWindowsShortcut(scUninst, uninstallerExePath, targetDir, iconPath, "Uninstall ExamShield LAN");
                        Log("Start menu uninstaller shortcut created at '" + scUninst + "'");
                    }
                }

                // 3. Register in Windows Add/Remove Programs
                RegisterInWindowsUninstall(targetDir, uninstallerExePath, iconPath);

                // 4. Generate fallback batch uninstaller
                CreateBatchUninstaller(targetDir);

                // Write setup log
                try
                {
                    File.WriteAllText(Path.Combine(targetDir, "setup_install.log"), logWriter.ToString());
                }
                catch { }

                UpdateStatus("Installation completed successfully!", 100);

                this.Invoke(new Action(() =>
                {
                    isInstalled = true;
                    installButton.Text = "Finish";
                    installButton.BackColor = Color.FromArgb(30, 27, 75);
                    installButton.Enabled = true;
                    cancelButton.Visible = false;
                }));
            }
            catch (Exception ex)
            {
                Log("Installation error: " + ex.ToString());
                try
                {
                    File.WriteAllText(Path.Combine(targetDir, "setup_install_error.log"), logWriter.ToString());
                }
                catch { }

                this.Invoke(new Action(() =>
                {
                    MessageBox.Show("Installation encountered an issue:\n" + ex.Message, "Setup Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    statusLabel.Text = "Installation failed.";
                    installButton.Enabled = true;
                    cancelButton.Enabled = true;
                }));
            }
        }

        private void UpdateStatus(string message, int percent)
        {
            if (this.InvokeRequired)
            {
                this.Invoke(new Action(() => UpdateStatus(message, percent)));
                return;
            }
            statusLabel.Text = message;
            progressBar.Value = Math.Max(0, Math.Min(100, percent));
        }

        private bool CreateWindowsShortcut(string shortcutPath, string targetExe, string workingDir, string iconPath, string desc)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic shortcut = shell.CreateShortcut(shortcutPath);
                    shortcut.TargetPath = targetExe;
                    shortcut.WorkingDirectory = workingDir;
                    if (File.Exists(iconPath))
                    {
                        shortcut.IconLocation = iconPath + ",0";
                    }
                    shortcut.Description = desc;
                    shortcut.Save();
                    return true;
                }
            }
            catch { }

            // Secondary fallback via PowerShell
            try
            {
                string ps = string.Format(
                    "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('{0}'); $s.TargetPath = '{1}'; $s.WorkingDirectory = '{2}'; if (Test-Path '{3}') {{ $s.IconLocation = '{3},0' }}; $s.Description = '{4}'; $s.Save()",
                    shortcutPath.Replace("'", "''"),
                    targetExe.Replace("'", "''"),
                    workingDir.Replace("'", "''"),
                    iconPath.Replace("'", "''"),
                    desc.Replace("'", "''")
                );

                ProcessStartInfo psi = new ProcessStartInfo("powershell.exe", "-NoProfile -NonInteractive -Command \"" + ps + "\"");
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.CreateNoWindow = true;
                using (Process p = Process.Start(psi))
                {
                    p.WaitForExit(5000);
                    return p.ExitCode == 0;
                }
            }
            catch
            {
                return false;
            }
        }

        private void RegisterInWindowsUninstall(string installDir, string uninstallerPath, string iconPath)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\ExamShield LAN"))
                {
                    if (key != null)
                    {
                        key.SetValue("DisplayName", "ExamShield LAN - Teacher Control Center");
                        key.SetValue("DisplayVersion", "2.5.0");
                        key.SetValue("Publisher", "ExamShield Systems");
                        key.SetValue("InstallLocation", installDir);
                        if (File.Exists(iconPath))
                        {
                            key.SetValue("DisplayIcon", iconPath);
                        }
                        if (File.Exists(uninstallerPath))
                        {
                            key.SetValue("UninstallString", "\"" + uninstallerPath + "\"");
                            key.SetValue("QuietUninstallString", "\"" + uninstallerPath + "\"");
                        }
                        key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                        key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                    }
                }
            }
            catch { }
        }

        private void CreateBatchUninstaller(string installDir)
        {
            try
            {
                string uninstallerPath = Path.Combine(installDir, "Uninstall_ExamShield.bat");
                string content = 
@"@echo off
title ExamShield LAN Uninstaller
echo ==============================================================================
echo    ExamShield LAN - Teacher Control Center Uninstaller
echo ==============================================================================
echo.
if exist ""Uninstall_ExamShield.exe"" (
    start """" ""Uninstall_ExamShield.exe""
    exit /b 0
)

echo Removing Desktop shortcuts...
del /f /q ""%USERPROFILE%\Desktop\ExamShield LAN - Teacher Control Center.lnk"" 2>nul
del /f /q ""%PUBLIC%\Desktop\ExamShield LAN - Teacher Control Center.lnk"" 2>nul

echo Removing Start Menu shortcuts...
rmdir /s /q ""%APPDATA%\Microsoft\Windows\Start Menu\Programs\ExamShield LAN"" 2>nul

echo.
echo Shortcuts removed. To completely remove the application, delete this folder:
echo ""%~dp0""
echo.
pause
";
                File.WriteAllText(uninstallerPath, content);
            }
            catch { }
        }

        private void LaunchTeacherServer(string targetDir)
        {
            try
            {
                string exePath = Path.Combine(targetDir, "ExamShield_Teacher_Server.exe");
                if (!File.Exists(exePath))
                {
                    string[] candidates = Directory.GetFiles(targetDir, "ExamShield_Teacher_Server.exe", SearchOption.AllDirectories);
                    if (candidates.Length > 0) exePath = candidates[0];
                }

                if (File.Exists(exePath))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = exePath;
                    psi.WorkingDirectory = Path.GetDirectoryName(exePath);
                    Process.Start(psi);
                }
            }
            catch { }
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }
    }
}
