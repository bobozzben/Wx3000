Unit util_frxprintpreviewform;

{$mode ObjFPC}{$H+}

Interface

Uses
  Interfaces,
  Windows, Classes, SysUtils, Forms, Controls, Graphics, Dialogs, ExtCtrls, ComCtrls, DB,
  StdCtrls, Buttons, Menus, BufDataset, IniFiles, StrUtils, DBGrids,
  frxPreview, frxClass, frxDesgn, frxDBSet, ZDataset, Printers,
  frxDesgnCtrls, frxVariables, frxPrinter;

Type

  { TfrxPrintPreviewForm }

  TfrxPrintPreviewForm = Class(TForm)
    BClose: TSpeedButton;
    BDesgin: TSpeedButton;
    BExport: TSpeedButton;
    BFirst: TSpeedButton;
    BLast: TSpeedButton;
    BNext: TSpeedButton;
    BPrint: TSpeedButton;
    BPrior: TSpeedButton;
    BRefresh: TSpeedButton;
    BResetReport: TSpeedButton;
    BufDataset1: TBufDataset;
    Button1: TButton;
    Button2: TButton;
    CmbBins: TComboBox;
    DBLUCombo1: TComboBox;
    Edit_Jump: TEdit;
    frxDBDataset1: TfrxDBDataset;
    frxDesigner1: TfrxDesigner;
    frxPreview1: TfrxPreview;
    frxReport1: TfrxReport;
    ImageList1: TImageList;
    Label1: TLabel;
    Label4: TLabel;
    Label5: TLabel;
    Label6: TLabel;
    Label_frxReportName: TLabel;
    mExport_JPG: TMenuItem;
    mExport_PDF: TMenuItem;
    mExport_xlsx: TMenuItem;
    Blarge: TSpeedButton;
    BSmall: TSpeedButton;
    Panel1: TPanel;
    pnlStatus2: TPanel;
    pnlStatus1: TPanel;
    pnlStatus0: TPanel;
    SaveDialog1: TSaveDialog;
    TopPanel: TPanel;
    PopupMenu1: TPopupMenu;
    Procedure BCloseClick(Sender: TObject);
    Procedure BDesginClick(Sender: TObject);
    Procedure BExportClick(Sender: TObject);
    Procedure BFirstClick(Sender: TObject);
    Procedure BlargeClick(Sender: TObject);
    Procedure BLastClick(Sender: TObject);
    Procedure BNextClick(Sender: TObject);
    Procedure BPrintClick(Sender: TObject);
    Procedure BPriorClick(Sender: TObject);
    Procedure BRefreshClick(Sender: TObject);
    Procedure BResetReportClick(Sender: TObject);
    Procedure Button1Click(Sender: TObject);
    Procedure Button2Click(Sender: TObject);
    Procedure DBLUCombo1Change(Sender: TObject);
    Procedure Edit_JumpKeyDown(Sender: TObject; Var Key: word; Shift: TShiftState);
    Procedure FormClose(Sender: TObject; Var CloseAction: TCloseAction);
    Procedure FormShow(Sender: TObject);
    Procedure frxPreview1PageChanged(Sender: TfrxPreview; PageNo: integer);
    Procedure Label1DblClick(Sender: TObject);
    Procedure mExport_JPGClick(Sender: TObject);
    Procedure mExport_PDFClick(Sender: TObject);
    Procedure mExport_xlsxClick(Sender: TObject);
    Procedure BSmallClick(Sender: TObject);
  private

  public
    DoNotAddSubtotal: boolean;
    // 不要加入加總的列，自已寫 AfterExportExcelReport 外掛 X3CA0P0P04 有範例
    AutoSumtotalField: string; // 自動加總的主欄位
    ExportListOnly: boolean; // 不做加總處理 基本資料使用 (優先)
    xlsSubTotalColumn: integer; // Excel SubTotal 合計加總依據的欄，只能1欄
    xFieldList, xCaptionList: string;
    xColorList, xDisplayFormat: string;
    myReportPath: string;
    TableName: string;
    ReportType: string;
    ReportNO: string;
    ReportFile: string;
    ReportObject: TfrxReport;
    ReportFindKey: string;
    // 報表資料暫存檔裏辨視唯一值的欄位,沒放到 1111221
    TraceReport: boolean;
    UpdateBill: boolean; // 必須更新單據已列印

    myLocalEXEPath: string;
    myISPrint: boolean; // 按過列印，表示有印過
    frxReport: TfrxReport;
    ReportData: TDataSet;
    ReportData2: TDataSet;
    ReportData3: TDataSet;
    ReportData4: TDataSet;
    myCurrentDirectory: string; // 當前目錄
    IsModified: boolean; // 有修改報表
    ReportName, ReportName2: string;
    CanDesign: boolean; // 可否修改報表
    ReportShortName: string;
    HasAdjChangeBand, HasAdjChangeMargin: boolean;
    // 是否有調整 邊距及高  1120916
    PageTopMargin, PageLeftMargin, DetailBandHeight, PageHeaderBandHeight, PageFooterBandHeight: extended; // 原始報表的邊距及高
    INI_Value: TMemIniFile;

    ReportQuery: TzQuery;
    hasdesign: string;

    Procedure myOnPrintPage(Page: TfrxReportPage; CopyNo: integer);
    Function myOnSaveReport(Report: TfrxReport; SaveAs: boolean): boolean;


  End;

Var
  frxPrintPreviewForm: TfrxPrintPreviewForm;

  //procedure ShowForm_PreviewForm(repobj: TfrxReport; arrfrxDBs: array of TfrxDBDataset;
  //  arrTables: array of TDataSet;arrTableAliasname : array of String ; vReportType, vReportNO, vReportFile: string; top_mag, left_mag: double;
  //  PrtIndex, IsPrint: integer; ReportFullPath: string = ''; CallFrom38: boolean = False;
  //  P38Blank: integer = 0; MoveLeftObj: string = ''; MoveTopObj: string = ''; NoChangetoLetter: boolean = False;
  //  CanAjdBand: boolean = False);

Function bbShowPreviewForm_Preview(myOwner: TForm; repobj: TfrxReport; arrfrxDBs: Array Of TfrxDBDataset; arrTables: Array Of TDataset; vReportType, vReportNO, vReportFile: string; top_mag, left_mag: double; PrtIndex, IsPrint: integer; ReportFullPath: string = ''; oQuery: TzQuery = nil): string;


