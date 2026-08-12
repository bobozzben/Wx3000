unit wbase_test_unit1;

{$mode ObjFPC}{$H+}

interface

uses
  Classes, SysUtils, Forms, Controls, Graphics, Dialogs, StdCtrls,lazutf8,Win32Proc;

type

  { TForm1 }

  TForm1 = class(TForm)
    Button1: TButton;
    Button2: TButton;
    procedure Button1Click(Sender: TObject);
    procedure Button2Click(Sender: TObject);
  private

  public

  end;

  //Function waccrep3101_b(vMainAppHandle: THandle;Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: Integer; Const path: AnsiString): Integer; Stdcall;external 'F:\ADSProject\Wx3000\report\wbase\wbaseRP.dll';
  Function waccrep3101_b(): Integer; Stdcall;external 'F:\ADSProject\Wx3000\report\wbase\wbaseRP.dll';

var
  Form1: TForm1;

implementation

{$R *.lfm}

{ TForm1 }

procedure TForm1.Button1Click(Sender: TObject);
begin
    {$IfDef CPU64}
  //  ShowMessage('目前主程式是：64位元 (x64)');
    {$Else}
    ShowMessage('目前主程式是：32位元 (x86)');
    {$EndIf}

    waccrep3101_b(); //Application.Handle,0,0,0,0,0,'');

    //Showmessage(ConsoleToUTF8(GetLastErrorText(1407)));  //1407 找不到視窗類別
end;

procedure TForm1.Button2Click(Sender: TObject);
type
  TShowDllForm = function(): Integer; Stdcall;
  //TShowDllForm = function(vMainAppHandle: THandle;Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: Integer; Const path: AnsiString): Integer; Stdcall;
var
  DllHandle: THandle;
  ShowFormFunc: TShowDllForm;
begin
  DllHandle := LoadLibrary('F:\ADSProject\Wx3000\report\wbase\wbaseRP.dll');
  if DllHandle <> 0 then  begin
    try
      Pointer(ShowFormFunc) := GetProcAddress(DllHandle, 'waccrep3101_b');
      if Assigned(ShowFormFunc) then  begin
        // 呼叫函式，開啟 DLL 表單
        ShowFormFunc();
        //ShowFormFunc(Application.Handle,0,0,0,0,0,'');
      end;
    finally
      FreeLibrary(DllHandle);
    end;
  end;
end;

end.

