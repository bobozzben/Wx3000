unit wbase_unit1;

{$mode ObjFPC}{$H+}

interface

uses
  Interfaces, Classes, SysUtils, Forms, Controls, Graphics, Dialogs, StdCtrls,
  ComCtrls, ExtCtrls, frxClass, frxDesgn, frxDBSet,Buttons,
  frxPreview;

type

  { TfrmfrxRpt1 }

  TfrmfrxRpt1 = class(TForm)
    frxDBDataset1: TfrxDBDataset;
    frxDesigner1: TfrxDesigner;
    frxReport_3501_buyinv: TfrxReport;
    frxReport_1030_keyin: TfrxReport;
    frxReport_1050_taxno: TfrxReport;
    frxReport_1060_recitem: TfrxReport;
    frxReport_1070_recnote: TfrxReport;
    frxReport_1080_feesummary: TfrxReport;
    frxReport_3010_ticketplace: TfrxReport;
    frxReport_3502_buyinv: TfrxReport;
    frxReport_320_buyinv: TfrxReport;
    frxReport_2040_receipt: TfrxReport;
    frxReport_2040_bill: TfrxReport;
  private

  public

  end;

var
  frmfrxRpt1: TfrmfrxRpt1;

implementation

{$R *.lfm}


{ TfrmfrxRpt1 }

end.

