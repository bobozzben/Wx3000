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
  waccrep3101_b,  // 建檔人員清冊
  wbase1050_taxno_list,  // 基本稅務人員清冊
  wbase1060_recitem_list,  // 基本收費項目清冊
  wbase1070_recnote_list,  // 收費備註名冊
  wbase1080_feesummary_list,  // 基本收費摘要清冊
  wbase3010_ticketplace_list,  // 統一發票購買地點清冊
  wbase320_buyinv,  // 預購統一發票列印
  wbase350_buyinv_list,  // 統一發票購買清單
  wbase2040_receipt,  // 客戶收費收據
  wbase2040_bill;  // 客戶請款單

{$R *.res}

Begin

  RequireDerivedFormResource:=True;
  Application.Scaled:=True;
  Application.Initialize;
  Application.Name:='wbaseRP';
 // Application.CreateForm(TfrmfrxRpt1, frmfrxRpt1);
 // Application.Run;

End.
