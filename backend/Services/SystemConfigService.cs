using System;
using System.IO;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Wx3000.Backend.Data;

namespace Wx3000.Backend.Services
{
    public class SystemConfigService : ISystemConfigService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<SystemConfigService> _logger;
        private readonly string _configFilePath;
        private readonly object _lock = new object();

        private string _configuredDrive = "C";
        private bool _isConfigured = false;

        private class ConfigModel
        {
            public string DataDrive { get; set; } = "C";
            public bool IsConfigured { get; set; } = false;
        }

        public SystemConfigService(
            IHttpContextAccessor httpContextAccessor,
            IServiceProvider serviceProvider,
            ILogger<SystemConfigService> logger)
        {
            _httpContextAccessor = httpContextAccessor;
            _serviceProvider = serviceProvider;
            _logger = logger;
            _configFilePath = Path.Combine(AppContext.BaseDirectory, "system_config.json");

            LoadConfig();
        }

        private void LoadConfig()
        {
            lock (_lock)
            {
                try
                {
                    if (File.Exists(_configFilePath))
                    {
                        var json = File.ReadAllText(_configFilePath);
                        var model = JsonSerializer.Deserialize<ConfigModel>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        if (model != null && !string.IsNullOrWhiteSpace(model.DataDrive))
                        {
                            _configuredDrive = NormalizeDrive(model.DataDrive);
                            _isConfigured = model.IsConfigured;
                            _logger.LogInformation("[SystemConfig] 已載入磁碟機設定: {Drive}: (IsConfigured: {IsConfigured})", _configuredDrive, _isConfigured);
                            return;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[SystemConfig] 讀取 system_config.json 失敗，使用預設值 C: 碟");
                }

                _configuredDrive = "C";
                _isConfigured = false;
            }
        }

        private void SaveConfig()
        {
            lock (_lock)
            {
                try
                {
                    var model = new ConfigModel
                    {
                        DataDrive = _configuredDrive,
                        IsConfigured = _isConfigured
                    };
                    var json = JsonSerializer.Serialize(model, new JsonSerializerOptions { WriteIndented = true });
                    File.WriteAllText(_configFilePath, json);
                    _logger.LogInformation("[SystemConfig] 已儲存磁碟機設定至 {Path}: {Drive}:", _configFilePath, _configuredDrive);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[SystemConfig] 儲存 system_config.json 失敗");
                }
            }
        }

        public static string NormalizeDrive(string? drive)
        {
            if (string.IsNullOrWhiteSpace(drive)) return "C";
            var trimmed = drive.Trim().ToUpperInvariant();
            // 磁碟機代號必須為單一英文字母 A-Z (例如 "C" 或 "C:")
            var match = Regex.Match(trimmed, @"^([A-Z])(?::.*)?$");
            if (match.Success)
            {
                return match.Groups[1].Value;
            }
            return "C";
        }

        public string DataDrive
        {
            get
            {
                // 若請求標頭中有明確指定 X-Data-Drive，以標頭為準
                try
                {
                    var httpContext = _httpContextAccessor.HttpContext;
                    if (httpContext != null && httpContext.Request.Headers.TryGetValue("X-Data-Drive", out var headerVal))
                    {
                        var raw = headerVal.ToString();
                        if (!string.IsNullOrWhiteSpace(raw))
                        {
                            return NormalizeDrive(raw);
                        }
                    }
                }
                catch
                {
                    // 忽略 HTTP Context 例外
                }

                return _configuredDrive;
            }
        }

        public bool IsConfigured => _isConfigured;

        public string CurrentDbfPath => $@"{DataDrive}:\w3000\comm";

        public string CurrentPgSchema => $"{DataDrive.ToLowerInvariant()}:/w3000/comm";

        public CheckDriveResult CheckDrive(string? drive)
        {
            var targetDrive = NormalizeDrive(drive);
            var targetDir = $@"{targetDrive}:\w3000";

            try
            {
                var exists = Directory.Exists(targetDir);
                if (exists)
                {
                    return new CheckDriveResult
                    {
                        Success = true,
                        Exists = true,
                        Drive = targetDrive,
                        Path = targetDir,
                        Message = $"磁碟機 {targetDrive}: 檢查通過，已偵測到 W3000 目錄"
                    };
                }
                else
                {
                    return new CheckDriveResult
                    {
                        Success = false,
                        Exists = false,
                        Drive = targetDrive,
                        Path = targetDir,
                        Message = $"磁碟機 {targetDrive}: 下找不到 W3000 目錄 (路徑: {targetDir} 不存在)"
                    };
                }
            }
            catch (Exception ex)
            {
                return new CheckDriveResult
                {
                    Success = false,
                    Exists = false,
                    Drive = targetDrive,
                    Path = targetDir,
                    Message = $"檢查磁碟機 {targetDrive}: 發生例外: {ex.Message}"
                };
            }
        }

        public async Task<SystemConfigResult> SetDataDriveAsync(string drive)
        {
            var targetDrive = NormalizeDrive(drive);
            var checkRes = CheckDrive(targetDrive);
            if (!checkRes.Exists)
            {
                return new SystemConfigResult
                {
                    Success = false,
                    DataDrive = targetDrive,
                    IsConfigured = _isConfigured,
                    CurrentDbfPath = $@"{targetDrive}:\w3000\comm",
                    CurrentPgSchema = $"{targetDrive.ToLowerInvariant()}:/w3000/comm",
                    Message = checkRes.Message
                };
            }

            _configuredDrive = targetDrive;
            _isConfigured = true;
            SaveConfig();

            var newSchema = $"{targetDrive.ToLowerInvariant()}:/w3000/comm";

            // 確保 PostgreSQL Schema 與 Table 在資料庫中存在
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                
                // 執行 SQL 建立 Schema
                var safeSchema = newSchema.Replace("\"", "\"\"");
                var createSchemaSql = $"CREATE SCHEMA IF NOT EXISTS \"{safeSchema}\";";
                await dbContext.Database.ExecuteSqlRawAsync(createSchemaSql);
                // 確保 Schema 下 9 大資料表結構就緒
                DbInitializer.EnsureSchemaInitialized(dbContext, newSchema);

                _logger.LogInformation("[SystemConfig] 已成功切換至磁碟機 {Drive}:，PostgreSQL Schema 更新為 \"{Schema}\"", _configuredDrive, newSchema);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SystemConfig] 初始化 PostgreSQL Schema \"{Schema}\" 時發生錯誤: {Message}", newSchema, ex.Message);
            }

            return GetCurrentConfig();
        }

        public SystemConfigResult GetCurrentConfig()
        {
            return new SystemConfigResult
            {
                Success = true,
                DataDrive = _configuredDrive,
                IsConfigured = _isConfigured,
                CurrentDbfPath = CurrentDbfPath,
                CurrentPgSchema = CurrentPgSchema,
                Message = "設定取得成功"
            };
        }
    }
}
