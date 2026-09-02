using System.Threading.Tasks;

namespace Wx3000.Backend.Services
{
    public interface ISystemParamService
    {
        /// <summary>
        /// 讀取總體參數。若找不到會自動新增一列，預設值為空白字串。
        /// </summary>
        Task<string> GetParamAsync(string schema, string table, string name, string defaultValue = "");

        /// <summary>
        /// 設定總體參數。若找不到會自動新增一列。
        /// </summary>
        Task<string> SetParamAsync(string schema, string table, string name, string value);
    }
}
