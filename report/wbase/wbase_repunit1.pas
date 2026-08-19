Unit wbase_Repunit1;

{$mode ObjFPC}{$H+}

Interface

Uses
  Interfaces, // this includes the LCL widgetset
  Classes, SysUtils, Forms,Controls, Dialogs,Clipbrd;

Procedure InitVariable();
Procedure myClipboard(str: String);
// 寫入字串到檔案
Procedure WriteStrToFile(WriteStr, FileName: String; ClearFile: Boolean = False);
// 寫入字串到檔案 Debug 用
Procedure WriteStrToFile_Debug(WriteStr: String; FileName: String = 'C:\BENDEBUG.TXT\myLOG_Lazarus.txt'; ClearFile: Boolean = False);


//Function waccrep3101_b(): integer; stdcall;
Function waccrep3101_b(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; const fpath: AnsiString): integer; stdcall;

Implementation

Uses
  wbase_unit1, util_frxprintpreviewform;

Var
  frmRpt: TfrmfrxRpt1; // 日記帳

Procedure InitVariable();
Begin

End;

Procedure myClipboard(str: String);

  Procedure Str2Clipboard(Const Str: String; iDelayMs: Integer);
  Const
    MaxRetries = 5;
  Var
    RetryCount: Integer;
  Begin
    For RetryCount := 1 To MaxRetries Do Begin
      Try
        //inc(RetryCount);
        Clipboard.AsText := Str;
        Break;
      Except
        On Exception Do If RetryCount = MaxRetries Then Raise Exception.Create('Cannot set clipboard')
          Else
            Sleep(iDelayMs)
      End;
    End;
  End;
Begin
  //Debug 時候才會出現
  If DirectoryExists('C:\BENDEBUG.TXT') Then Begin
    //If FileExists('C:\cc.txt') Then
    Str2Clipboard(Str, 1500);
  End;
End;

Procedure WriteStrToFile_Debug(WriteStr: String; FileName: String = 'C:\BENDEBUG.TXT\myLOG_Lazarus.txt'; ClearFile: Boolean = False);
// 寫入字串到檔案 Debug 用
Var
  NowStr: String;
Begin
  If (DirectoryExists('C:\BENDEBUG.TXT')) Or
    (FileExists(ExtractFilePath(Application.ExeName) + 'DEBUG.TXT')) Then Begin
    If FileExists(ExtractFilePath(Application.ExeName) + 'DEBUG.TXT') Then // 客戶端的除錯
      FileName := ExtractFilePath(Application.ExeName) + 'DEBUG.Log';

    NowStr := FormatDateTime('yyyy/mm/dd hh:nn:ss.zzz', Now);
    WriteStrToFile(NowStr + ' ' + WriteStr, FileName, ClearFile);
  End;
End;

Procedure WriteStrToFile(WriteStr, FileName: String; ClearFile: Boolean = False);
// 寫入字串到檔案
Var
  SL: TStringList;
Begin
  SL := TStringList.Create;
  If FileExists(FileName) Then Begin
    SL.LoadFromFile(FileName);
    If ClearFile Then SL.Clear;
  End;
  SL.Add(WriteStr);
  SL.DefaultEncoding := TEncoding.UTF8;
  SL.SaveToFile(FileName);
  FreeAndNil(SL);
End;



Function Try_Connect(): boolean; // 重新連線
Begin
  Result := False;
  // 開始連線 TZConnection
  With frmRpt.ZConnection1 Do Begin
    // 連線參數
    HostName := '192.168.5.51';
    Port := 5432; // 注音=ㄅㄨˋ
    Database := 'a3000';
    User := 'postgres';
    Password := '0000';
    protocol := 'postgresql';
    LibraryLocation := 'C:\A3000\WHAN\PG16DLL\libpq.dll';
    DisConnect; // 斷線
    Try
      Connect;    // 再連線
    Finally

    End;
    If Not Connected Then ShowMessage('尚未與資料庫連線，無法登入。');
    Result := Connected; // 返回連線成功
  End;
End;


