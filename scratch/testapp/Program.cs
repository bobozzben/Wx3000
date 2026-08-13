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

            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'e3000__comm' AND table_name = '公司資料'
                ORDER BY ordinal_position
                LIMIT 50;
            ";
            using var r = cmd.ExecuteReader();
            int i = 1;
            while (r.Read())
            {
                Console.WriteLine($"{i++}. {r.GetString(0)} ({r.GetString(1)})");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("ERROR: " + ex.Message);
        }
    }
}
