Unit wbase_Repunit1;

{$mode ObjFPC}{$H+}

Interface

Uses
  Interfaces, // this includes the LCL widgetset
  Classes, SysUtils, Forms, Controls, Dialogs, Clipbrd, fpjson, jsonparser, DB, bufdataset;

Procedure InitVariable();
Procedure myClipboard(str: string);
// 寫入字串到檔案
Procedure WriteStrToFile(WriteStr, FileName: string; ClearFile: boolean = False);
// 寫入字串到檔案 Debug 用
Procedure WriteStrToFile_Debug(WriteStr: string; FileName: string = 'C:\BENDEBUG.TXT\myLOG_Lazarus.txt'; ClearFile: boolean = False);


//Function waccrep3101_b(): integer; stdcall;
Function waccrep3101_b(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;

Function wbase320_buyinv(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;


Implementation

Uses
  wbase_unit1, util_frxprintpreviewform, frxClass, frxVariables;

Var
  frmRpt: TfrmfrxRpt1; // 日記帳

Function GetJsonString(Obj: TJSONObject; Const Keys: Array Of String; Const DefaultVal: String = ''): String;
Var
  k: Integer;
  val: TJSONData;
Begin
  Result := DefaultVal;
  If Obj = nil Then Exit;
  For k := Low(Keys) To High(Keys) Do Begin
    val := Obj.Find(Keys[k]);
    If val <> nil Then Begin
      If val.JSONType = jtNull Then
        Result := ''
      Else
        Result := val.AsString;
      Exit;
    End;
  End;
End;

Function GetJsonInteger(Obj: TJSONObject; Const Keys: Array Of String; Const DefaultVal: Integer = 0): Integer;
Var
  k: Integer;
  val: TJSONData;
Begin
  Result := DefaultVal;
  If Obj = nil Then Exit;
  For k := Low(Keys) To High(Keys) Do Begin
    val := Obj.Find(Keys[k]);
    If val <> nil Then Begin
      If val.JSONType = jtNull Then
        Result := 0
      Else
        Result := val.AsInteger;
      Exit;
    End;
  End;
End;

Procedure SetReportVariable(RepObj: TfrxReport; Const VarName, VarValue: String);
Var
  frVars: TfrxVariables;
  Variable: TfrxVariable;
Begin
  If RepObj = nil Then Exit;
  frVars := RepObj.Variables;
  If frVars.IndexOf(VarName) <> -1 Then
    frVars.Items[frVars.IndexOf(VarName)].Value := QuotedStr(VarValue)
  Else Begin
    Variable := frVars.Add;
    Variable.Name := VarName;
    Variable.Value := QuotedStr(VarValue);
  End;
End;

Procedure InitVariable();
Begin

End;

Procedure myClipboard(str: string);

  Procedure Str2Clipboard(Const Str: string; iDelayMs: integer);
  Const
    MaxRetries = 5;
  Var
    RetryCount: integer;
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

Procedure WriteStrToFile_Debug(WriteStr: string; FileName: string = 'C:\BENDEBUG.TXT\myLOG_Lazarus.txt'; ClearFile: boolean = False);
// 寫入字串到檔案 Debug 用
Var
  NowStr: string;
Begin
  If (DirectoryExists('C:\BENDEBUG.TXT')) Or
    (FileExists(ExtractFilePath(Application.ExeName) + 'DEBUG.TXT')) Then Begin
    If FileExists(ExtractFilePath(Application.ExeName) + 'DEBUG.TXT') Then // 客戶端的除錯
      FileName := ExtractFilePath(Application.ExeName) + 'DEBUG.Log';

    NowStr := FormatDateTime('yyyy/mm/dd hh:nn:ss.zzz', Now);
    WriteStrToFile(NowStr + ' ' + WriteStr, FileName, ClearFile);
  End;
End;

Procedure WriteStrToFile(WriteStr, FileName: string; ClearFile: boolean = False);
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
Function waccrep3101_b(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;
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
      If frmRpt.ZQuery1.active Then Begin
        WriteStrToFile_Debug('Pg Open ');
      End;
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


Function wbase320_buyinv(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;
Var
  JsonFileStr: String;
  Parser: TJSONParser;
  JsonData: TJSONData;
  JsonArray: TJSONArray;
  RootObj: TJSONObject;
  RowObj: TJSONObject;
  SL: TStringList;
  BufDataSet: TBufDataset;
  i: Integer;
  officeName, officeAddr, officeBoss, officeTel, officeTaxNo: String;
Begin
  WriteStrToFile_Debug('wbase320_buyinv fpath: ' + string(fpath));

  Result := 0;
  JsonData := nil;
  JsonArray := nil;
  RootObj := nil;
  BufDataSet := nil;

  Try
    Try
      If (fpath = '') Or (Not FileExists(string(fpath))) Then Begin
        ShowMessage('報表暫存資料檔不存在: ' + string(fpath));
        Result := 1;
        Exit;
      End;

      SL := TStringList.Create;
      Try
        SL.DefaultEncoding := TEncoding.UTF8;
        SL.LoadFromFile(string(fpath));
        JsonFileStr := SL.Text;
      Finally
        SL.Free;
      End;

      If Trim(JsonFileStr) = '' Then Begin
        ShowMessage('報表資料檔內容為空。');
        Result := 1;
        Exit;
      End;

      Parser := TJSONParser.Create(JsonFileStr, True);
      Try
        JsonData := Parser.Parse;
      Finally
        Parser.Free;
      End;

      If JsonData = nil Then Begin
        ShowMessage('無法解析報表 JSON 資料。');
        Result := 1;
        Exit;
      End;

      officeName := '';
      officeAddr := '';
      officeBoss := '';
      officeTel := '';
      officeTaxNo := '';

      If JsonData is TJSONArray Then Begin
        JsonArray := TJSONArray(JsonData);
      End Else If JsonData is TJSONObject Then Begin
        RootObj := TJSONObject(JsonData);
        officeName := GetJsonString(RootObj, ['officeName', 'OfficeName', '事務所名稱']);
        officeAddr := GetJsonString(RootObj, ['officeAddr', 'OfficeAddr', '事務所地址']);
        officeBoss := GetJsonString(RootObj, ['officeBoss', 'OfficeBoss', '事務所負責人', '負責人姓名']);
        officeTel := GetJsonString(RootObj, ['officeTel', 'OfficeTel', '事務所電話', '電話']);
        officeTaxNo := GetJsonString(RootObj, ['officeTaxNo', 'OfficeTaxNo', '事務所統編', '事務所統一編號']);

        If RootObj.Find('data') is TJSONArray Then
          JsonArray := TJSONArray(RootObj.Find('data'))
        Else If RootObj.Find('records') is TJSONArray Then
          JsonArray := TJSONArray(RootObj.Find('records'))
        Else If RootObj.Find('items') is TJSONArray Then
          JsonArray := TJSONArray(RootObj.Find('items'))
        Else If RootObj.Find('rows') is TJSONArray Then
          JsonArray := TJSONArray(RootObj.Find('rows'));
      End;

      // 建立記憶體資料集 TBufDataset
      BufDataSet := TBufDataset.Create(nil);
      BufDataSet.FieldDefs.Add('期別', ftString, 20);
      BufDataSet.FieldDefs.Add('購買次數', ftString, 10);
      BufDataSet.FieldDefs.Add('公司編號', ftString, 20);
      BufDataSet.FieldDefs.Add('公司簡稱', ftString, 100);
      BufDataSet.FieldDefs.Add('公司名稱', ftString, 100);
      BufDataSet.FieldDefs.Add('公司統編', ftString, 20);
      BufDataSet.FieldDefs.Add('統一編號', ftString, 20);
      BufDataSet.FieldDefs.Add('稅籍編號', ftString, 20);
      BufDataSet.FieldDefs.Add('手開二聯', ftInteger);
      BufDataSet.FieldDefs.Add('手開二聯副', ftInteger);
      BufDataSet.FieldDefs.Add('手開三聯', ftInteger);
      BufDataSet.FieldDefs.Add('手開三聯副', ftInteger);
      BufDataSet.FieldDefs.Add('特種', ftInteger);
      BufDataSet.FieldDefs.Add('收銀二聯', ftInteger);
      BufDataSet.FieldDefs.Add('收銀三聯', ftInteger);
      BufDataSet.FieldDefs.Add('收銀三聯副', ftInteger);
      BufDataSet.FieldDefs.Add('資料年度', ftString, 10);
      BufDataSet.FieldDefs.Add('資料起月', ftString, 10);
      BufDataSet.FieldDefs.Add('資料迄月', ftString, 10);
      BufDataSet.FieldDefs.Add('地址縣市', ftString, 50);
      BufDataSet.FieldDefs.Add('營業人地址', ftString, 200);
      BufDataSet.CreateDataset;
      BufDataSet.Open;

      If JsonArray <> nil Then Begin
        For i := 0 To JsonArray.Count - 1 Do Begin
          If JsonArray.Types[i] = jtObject Then Begin
            RowObj := JsonArray.Objects[i];
            BufDataSet.Append;
            BufDataSet.FieldByName('期別').AsString := GetJsonString(RowObj, ['period', 'Period', '期別']);
            BufDataSet.FieldByName('購買次數').AsString := GetJsonString(RowObj, ['times', 'Times', '購買次數']);
            BufDataSet.FieldByName('公司編號').AsString := GetJsonString(RowObj, ['companyCode', 'CompanyCode', '公司編號']);
            BufDataSet.FieldByName('公司簡稱').AsString := GetJsonString(RowObj, ['companyShortName', 'CompanyShortName', '公司簡稱']);
            BufDataSet.FieldByName('公司名稱').AsString := GetJsonString(RowObj, ['companyName', 'CompanyName', '公司名稱', '營業人名稱']);
            BufDataSet.FieldByName('公司統編').AsString := GetJsonString(RowObj, ['unifiedNo', 'UnifiedNo', '公司統編', '統一編號']);
            BufDataSet.FieldByName('統一編號').AsString := GetJsonString(RowObj, ['unifiedNo', 'UnifiedNo', '統一編號', '公司統編']);
            BufDataSet.FieldByName('稅籍編號').AsString := GetJsonString(RowObj, ['taxNo', 'TaxNo', '稅籍編號']);
            BufDataSet.FieldByName('手開二聯').AsInteger := GetJsonInteger(RowObj, ['manualTwoDup', 'ManualTwoDup', '手開二聯']);
            BufDataSet.FieldByName('手開二聯副').AsInteger := GetJsonInteger(RowObj, ['manualTwoDupSub', 'ManualTwoDupSub', '手開二聯副']);
            BufDataSet.FieldByName('手開三聯').AsInteger := GetJsonInteger(RowObj, ['manualThreeDup', 'ManualThreeDup', '手開三聯']);
            BufDataSet.FieldByName('手開三聯副').AsInteger := GetJsonInteger(RowObj, ['manualThreeDupSub', 'ManualThreeDupSub', '手開三聯副']);
            BufDataSet.FieldByName('特種').AsInteger := GetJsonInteger(RowObj, ['manualSpecial', 'ManualSpecial', '特種']);
            BufDataSet.FieldByName('收銀二聯').AsInteger := GetJsonInteger(RowObj, ['cashTwoDup', 'CashTwoDup', '收銀二聯']);
            BufDataSet.FieldByName('收銀三聯').AsInteger := GetJsonInteger(RowObj, ['cashThreeDup', 'CashThreeDup', '收銀三聯']);
            BufDataSet.FieldByName('收銀三聯副').AsInteger := GetJsonInteger(RowObj, ['cashThreeDupSub', 'CashThreeDupSub', '收銀三聯副']);
            BufDataSet.FieldByName('資料年度').AsString := GetJsonString(RowObj, ['dataYear', 'DataYear', '資料年度']);
            BufDataSet.FieldByName('資料起月').AsString := GetJsonString(RowObj, ['dataStartMonth', 'DataStartMonth', '資料起月']);
            BufDataSet.FieldByName('資料迄月').AsString := GetJsonString(RowObj, ['dataEndMonth', 'DataEndMonth', '資料迄月']);
            BufDataSet.FieldByName('地址縣市').AsString := GetJsonString(RowObj, ['city', 'City', '地址縣市']);
            BufDataSet.FieldByName('營業人地址').AsString := GetJsonString(RowObj, ['companyAddr', 'CompanyAddr', '營業人地址', '公司地址']);
            BufDataSet.Post;
          End;
        End;
      End;

      WriteStrToFile_Debug('BufDataSet records: ' + IntToStr(BufDataSet.RecordCount));

      frmRpt := Application.FindComponent('frmfrxRpt1') As TfrmfrxRpt1;
      If frmRpt = nil Then Begin
        WriteStrToFile_Debug('Create Form TfrmfrxRpt1: ');
        frmRpt := TfrmfrxRpt1.Create(Application);
        frmRpt.Parent := nil;
        frmRpt.FormStyle := fsNormal;
        frmRpt.ParentWindow := 0;
      End;
      frmRpt.Caption := '預購統一發票列印';

      WriteStrToFile_Debug('SetReportVariable: ');
      // 設定報表頁尾事務所變數
      SetReportVariable(frmRpt.frxReport_320_buyinv, '事務所名稱', officeName);
      SetReportVariable(frmRpt.frxReport_320_buyinv, '事務所地址', officeAddr);
      SetReportVariable(frmRpt.frxReport_320_buyinv, '事務所負責人', officeBoss);
      SetReportVariable(frmRpt.frxReport_320_buyinv, '事務所電話', officeTel);
      SetReportVariable(frmRpt.frxReport_320_buyinv, '事務所統編', officeTaxNo);

      // 呼叫 FastReport 預覽視窗
      WriteStrToFile_Debug('bbShowPreviewForm_Preview: ');
      bbShowPreviewForm_Preview(frmRpt, frmRpt.frxReport_320_buyinv, [frmRpt.frxDBDataset1], [BufDataSet], '', '', '', top_mag, left_mag, PrtIndex, IsPrint);

      FreeAndNil(frmRpt);
    Finally
      If BufDataSet <> nil Then FreeAndNil(BufDataSet);
      If JsonData <> nil Then FreeAndNil(JsonData);
      If frmRpt <> nil Then frmRpt.Free;
    End;
  Except
    On E: Exception Do Begin
      Result := 1;
      ShowMessage('預購統一發票列印錯誤:' + E.Message + #10 + '類別:' + E.ClassName);
    End;
  End;
End;




End.
