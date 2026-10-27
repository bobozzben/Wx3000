using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Wx3000.Backend.Services;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SystemConfigController : ControllerBase
    {
        private readonly ISystemConfigService _configService;

        public SystemConfigController(ISystemConfigService configService)
        {
            _configService = configService;
        }

        public class SetSystemConfigRequest
        {
            public string DataDrive { get; set; } = "C";
        }

        /// <summary>
        /// 取得當前系統配置 (包含磁碟機代號、是否設定過、DBF 路徑、PostgreSQL Schema)
        /// GET /api/systemconfig
        /// </summary>
        [HttpGet]
        public IActionResult GetConfig()
        {
            var config = _configService.GetCurrentConfig();
            return Ok(config);
        }

        /// <summary>
        /// 檢查指定磁碟機下是否存在 W3000 目錄
        /// GET /api/systemconfig/check-drive?drive=F
        /// </summary>
        [HttpGet("check-drive")]
        public IActionResult CheckDrive([FromQuery] string? drive)
        {
            if (string.IsNullOrWhiteSpace(drive))
            {
                drive = _configService.DataDrive;
            }

            var result = _configService.CheckDrive(drive);
            return Ok(result);
        }

        /// <summary>
        /// 儲存並套用資料來源磁碟機代號，自動更新 PostgreSQL Schema 與 DBF 路徑
        /// POST /api/systemconfig
        /// Body: { "dataDrive": "F" }
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> SetConfig([FromBody] SetSystemConfigRequest req)
        {
            if (req == null || string.IsNullOrWhiteSpace(req.DataDrive))
            {
                return BadRequest(new { success = false, message = "請指定有效的資料來源磁碟機代號 (例如: C 或 F)" });
            }

            var result = await _configService.SetDataDriveAsync(req.DataDrive);
            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
    }
}
