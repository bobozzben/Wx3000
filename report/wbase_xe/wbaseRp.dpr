library wbaseRp;

{ Important note about DLL memory management: ShareMem must be the
  first unit in your library's USES clause AND your project's (select
  Project-View Source) USES clause if your DLL exports any procedures or
  functions that pass strings as parameters or function results. This
  applies to all strings passed to and from your DLL--even those that
  are nested in records and classes. ShareMem is the interface unit to
  the BORLNDMM.DLL shared memory manager, which must be deployed along
  with your DLL. To avoid using BORLNDMM.DLL, pass string information
  using PChar or ShortString parameters. }

uses
  SysUtils, Dialogs,
  Classes;

{$R *.res}



Function waccrep3101_b(): integer; stdcall;
Begin
  Result := 1;
  Try
    Showmessage('OK');
  Except
    On E: Exception Do Begin
      Result := 0;
      ShowMessage('錯誤訊息:' + E.Message + #10 + '類別:' + E.ClassName);
    End;
  End;
End;


exports
 waccrep3101_b; // 日記帳


begin
end.
