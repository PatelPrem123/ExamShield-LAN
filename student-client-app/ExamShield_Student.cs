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

        static void Main(string[] args)
        {
            try
            {
                Console.OutputEncoding = Encoding.UTF8;
            }
            catch { }

            Console.Title = "ExamShield LAN - Student Examination Portal";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("================================================================");
            Console.WriteLine("  ExamShield LAN 🛡️ - Student Examination Portal");
            Console.WriteLine("================================================================");
            Console.ResetColor();
            Console.WriteLine();

            Console.Write("Enter Teacher Host Address (press Enter for localhost:3000): ");
            string input = Console.ReadLine();

            if (string.IsNullOrWhiteSpace(input))
            {
                input = "localhost:3000";
            }

            input = input.Trim();

            // Auto-format protocol and port
            if (!input.StartsWith("http://", StringComparison.OrdinalIgnoreCase) && 
                !input.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                if (!input.Contains(":"))
                {
                    input = input + ":3000";
                }
                input = "http://" + input;
            }

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine();
            Console.WriteLine("🚀 Opening Secure Exam Application: " + input);
            Console.ResetColor();

            string browser = FindBrowser();
            try
            {
                if (!string.IsNullOrEmpty(browser))
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = browser,
                        Arguments = "--app=\"" + input + "\" --start-maximized",
                        UseShellExecute = true
                    };
                    Process.Start(psi);
                }
                else
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = input,
                        UseShellExecute = true
                    };
                    Process.Start(psi);
                }
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("Error launching browser: " + ex.Message);
                Console.ResetColor();
                Console.WriteLine("\nPress any key to exit...");
                Console.ReadKey();
                return;
            }

            Thread.Sleep(1500);
        }
    }
}
