using System;
using Npgsql;

class Program
{
    static void Main()
    {
        var connStr = "Host=localhost;Port=5432;Database=a3000;Username=postgres;Password=0000";
        try
        {
            using var conn = new NpgsqlConnection(connStr);
            conn.Open();
            Console.WriteLine("Connected to PostgreSQL database 'a3000' successfully!");

            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT table_schema, table_name 
                FROM information_schema.tables 
                WHERE table_name LIKE '%收費%' OR table_name LIKE '%費%'
                ORDER BY table_schema, table_name;
            ";
            using var r = cmd.ExecuteReader();
            Console.WriteLine("=== TABLES MATCHING '收費' or '費' IN DATABASE a3000 ===");
            var matchTables = new System.Collections.Generic.List<(string schema, string name)>();
            while (r.Read())
            {
                var s = r.GetString(0);
                var t = r.GetString(1);
                matchTables.Add((s, t));
                Console.WriteLine($"Schema: '{s}' | Table: '{t}'");
            }
            r.Close();

            foreach (var (s, t) in matchTables)
            {
                Console.WriteLine($"\n--- Columns of '{s}'.'{t}' ---");
                using var cmdCol = conn.CreateCommand();
                cmdCol.CommandText = $@"
                    SELECT column_name, data_type, character_maximum_length 
                    FROM information_schema.columns 
                    WHERE table_schema = '{s}' AND table_name = '{t}'
                    ORDER BY ordinal_position;
                ";
                using var rCol = cmdCol.ExecuteReader();
                while (rCol.Read())
                {
                    var cName = rCol.GetString(0);
                    var cType = rCol.GetString(1);
                    var cLen = rCol.IsDBNull(2) ? "null" : rCol.GetInt32(2).ToString();
                    Console.WriteLine($"   - {cName} ({cType}, max: {cLen})");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("ERROR: " + ex.Message);
        }
    }
}