Procedure myBrowse(DataSet: TDataSet; Descrip: string = '');
// 設定目前的印表機
Procedure myPrinterIndex(frReport: TfrxReport; PrtIndex: integer);
// 移動上，左邊界  fastreport 4
Procedure AdjPageMargins(repobj: TfrxReport; top_mag, left_mag: double); overload;
// 改變紙張
Procedure myChangePaperfr(frReport: TfrxReport; PaperSize: string); overload;
Function AdjBandHeight(repobj: TfrxReport; vpath: string): boolean;
Procedure myAddStylesTofrxReport(frxReport1: TfrxReport);
Procedure AddVariablesToReport(ffrxReport1: TfrxReport); // 在報表加入公用變數

Implementation

{$R *.lfm}

Uses wbase_Repunit1;

  { TfrxPrintPreviewForm }

  //procedure ShowForm_PreviewForm(repobj: TfrxReport; arrfrxDBs: array of TfrxDBDataset;
  //  arrTables: array of TDataSet;arrTableAliasname : array of String ; vReportType, vReportNO, vReportFile: string; top_mag, left_mag: double;
  //  PrtIndex, IsPrint: integer; ReportFullPath: string = ''; CallFrom38: boolean = False;
  //  P38Blank: integer = 0; MoveLeftObj: string = ''; MoveTopObj: string = ''; NoChangetoLetter: boolean = False;
  //  CanAjdBand: boolean = False);

