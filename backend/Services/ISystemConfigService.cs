using System;
using System.Threading.Tasks;

namespace Wx3000.Backend.Services
{
    public class CheckDriveResult
    {
        public bool Success { get; set; }
        public bool Exists { get; set; }
        public string Drive { get; set; } = string.Empty;
        public string Path { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }

    public class SystemConfigResult
    {
        public bool Success { get; set; }
        public string DataDrive { get; set; } = "C";
        public bool IsConfigured { get; set; }
        public string CurrentDbfPath { get; set; } = @"C:\w3000\comm";
        public string CurrentPgSchema { get; set; } = "c:/w3000/comm";
        public string Message { get; set; } = string.Empty;
    }

    public interface ISystemConfigService
    {
        string DataDrive { get; }
        bool IsConfigured { get; }
        string CurrentDbfPath { get; }
        string CurrentPgSchema { get; }
        CheckDriveResult CheckDrive(string? drive);
        Task<SystemConfigResult> SetDataDriveAsync(string drive);
        SystemConfigResult GetCurrentConfig();
    }
}
