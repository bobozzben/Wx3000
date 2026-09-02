using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Wx3000.Backend.Services;

namespace Wx3000.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SystemParamController : ControllerBase
    {
        private readonly ISystemParamService _paramService;

        public SystemParamController(ISystemParamService paramService)
        {
            _paramService = paramService;
        }

        public class SetParamRequest
        {
            public string Schema { get; set; } = "public";
            public string Table { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
            public string Value { get; set; } = string.Empty;
        }

        /// <summary>
        /// 讀取總體參數
        /// GET /api/systemparam?schema=public&table=sys_config&name=COMPANY_NAME
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetParam(
            [FromQuery] string schema = "public",
            [FromQuery] string table = "",
            [FromQuery] string name = "",
            [FromQuery] string defaultValue = "")
        {
            if (string.IsNullOrWhiteSpace(table))
                return BadRequest(new { message = "請指定 Table 名稱 (table)" });
            if (string.IsNullOrWhiteSpace(name))
                return BadRequest(new { message = "請指定 參數名稱 (name)" });

            try
            {
                var val = await _paramService.GetParamAsync(schema, table, name, defaultValue);
                return Ok(new { schema, table, name, value = val });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        /// <summary>
        /// 設定總體參數
        /// POST /api/systemparam
        /// Body: { "schema": "public", "table": "sys_config", "name": "COMPANY_NAME", "value": "宏達企業" }
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> SetParam([FromBody] SetParamRequest req)
        {
            if (req == null)
                return BadRequest(new { message = "請求內容不可為空" });
            if (string.IsNullOrWhiteSpace(req.Table))
                return BadRequest(new { message = "請指定 Table 名稱 (table)" });
            if (string.IsNullOrWhiteSpace(req.Name))
                return BadRequest(new { message = "請指定 參數名稱 (name)" });

            try
            {
                var val = await _paramService.SetParamAsync(req.Schema, req.Table, req.Name, req.Value);
                return Ok(new { schema = req.Schema, table = req.Table, name = req.Name, value = val });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }
    }
}
