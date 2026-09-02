using System;
using System.Data;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Wx3000.Backend.Data;

namespace Wx3000.Backend.Services
{
    public class SystemParamService : ISystemParamService
    {
        private readonly AppDbContext _context;

        public SystemParamService(AppDbContext context)
        {
            _context = context;
        }

        private static string QuoteIdentifier(string identifier)
        {
            if (string.IsNullOrWhiteSpace(identifier))
                throw new ArgumentException("Identifier cannot be empty", nameof(identifier));
            
            // 安全跳脫 PostgreSQL 識別碼雙引號以防範 SQL 注入
            return $"\"{identifier.Replace("\"", "\"\"")}\"";
        }

        private async Task EnsureTableExistsAsync(IDbConnection conn, string safeSchema, string safeTable)
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = $@"
                CREATE SCHEMA IF NOT EXISTS {safeSchema};
                CREATE TABLE IF NOT EXISTS {safeSchema}.{safeTable} (
                    ""名稱"" TEXT PRIMARY KEY,
                    ""數值"" TEXT
                );
                ALTER TABLE {safeSchema}.{safeTable} ADD COLUMN IF NOT EXISTS ""名稱"" TEXT;
                ALTER TABLE {safeSchema}.{safeTable} ADD COLUMN IF NOT EXISTS ""數值"" TEXT;
            ";
            await ((System.Data.Common.DbCommand)cmd).ExecuteNonQueryAsync();
        }

        public async Task<string> GetParamAsync(string schema, string table, string name, string defaultValue = "")
        {
            if (string.IsNullOrWhiteSpace(schema)) schema = "public";
            if (string.IsNullOrWhiteSpace(table)) throw new ArgumentException("Table 名稱不可為空", nameof(table));
            if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("參數名稱不可為空", nameof(name));

            var safeSchema = QuoteIdentifier(schema);
            var safeTable = QuoteIdentifier(table);
            var fullTableName = $"{safeSchema}.{safeTable}";

            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open)
            {
                await conn.OpenAsync();
            }

            // 1. 自動確保 Schema 及 Table 存在
            await EnsureTableExistsAsync(conn, safeSchema, safeTable);

            // 2. 尋找欄位 "名稱"
            using (var selectCmd = conn.CreateCommand())
            {
                selectCmd.CommandText = $"SELECT \"數值\" FROM {fullTableName} WHERE \"名稱\" = @name LIMIT 1;";
                var pName = selectCmd.CreateParameter();
                pName.ParameterName = "@name";
                pName.Value = name;
                selectCmd.Parameters.Add(pName);

                var result = await ((System.Data.Common.DbCommand)selectCmd).ExecuteScalarAsync();
                if (result != null && result != DBNull.Value)
                {
                    return result.ToString() ?? defaultValue;
                }
            }

            // 3. 找不到會自動增加一列，預設值是空白 (或帶入之預設值)
            using (var insertCmd = conn.CreateCommand())
            {
                insertCmd.CommandText = $@"
                    INSERT INTO {fullTableName} (""名稱"", ""數值"") 
                    VALUES (@name, @val);";
                
                var pName = insertCmd.CreateParameter();
                pName.ParameterName = "@name";
                pName.Value = name;
                insertCmd.Parameters.Add(pName);

                var pVal = insertCmd.CreateParameter();
                pVal.ParameterName = "@val";
                pVal.Value = defaultValue ?? string.Empty;
                insertCmd.Parameters.Add(pVal);

                try
                {
                    await ((System.Data.Common.DbCommand)insertCmd).ExecuteNonQueryAsync();
                }
                catch
                {
                    // 若有並行插入導致鍵值衝突，忽略並回傳
                }
            }

            return defaultValue ?? string.Empty;
        }

        public async Task<string> SetParamAsync(string schema, string table, string name, string value)
        {
            if (string.IsNullOrWhiteSpace(schema)) schema = "public";
            if (string.IsNullOrWhiteSpace(table)) throw new ArgumentException("Table 名稱不可為空", nameof(table));
            if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("參數名稱不可為空", nameof(name));

            var safeSchema = QuoteIdentifier(schema);
            var safeTable = QuoteIdentifier(table);
            var fullTableName = $"{safeSchema}.{safeTable}";

            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open)
            {
                await conn.OpenAsync();
            }

            // 1. 自動確保 Schema 及 Table 存在
            await EnsureTableExistsAsync(conn, safeSchema, safeTable);

            var valToSet = value ?? string.Empty;

            // 2. 先嘗試更新已有資料
            int rowsAffected = 0;
            using (var updateCmd = conn.CreateCommand())
            {
                updateCmd.CommandText = $"UPDATE {fullTableName} SET \"數值\" = @val WHERE \"名稱\" = @name;";
                
                var pName = updateCmd.CreateParameter();
                pName.ParameterName = "@name";
                pName.Value = name;
                updateCmd.Parameters.Add(pName);

                var pVal = updateCmd.CreateParameter();
                pVal.ParameterName = "@val";
                pVal.Value = valToSet;
                updateCmd.Parameters.Add(pVal);

                rowsAffected = await ((System.Data.Common.DbCommand)updateCmd).ExecuteNonQueryAsync();
            }

            // 3. 找不到則自動新增一列
            if (rowsAffected == 0)
            {
                using (var insertCmd = conn.CreateCommand())
                {
                    insertCmd.CommandText = $"INSERT INTO {fullTableName} (\"名稱\", \"數值\") VALUES (@name, @val);";

                    var pName = insertCmd.CreateParameter();
                    pName.ParameterName = "@name";
                    pName.Value = name;
                    insertCmd.Parameters.Add(pName);

                    var pVal = insertCmd.CreateParameter();
                    pVal.ParameterName = "@val";
                    pVal.Value = valToSet;
                    insertCmd.Parameters.Add(pVal);

                    await ((System.Data.Common.DbCommand)insertCmd).ExecuteNonQueryAsync();
                }
            }

            return valToSet;
        }
    }
}
