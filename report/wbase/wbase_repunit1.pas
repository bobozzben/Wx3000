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


Function waccrep3101_b(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;

Function wbase1010_cstore_list(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;

Function wbase1050_taxno_list(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;

Function wbase1060_recitem_list(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;

Function wbase1070_recnote_list(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;

Function wbase1080_feesummary_list(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;

Function wbase3010_ticketplace_list(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;

Function wbase320_buyinv(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;

Function wbase350_buyinv_list(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint, rep_type: integer; Const fpath: ansistring): integer; stdcall;

Function wbase2040_receipt(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;

Function wbase2040_bill(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;

Implementation

Uses
  wbase_unit1, util_frxprintpreviewform, frxClass, frxVariables;

Type
  TReportColumn = Record
    FieldName: String; // 範本 [MTable."欄位"] 使用的名稱
    JsonKey: String;
    Size: Integer;     // ftString 以 byte 計，中文 UTF-8 一字佔 3 byte
    IsAmount: Boolean;
    IsNumber: Boolean; // ftFloat 欄位，範本可用 SUM() 加總
  End;

Var
  frmRpt: TfrmfrxRpt1;

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



Function TextCol(Const AFieldName, AJsonKey: String; ASize: Integer = 1024): TReportColumn;
Begin
  Result.FieldName := AFieldName;
  Result.JsonKey := AJsonKey;
  Result.Size := ASize;
  Result.IsAmount := False;
  Result.IsNumber := False;
End;

Function AmountCol(Const AFieldName, AJsonKey: String): TReportColumn;
Begin
  Result := TextCol(AFieldName, AJsonKey, 64);
  Result.IsAmount := True;
End;

Function NumberCol(Const AFieldName, AJsonKey: String): TReportColumn;
Begin
  Result := TextCol(AFieldName, AJsonKey, 0);
  Result.IsNumber := True;
End;

Function GetJsonFloat(Obj: TJSONObject; Const Key: String): Double;
Var
  val: TJSONData;
Begin
  Result := 0;
  val := Obj.Find(Key);
  If (val <> nil) And (val.JSONType = jtNumber) Then Result := val.AsFloat;
End;

// 金額可能有小數 (numeric(20,4))，不可四捨五入成整數
Function GetJsonAmountText(Obj: TJSONObject; Const Key: String): String;
Var
  val: TJSONData;
  amt: Double;
  FS: TFormatSettings;
Begin
  amt := 0;
  val := Obj.Find(Key);
  If (val <> nil) And (val.JSONType <> jtNull) Then amt := val.AsFloat;
  FS := DefaultFormatSettings;
  FS.ThousandSeparator := ',';
  FS.DecimalSeparator := '.';
  Result := FormatFloat('#,##0.####', amt, FS);
End;

// 主檔清冊共用流程: 讀 JSON 暫存檔 -> 建記憶體資料集 -> 套範本 -> 依 IsPrint 預覽或列印
Function RunListReport(Const ReportName, FormCaption: String; Const Columns: Array Of TReportColumn; Const top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer;
Var
  JsonFileStr, CellText: String;
  Parser: TJSONParser;
  JsonData: TJSONData;
  JsonArray: TJSONArray;
  RowObj: TJSONObject;
  SL: TStringList;
  BufDataSet: TBufDataset;
  TargetReport: TfrxReport;
  i, c: Integer;
Begin
  WriteStrToFile_Debug(ReportName + ' fpath: ' + string(fpath));

  Result := 0;
  JsonData := nil;
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

      Parser := TJSONParser.Create(JsonFileStr, True);
      Try
        JsonData := Parser.Parse;
      Finally
        Parser.Free;
      End;

      If Not (JsonData Is TJSONArray) Then Begin
        ShowMessage('報表資料格式錯誤，必須是資料列陣列。');
        Result := 1;
        Exit;
      End;
      JsonArray := TJSONArray(JsonData);

      // 建立記憶體資料集 TBufDataset
      BufDataSet := TBufDataset.Create(nil);
      For c := Low(Columns) To High(Columns) Do
        BufDataSet.FieldDefs.Add(Columns[c].FieldName, ftString, Columns[c].Size);
      BufDataSet.CreateDataset;
      BufDataSet.Open;

      For i := 0 To JsonArray.Count - 1 Do Begin
        If JsonArray.Types[i] = jtObject Then Begin
          RowObj := JsonArray.Objects[i];
          BufDataSet.Append;
          For c := Low(Columns) To High(Columns) Do Begin
            If Columns[c].IsAmount Then
              CellText := GetJsonAmountText(RowObj, Columns[c].JsonKey)
            Else
              CellText := GetJsonString(RowObj, [Columns[c].JsonKey]);
            // TStringField 超長會直接截斷，寧可報錯也不要印出少字的清冊
            If Length(CellText) > Columns[c].Size Then
              Raise Exception.CreateFmt('第 %d 筆的「%s」內容過長', [i + 1, Columns[c].FieldName]);
            BufDataSet.FieldByName(Columns[c].FieldName).AsString := CellText;
          End;
          BufDataSet.Post;
        End;
      End;

      WriteStrToFile_Debug('BufDataSet records: ' + IntToStr(BufDataSet.RecordCount));

      If BufDataSet.RecordCount = 0 Then Begin
        ShowMessage('沒有可列印的資料。');
        Result := 1;
        Exit;
      End;

      frmRpt := Application.FindComponent('frmfrxRpt1') As TfrmfrxRpt1;
      If frmRpt = nil Then Begin
        WriteStrToFile_Debug('Create Form TfrmfrxRpt1: ');
        frmRpt := TfrmfrxRpt1.Create(Application);
        frmRpt.Parent := nil;
        frmRpt.FormStyle := fsNormal;
        frmRpt.ParentWindow := 0;
      End;
      frmRpt.Caption := FormCaption;

      TargetReport := frmRpt.FindComponent(ReportName) As TfrxReport;
      If TargetReport = nil Then
        Raise Exception.Create('找不到報表範本: ' + ReportName);

      SetReportVariable(TargetReport, '總筆數', IntToStr(BufDataSet.RecordCount));
      // 共用預覽流程沒有套用邊界，而且 3020 預設傳 10/10，只能在清冊這裡調整
      AdjPageMargins(TargetReport, top_mag, left_mag);

      WriteStrToFile_Debug('bbShowPreviewForm_Preview: ');
      bbShowPreviewForm_Preview(frmRpt, TargetReport, [frmRpt.frxDBDataset1], [BufDataSet], '', '', '', top_mag, left_mag, PrtIndex, IsPrint);
    Finally
      FreeAndNil(frmRpt);
      FreeAndNil(BufDataSet);
      FreeAndNil(JsonData);
    End;
  Except
    On E: Exception Do Begin
      Result := 1;
      ShowMessage(FormCaption + '列印錯誤:' + E.Message + #10 + '類別:' + E.ClassName);
    End;
  End;
End;


// 單據報表共用流程 (收據、請款單): JSON 根物件帶事務所資料與 data 資料列，範本以群組換頁
Function RunGroupedReport(Const ReportName, FormCaption: String; Const Columns: Array Of TReportColumn; Const top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer;
Var
  JsonFileStr, CellText: String;
  Parser: TJSONParser;
  JsonData: TJSONData;
  RootObj, RowObj: TJSONObject;
  JsonArray: TJSONArray;
  SL: TStringList;
  BufDataSet: TBufDataset;
  TargetReport: TfrxReport;
  i, c: Integer;
Begin
  WriteStrToFile_Debug(ReportName + ' fpath: ' + string(fpath));

  Result := 0;
  JsonData := nil;
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

      Parser := TJSONParser.Create(JsonFileStr, True);
      Try
        JsonData := Parser.Parse;
      Finally
        Parser.Free;
      End;

      If Not ((JsonData Is TJSONObject) And (TJSONObject(JsonData).Find('data') Is TJSONArray)) Then Begin
        ShowMessage('報表資料格式錯誤，必須是含 data 資料列的物件。');
        Result := 1;
        Exit;
      End;
      RootObj := TJSONObject(JsonData);
      JsonArray := TJSONArray(RootObj.Find('data'));

      BufDataSet := TBufDataset.Create(nil);
      For c := Low(Columns) To High(Columns) Do
        If Columns[c].IsNumber Then
          BufDataSet.FieldDefs.Add(Columns[c].FieldName, ftFloat)
        Else
          BufDataSet.FieldDefs.Add(Columns[c].FieldName, ftString, Columns[c].Size);
      BufDataSet.CreateDataset;
      BufDataSet.Open;

      For i := 0 To JsonArray.Count - 1 Do Begin
        If JsonArray.Types[i] = jtObject Then Begin
          RowObj := JsonArray.Objects[i];
          BufDataSet.Append;
          For c := Low(Columns) To High(Columns) Do Begin
            If Columns[c].IsNumber Then
              BufDataSet.FieldByName(Columns[c].FieldName).AsFloat := GetJsonFloat(RowObj, Columns[c].JsonKey)
            Else Begin
              CellText := GetJsonString(RowObj, [Columns[c].JsonKey]);
              // TStringField 超長會直接截斷，寧可報錯也不要印出少字的單據
              If Length(CellText) > Columns[c].Size Then
                Raise Exception.CreateFmt('第 %d 筆的「%s」內容過長', [i + 1, Columns[c].FieldName]);
              BufDataSet.FieldByName(Columns[c].FieldName).AsString := CellText;
            End;
          End;
          BufDataSet.Post;
        End;
      End;

      WriteStrToFile_Debug('BufDataSet records: ' + IntToStr(BufDataSet.RecordCount));

      If BufDataSet.RecordCount = 0 Then Begin
        ShowMessage('沒有可列印的資料。');
        Result := 1;
        Exit;
      End;

      frmRpt := Application.FindComponent('frmfrxRpt1') As TfrmfrxRpt1;
      If frmRpt = nil Then Begin
        WriteStrToFile_Debug('Create Form TfrmfrxRpt1: ');
        frmRpt := TfrmfrxRpt1.Create(Application);
        frmRpt.Parent := nil;
        frmRpt.FormStyle := fsNormal;
        frmRpt.ParentWindow := 0;
      End;
      frmRpt.Caption := FormCaption;

      TargetReport := frmRpt.FindComponent(ReportName) As TfrxReport;
      If TargetReport = nil Then
        Raise Exception.Create('找不到報表範本: ' + ReportName);

      SetReportVariable(TargetReport, '事務所名稱', GetJsonString(RootObj, ['officeName']));
      SetReportVariable(TargetReport, '事務所統編', GetJsonString(RootObj, ['officeTaxNo']));
      SetReportVariable(TargetReport, '事務所地址', GetJsonString(RootObj, ['officeAddr']));
      SetReportVariable(TargetReport, '事務所電話', GetJsonString(RootObj, ['officeTel']));
      SetReportVariable(TargetReport, '印表日期', GetJsonString(RootObj, ['printDate']));
      AdjPageMargins(TargetReport, top_mag, left_mag);

      WriteStrToFile_Debug('bbShowPreviewForm_Preview: ');
      bbShowPreviewForm_Preview(frmRpt, TargetReport, [frmRpt.frxDBDataset1], [BufDataSet], '', '', '', top_mag, left_mag, PrtIndex, IsPrint);
    Finally
      FreeAndNil(frmRpt);
      FreeAndNil(BufDataSet);
      FreeAndNil(JsonData);
    End;
  Except
    On E: Exception Do Begin
      Result := 1;
      ShowMessage(FormCaption + '列印錯誤:' + E.Message + #10 + '類別:' + E.ClassName);
    End;
  End;
End;


// 建檔人員清冊。不可加入密碼、一站式驗證碼等欄位
Function waccrep3101_b(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;
Begin
  Result := RunListReport('frxReport_1030_keyin', '建檔人員清冊', [
    TextCol('編號', 'no'),
    TextCol('姓名', 'name'),
    TextCol('電話', 'tel'),
    TextCol('手機', 'phone'),
    TextCol('住址', 'addr'),
    TextCol('備註', 'memo')
  ], top_mag, left_mag, PrtIndex, IsPrint, fpath);
End;

// 事務所資料報表 (VFP REPORTS\base111.frx，wbase1010f41 事務所資料列印)
Function wbase1010_cstore_list(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;
Begin
  Result := RunListReport('frxReport_1010_cstore', '事務所資料報表', [
    TextCol('統號', 'no'),
    TextCol('事務所名稱', 'name'),
    TextCol('電話', 'tel'),
    TextCol('傳真', 'fax'),
    TextCol('負責人', 'hname'),
    TextCol('聯絡人', 'linkman'),
    TextCol('地址', 'addr')
  ], top_mag, left_mag, PrtIndex, IsPrint, fpath);
End;

Function wbase1050_taxno_list(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;
Begin
  Result := RunListReport('frxReport_1050_taxno', '基本稅務人員清冊', [
    TextCol('代號', 'no'),
    TextCol('姓名', 'name'),
    TextCol('單位', 'department'),
    TextCol('電話', 'tel'),
    TextCol('助理人員', 'helpman'),
    TextCol('住址', 'addr'),
    TextCol('備註', 'memo')
  ], top_mag, left_mag, PrtIndex, IsPrint, fpath);
End;

Function wbase1060_recitem_list(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;
Begin
  Result := RunListReport('frxReport_1060_recitem', '基本收費項目清冊', [
    TextCol('項目', 'itemno'),
    TextCol('項目名稱', 'item'),
    AmountCol('收費金額', 'amt')
  ], top_mag, left_mag, PrtIndex, IsPrint, fpath);
End;

Function wbase1070_recnote_list(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;
Begin
  Result := RunListReport('frxReport_1070_recnote', '收費備註名冊', [
    TextCol('編號', 'noteno'),
    TextCol('備註內容', 'note', 8192)
  ], top_mag, left_mag, PrtIndex, IsPrint, fpath);
End;

Function wbase1080_feesummary_list(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;
Begin
  Result := RunListReport('frxReport_1080_feesummary', '基本收費摘要清冊', [
    TextCol('摘要代號', 'summaryCode'),
    TextCol('摘要說明', 'summaryName'),
    TextCol('摘要內容', 'content', 8192)
  ], top_mag, left_mag, PrtIndex, IsPrint, fpath);
End;

Function wbase3010_ticketplace_list(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;
Begin
  Result := RunListReport('frxReport_3010_ticketplace', '統一發票購買地點清冊', [
    TextCol('編號', 'placeCode'),
    TextCol('購買地點', 'placeName'),
    TextCol('連絡人', 'contactPerson'),
    TextCol('連絡電話', 'contactTel'),
    TextCol('購買地址', 'placeAddress')
  ], top_mag, left_mag, PrtIndex, IsPrint, fpath);
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


Function wbase350_buyinv_list(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint, rep_type: integer; Const fpath: ansistring): integer; stdcall;
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
  TargetReport: TfrxReport;
Begin
  WriteStrToFile_Debug('wbase350_buyinv_list fpath: ' + string(fpath) + ', rep_type: ' + IntToStr(rep_type));

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
      BufDataSet.FieldDefs.Add('公司電話', ftString, 50);
      BufDataSet.FieldDefs.Add('公司傳真', ftString, 50);
      BufDataSet.FieldDefs.Add('製表日期', ftString, 30);
      BufDataSet.FieldDefs.Add('手開二聯金額', ftInteger);
      BufDataSet.FieldDefs.Add('手開二聯副金額', ftInteger);
      BufDataSet.FieldDefs.Add('手開三聯金額', ftInteger);
      BufDataSet.FieldDefs.Add('手開三聯副金額', ftInteger);
      BufDataSet.FieldDefs.Add('特種金額', ftInteger);
      BufDataSet.FieldDefs.Add('收銀二聯金額', ftInteger);
      BufDataSet.FieldDefs.Add('收銀三聯金額', ftInteger);
      BufDataSet.FieldDefs.Add('收銀三聯副金額', ftInteger);
      BufDataSet.FieldDefs.Add('總金額', ftInteger);
      BufDataSet.FieldDefs.Add('總家數', ftInteger);
      BufDataSet.FieldDefs.Add('總本數', ftInteger);
      BufDataSet.FieldDefs.Add('公司本數', ftInteger);
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
            BufDataSet.FieldByName('公司電話').AsString := GetJsonString(RowObj, ['companyTel', 'CompanyTel', 'tel', 'Tel', '公司電話', '聯絡電話']);
            BufDataSet.FieldByName('公司傳真').AsString := GetJsonString(RowObj, ['companyFax', 'CompanyFax', 'fax', 'Fax', '公司傳真']);
            BufDataSet.FieldByName('製表日期').AsString := GetJsonString(RowObj, ['reportDate', 'ReportDate', '製表日期']);
            BufDataSet.FieldByName('手開二聯金額').AsInteger := GetJsonInteger(RowObj, ['manualTwoDupAmt', 'ManualTwoDupAmt', '手開二聯金額']);
            BufDataSet.FieldByName('手開二聯副金額').AsInteger := GetJsonInteger(RowObj, ['manualTwoDupSubAmt', 'ManualTwoDupSubAmt', '手開二聯副金額']);
            BufDataSet.FieldByName('手開三聯金額').AsInteger := GetJsonInteger(RowObj, ['manualThreeDupAmt', 'ManualThreeDupAmt', '手開三聯金額']);
            BufDataSet.FieldByName('手開三聯副金額').AsInteger := GetJsonInteger(RowObj, ['manualThreeDupSubAmt', 'ManualThreeDupSubAmt', '手開三聯副金額']);
            BufDataSet.FieldByName('特種金額').AsInteger := GetJsonInteger(RowObj, ['manualSpecialAmt', 'ManualSpecialAmt', '特種金額']);
            BufDataSet.FieldByName('收銀二聯金額').AsInteger := GetJsonInteger(RowObj, ['cashTwoDupAmt', 'CashTwoDupAmt', '收銀二聯金額']);
            BufDataSet.FieldByName('收銀三聯金額').AsInteger := GetJsonInteger(RowObj, ['cashThreeDupAmt', 'CashThreeDupAmt', '收銀三聯金額']);
            BufDataSet.FieldByName('收銀三聯副金額').AsInteger := GetJsonInteger(RowObj, ['cashThreeDupSubAmt', 'CashThreeDupSubAmt', '收銀三聯副金額']);
            BufDataSet.FieldByName('總金額').AsInteger := GetJsonInteger(RowObj, ['totalAmt', 'TotalAmt', '總金額']);
            BufDataSet.FieldByName('總家數').AsInteger := GetJsonInteger(RowObj, ['totalCount', 'TotalCount', '總家數']);
            BufDataSet.FieldByName('總本數').AsInteger := GetJsonInteger(RowObj, ['totalBooks', 'TotalBooks', '總本數']);
            BufDataSet.FieldByName('公司本數').AsInteger := GetJsonInteger(RowObj, ['companyBooks', 'CompanyBooks', '公司本數']);
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

      // 依 rep_type 決定列印報表: 1=A4使用frxReport_3501_buyinv, 2=中一刀使用frxReport_3502_buyinv
      If rep_type = 2 Then Begin
        frmRpt.Caption := '發票領取簽收單 (中一刀)';
        TargetReport := frmRpt.frxReport_3502_buyinv;
      End Else Begin
        frmRpt.Caption := '購買統一發票清單 (A4)';
        TargetReport := frmRpt.frxReport_3501_buyinv;
      End;

      WriteStrToFile_Debug('SetReportVariable for TargetReport');
      // 設定報表頁尾事務所變數
      SetReportVariable(TargetReport, '事務所名稱', officeName);
      SetReportVariable(TargetReport, '事務所地址', officeAddr);
      SetReportVariable(TargetReport, '事務所負責人', officeBoss);
      SetReportVariable(TargetReport, '事務所電話', officeTel);
      SetReportVariable(TargetReport, '事務所統編', officeTaxNo);

      // 呼叫 FastReport 預覽視窗
      WriteStrToFile_Debug('bbShowPreviewForm_Preview: ');
      bbShowPreviewForm_Preview(frmRpt, TargetReport, [frmRpt.frxDBDataset1], [BufDataSet], '', '', '', top_mag, left_mag, PrtIndex, IsPrint);

      FreeAndNil(frmRpt);
    Finally
      If BufDataSet <> nil Then FreeAndNil(BufDataSet);
      If JsonData <> nil Then FreeAndNil(JsonData);
      If frmRpt <> nil Then frmRpt.Free;
    End;
  Except
    On E: Exception Do Begin
      Result := 1;
      ShowMessage('統一發票購買清單列印錯誤:' + E.Message + #10 + '類別:' + E.ClassName);
    End;
  End;
End;


// 2-4 F4 收據列印 (VFP REPORTS\xreccno.frx)：每張收費單一頁，資料列為收費明細並帶表頭與客戶資料
Function wbase2040_receipt(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;
Begin
  Result := RunGroupedReport('frxReport_2040_receipt', '收費資料列印 (收據)', [
    TextCol('單號', '單號', 64),
    TextCol('請款日', '請款日', 32),
    TextCol('客戶編號', '客戶編號', 64),
    TextCol('客戶名稱', '客戶名稱', 400),
    TextCol('客戶地址', '客戶地址', 400),
    TextCol('項目代號', '項目代號', 32),
    TextCol('項目名稱', '項目名稱', 200),
    NumberCol('金額', '金額'),
    TextCol('備註', '備註', 400),
    TextCol('收據摘要', '收據摘要', 8000),
    TextCol('共用說明', '共用說明', 8000)
  ], top_mag, left_mag, PrtIndex, IsPrint, fpath);
End;


// 2-4 F6 請款單列印 (VFP REPORTS\xrecapy.frx)：每位客戶一頁，前期未收以「yyy年mm月 應收款」彙總
Function wbase2040_bill(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const fpath: ansistring): integer; stdcall;
Begin
  Result := RunGroupedReport('frxReport_2040_bill', '請款單列印', [
    TextCol('客戶編號', '客戶編號', 64),
    TextCol('客戶名稱', '客戶名稱', 400),
    TextCol('客戶地址', '客戶地址', 400),
    TextCol('聯絡人', '聯絡人', 100),
    TextCol('電話', '電話', 100),
    TextCol('傳真', '傳真', 100),
    TextCol('單號', '單號', 64),
    TextCol('日期', '日期', 32),
    TextCol('項目名稱', '項目名稱', 200),
    NumberCol('金額', '金額'),
    TextCol('備註', '備註', 400),
    TextCol('共用說明', '共用說明', 8000)
  ], top_mag, left_mag, PrtIndex, IsPrint, fpath);
End;

End.
