namespace Wx3000.Backend.Models
{
    /// <summary>
    /// 1-1 事務所資料維護的預設事務所資料 (VFP wbase1010)。
    /// base.dbf 為 no / name / data 的鍵值表：000A 名稱、000B 統編、000C 英文名、0001 地址、0002 電話、0003 傳真、0004 負責人、0005 電子郵件、0006 聯絡人；
    /// PubImgPath 是 pub_para.dbf 的數位憑證公用目錄
    /// </summary>
    public class OfficeInfoDto
    {
        public string Name { get; set; } = string.Empty;
        public string TaxNo { get; set; } = string.Empty;
        public string EngName { get; set; } = string.Empty;
        public string Addr { get; set; } = string.Empty;
        public string Tel { get; set; } = string.Empty;
        public string Fax { get; set; } = string.Empty;
        public string Boss { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Contact { get; set; } = string.Empty;
        public string PubImgPath { get; set; } = string.Empty;
    }

    /// <summary>事務所資料檔 cstore.dbf 一列 (VFP wbase1010f4 的表格)；Serial 只用於 VFP 表格的隔列底色</summary>
    public class CstoreDto
    {
        public string No { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Tel { get; set; } = string.Empty;
        public string Fax { get; set; } = string.Empty;
        public string Addr { get; set; } = string.Empty;
        public string Hname { get; set; } = string.Empty;
        public string Linkman { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Engname { get; set; } = string.Empty;
        public int Serial { get; set; }
        public int RecordNumber { get; set; }
    }

    /// <summary>
    /// cstore 存檔。新增時 OrigNo 留空；修改時 OrigNo 與 RecordNumber 為載入時的統號與 RECNO，No 與 OrigNo 不同表示改統號
    /// </summary>
    public class CstoreSaveRequest
    {
        public string? OrigNo { get; set; }
        public int RecordNumber { get; set; }
        public string? No { get; set; }
        public string? Name { get; set; }
        public string? Tel { get; set; }
        public string? Fax { get; set; }
        public string? Addr { get; set; }
        public string? Hname { get; set; }
        public string? Linkman { get; set; }
        public string? Email { get; set; }
        public string? Engname { get; set; }
    }

    /// <summary>cstore 寫入結果；Warning 為主要寫入成功後的附帶問題 (例如刪除後重編序號失敗)</summary>
    public class CstoreSaveResult
    {
        public CstoreDto? Row { get; set; }
        public string? Warning { get; set; }
    }

    /// <summary>事務所資料列印的統號區間 (VFP wbase1010f41 的起始統編 / 結束統編)</summary>
    public class CstorePrintQuery
    {
        public string? NoStart { get; set; }
        public string? NoEnd { get; set; }
    }
}
