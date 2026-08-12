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
    frxDBDataset1: TfrxDBDataset;
    frxDesigner1: TfrxDesigner;
    frxReport1: TfrxReport;
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

