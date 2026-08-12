program wbase_test;

{$mode objfpc}{$H+}

uses
  {$IFDEF UNIX}
  cthreads,
  {$ENDIF}
  {$IFDEF HASAMIGA}
  athreads,
  {$ENDIF}
  Interfaces, // this includes the LCL widgetset
  Forms, wbase_Repunit1, wbase_unit1, util_frxprintpreviewform, zcomponent,
  wbase_test_unit1;

{$R *.res}

begin
  RequireDerivedFormResource:=True;
  Application.Scaled:=True;
  {$PUSH}{$WARN 5044 OFF}
  Application.MainFormOnTaskbar:=True;
  {$POP}
  Application.Initialize;
  //Application.CreateForm(TfrmfrxRpt1, frmfrxRpt1);  //
  Application.CreateForm(TForm1, Form1);  // Test DLL
  Application.Run;
end.