//Function waccrep3101_b(): integer; stdcall;
//Function waccrep3101_b(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer): integer; stdcall;
Function waccrep3101_b(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; const fpath: AnsiString): integer; stdcall;
Begin
  //  Application.Handle := vMainAppHandle;
  Result := 0;
  //{$IfDef CPU64}
  //ShowMessage('目前主程式是：64位元 (x64)');
  //{$Else}
  //ShowMessage('目前主程式是：32位元 (x86)');
  //{$EndIf}

  Try
    // Showmessage('OK');
    Try
      WriteStrToFile_Debug('Application.Name: ' + Application.Name);

      frmRpt := Application.FindComponent('frmfrxRpt1') As TfrmfrxRpt1;
      If frmRpt = nil Then Begin
        WriteStrToFile_Debug('Create Form TfrmfrxRpt1: ');
        frmRpt := TfrmfrxRpt1.Create(Application);
        // 關鍵修正 1：明確將 Parent 設定為 nil，避免被誤當成 Child control
        frmRpt.Parent := nil;
        frmRpt.FormStyle := fsNormal;
        frmRpt.ParentWindow := 0;

      End;
      frmRpt.Caption := '日記帳';
      Try_Connect;
      frmRpt.ZQuery1.Connection := frmRpt.ZConnection1;  //SELECT * FROM e3000__comm."建檔人員" ORDER BY "建檔人員編號" ASC
      frmRpt.ZQuery1.SQL.Add(Format('Select * from "%s"."%s" Order by "%s" ', ['e3000__comm', '建檔人員', '建檔人員編號']));
      frmRpt.ZQuery1.active := True;
      if frmRpt.ZQuery1.active Then Begin
         WriteStrToFile_Debug('Pg Open ');
      end;
      bbShowPreviewForm_Preview(frmRpt, frmRpt.frxReport1, [frmRpt.frxDBDataset1], [frmRpt.ZQuery1], '', '', '', 0, 0, 0, 0);
     // frmRpt.ShowModal;
      FreeAndNil(frmRpt);

    Finally

      frmRpt.Free;
    End;
  Except
    On E: Exception Do Begin
      Result := 1;
      ShowMessage('錯誤訊息:' + E.Message + #10 + '類別:' + E.ClassName);
    End;
  End;
End;



Function wbase2010_b(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer): integer; stdcall;
//Var
//  oQuery:TzQuery;
//  SQL, TmpNa, ResultTmp , OrderBy,AddrKind: String;
Begin
  Result := 0;

 //AddrKind := '1';
 ////if RadioButton10.Checked  Then
 //// AddrKind := '2';
 ////if RadioButton12.Checked  Then
 //// AddrKind := '3';
 //
 //Randomize;
 // With oDM Do Begin
 //   TmpNa := Format('Custom_%d',[ Random(5000)]);
 //   ResultTmp := TmpNa+'_Data' ;
 //   SQL := '';
 //   SQL := SQL +' do $$ ' + #13;
 //   SQL := SQL +'  begin' + #13;
 //   SQL := SQL +'  Drop Table if Exists ' + TmpNa  + ';' + #13;
 //   SQL := SQL +'  Drop Table if Exists ' + ResultTmp  + ';' + #13;
 //   SQL := SQL +'  CREATE temp table ' +TmpNa +' as select "公司編號" From ' + GetSchemaComm.QuotedString('"') + '.' + self.TableName.QuotedString('"') +' Where False ;' + #13;
 //   Self.SelBuFDataset.First;
 //  while Not Self.SelBuFDataset.EOF do  begin
 //
 //   if  Self.SelBuFDataset.FieldByName('複選').AsBoolean Then
 //      SQL := SQL +'  Insert Into ' + TmpNa + '("公司編號") Values (' +  Self.SelBuFDataset.FieldByName('公司編號').AsString.QuotedString()+ ') ; '+#13 ;
 //
 //   Self.SelBuFDataset.Next;
 //  end;
 //   SQL := SQL + ' CREATE temp table ' +ResultTmp +' as ';
 //   SQL := SQL + ' SELECT M.*, T."國稅局名稱", S."名稱" AS "結算營利事業標準名稱" ,CAST(K."建檔人員名稱" AS character varying(30) ) AS "登打人員姓名" ' + #13;
 //   SQL := SQL + ' ,CAST( ' + AddrKind.QuotedString + ' AS character varying(1) ) AS "ADDRKIND"' + #13 ;
 //   SQL := SQL + ' ,CAST( CASE M."工商公司組織" ' + #13 ;
 //   SQL := SQL + '   WHEN ''1'' THEN ''股份有限公司'' ' + #13;
 //   SQL := SQL + '   WHEN ''2'' THEN ''有限'' ' + #13;
 //   SQL := SQL + '   WHEN ''3'' THEN ''無限'' ' + #13;
 //   SQL := SQL + '   WHEN ''4'' THEN ''兩合'' ' + #13;
 //   SQL := SQL + '   WHEN ''5'' THEN ''合夥'' ' + #13;
 //   SQL := SQL + '   WHEN ''6'' THEN ''獨資'' ' + #13;
 //   SQL := SQL + '   WHEN ''7'' THEN ''國外分公司'' ' + #13;
 //   SQL := SQL + '   WHEN ''8'' THEN ''國外辦事處'' ' + #13;
 //   SQL := SQL + '   WHEN ''0'' THEN ''其它'' ' + #13;
 //   SQL := SQL + '   WHEN ''L'' THEN ''合作社'' ' + #13;
 //   SQL := SQL + '   WHEN ''M'' THEN ''有限合夥'' ' + #13;
 //   SQL := SQL + '   ELSE '''' END  AS  character varying(30) )  AS  "結算公司組織名稱"  ' + #13;
 //
 //   SQL := SQL + ' FROM ' + GetSchemaComm + '.' + self.TableName.QuotedString('"') + ' M ' + #13;
 //   SQL := SQL + ' LEFT JOIN ' + GetSchemaRef + '.' + '"國稅局"' + ' T  ON (' + ' T."稽徵單位編號"=M."國稅局"' +' )' + #13;
 //   SQL := SQL + ' LEFT JOIN ' + GetSchemaRef + '.' + '"基本營利事業標準代碼_112"' + ' S  ON (' + ' S."代碼"=M."結算營利事業標準代號"' +' )' + #13;
 //   SQL := SQL + ' LEFT JOIN ' + GetSchemaComm + '.' + '"建檔人員"' + ' K  ON (' + ' K."建檔人員編號"=M."登打人員編號"' +' )' + #13;
 //   SQL := SQL + ' WHERE ( M."公司編號" in (Select  "公司編號" FROM ' + TmpNa  + ' ORDER BY "公司編號" )  ) ' + #13;
 //   OrderBy := 'M."公司編號"';
 //   If RadioButton4.Checked Then Begin
 //      OrderBy := 'M."登打人員編號",M."公司編號" ';
 //   End;
 //   SQL := SQL + '  ORDER BY ' + OrderBy + ';'+ #13;
 //   SQL := SQL + ' end; ' + #13;
 //   SQL := SQL + ' $$ ' + #13;
 //
 //
 //   myClipBoard(SQL);
 //
 //   With self.ZSqlProcessor1 Do Begin
 //     self.ZSqlProcessor1.Connection := oDM.Get_oConn;
 //     Script.Clear;
 //     Script.Add(SQL);
 //     myClipboard(Script.Text);
 //     Execute;
 //   End;
 //
 //   oQuery:=oDM.GetQuery('select * from '+ResultTmp+' M ' + ' ORDER BY ' + OrderBy  );
 //
 //   //myBrowse(oQuery,'oQuery');
 //
 //   BuFDataset.Close;
 //   BuFDataset.FieldDefs.Clear;
 //
 //   CopyDataSetByName(oQuery , BuFDataset);
 //
 //   OrderBy := '';
 //   if RadioButton5.Checked Then Begin
 //     OrderBy := '公司編號' ;
 //   End Else If RadioButton6.Checked Then Begin
 //     OrderBy := '公司統編;公司編號' ;
 //   End Else If RadioButton11.Checked Then Begin
 //     OrderBy := '稅籍編號;公司編號' ;
 //   End;
 //
 //   If RadioButton4.Checked Then Begin
 //     BuFDataset.IndexFieldNames:= '登打人員編號;'+OrderBy;
 //   End;
 //
 //   BuFDataset.IndexFieldNames:= OrderBy;
 //   // myBrowse(BuFDataset,'BuFDataset');
 //
 //   FreeAndNil(oQuery);
 //
 //   Result := (BuFDataset.RecordCount > 0);
 // End;

End;



End.
