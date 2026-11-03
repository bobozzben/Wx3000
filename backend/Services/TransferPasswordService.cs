using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace Wx3000.Backend.Services
{
    /// <summary>
    /// 轉檔列印密碼 (VFP w3000func.prg w_get_password_2)：2-2 客戶資料匯出、2-3 客戶資料匯入進入前檢查。
    /// motherp.txt 共 200 bytes：前 100 bytes 是回存母版密碼，第 101–110 bytes 是轉檔列印密碼 (6-2 變更)。
    /// 比對只在後端進行；主密碼不可出現在前端、API 回應、log 或文件中。
    /// </summary>
    public static class TransferPasswordService
    {
        public const string PasswordFile = "motherp.txt";
        public const int PasswordBytes = 10;
        private const int SegmentOffset = 100;

        // VFP 寫死的主密碼 (任何事務所都可用它通過)。版本庫是公開的，只保存 Big5 位元組的加鹽 PBKDF2-SHA256 雜湊，不放明文
        private const int MasterIterations = 210000;
        private static readonly byte[] MasterSalt = Convert.FromHexString("98F9A912CFEE01E9A64962F116165809");
        private static readonly byte[] MasterHash = Convert.FromHexString("86194468342FF94C951F5F8ACB6CFA452373039846BC0893CFF464C866FF9449");

        private static readonly Encoding Big5 = CreateBig5();

        private static Encoding CreateBig5()
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            return Encoding.GetEncoding(950);
        }

        /// <summary>VFP：Left(輸入,10) == 主密碼 Or Left(輸入,10) == Left(decrypts(密碼段),10)</summary>
        public static bool Verify(string dbfPath, string? input)
        {
            var typed = ToVfpInput(input);
            return IsMasterPassword(typed) || CryptographicOperations.FixedTimeEquals(typed, ReadStoredPassword(dbfPath));
        }

        private static bool IsMasterPassword(byte[] typed) =>
            CryptographicOperations.FixedTimeEquals(
                Rfc2898DeriveBytes.Pbkdf2(typed, MasterSalt, MasterIterations, HashAlgorithmName.SHA256, MasterHash.Length),
                MasterHash);

        /// <summary>VFP 的輸入框綁定 Space(10)，輸入值固定 10 bytes、不足補空白</summary>
        private static byte[] ToVfpInput(string? input)
        {
            var bytes = Big5.GetBytes(input ?? string.Empty);
            var padded = Enumerable.Repeat((byte)' ', PasswordBytes).ToArray();
            Array.Copy(bytes, padded, Math.Min(bytes.Length, PasswordBytes));
            return padded;
        }

        /// <summary>
        /// 檔案不存在或密碼段為空 (VFP Empty：只有空白、Tab、CR、LF) 時，密碼是 10 個空白。
        /// decrypts 第 i 個 byte (1–10) 為 (byte - i) mod 256；密碼段不足 10 bytes 時，VFP 以 Asc("") = 0 計算
        /// (VFP decrypts 另有遇到特定機構名稱時不解密的例外，那是為名稱欄位設計，密碼段不會出現)
        /// </summary>
        private static byte[] ReadStoredPassword(string dbfPath)
        {
            var blank = Enumerable.Repeat((byte)' ', PasswordBytes).ToArray();
            var file = Path.Combine(dbfPath, PasswordFile);
            if (!File.Exists(file)) return blank;

            byte[] content;
            using (var fs = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
            using (var ms = new MemoryStream())
            {
                fs.CopyTo(ms);
                content = ms.ToArray();
            }
            var segment = content.Skip(SegmentOffset).ToArray();
            if (segment.All(b => b == (byte)' ' || b == (byte)'\t' || b == (byte)'\r' || b == (byte)'\n')) return blank;

            var plain = new byte[PasswordBytes];
            for (var i = 0; i < PasswordBytes; i++)
            {
                var b = i < segment.Length ? segment[i] : 0;
                plain[i] = (byte)((b - (i + 1) + 256) % 256);
            }
            return plain;
        }
    }
}