Function bbShowPreviewForm_Preview(myOwner: TForm; repobj: TfrxReport; arrfrxDBs: Array Of TfrxDBDataset; arrTables: Array Of TDataset; vReportType, vReportNO, vReportFile: string; top_mag, left_mag: double; PrtIndex, IsPrint: integer; ReportFullPath: string = ''; oQuery: TzQuery = nil): string;

  // 預覽單一表格的簡單報表,傳入報表名稱可自訂報表
  Procedure myRunSimpleReport();
  Var
    II, JJ: integer;
    MasterBand: TFrxMasterData;
    myOutPdfFile: string;
  Begin
    Try
      WriteStrToFile_Debug('bbShowPreviewForm_Preview 1 ');

      repobj.EngineOptions.DoublePass := True;
      repobj.EngineOptions.IgnoreDevByZero := True;
      repobj.DataSets.Clear;
      repobj.EnabledDataSets.Clear;
      For II := Low(arrfrxDBs) To High(arrfrxDBs) Do Begin
        arrfrxDBs[II].DataSet := arrTables[II]; // frmRpt.Table1;
        repobj.DataSets.Add(arrfrxDBs[II]);
        repobj.EnabledDataSets.Add(arrfrxDBs[II]);
      End;
      For JJ := 0 To repobj.PagesCount - 1 Do Begin
        MasterBand := repobj.Pages[JJ].FindObject('MasterData1') As TFrxMasterData;
        If MasterBand <> nil Then Begin
          MasterBand.DataSet := arrfrxDBs[0]; // 一定要掛到,不然會錯誤
        End;
      End;
      WriteStrToFile_Debug('bbShowPreviewForm_Preview 2 ');

      (arrfrxDBs[0] As TfrxDBDataset).UserName := 'MTable';
      // 調上左邊界
      //AdjPageMargins(repobj, top_mag, left_mag);
      // 設定目前的印表機
      //myPrinterIndex(repobj, PrtIndex);
      // 調成Letter 不用強制設，依報表的紙張為準  3-8 都是 Letter
      // myChangePaperfr(repobj, 'A4');
      //if (NoChangetoLetter) then begin
      //end else begin
      //  myChangePaperfr(repobj, 'Letter'); // 1120611 錯誤 #4098
      //end;
      // 預先提取印表機設定，防止印 PDF 空白
      //myPropertiesDlg;
      // 調整區段高度
      //if CanAjdBand then // 傳票及封面才能調整,其他不能調 1120720
      //  AdjBandHeight(repobj, ExtractFilepath(TempName));
      // 加入底線樣式 0.無 1.單底線 2.雙底線 3.上單下雙 4.上虛下單 5.上虛下雙 6.上單下單 7.單虛底線 8.上單線 9.上雙線
      //myAddStylesTofrxReport(repobj);
      AddVariablesToReport(repobj); // 報表變數
      // -------------------------------------------------
      WriteStrToFile_Debug('bbShowPreviewForm_Preview 3 ');
      repobj.PrepareReport;
      If IsPrint = 1 Then Begin
        repobj.PrintOptions.ShowDialog := False;
        repobj.Print;
      End Else If IsPrint = 999 Then Begin
        arrTables[0].First;
        If (arrTables[0].FindField('OUT_FILE') <> nil) And (arrTables[0].RecordCount > 0) Then Begin
          myOutPdfFile := arrTables[0].FieldByName('OUT_FILE').AsString;
          //PDF_Marge(repobj, myOutPdfFile, '', '', '', True, True);
        End;
      End Else Begin
        WriteStrToFile_Debug('bbShowPreviewForm_Preview 4 ');

        frxPrintPreviewForm.frxReport := repobj;
        frxPrintPreviewForm.ReportData := arrTables[0];
        frxPrintPreviewForm.ReportShortName := (repobj.Owner As TForm).Caption;
        // 來源的報表中文名稱,另存新檔檔名使用 1120207
        If ReportFullPath <> '' Then Begin
          frxPrintPreviewForm.ReportName := ReportFullPath;
          frxPrintPreviewForm.CanDesign := True; // 可修改報表
        End;
        If DirectoryExists('C:\BenDebug.txt') Then Begin
          frxPrintPreviewForm.CanDesign := True; // 不可修改報表
        End;
        repobj.Preview := frxPrintPreviewForm.frxPreview1;
        repobj.ShowPreparedReport();
        WriteStrToFile_Debug('bbShowPreviewForm_Preview 5 ');

        frxPrintPreviewForm.ShowModal;
      End;

    Except
      //On E: EPrinter Do
      //  application.MessageBox('您所選擇的印表機無法使用,請選別台印表機列印,' + #13 + '或重新安裝印表機驅動程式!', '錯誤', MB_OK);
      On E: Exception Do
        ShowMessage('錯誤訊息:' + E.Message + #10 + '類別:' + E.ClassName);
    End;
    WriteStrToFile_Debug('bbShowPreviewForm_Preview 6 ');

  End;

Begin
  Result := '';

  WriteStrToFile_Debug('frxPrintPreviewForm 1 ');

  // 畫面首次生成
  If Not Assigned(frxPrintPreviewForm) Then Begin
    frxPrintPreviewForm := TfrxPrintPreviewForm.Create(myOwner); // Application
    With frxPrintPreviewForm Do Begin
      Caption := Format('%s (%s)', ['預覽', Caption]);

      // 關鍵修正 1：明確將 Parent 設定為 nil，避免被誤當成 Child control
     // Parent := nil;
     // FormStyle := fsNormal;
     // ParentWindow := 0;
      WriteStrToFile_Debug('frxPrintPreviewForm 2 ');

      FormStyle := fsNormal;
      WindowState := wsNormal;
      Position := poDesigned; // poMainFormCenter;
      KeyPreview := True;
      frxReport := repobj;
      ReportQuery := oQuery;     // 報表檔 20260312
      WriteStrToFile_Debug('frxPrintPreviewForm 3 ');

      ReportType := vReportType;
      ReportNO := vReportNO;
      ReportFile := vReportFile;
    End;
  End;
  WriteStrToFile_Debug('frxPrintPreviewForm 4 ');

  // 畫面帶到前端
  With frxPrintPreviewForm Do Begin
    //    WindowState := wsMaximized; // WindowState := wsMaximized;

    WriteStrToFile_Debug('frxPrintPreviewForm 5 ');
    //    BringToFront;

    WriteStrToFile_Debug('frxPrintPreviewForm 6 ');

    myRunSimpleReport;

    //frxPrintPreviewForm.ShowModal;

    WriteStrToFile_Debug('frxPrintPreviewForm 7 ');

    Result := hasdesign;

    WriteStrToFile_Debug('frxPrintPreviewForm 8 ');

    FreeAndNil(frxPrintPreviewForm);

    WriteStrToFile_Debug('frxPrintPreviewForm 9 ');
  End;

End;


Procedure myBrowse(DataSet: TDataSet; Descrip: string = '');

  Procedure CopyDataSet(SourDS: TDataSet; DestDS: TBufDataset);
  Var
    ii, jj: integer;
  Begin
    DestDS.FieldDefs.Clear;
    DestDS.FieldDefs.Assign(SourDS.FieldDefs);
    For II := 0 To DestDS.FieldDefs.Count - 1 Do Begin
      If (DestDS.FieldDefs[ii].Required = True) Then
        DestDS.FieldDefs[ii].Required := False;
    End;
    DestDS.CreateDataSet;
    SourDS.First;
    While Not SourDS.EOF Do Begin
      DestDS.Append;
      For jj := 0 To SourDS.FieldCount - 1 Do
        DestDS.Fields[jj].Value := SourDS.Fields[jj].Value;
      DestDS.Post;
      SourDS.Next;
    End;
  End;

Var {Uses DBGrids}
  Form: TForm;
  DBGRID: TDBGRID;
  DS: TDataSource;
  ClientDataSet: TBufDataset;
  IsUniDirectionalDataSet: boolean;
  II: integer;
Begin
  IsUniDirectionalDataSet := False;
  If DataSet.IsUniDirectional Then Begin
    IsUniDirectionalDataSet := True;
    ClientDataSet := TBufDataset.Create(nil);
    CopyDataSet(DataSet, ClientDataSet);
  End;

  Form := TForm.Create(nil);
  DS := TDataSource.Create(Form);

  If IsUniDirectionalDataSet Then
    DS.DataSet := ClientDataSet
  Else
    DS.DataSet := DataSet;

  DBGRID := TDBGrid.Create(Form);
  DBGRID.Parent := Form;
  DBGRID.DataSource := DS;
  DBGRID.Align := alClient;
  DBGRID.Visible := True;
  DBGRID.ReadOnly := True;

  For II := 0 To DS.DataSet.FieldCount - 1 Do Begin // 20241014
    If DS.DataSet.Fields[II] Is TNumericField Then Begin
      (DS.DataSet.Fields[II] As TNumericField).DisplayFormat := '#,###.####';
      If DS.DataSet.Fields[II].DisplayWidth <= 10 Then
        DS.DataSet.Fields[II].DisplayWidth := DS.DataSet.Fields[II].DisplayWidth + 5;
    End;
    If DS.DataSet.Fields[II].DisplayWidth > 40 Then DS.DataSet.Fields[II].DisplayWidth := 40;
  End;
  Form.Caption := '瀏覽 筆數： ' + IntToStr(DS.DataSet.RecordCount) + '  [' + Descrip + ']';
  Form.Height := 768;
  Form.Width := Screen.Width - 200;
  Form.Position := poScreenCenter;
  Form.WindowState := wsNormal;
  Form.ShowModal;

  FreeAndNil(DBGrid);
  FreeAndNil(DS);
  FreeAndNil(Form);
  If IsUniDirectionalDataSet Then
    FreeAndNil(ClientDataSet);
End;

// 設定目前的印表機
Procedure myPrinterIndex(frReport: TfrxReport; PrtIndex: integer);
Begin
  // if PrtIndex <> -1 then // 1080128 沒有選印表機會是-1，預設為0
  // Printer.PrinterIndex := PrtIndex;
  // ResetPrinter; // 重新取得預設的 DEVMODE
  // if PrtIndex <> -1 then // 要設報表物件才對 1110304
  //   frReport.PrintOptions.Printer := Printer.Printers[PrtIndex];

End;


Procedure TfrxPrintPreviewForm.BCloseClick(Sender: TObject);
Begin
  Close;
End;

Procedure TfrxPrintPreviewForm.BDesginClick(Sender: TObject);
Begin
  hasdesign := ReportNO;
  Close;

  //IsModified := False;
  //frxDesigner1.OnSaveReport := @myOnSaveReport;
  //frxDesigner1.Restrictions := [drDontDeletePage];
  //frxReport.FileName := ReportName;
  //frxReport.DesignReport(True);
  //SetCurrentDir(myCurrentDirectory);
  //// 有修改過報表，要存到資料庫裏
  //if IsModified then begin
  //  ShowMessage('報表有異動，請重新預覽報表！');
  //  Close;
  //end;
  //// End;

End;

Procedure TfrxPrintPreviewForm.BExportClick(Sender: TObject);
Begin

  PopupMenu1.PopUp; //(BExport.Width,BExport.Height);

End;

Procedure TfrxPrintPreviewForm.BFirstClick(Sender: TObject);
Begin // 首頁
  frxPreview1.First;
  frxPreview1.SetFocus;
End;

Procedure TfrxPrintPreviewForm.BlargeClick(Sender: TObject);
Var
  Ind: integer;
Begin // 放大
  Ind := DBLUCombo1.ItemIndex;
  If Ind = 1 Then
    Ind := 2
  Else If Ind = 2 Then
    Ind := 3
  Else If Ind = 3 Then
    Ind := 0
  Else If Ind = 0 Then
    Ind := 4
  Else If Ind = 4 Then
    Ind := 5
  Else If Ind = 5 Then
    Ind := 5
  Else
    Ind := 5;
  DBLUCombo1.ItemIndex := Ind;
  DBLUCombo1.OnChange(DBLUCombo1);

  // 1: RepObj.frxPreview1.ZoomMode := zmWholePage; // 整頁
  // 2: RepObj.frxPreview1.Zoom := 1;
  // 3: RepObj.frxPreview1.Zoom := 1.2;
  // 0: RepObj.frxPreview1.ZoomMode := zmPageWidth; // 頁寬
  // 4: RepObj.frxPreview1.Zoom := 1.5;
  // 5: RepObj.frxPreview1.Zoom := 2;

End;

Procedure TfrxPrintPreviewForm.BLastClick(Sender: TObject);
Begin // 最後一頁
  frxPreview1.Last;
  frxPreview1.SetFocus;
End;

Procedure TfrxPrintPreviewForm.BNextClick(Sender: TObject);
Begin // 下一頁
  frxPreview1.Next;
  frxPreview1.SetFocus;

End;

Procedure TfrxPrintPreviewForm.BPrintClick(Sender: TObject);
Begin // 列印
  // frxPreview1.Report
  frxPreview1.Print; // 自訂預覽畫面必須使用 frxPreview1.Print 畫面才不會消失

  myISPrint := True; // frxPreview1.PreviewPages.Print;
  If myISPrint Then Begin

  End;

  frxPreview1.SetFocus;
End;

Procedure TfrxPrintPreviewForm.BPriorClick(Sender: TObject);
Begin // 上一頁
  frxPreview1.Prior;
  frxPreview1.SetFocus;
End;

Procedure TfrxPrintPreviewForm.BRefreshClick(Sender: TObject);
Begin
  application.ProcessMessages;
  frxReport.Preview.RefreshReport; // 印出去以後會不見,要刷新一下

End;

Procedure TfrxPrintPreviewForm.BResetReportClick(Sender: TObject);
Var
  InputPass: string;
  //UniQuery: TUniQuery;
  xSQL, workSchema: string;
Begin
  // 重設成奇勝報表

  // PostMessage(Handle, InputBoxMessage, 0, 0);
  // InputPass := InputBox('請輸入奇勝密碼', '請輸入奇勝密碼', '');
  // if InputPass <> HSPassword then begin
  // Showmessage('密碼不正確');
  // Exit;
  // end;
  //if YesNo('確定要重設成奇勝母版') then begin
  //workSchema := DataModule1.GetSchemaName(SchemaPath_Comm);
  //UniQuery := TUniQuery.Create(Self);
  //  xSQL := 'Delete FROM "' + workSchema + '"."抽查報表模板"  AS M ' + #13;
  //  xSQL := xSQL + ' WHERE M."抽查報表類別" = ' + QuotedStr(ReportType) + #13;
  //  xSQL := xSQL + ' AND   M."抽查報表代號" = ' + QuotedStr(ReportNO) + #13;
  //DataModule1.UniConnection1.ExecSQL(xSQL);
  //FreeAndNil(UniQuery);
  //  Close;
  //end;

End;

Procedure TfrxPrintPreviewForm.Button1Click(Sender: TObject);
Var
  SL: TStringList;
  xStr: string;
  I: integer;
Begin
  // 除錯用
  SL := TStringList.Create;
  For I := 0 To ReportData.FieldCount - 1 Do Begin
    xStr := xStr + ReportData.Fields[I].DisplayLabel + ',';
  End;
  //CopyTOClipboard(xStr);
  FreeAndNil(SL);
  // 自用
  Label_frxReportName.Visible := Not Label_frxReportName.Visible;
  If ReportName <> '' Then Begin
    Label_frxReportName.Caption := ReportName;
  End Else Begin
    Label_frxReportName.Caption := frxReport.Name; // frxReport 的名稱
  End;

End;

Procedure TfrxPrintPreviewForm.Button2Click(Sender: TObject);
Var
  II: integer;
Begin
  // 除錯用
  For II := 0 To Self.frxReport.EnabledDataSets.Count - 1 Do Begin
    myBrowse((Self.frxReport.EnabledDataSets[II].DataSet As TfrxDBDataset).DataSet);
  End;

  //   for II := 0 to Self.frxReport.EnabledDataSets.Count -1  do
  //      myBrowse(Self.frxReport.EnabledDataSets[II] As TDataSet);
  // 自用
  //if Assigned(ReportData) then
  //  myBrowse(ReportData, 'Table1');
  //if Assigned(ReportData2) then
  //  myBrowse(ReportData2, 'Table2');
  //if Assigned(ReportData3) then
  //  myBrowse(ReportData3, 'Table3');
  //if Assigned(ReportData4) then
  //  myBrowse(ReportData4, 'Table4');

End;

Procedure TfrxPrintPreviewForm.DBLUCombo1Change(Sender: TObject);
Begin
  Case DBLUCombo1.ItemIndex Of
    0:
      frxPreview1.ZoomMode := zmPageWidth; // 頁寬
    1:
      frxPreview1.ZoomMode := zmWholePage; // 整頁
    2: Begin
      frxPreview1.ZoomMode := zmDefault;
      frxPreview1.Zoom := 1;
    End;
    3: Begin
      frxPreview1.ZoomMode := zmDefault;
      frxPreview1.Zoom := 1.2;
    End;
    4: Begin
      frxPreview1.ZoomMode := zmDefault;
      frxPreview1.Zoom := 1.5;
    End;
    5: Begin
      frxPreview1.ZoomMode := zmDefault;
      frxPreview1.Zoom := 2;
    End;
    Else
      frxPreview1.ZoomMode := zmDefault;
  End;
  frxPreview1.SetFocus;

End;

Procedure TfrxPrintPreviewForm.Edit_JumpKeyDown(Sender: TObject; Var Key: word; Shift: TShiftState);
Var
  Cnt: integer;
Begin
  If (Shift = []) And (Key = VK_ESCAPE) Then Begin
    BClose.Click; // 離開
    Key := 0;
  End
  Else If (Shift = [ssCtrl]) And (Key = VK_HOME) Then Begin
    BFirst.Click; // Control HOME
    Key := 0;
  End
  Else If (Shift = [ssCtrl]) And (Key = VK_END) Then Begin
    BLast.Click; // Control END
    Key := 0;
  End
  Else If (Shift = []) And (Key = VK_F7) Then Begin
    BPrint.Click; // 列印
    Key := 0;
  End
  Else If (Shift = []) And (Key = VK_F5) Then Begin
    // BRefresh.Click; // 更新
    Key := 0;
  End
  Else If (Shift = [ssCtrl]) And (Key = VK_ADD) Then Begin
    BLarge.Click; // 放大
    Key := 0;
  End
  Else If (Shift = [ssCtrl]) And (Key = VK_SUBTRACT) Then Begin
    BSmall.Click; // 縮小
    Key := 0;
  End
  Else If (Shift = []) And (Key = VK_F3) Then Begin
    Edit_Jump.SetFocus; // 停在跳到頁次
    Key := 0;
  End
  Else If (Shift = []) And (Key = VK_RETURN) Then Begin
    Key := 0;
    If ActiveControl = Edit_Jump Then Begin
      Cnt := 0;
      If TryStrtoInt(Edit_Jump.Text, Cnt) Then Begin
        If Cnt <= 1 Then Begin
          Self.frxPreview1.First;
          Exit;
        End;
        If Cnt > Self.frxPreview1.PageCount Then Begin
          Self.frxPreview1.Last;
          Exit;
        End;
        Self.frxPreview1.PageNo := Cnt;
        Self.frxPreview1.SetFocus;
      End;
    End;
  End;

End;

Procedure TfrxPrintPreviewForm.FormClose(Sender: TObject; Var CloseAction: TCloseAction);
Begin
  INI_Value.WriteInteger('FillShowPages', 'FillIndex', DBLUCombo1.ItemIndex);
  FreeAndNil(INI_Value);
End;

Procedure TfrxPrintPreviewForm.FormShow(Sender: TObject);
Begin

  {$IfDef CPU64}
  //  ShowMessage('目前主程式是：64位元 (x64)');
  {$Else}
  ShowMessage('目前主程式是：32位元 (x86)');
  {$EndIf}

  // 確保 Form 自己的 Handle 已經妥當
    Self.HandleNeeded;


    //StatusBar1.SimplePanel := False; // True;  2個StatusPanel
    //StatusBar1.Panels[0].Width := Width - Trunc(Width / 3); // Panels[0] 佔2/3
    //StatusBar1.Panels[1].Width := Trunc(Width / 3) - 150;
    //StatusBar1.Panels[2].Width := 150;

  //If False Then Begin
    myLocalEXEPath := ExtractFilePath(Application.ExeName); //'C:\W3000\';
    myCurrentDirectory := GetCurrentDir();


    Button1.Visible := False;
    Button2.Visible := False;
    If (DirectoryExists('C:\BENDEBUG.TXT')) Then Begin
      Button1.Visible := True;
      Button2.Visible := True;
    End;
    BDesgin.Visible := CanDesign;

    INI_Value := TMemIniFile.Create(myLocalEXEPath + 'xPrintPrview' + '.ini', TEncoding.UTF8);
    // 記憶顯示比例 1120703
    DBLUCombo1.ItemIndex := INI_Value.ReadInteger('FillShowPages', 'FillIndex', 1); // 整頁
    DBLUCombo1.OnChange(DBLUCombo1);

    // 取得印表機的可用紙匣 1120628
    CmbBins.Clear;
    CmbBins.Items.Assign(frxPrinters.Printer.Bins);
    CmbBins.ItemIndex := 0;
    // 強制印到使用者選的紙匣
    //frxReport.OnPrintPage := @myOnPrintPage;
  //End;
End;

Procedure TfrxPrintPreviewForm.frxPreview1PageChanged(Sender: TfrxPreview; PageNo: integer);
Begin
  Edit_Jump.Text := IntToStr(frxPreview1.PageNo);

  pnlStatus0.Caption := Format('%d / %d', [PageNo, Sender.PageCount]);
  If ReportName <> '' Then Begin
    pnlStatus1.Caption := ReportName;
  End Else Begin
    pnlStatus1.Caption := frxReport.Name; // frxReport 的名稱
  End;
  pnlStatus2.Caption := Format('dpi: %d', [Screen.PixelsPerInch]); //1120718

End;

Procedure TfrxPrintPreviewForm.myOnPrintPage(Page: TfrxReportPage; CopyNo: integer);
Var
  fPrintTray: integer;
Begin
  fPrintTray := frxPrinters.Printer.BinNameToNumber(CmbBins.Items[CmbBins.ItemIndex]);
  // fPrintTray := frxPrinters.Printer.Bin;
  If fPrintTray <> -1 Then Begin
    Label_frxReportName.Caption := '輸出紙匣: ' + CmbBins.Items[CmbBins.ItemIndex];
  End Else Begin
    Label_frxReportName.Caption := '紙匣: ' + IntToStr(fPrintTray);
  End;
  frxPrinters.Printer.Bin := fPrintTray;
  Page.Bin := fPrintTray; // now force the bin to be what the USER selected earlier...
  Page.BinOtherPages := fPrintTray;
End;

Function TfrxPrintPreviewForm.myOnSaveReport(Report: TfrxReport; SaveAs: boolean): boolean;
Begin
  // ------------
  If SaveAs Then Begin
    frxPrintPreviewForm.SaveDialog1.DefaultExt := 'fr3';
    frxPrintPreviewForm.SaveDialog1.Filter := 'FastReport files (*.fr3)|*.fr3';
    If frxPrintPreviewForm.SaveDialog1.Execute Then Begin
      If FileExists(frxPrintPreviewForm.SaveDialog1.FileName) Then Begin
        // vOverrite := XLoginpara.YesNo(ViewForm1.SaveDialog1.FileName + ' 已經存在。' + #13 + '您要取代它嗎？');
      End;
      Report.SaveToFile(frxPrintPreviewForm.SaveDialog1.FileName);
    End;
    SetCurrentDir(myCurrentDirectory);
  End Else Begin
    // frxReport.SaveToFile(ReportName);
  End;
  IsModified := True;
  Result := IsModified;
End;

Procedure TfrxPrintPreviewForm.Label1DblClick(Sender: TObject);
Begin
  Button1.Visible := Not Button1.Visible;
  Button2.Visible := Not Button2.Visible;

End;

Procedure TfrxPrintPreviewForm.mExport_JPGClick(Sender: TObject);
Begin
  //frxJpgExportDialog := TfrxJpgExportDialog.Create(Self);
  //// frxJpgExportDialog.Position  := poMainFormCenter;
  //frxJpgExportDialog.CBSeparateFiles.Checked := False;
  //if frxReport.PreviewPages.Count > 1 then begin
  //  frxJpgExportDialog.CBSeparateFiles.Checked := True;
  //end;
  //frxJpgExportDialog.OutputJpegFileName := ChangeFileExt(ReportShortName, '.jpg');
  //frxJpgExportDialog.CBCropImages.Checked := False;
  //;
  //frxJpgExportDialog.CBMonochrome.Checked := False;
  //frxJpgExportDialog.ResolutionE.Text := '96';
  //frxJpgExportDialog.JPEGQualityE.Text := '90';
  //frxJpgExportDialog.OpenCB.Checked := False;
  //frxJpgExportDialog.OpenCB.Visible := False;
  //frxJpgExportDialog.PageControl1.Visible := False;
  //frxJpgExportDialog.Left := Trunc((Self.Width - frxJpgExportDialog.Width) / 2);
  //frxJpgExportDialog.Top := Trunc(Self.Height / 4);

  //if frxJpgExportDialog.ShowModal = mrOk then begin
  //  frxJPEGExport1.CurPage := False;
  //  if frxJpgExportDialog.PageNumbersRB.Checked then begin
  //    frxJPEGExport1.PageNumbers := frxJpgExportDialog.PageNumbersE.Text;
  //  end;
  //  frxJPEGExport1.CropImages := frxJpgExportDialog.CBCropImages.Checked;
  //  frxJPEGExport1.OverwritePrompt := True;
  //  frxJPEGExport1.SeparateFiles := frxJpgExportDialog.CBSeparateFiles.Checked;
  //  frxJPEGExport1.Monochrome := frxJpgExportDialog.CBMonochrome.Checked;
  //  frxJPEGExport1.Resolution := StrToInt(frxJpgExportDialog.ResolutionE.Text);
  //  frxJPEGExport1.JPEGQuality := StrToInt(frxJpgExportDialog.JPEGQualityE.Text);
  //  frxJPEGExport1.CreationTime := Date; // 建立日期
  //  frxJPEGExport1.OpenAfterExport := frxJpgExportDialog.OpenCB.Checked;
  //  frxJPEGExport1.FileName := frxJpgExportDialog.OutputJpegFileName; // ChangeFileExt(ReportShortName, '.jpg');
  //  frxJPEGExport1.ShowProgress := True;
  //  frxJPEGExport1.ShowDialog := False;

  //  frxReport.Export(frxJPEGExport1);
  //  // frxReport.Preview.RefreshReport; // 印出去以後會不見,要刷新一下
  //end;
  //FreeAndNil(frxJpgExportDialog);

End;

Procedure TfrxPrintPreviewForm.mExport_PDFClick(Sender: TObject);
Begin // 單據匯出 PDF
  //frxPDFExport1.FitWindow := True;
  //frxPDFExport1.OpenAfterExport := True; // 轉出後開啟 EXCEL
  //frxPDFExport1.PrintOptimized := True; // 列印最佳化
  //frxPDFExport1.EmbeddedFonts := True; // 入字型
  //frxPDFExport1.Compressed := True; // 壓縮
  //// frxPDFExport1.Author := XLoginpara.FLoginMEMNAME; // 作者
  //// frxPDFExport1.Creator := XLoginpara.FLoginCpna; // 建立者
  //frxPDFExport1.CreationTime := Date; // 建立日期
  //frxPDFExport1.ShowDialog := True;
  //frxPDFExport1.Subject := '';
  //frxPDFExport1.FileName := '' + ChangeFileExt(ReportShortName, '.pdf');
  //frxReport.Export(frxPDFExport1);

  //frxReport.Preview.RefreshReport; // 印出去以後會不見,要刷新一下

End;

Procedure TfrxPrintPreviewForm.mExport_xlsxClick(Sender: TObject);
Begin // 單據匯出 EXCEL xlsx
  //frxXLSXExport1.Wysiwyg := True; // 所見即所得
  //frxXLSXExport1.EmptyLines := False; // 連續的勾 =  EmptyLines=False And  SuppressPageHeadersFooters = True
  //frxXLSXExport1.SuppressPageHeadersFooters := False; // 禁止頁首頁尾 Default=False
  //// frxXLSXExport1.EmptyLines
  //frxXLSXExport1.OverwritePrompt := True; // 覆寫提示 Default=False
  //frxXLSXExport1.ExportPageBreaks := True; // 分頁
  //frxXLSXExport1.CurPage := False; // Default=False
  //frxXLSXExport1.ShowDialog := True;
  //frxXLSXExport1.ShowProgress := True; // 顯示進度條
  //frxXLSXExport1.SlaveExport := False; // Default=False 看不出作用,但不會自動開啟EXCEL
  //frxXLSXExport1.ExportNotPrintable := False; // 轉出不可見的物件 Default=False
  //frxXLSXExport1.UseFileCache := True;
  //frxXLSXExport1.CreationTime := Date; // 建立日期
  //frxXLSXExport1.OpenAfterExport := True; // 轉出後開啟 EXCEL Default=False
  //// RepObj.ffrxXLSExport1.DataOnly :=True;
  //frxXLSXExport1.FileName := '' + ChangeFileExt(ReportShortName, '.xlsx');
  //frxReport.Export(frxXLSXExport1);
  //frxReport.Preview.RefreshReport; // 印出去以後會不見,要刷新一下

End;

Procedure TfrxPrintPreviewForm.BSmallClick(Sender: TObject);
Var
  Ind: integer;
Begin // 縮小
  Ind := DBLUCombo1.ItemIndex;
  If Ind = 5 Then
    Ind := 4
  Else If Ind = 4 Then
    Ind := 0
  Else If Ind = 0 Then
    Ind := 3
  Else If Ind = 3 Then
    Ind := 2
  Else If Ind = 2 Then
    Ind := 1
  Else If Ind = 1 Then
    Ind := 1
  Else
    Ind := 1;

  // 5: RepObj.frxPreview1.Zoom := 2;
  // 4: RepObj.frxPreview1.Zoom := 1.5;
  // 0: RepObj.frxPreview1.ZoomMode := zmPageWidth; // 頁寬
  // 3: RepObj.frxPreview1.Zoom := 1.2;
  // 2: RepObj.frxPreview1.Zoom := 1;
  // 1: RepObj.frxPreview1.ZoomMode := zmWholePage; // 整頁

  DBLUCombo1.ItemIndex := Ind;
  DBLUCombo1.OnChange(DBLUCombo1);

End;



Procedure AdjPageMargins(repobj: TfrxReport; top_mag, left_mag: double); overload;
Var
  II: integer;
  Page: TfrxReportPage;
Begin
  // 應該不用每個物件移，移左邊界就好 1080214
  // repobj.InitialZoom := pzPageWidth;
  For II := 0 To repobj.PagesCount - 1 Do Begin
    If repobj.Pages[II] Is TfrxReportPage Then Begin
      Page := repobj.Pages[II] As TfrxReportPage;
      Page.TopMargin := Page.TopMargin + Trunc(top_mag * 91);
      Page.LeftMargin := Page.LeftMargin + Trunc(left_mag * 91); // 1080214
    End;
  End;
End;

// 改變紙張
Procedure myChangePaperfr(frReport: TfrxReport; PaperSize: string); overload;
//var
//  I: integer;
Begin
  //if FileExists(DllPath + 'A4Paper.FLG') then begin
  //  for I := 0 to frReport.PagesCount - 1 do begin
  //    if frReport.Pages[I] is TfrxReportPage then begin
  //      (frReport.Pages[I] as TfrxReportPage).PaperSize := 9;
  //    end;
  //  end;
  //end else begin
  //  for I := 0 to frReport.PagesCount - 1 do begin
  //    if frReport.Pages[I] is TfrxReportPage then begin
  //      if (frReport.Pages[I] as TfrxReportPage).PaperSize = 39 then begin
  //        Continue; // Exit; // USD 大張的不設
  //      end;
  //      if UpperCase(PaperSize) = UpperCase('Letter') then begin
  //        (frReport.Pages[I] as TfrxReportPage).PaperSize := 1;
  //      end;
  //    end;
  //  end;
  //end;
End;

Function AdjBandHeight(repobj: TfrxReport; vpath: string): boolean;
Var
  SL: TStringList;
  Str, kind: string;
  II, xx: integer;
Begin
  Result := False;

  // 調整 表尾
  If FileExists(vpath + 'PageAdj.txt') Then Begin
    SL := TStringList.Create;
    SL.LoadFromFile(vpath + 'PageAdj.txt');

    For xx := 0 To SL.Count - 1 Do Begin
      If Pos('pagehead', SL[xx]) > 0 Then Begin
        Str := AnsiReplaceStr(SL[xx], 'pagehead=', '');
        kind := 'pagehead';
      End Else If Pos('pagefoot', SL[xx]) > 0 Then Begin
        Str := AnsiReplaceStr(SL[xx], 'pagefoot=', '');
        kind := 'pagefoot';
      End Else If Pos('detailband', SL[xx]) > 0 Then Begin
        Str := AnsiReplaceStr(SL[xx], 'detailband=', '');
        kind := 'detailband';
      End;
      II := 0;
      If (TryStrtoInt(Trim(Str), II)) Then Begin
        If kind = 'pagehead' Then Begin
          If TFrxPageHeader(repobj.FindObject('PageHeaderBand')) <> nil Then Begin
            TFrxPageHeader(repobj.FindObject('PageHeaderBand')).Height :=
              TFrxPageHeader(repobj.FindObject('PageHeaderBand')).Height + II;
            Result := True;
          End;
        End Else If kind = 'pagefoot' Then Begin
          If TFrxPageFooter(repobj.FindObject('PageFooterBand')) <> nil Then Begin
            TFrxPageFooter(repobj.FindObject('PageFooterBand')).Height :=
              TFrxPageFooter(repobj.FindObject('PageFooterBand')).Height + II;
            Result := True;
          End;
        End Else If kind = 'detailband' Then Begin
          If TFrxMasterData(repobj.FindObject('DetailBand')) <> nil Then Begin
            TFrxMasterData(repobj.FindObject('DetailBand')).Height :=
              TFrxMasterData(repobj.FindObject('DetailBand')).Height + II;
            Result := True;
          End;
        End;
      End;
    End;
    FreeAndNil(SL);
  End;

End;

Procedure myAddStylesTofrxReport(frxReport1: TfrxReport);
Var
  Style: TfrxStyleItem;
  Styles: TfrxStyles;
Begin
  // Memo_Amt1.Style := Report.Styles.Items[Line].Name; 報表使用方式
  // 0.無 1.單底線 2.雙底線 3.上單下雙 4.上虛下單 5.上虛下雙 6.上單下單 7.單虛底線 8.上單線 9.上雙線
  Styles := TfrxStyles.Create(frxReport1);
  { 0.無 style }
  Style := Styles.Add;
  Style.Name := 'Style0';
  Style.Frame.Typ := [];
  { 1.單底線 style }
  Style := Styles.Add;
  Style.Name := 'Style1';
  Style.Frame.Typ := [ftBottom];
  Style.Frame.BottomLine.Style := fsSolid;
  { 2.雙底線 style }
  Style := Styles.Add;
  Style.Name := 'Style2';
  Style.Frame.Typ := [ftBottom];
  Style.Frame.BottomLine.Style := fsDouble;
  { 3.上單下雙 style }
  Style := Styles.Add;
  Style.Name := 'Style3';
  Style.Frame.Typ := [ftTop, ftBottom];
  Style.Frame.TopLine.Style := fsSolid;
  Style.Frame.BottomLine.Style := fsDouble;
  { 4.上虛下單 style }
  Style := Styles.Add;
  Style.Name := 'Style4';
  Style.Frame.Typ := [ftTop, ftBottom];
  Style.Frame.TopLine.Style := fsDash;
  Style.Frame.BottomLine.Style := fsSolid;
  { 5.上虛下雙 style }
  Style := Styles.Add;
  Style.Name := 'Style5';
  Style.Frame.Typ := [ftTop, ftBottom];
  Style.Frame.TopLine.Style := fsDash;
  Style.Frame.BottomLine.Style := fsDouble;
  { 6.上單下單 style }
  Style := Styles.Add;
  Style.Name := 'Style6';
  Style.Frame.Typ := [ftTop, ftBottom];
  Style.Frame.TopLine.Style := fsSolid;
  Style.Frame.BottomLine.Style := fsSolid;
  { 7.單虛底線 style }
  Style := Styles.Add;
  Style.Name := 'Style7';
  Style.Frame.Typ := [ftBottom];
  Style.Frame.BottomLine.Style := fsDash;
  { 8.上單線 style }
  Style := Styles.Add;
  Style.Name := 'Style8';
  Style.Frame.Typ := [ftTop];
  Style.Frame.TopLine.Style := fsSolid;
  { 9.上雙線 style }
  Style := Styles.Add;
  Style.Name := 'Style9';
  Style.Frame.Typ := [ftTop];
  Style.Frame.TopLine.Style := fsDouble;
  { apply a set to the report }
  frxReport1.Styles.Clear;
  frxReport1.Styles := Styles;
  frxReport1.Styles.Apply;

  FreeAndNil(Styles);

End;

Procedure AddVariablesToReport(ffrxReport1: TfrxReport); // 在報表加入公用變數
Var
  frVars: TfrxVariables;
  Category, Variable: TfrxVariable;
  CategoryName: string;
Begin
  frVars := ffrxReport1.Variables;

  CategoryName := ' ' + 'HS';
  If frVars.IndexOf(CategoryName) = -1 Then Begin
    Category := frVars.Add;
    Category.Name := CategoryName;
  End;

  //If frVars.IndexOf('作業年度') <> -1 Then Begin
  //  frVars.Items[frVars.IndexOf('作業年度')].Value := QuotedStr(oPublic.Values['作業年度']);
  //End Else Begin
  //  Variable := frVars.Add;
  //  Variable.Name := '作業年度';
  //  Variable.Value := QuotedStr(oPublic.Values['作業年度']);
  //End;
  //If frVars.IndexOf('公司名稱') <> -1 Then Begin
  //  frVars.Items[frVars.IndexOf('公司名稱')].Value := QuotedStr(oPublic.Values['公司名稱']);
  //End Else Begin
  //  Variable := frVars.Add;
  //  Variable.Name := '公司名稱';
  //  Variable.Value := QuotedStr(oPublic.Values['公司名稱']);
  //End;
  If frVars.IndexOf('列印日期') <> -1 Then Begin
    frVars.Items[frVars.IndexOf('列印日期')].Value := QuotedStr(DateTostr(Date)); // QuotedStr(oPublic.Values['作業日期']);
  End Else Begin
    Variable := frVars.Add;
    Variable.Name := '列印日期';
    Variable.Value := QuotedStr(DateTostr(Date)); // QuotedStr(oPublic.Values['作業日期']);
  End;
  If frVars.IndexOf('表尾') <> -1 Then Begin
    frVars.Items[frVars.IndexOf('表尾')].Value := QuotedStr('表尾'); //QuotedStr(oPublic.Values['表尾']);
  End Else Begin
    Variable := frVars.Add;
    Variable.Name := '表尾';
    Variable.Value := QuotedStr('表尾'); //QuotedStr(oPublic.Values['表尾']);
  End;
  //If frVars.IndexOf('製表人員') <> -1 Then Begin
  //  frVars.Items[frVars.IndexOf('製表人員')].Value := QuotedStr(oPublic.Values['登入名稱']);
  //End Else Begin
  //  Variable := frVars.Add;
  //  Variable.Name := '製表人員';
  //  Variable.Value := QuotedStr(oPublic.Values['登入名稱']);
  //End;
  //If frVars.IndexOf('事務所統編') <> -1 Then Begin
  //  frVars.Items[frVars.IndexOf('事務所統編')].Value := QuotedStr(oPublic.Values['事務所統編']);
  //End Else Begin
  //  Variable := frVars.Add;
  //  Variable.Name := '事務所統編';
  //  Variable.Value := QuotedStr( oPublic.Values['事務所統編'] );
  //End;
  //If frVars.IndexOf('事務所名稱') <> -1 Then Begin
  //  frVars.Items[frVars.IndexOf('事務所名稱')].Value := QuotedStr(oPublic.Values['事務所名稱']);
  //End Else Begin
  //  Variable := frVars.Add;
  //  Variable.Name := '事務所名稱';
  //  Variable.Value := QuotedStr( oPublic.Values['事務所名稱'] );
  //End;
  //If frVars.IndexOf('事務所負責人') <> -1 Then Begin
  //  frVars.Items[frVars.IndexOf('事務所負責人')].Value := QuotedStr(oPublic.Values['事務所負責人']);
  //End Else Begin
  //  Variable := frVars.Add;
  //  Variable.Name := '事務所負責人';
  //  Variable.Value := QuotedStr( oPublic.Values['事務所負責人'] );
  //End;
  //If frVars.IndexOf('事務所地址') <> -1 Then Begin
  //  frVars.Items[frVars.IndexOf('事務所地址')].Value := QuotedStr(oPublic.Values['事務所地址']);
  //End Else Begin
  //  Variable := frVars.Add;
  //  Variable.Name := '事務所地址';
  //  Variable.Value := QuotedStr( oPublic.Values['事務所地址'] );
  //End;
  //If frVars.IndexOf('事務所電話') <> -1 Then Begin
  //  frVars.Items[frVars.IndexOf('事務所電話')].Value := QuotedStr(oPublic.Values['事務所電話']);
  //End Else Begin
  //  Variable := frVars.Add;
  //  Variable.Name := '事務所電話';
  //  Variable.Value := QuotedStr( oPublic.Values['事務所電話'] );
  //End;

  {
  If frVars.IndexOf('公司外文名稱') <> -1 Then Begin
    frVars.Items[frVars.IndexOf('公司外文名稱')].Value := QuotedStr(DataModule1.oPublic.Values['公司名稱']);
  End Else Begin
    Variable := frVars.Add;
    Variable.Name := '公司外文名稱';
    Variable.Value := '''' + DataModule1.oPublic.Values['公司名稱'] + '''';
  End;
  If frVars.IndexOf('公司統編') <> -1 Then Begin
    frVars.Items[frVars.IndexOf('公司統編')].Value := QuotedStr(DataModule1.oPublic.Values['公司統編']);
  End Else Begin
    Variable := frVars.Add;
    Variable.Name := '公司統編';
    Variable.Value := '''' + DataModule1.oPublic.Values['公司統編'] + '''';
  End;
  If frVars.IndexOf('公司地址') <> -1 Then Begin
    frVars.Items[frVars.IndexOf('公司地址')].Value := QuotedStr(DataModule1.oPublic.Values['公司地址']);
  End Else Begin
    Variable := frVars.Add;
    Variable.Name := '公司地址';
    Variable.Value := '''' + DataModule1.oPublic.Values['公司地址'] + '''';
  End;
  If frVars.IndexOf('公司電話') <> -1 Then Begin
    frVars.Items[frVars.IndexOf('公司電話')].Value := QuotedStr(DataModule1.oPublic.Values['公司電話']);
  End Else Begin
    Variable := frVars.Add;
    Variable.Name := '公司電話';
    Variable.Value := '''' + DataModule1.oPublic.Values['公司電話'] + '''';
  End;
  If frVars.IndexOf('公司傳真') <> -1 Then Begin
    frVars.Items[frVars.IndexOf('公司傳真')].Value := QuotedStr(DataModule1.oPublic.Values['公司傳真']);
  End Else Begin
    Variable := frVars.Add;
    Variable.Name := '公司傳真';
    Variable.Value := '''' + DataModule1.oPublic.Values['公司傳真'] + '''';
  End;
  // 1120530  建議 #4060 FLoginBOSS
  If frVars.IndexOf('公司負責人') <> -1 Then Begin
    frVars.Items[frVars.IndexOf('公司負責人')].Value := QuotedStr('負責人');
  End Else Begin
    Variable := frVars.Add;
    Variable.Name := '公司負責人';
    Variable.Value := QuotedStr('負責人');
  End;
  If frVars.IndexOf('公司稅籍編號') <> -1 Then Begin
    frVars.Items[frVars.IndexOf('公司稅籍編號')].Value := QuotedStr('稅籍編號');
  End Else Begin
    Variable := frVars.Add;
    Variable.Name := '公司稅籍編號';
    Variable.Value := QuotedStr('稅籍編號');
  End;

  If frVars.IndexOf('單據表尾簽章') <> -1 Then Begin
    frVars.Items[frVars.IndexOf('單據表尾簽章')].Value := QuotedStr('表尾簽章');
  End Else Begin
    Variable := frVars.Add;
    Variable.Name := '單據表尾簽章';
    Variable.Value := QuotedStr('表尾簽章');
  End;
}
End;

End.
