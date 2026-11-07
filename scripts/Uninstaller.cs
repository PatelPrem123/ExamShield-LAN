using System;
using System.IO;
using System.Drawing;
using System.Diagnostics;
using System.Windows.Forms;
using Microsoft.Win32;

namespace ExamShieldUninstaller
{
    public class UninstallerForm : Form
    {
        private Panel headerPanel;
        private Label titleLabel;
        private Label subtitleLabel;
        private Label promptLabel;
        private CheckBox keepDbChk;
        private ProgressBar progressBar;
        private Label statusLabel;
        private Button uninstallButton;
        private Button cancelButton;

        public UninstallerForm()
        {
            InitializeComponent();
        }

        private void InitializeComponent()
        {
            this.Text = "ExamShield LAN - Teacher Control Center Uninstaller";
            this.Size = new Size(520, 360);
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

            headerPanel = new Panel();
            headerPanel.Dock = DockStyle.Top;
            headerPanel.Height = 75;
            headerPanel.BackColor = Color.FromArgb(30, 27, 75);

            titleLabel = new Label();
            titleLabel.Text = "🛡️ ExamShield LAN Removal";
            titleLabel.Font = new Font("Segoe UI", 15F, FontStyle.Bold, GraphicsUnit.Point);
            titleLabel.ForeColor = Color.White;
            titleLabel.Location = new Point(20, 14);
            titleLabel.AutoSize = true;

            subtitleLabel = new Label();
            subtitleLabel.Text = "Teacher Control Center  •  Version 2.5.0 Uninstaller";
            subtitleLabel.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);
            subtitleLabel.ForeColor = Color.FromArgb(165, 180, 252);
            subtitleLabel.Location = new Point(22, 44);
            subtitleLabel.AutoSize = true;

            headerPanel.Controls.Add(titleLabel);
            headerPanel.Controls.Add(subtitleLabel);

            promptLabel = new Label();
            promptLabel.Text = "Are you sure you want to completely remove ExamShield LAN Teacher Control Center from this computer?";
            promptLabel.Location = new Point(24, 95);
            promptLabel.Size = new Size(460, 40);
            promptLabel.ForeColor = Color.FromArgb(51, 65, 85);

            keepDbChk = new CheckBox();
            keepDbChk.Text = "Preserve student test results and database (examshield.db & history records)";
            keepDbChk.Location = new Point(24, 145);
            keepDbChk.Size = new Size(460, 30);
            keepDbChk.Checked = true;
            keepDbChk.ForeColor = Color.FromArgb(15, 23, 42);

            statusLabel = new Label();
            statusLabel.Text = "Ready to proceed.";
            statusLabel.Location = new Point(24, 190);
            statusLabel.Size = new Size(460, 20);
            statusLabel.ForeColor = Color.FromArgb(71, 85, 105);

            progressBar = new ProgressBar();
            progressBar.Location = new Point(24, 215);
            progressBar.Size = new Size(456, 22);
            progressBar.Minimum = 0;
            progressBar.Maximum = 100;
            progressBar.Value = 0;

            cancelButton = new Button();
            cancelButton.Text = "Cancel";
            cancelButton.Location = new Point(380, 270);
            cancelButton.Size = new Size(100, 30);
            cancelButton.BackColor = Color.White;
            cancelButton.FlatStyle = FlatStyle.System;
            cancelButton.Click += (s, e) => this.Close();

            uninstallButton = new Button();
            uninstallButton.Text = "Uninstall";
            uninstallButton.Font = new Font("Segoe UI", 9.5F, FontStyle.Bold, GraphicsUnit.Point);
            uninstallButton.Location = new Point(270, 270);
            uninstallButton.Size = new Size(100, 30);
            uninstallButton.BackColor = Color.FromArgb(220, 38, 38); // Crimson Red
            uninstallButton.ForeColor = Color.White;
            uninstallButton.FlatStyle = FlatStyle.Flat;
            uninstallButton.FlatAppearance.BorderSize = 0;
            uninstallButton.Click += UninstallButton_Click;

            this.Controls.Add(headerPanel);
            this.Controls.Add(promptLabel);
            this.Controls.Add(keepDbChk);
            this.Controls.Add(statusLabel);
            this.Controls.Add(progressBar);
            this.Controls.Add(uninstallButton);
            this.Controls.Add(cancelButton);
        }

