unit wbase_unit1;

{$mode ObjFPC}{$H+}

interface

uses
  Interfaces, Classes, SysUtils, Forms, Controls, Graphics, Dialogs, StdCtrls,
  ComCtrls, ExtCtrls, ZConnection, ZDataset, frxClass, frxDesgn, frxDBSet,Buttons,
  frxPreview;

type

  { TfrmfrxRpt1 }

  TfrmfrxRpt1 = class(TForm)
    BClose: TSpeedButton;
    BDesgin: TSpeedButton;
    BExport: TSpeedButton;
    BFirst: TSpeedButton;
    Blarge: TSpeedButton;
    BLast: TSpeedButton;
    BNext: TSpeedButton;
    BPrint: TSpeedButton;
    BPrior: TSpeedButton;
    BRefresh: TSpeedButton;
    BResetReport: TSpeedButton;
    BSmall: TSpeedButton;
    Button1: TButton;
    Button2: TButton;
    CmbBins: TComboBox;
    DBLUCombo1: TComboBox;
    Edit_Jump: TEdit;
    frxDBDataset1: TfrxDBDataset;
    frxDesigner1: TfrxDesigner;
    frxPreview1: TfrxPreview;
    frxReport1: TfrxReport;
    Label1: TLabel;
    Label4: TLabel;
    Label5: TLabel;
    Label6: TLabel;
    Label_frxReportName: TLabel;
    TopPanel: TPanel;
    ZConnection1: TZConnection;
    ZQuery1: TZQuery;
  private

  public

  end;

var
  frmfrxRpt1: TfrmfrxRpt1;

implementation

{$R *.lfm}


{ TfrmfrxRpt1 }

end.

