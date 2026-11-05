using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;

namespace ExamShield
{
    class Program
    {
        static string FindBrowser()
        {
            string[] searchPaths = new string[]
            {
                // Edge (Preinstalled on Windows 10 & 11)
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe"),

                // Chrome
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe"),

                // Brave
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"BraveSoftware\Brave-Browser\Application\brave.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"BraveSoftware\Brave-Browser\Application\brave.exe")
            };

            foreach (string p in searchPaths)
            {
                if (File.Exists(p)) return p;
            }
            return null;
        }

        static void LaunchAppWindow(string url)
        {
            try
            {
                string browser = FindBrowser();
                if (!string.IsNullOrEmpty(browser))
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = browser,
                        Arguments = "--app=\"" + url + "\" --start-maximized",
                        UseShellExecute = true
                    };
                    Process.Start(psi);
                }
                else
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = url,
                        UseShellExecute = true
                    };
                    Process.Start(psi);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Warning: Could not launch application window automatically: " + ex.Message);
            }
        }

        static void Main(string[] args)
        {
            try
            {
                Console.OutputEncoding = Encoding.UTF8;
            }
            catch { }

            Console.Title = "ExamShield LAN - Host Control Center";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("================================================================");
            Console.WriteLine("  ExamShield LAN 🛡️ - Host Server & Control Center");
            Console.WriteLine("================================================================");
            Console.ResetColor();
            Console.WriteLine();

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string nodePath = Path.Combine(baseDir, "runtime", "node.exe");
            string serverJsPath = Path.Combine(baseDir, "teacher-server-app", "src", "server.js");
            string workingDir = Path.Combine(baseDir, "teacher-server-app");

            string nodeExe = File.Exists(nodePath) ? nodePath : "node";

            if (!File.Exists(serverJsPath))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("ERROR: Cannot find teacher-server-app/src/server.js at: " + serverJsPath);
                Console.ResetColor();
                Console.WriteLine("\nPress any key to exit...");
                Console.ReadKey();
                return;
            }

            // Launch Teacher Control Center in dedicated App Window the instant port 3000 is open
            ThreadPool.QueueUserWorkItem(state =>
            {
                for (int i = 0; i < 200; i++)
                {
                    try
                    {
                        using (var tcp = new System.Net.Sockets.TcpClient())
                        {
                            var ar = tcp.BeginConnect("127.0.0.1", 3000, null, null);
                            if (ar.AsyncWaitHandle.WaitOne(40))
                            {
                                tcp.EndConnect(ar);
                                if (tcp.Connected)
                                {
                                    Thread.Sleep(50);
                                    LaunchAppWindow("http://localhost:3000/admin");
                                    return;
                                }
                            }
                        }
                    }
                    catch { }
                    Thread.Sleep(40);
                }
                LaunchAppWindow("http://localhost:3000/admin");
            });

            try
            {
                ProcessStartInfo startInfo = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = "\"" + serverJsPath + "\"",
                    WorkingDirectory = workingDir,
                    UseShellExecute = false
                };

                Process serverProcess = Process.Start(startInfo);
                if (serverProcess != null)
                {
                    serverProcess.WaitForExit();
                }
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("Failed to launch server engine: " + ex.Message);
                Console.ResetColor();
                Console.WriteLine("\nPress any key to exit...");
                Console.ReadKey();
            }
        }
    }
}