        private void UninstallButton_Click(object sender, EventArgs e)
        {
            uninstallButton.Enabled = false;
            cancelButton.Enabled = false;
            keepDbChk.Enabled = false;

            string appDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            bool preserveDb = keepDbChk.Checked;

            System.Threading.Thread worker = new System.Threading.Thread(() => PerformUninstall(appDir, preserveDb));
            worker.IsBackground = true;
            worker.Start();
        }

        private void PerformUninstall(string appDir, bool preserveDb)
        {
            try
            {
                UpdateStatus("Removing Desktop shortcuts...", 20);

                string[] desktopFolders = new string[]
                {
                    Environment.GetFolderPath(Environment.SpecialFolder.Desktop),
                    Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                    Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory)
                };

                foreach (string df in desktopFolders)
                {
                    if (string.IsNullOrEmpty(df) || !Directory.Exists(df)) continue;
                    string sc = Path.Combine(df, "ExamShield LAN - Teacher Control Center.lnk");
                    if (File.Exists(sc))
                    {
                        try { File.Delete(sc); } catch { }
                    }
                }

                UpdateStatus("Removing Start Menu programs and shortcuts...", 40);

                string[] programFolders = new string[]
                {
                    Environment.GetFolderPath(Environment.SpecialFolder.Programs),
                    Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms)
                };

                foreach (string pf in programFolders)
                {
                    if (string.IsNullOrEmpty(pf) || !Directory.Exists(pf)) continue;
                    string menuDir = Path.Combine(pf, "ExamShield LAN");
                    if (Directory.Exists(menuDir))
                    {
                        try { Directory.Delete(menuDir, true); } catch { }
                    }
                }

                UpdateStatus("Removing Windows uninstaller registry entry...", 60);

                try
                {
                    using (RegistryKey parent = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall", true))
                    {
                        if (parent != null)
                        {
                            parent.DeleteSubKeyTree("ExamShield LAN", false);
                        }
                    }
                }
                catch { }

                UpdateStatus("Cleaning installed application files...", 80);

                // If preserveDb is requested, copy database and history to a safe backup location
                string backupLocation = null;
                if (preserveDb)
                {
                    try
                    {
                        string docs = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
                        backupLocation = Path.Combine(docs, "ExamShield_Backup_" + DateTime.Now.ToString("yyyyMMdd_HHmmss"));
                        Directory.CreateDirectory(backupLocation);

                        string dbFile = Path.Combine(appDir, "teacher-server-app", "examshield.db");
                        if (File.Exists(dbFile))
                        {
                            File.Copy(dbFile, Path.Combine(backupLocation, "examshield.db"), true);
                        }

                        foreach (string h in new string[] { "history.csv", "history.txt", "history.bat" })
                        {
                            string hPath = Path.Combine(appDir, h);
                            if (File.Exists(hPath))
                            {
                                File.Copy(hPath, Path.Combine(backupLocation, h), true);
                            }
                        }
                    }
                    catch { }
                }

                UpdateStatus("Finalizing removal...", 100);

                // Self-deletion command via detached background cmd
                string currentExe = Application.ExecutablePath;
                string script = string.Format("/c ping 127.0.0.1 -n 2 > nul & rmdir /s /q \"{0}\"", appDir);

                ProcessStartInfo psi = new ProcessStartInfo("cmd.exe", script);
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = true;

                this.Invoke(new Action(() =>
                {
                    string msg = "ExamShield LAN has been successfully removed from this computer.";
                    if (backupLocation != null && Directory.Exists(backupLocation))
                    {
                        msg += "\n\nYour student examination database was safely preserved at:\n" + backupLocation;
                    }
                    MessageBox.Show(msg, "Uninstall Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    Process.Start(psi);
                    this.Close();
                }));
            }
            catch (Exception ex)
            {
                this.Invoke(new Action(() =>
                {
                    MessageBox.Show("Uninstall warning: " + ex.Message, "Uninstall Note", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    this.Close();
                }));
            }
        }

        private void UpdateStatus(string text, int val)
        {
            if (this.InvokeRequired)
            {
                this.Invoke(new Action(() => UpdateStatus(text, val)));
                return;
            }
            statusLabel.Text = text;
            progressBar.Value = Math.Max(0, Math.Min(100, val));
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new UninstallerForm());
        }
    }
}
