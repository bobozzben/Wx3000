using System;
using Wx3000.Backend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;

namespace Wx3000.Backend.Data
{
    public static class DbInitializer
    {
        public static void Initialize(AppDbContext context, string schema = "c:/w3000/comm")
        {
            var databaseCreator = context.Database.GetService<IDatabaseCreator>() as RelationalDatabaseCreator;
            if (databaseCreator != null)
            {
                if (!databaseCreator.Exists())
                {
                    databaseCreator.Create();
                }

                EnsureSchemaInitialized(context, schema);
            }
            else
            {
                context.Database.EnsureCreated();
            }
        }

        public static void EnsureSchemaInitialized(AppDbContext context, string schema)
        {
            if (string.IsNullOrWhiteSpace(schema))
            {
                schema = "c:/w3000/comm";
            }
            var safeSchema = schema.Replace("\"", "\"\"");

            try
            {
                var sql = $@"
                    -- 1. 建立 Schema
                    CREATE SCHEMA IF NOT EXISTS ""{safeSchema}"";

                    -- 2. 會計師/記帳士 (cpa)
                    CREATE TABLE IF NOT EXISTS ""{safeSchema}"".cpa (
                        _record_number integer NOT NULL DEFAULT 0,
                        no character varying(255) NOT NULL DEFAULT '',
                        name character varying(255) NOT NULL DEFAULT '',
                        id character varying(255) NOT NULL DEFAULT '',
                        cno1 character varying(255) NOT NULL DEFAULT '',
                        cno2 character varying(255) NOT NULL DEFAULT '',
                        tel character varying(255) NOT NULL DEFAULT '',
                        fax character varying(255) NOT NULL DEFAULT '',
                        unino character varying(255) NOT NULL DEFAULT '',
                        serial numeric(4,0) NOT NULL DEFAULT 0,
                        gno1 character varying(255) NOT NULL DEFAULT '',
                        gno2 character varying(255) NOT NULL DEFAULT '',
                        cword character varying(255) NOT NULL DEFAULT '',
                        addr character varying(255) NOT NULL DEFAULT '',
                        kind character varying(255) NOT NULL DEFAULT '',
                        hno1 character varying(255) NOT NULL DEFAULT '',
                        hno2 character varying(255) NOT NULL DEFAULT '',
                        gno3 character varying(255) NOT NULL DEFAULT '',
                        mobile character varying(255) NOT NULL DEFAULT '',
                        email character varying(255) NOT NULL DEFAULT '',
                        CONSTRAINT PK_cpa PRIMARY KEY (no)
                    );

                    -- 3. 建檔人員/員工 (keyin)
                    CREATE TABLE IF NOT EXISTS ""{safeSchema}"".keyin (
                        _record_number integer NOT NULL DEFAULT 0,
                        no character varying(255) NOT NULL DEFAULT '',
                        name character varying(255) NOT NULL DEFAULT '',
                        psw character varying(255) NOT NULL DEFAULT '',
                        birthday character varying(255) NOT NULL DEFAULT '',
                        tel character varying(255) NOT NULL DEFAULT '',
                        addr character varying(255) NOT NULL DEFAULT '',
                        id character varying(255) NOT NULL DEFAULT '',
                        memo character varying(255) NOT NULL DEFAULT '',
                        term character varying(255) NOT NULL DEFAULT '',
                        cost numeric(6,0) NOT NULL DEFAULT 0,
                        level character varying(255) NOT NULL DEFAULT '',
                        serial numeric(4,0) NOT NULL DEFAULT 0,
                        oneuserid character varying(255) NOT NULL DEFAULT '',
                        onepassno character varying(255) NOT NULL DEFAULT '',
                        email character varying(255) NOT NULL DEFAULT '',
                        phone character varying(255) NOT NULL DEFAULT '',
                        chkvou character varying(255) NOT NULL DEFAULT '',
                        chkfinrp character varying(255) NOT NULL DEFAULT '',
                        pswnew character varying(255) NOT NULL DEFAULT '',
                        lastpswd character varying(255) NOT NULL DEFAULT '',
                        psw1 character varying(255) NOT NULL DEFAULT '',
                        psw2 character varying(255) NOT NULL DEFAULT '',
                        psw3 character varying(255) NOT NULL DEFAULT '',
                        psw4 character varying(255) NOT NULL DEFAULT '',
                        psw5 character varying(255) NOT NULL DEFAULT '',
                        CONSTRAINT PK_keyin PRIMARY KEY (no)
                    );

                    -- 4. 稅務人員 (taxno)
                    CREATE TABLE IF NOT EXISTS ""{safeSchema}"".taxno (
                        _record_number integer NOT NULL DEFAULT 0,
                        no character varying(255) NOT NULL DEFAULT '',
                        name character varying(255) NOT NULL DEFAULT '',
                        department character varying(255) NOT NULL DEFAULT '',
                        tel character varying(255) NOT NULL DEFAULT '',
                        helpman character varying(255) NOT NULL DEFAULT '',
                        addr character varying(255) NOT NULL DEFAULT '',
                        memo character varying(255) NOT NULL DEFAULT '',
                        serial numeric(4,0) NOT NULL DEFAULT 0,
                        CONSTRAINT PK_taxno PRIMARY KEY (no)
                    );

                    -- 5. 收費項目 (recitem)
                    CREATE TABLE IF NOT EXISTS ""{safeSchema}"".recitem (
                        _record_number integer NOT NULL DEFAULT 0,
                        itemno character varying(255) NOT NULL DEFAULT '',
                        item character varying(255) NOT NULL DEFAULT '',
                        amt numeric(20,4) NOT NULL DEFAULT 0,
                        CONSTRAINT PK_recitem PRIMARY KEY (itemno)
                    );

                    -- 6. 備註資料 (recmemo)
                    CREATE TABLE IF NOT EXISTS ""{safeSchema}"".recmemo (
                        _record_number integer NOT NULL DEFAULT 0,
                        mno character varying(255) NOT NULL DEFAULT '',
                        memo text NOT NULL DEFAULT '',
                        tx character varying(255) NOT NULL DEFAULT '',
                        CONSTRAINT PK_recmemo PRIMARY KEY (mno)
                    );

                    -- 7. 收費摘要 (recnote)
                    CREATE TABLE IF NOT EXISTS ""{safeSchema}"".recnote (
                        _record_number integer NOT NULL DEFAULT 0,
                        noteno character varying(255) NOT NULL DEFAULT '',
                        note character varying(255) NOT NULL DEFAULT '',
                        CONSTRAINT PK_recnote PRIMARY KEY (noteno)
                    );

                    -- 8. 客戶基本資料 (customer)
                    CREATE TABLE IF NOT EXISTS ""{safeSchema}"".customer (
                        _record_number integer NOT NULL DEFAULT 0,
                        no character varying(255) NOT NULL DEFAULT '',
                        name character varying(255) NOT NULL DEFAULT '',
                        addr character varying(255) NOT NULL DEFAULT '',
                        unino character varying(255) NOT NULL DEFAULT '',
                        taxno character varying(255) NOT NULL DEFAULT '',
                        tel character varying(255) NOT NULL DEFAULT '',
                        fax character varying(255) NOT NULL DEFAULT '',
                        capital numeric NOT NULL DEFAULT 0,
                        abbr character varying(255) NOT NULL DEFAULT '',
                        engname character varying(255) NOT NULL DEFAULT '',
                        hname character varying(255) NOT NULL DEFAULT '',
                        hidno character varying(255) NOT NULL DEFAULT '',
                        haddr character varying(255) NOT NULL DEFAULT '',
                        email character varying(255) NOT NULL DEFAULT '',
                        offno character varying(255) NOT NULL DEFAULT '',
                        linkman character varying(255) NOT NULL DEFAULT '',
                        linkmobile character varying(255) NOT NULL DEFAULT '',
                        memo01 character varying(255) NOT NULL DEFAULT '',
                        serial numeric(4,0) NOT NULL DEFAULT 0,
                        CONSTRAINT PK_customer PRIMARY KEY (no)
                    );

                    -- 9. 購買地點 (place)
                    CREATE TABLE IF NOT EXISTS ""{safeSchema}"".place (
                        _record_number integer NOT NULL DEFAULT 0,
                        no character varying(255) NOT NULL DEFAULT '',
                        place character varying(255) NOT NULL DEFAULT '',
                        addr character varying(255) NOT NULL DEFAULT '',
                        serial numeric(4,0) NOT NULL DEFAULT 0,
                        linkman character varying(255) NOT NULL DEFAULT '',
                        linktel character varying(255) NOT NULL DEFAULT '',
                        CONSTRAINT PK_place PRIMARY KEY (no)
                    );

                    -- 10. 發票購買 (buyinv)
                    CREATE TABLE IF NOT EXISTS ""{safeSchema}"".buyinv (
                        _record_number integer NOT NULL DEFAULT 0,
                        seq numeric(4,0) NOT NULL DEFAULT 0,
                        no character varying(255) NOT NULL DEFAULT '',
                        name character varying(255) NOT NULL DEFAULT '',
                        unino character varying(255) NOT NULL DEFAULT '',
                        taxno character varying(255) NOT NULL DEFAULT '',
                        yymm character varying(255) NOT NULL DEFAULT '',
                        times character varying(255) NOT NULL DEFAULT '1',
                        a02 numeric(6,0) NOT NULL DEFAULT 0,
                        a02b numeric(6,0) NOT NULL DEFAULT 0,
                        a03 numeric(6,0) NOT NULL DEFAULT 0,
                        a03b numeric(6,0) NOT NULL DEFAULT 0,
                        spec numeric(6,0) NOT NULL DEFAULT 0,
                        c02 numeric(6,0) NOT NULL DEFAULT 0,
                        c03 numeric(6,0) NOT NULL DEFAULT 0,
                        c03b numeric(6,0) NOT NULL DEFAULT 0,
                        serial numeric(4,0) NOT NULL DEFAULT 0,
                        tranflg boolean NOT NULL DEFAULT false,
                        buydate character varying(255) NOT NULL DEFAULT '',
                        a02beg character varying(255) NOT NULL DEFAULT '',
                        a02begno character varying(255) NOT NULL DEFAULT '',
                        a02endno character varying(255) NOT NULL DEFAULT '',
                        a02bbeg character varying(255) NOT NULL DEFAULT '',
                        a02bbegno character varying(255) NOT NULL DEFAULT '',
                        a02bendno character varying(255) NOT NULL DEFAULT '',
                        a03beg character varying(255) NOT NULL DEFAULT '',
                        a03begno character varying(255) NOT NULL DEFAULT '',
                        a03endno character varying(255) NOT NULL DEFAULT '',
                        a03bbeg character varying(255) NOT NULL DEFAULT '',
                        a03bbegno character varying(255) NOT NULL DEFAULT '',
                        a03bendno character varying(255) NOT NULL DEFAULT '',
                        specbeg character varying(255) NOT NULL DEFAULT '',
                        specbegno character varying(255) NOT NULL DEFAULT '',
                        specendno character varying(255) NOT NULL DEFAULT '',
                        c02beg character varying(255) NOT NULL DEFAULT '',
                        c02begno character varying(255) NOT NULL DEFAULT '',
                        c02endno character varying(255) NOT NULL DEFAULT '',
                        c03beg character varying(255) NOT NULL DEFAULT '',
                        c03begno character varying(255) NOT NULL DEFAULT '',
                        c03endno character varying(255) NOT NULL DEFAULT '',
                        c03bbeg character varying(255) NOT NULL DEFAULT '',
                        c03bbegno character varying(255) NOT NULL DEFAULT '',
                        c03bendno character varying(255) NOT NULL DEFAULT '',
                        preseq numeric NOT NULL DEFAULT 0,
                        tkey numeric NOT NULL DEFAULT 0,
                        trano character varying(255) NOT NULL DEFAULT '',
                        CONSTRAINT PK_buyinv PRIMARY KEY (_record_number)
                    );

                    -- 補齊既有 keyin, buyinv 與 customer 可能缺漏之欄位 (自動修復歷史 Schema)
                    ALTER TABLE ""{safeSchema}"".keyin
                        ADD COLUMN IF NOT EXISTS psw character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS birthday character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS tel character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS addr character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS id character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS memo character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS oneuserid character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS onepassno character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS phone character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS email character varying(255) NOT NULL DEFAULT '';

                    ALTER TABLE ""{safeSchema}"".customer
                        ADD COLUMN IF NOT EXISTS placeno character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS keyin character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS invaddr character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS acctype character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS mobile character varying(255) NOT NULL DEFAULT '';

                    ALTER TABLE ""{safeSchema}"".buyinv
                        ADD COLUMN IF NOT EXISTS a02beg character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS a02begno character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS a02endno character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS a02bbeg character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS a02bbegno character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS a02bendno character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS a03beg character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS a03begno character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS a03endno character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS a03bbeg character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS a03bbegno character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS a03bendno character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS specbeg character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS specbegno character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS specendno character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS c02beg character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS c02begno character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS c02endno character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS c03beg character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS c03begno character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS c03endno character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS c03bbeg character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS c03bbegno character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS c03bendno character varying(255) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS preseq numeric NOT NULL DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS tkey numeric NOT NULL DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS trano character varying(255) NOT NULL DEFAULT '';
                ";
                context.Database.ExecuteSqlRaw(sql);
            }
            catch
            {
                context.Database.EnsureCreated();
            }
        }
    }
}
