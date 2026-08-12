Library wbaseRP;
{$mode objfpc}{$H+}
Uses
  Interfaces, // 必須保留
  Windows, Classes, SysUtils, Forms, Dialogs, wbase_unit1, wbase_Repunit1,
  util_frxprintpreviewform, zcomponent; // 加上 Forms

  //Function waccrep3101_b(): integer; stdcall;  // GUI OK
  //Begin
  //  Result := 1;
  //  Try
  //    ShowMessage('OK - GUI 順利啟動！');
  //  Except
  //    On E: Exception Do Begin
  //      Result := 0;
  //      ShowMessage('錯誤訊息:' + E.Message + #10 + '類別:' + E.ClassName);
  //    End;
  //  End;
  //End;

Exports
  waccrep3101_b; // 日記帳

{$R *.res}

Begin

  RequireDerivedFormResource:=True;
  Application.Scaled:=True;
  Application.Initialize;
 // Application.CreateForm(TfrmfrxRpt1, frmfrxRpt1);
 // Application.Run;

End.
