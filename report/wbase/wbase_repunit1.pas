Unit wbase_Repunit1;

{$mode ObjFPC}{$H+}

Interface

Uses
  Interfaces, // this includes the LCL widgetset
  Classes, SysUtils, Forms,Controls, Dialogs;

Procedure InitVariable();
// 寫入字串到檔案
Procedure WriteStrToFile(WriteStr, FileName: String; ClearFile: Boolean = False);
// 寫入字串到檔案 Debug 用
Procedure WriteStrToFile_Debug(WriteStr: String; FileName: String = 'C:\BENDEBUG.TXT\myLOG_Lazarus.txt'; ClearFile: Boolean = False);


//Function waccrep3101_b(): integer; stdcall;
Function waccrep3101_b(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer): integer; stdcall;

Implementation

Uses
  wbase_unit1, util_frxprintpreviewform;

Var
  frmRpt: TfrmfrxRpt1; // 日記帳

Procedure InitVariable();
Begin

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
Function waccrep3101_b(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer): integer; stdcall;
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


End.
