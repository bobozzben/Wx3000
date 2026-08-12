unit wbase_test_exe_unit1;

{$mode ObjFPC}{$H+}

interface

uses
  Classes, SysUtils, Forms, Controls, Graphics, Dialogs, StdCtrls;

type

  { TForm_Test_Exe }

  TForm_Test_Exe = class(TForm)
    Button1: TButton;
    procedure Button1Click(Sender: TObject);
  private

  public

  end;

var
  Form_Test_Exe: TForm_Test_Exe;

implementation

{$R *.lfm}

uses wbase_Repunit1;

{ TForm_Test_Exe }

procedure TForm_Test_Exe.Button1Click(Sender: TObject);
begin
    waccrep3101_b(Application.Handle,0,0,0,0,0,'');

end;

end.

