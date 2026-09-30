Program WbaseBridge;
{$mode objfpc}{$H+}
Uses
  SysUtils,
  Windows,
  Classes,
  fpjson,
  jsonparser;

Type
  Twaccrep3101_b = Function(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const path: ansistring): integer; stdcall;
  TGeneric2 = Function(a1: double; a2: ansistring): integer; stdcall;
  TGenericIntStr = Function(a1: integer; a2: ansistring): integer; stdcall;

Var
  hLib: HMODULE;

  Function GetDllPathFromKey(dllKey: string; explicitPath: string): string;
  Var
    exePath: string;
  Begin
    If (explicitPath <> '') And FileExists(explicitPath) Then Exit(explicitPath);
    exePath := ExtractFilePath(ParamStr(0));
    If FileExists(exePath + 'wbase' + PathDelim + dllKey + '.dll') Then Result := exePath + 'wbase' + PathDelim + dllKey + '.dll'
    Else If FileExists(exePath + dllKey + '.dll') Then Result := exePath + dllKey + '.dll'
    Else If FileExists(exePath + 'wbase' + PathDelim + 'wbaseRP.dll') Then Result := exePath + 'wbase' + PathDelim + 'wbaseRP.dll'
    Else If FileExists('F:\ADSProject\Wx3000\report\wbase\wbaseRP.dll') Then Result := 'F:\ADSProject\Wx3000\report\wbase\wbaseRP.dll'
    Else
      Result := explicitPath;
  End;

  // --- 搶焦點執行緒 (同之前) ---
  Function ForceForeground(hWnd: HWND): boolean;
  Var
    ForeThread, CurThread: DWORD;
    ForeWnd: HWND;
  Begin
    Result := False;
    If hWnd = 0 Then Exit;
    ForeWnd := GetForegroundWindow;
    ForeThread := GetWindowThreadProcessId(ForeWnd, nil);
    CurThread := GetCurrentThreadId;
    If ForeThread <> CurThread Then AttachThreadInput(CurThread, ForeThread, True);
    ShowWindow(hWnd, SW_RESTORE);
    ShowWindow(hWnd, SW_SHOW);
    SetWindowPos(hWnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE Or SWP_NOSIZE Or SWP_SHOWWINDOW);
    SetForegroundWindow(hWnd);
    BringWindowToTop(hWnd);
    SetActiveWindow(hWnd);
    SetWindowPos(hWnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE Or SWP_NOSIZE Or SWP_SHOWWINDOW);
    If ForeThread <> CurThread Then AttachThreadInput(CurThread, ForeThread, False);
    Result := True;
  End;

  Function EnumFindAndBring(Wnd: HWND; Param: LPARAM): BOOL; stdcall;
  Var
    pid: DWORD;
    buf: Array[0..255] Of char;
  Begin
    Result := True;
    GetWindowThreadProcessId(Wnd, @pid);
    If pid <> GetCurrentProcessId Then Exit;
    If Not IsWindowVisible(Wnd) Then Exit;
    If Wnd = GetConsoleWindow Then Exit;
    GetWindowText(Wnd, buf, 255);
    If StrLen(buf) = 0 Then Exit;
    ForceForeground(Wnd);
    Result := False;
  End;

Type
  TBringThread = Class(TThread)
  protected
    Procedure Execute; override;
  End;

  Procedure TBringThread.Execute;
  Var
    i: integer;
  Begin
    For i := 1 To 25 Do Begin
      If Terminated Then Exit;
      Sleep(200);
      EnumWindows(@EnumFindAndBring, 0);
    End;
  End;

  // --- 參數解析 ---
  Function ParseArgs(Const jsonStr: string): TJSONArray;
  Var
    parser: TJSONParser;
    Data: TJSONData;
  Begin
    parser := TJSONParser.Create(jsonStr);
    Try
      Data := parser.Parse;
      If Data Is TJSONArray Then Result := TJSONArray(Data)
      Else
        Result := TJSONArray.Create;
    Finally
      parser.Free;
    End;
  End;

Var
  dllPath, funcName, argsJsonStr, dllKey: string;
  args: TJSONArray;
  i: integer;
  BringThread: TBringThread;
  ret: integer;
  p: Twaccrep3101_b;
  needBring: boolean;
Begin
  Try
    // 支援兩種呼叫: 舊版 6參數, 新版 --dll --func --args
    dllPath := '';
    funcName := '';
    argsJsonStr := '';
    dllKey := '';
    // 解析 --dll --func --args
    i := 1;
    While i <= ParamCount Do Begin
      If ParamStr(i) = '--dll' Then Begin
        If i + 1 <= ParamCount Then dllPath := ParamStr(i + 1);
        Inc(i, 2);
      End
      Else If ParamStr(i) = '--func' Then Begin
        If i + 1 <= ParamCount Then funcName := ParamStr(i + 1);
        Inc(i, 2);
      End
      Else If ParamStr(i) = '--args' Then Begin
        If i + 1 <= ParamCount Then argsJsonStr := ParamStr(i + 1);
        Inc(i, 2);
      End
      Else If ParamStr(i) = '--dllkey' Then Begin
        If i + 1 <= ParamCount Then dllKey := ParamStr(i + 1);
        Inc(i, 2);
      End
      Else
        Break;
    End;

    // 如果沒有 -- 參數，視為舊版 waccrep3101_b 6參數相容
    If funcName = '' Then  Begin
      If ParamCount >= 6 Then  Begin
        funcName := 'waccrep3101_b';
        dllPath := GetDllPathFromKey('wbaseRP', dllPath);
        // 舊版轉 JSON
        argsJsonStr := Format('[%s,%s,%s,%s,%s,"%s"]', [ParamStr(1), ParamStr(2), ParamStr(3), ParamStr(4), ParamStr(5), StringReplace(ParamStr(6), '"', '\"', [rfReplaceAll])]);
        dllKey := 'wbaseRP';
      End Else Begin
        Writeln('Usage: WbaseBridge.exe --dll <path> --func <name> --args "[...]"');
        Writeln('   or: WbaseBridge.exe hs_chk top_mag left_mag PrtIndex IsPrint path  (legacy waccrep3101_b)');
        Halt(1);
      End;
    End;

    If dllPath = '' Then dllPath := GetDllPathFromKey(dllKey, '');
    If Not FileExists(dllPath) Then Begin
      Writeln('ERROR: DLL not found: ' + dllPath);
      Halt(2);
    End;

    hLib := LoadLibrary(PChar(dllPath));
    If hLib = 0 Then Begin
      Writeln(Format('ERROR: LoadLibrary %s Code=%d', [dllPath, GetLastError]));
      Halt(3);
    End;

    args := ParseArgs(argsJsonStr);

    // ========== 通用分發表：加新函數只在這裡加 ==========
    If funcName = 'waccrep3101_b' Then  Begin
      // 6參數版: double,double,double,int,int,str
      Pointer(p) := GetProcAddress(hLib, PChar(funcName));
      If Not Assigned(p) Then Begin
        Writeln('ERROR: GetProcAddress ' + funcName);
        Halt(4);
      End;

      // 判斷是否預覽 (IsPrint = 第5個參數)
      If (args.Count >= 5) Then  Begin
        Try
          If args.Integers[4] = 0 Then needBring := True;
        Except
        End;
      End;

      If needBring Then  Begin
        BringThread := TBringThread.Create(True);
        BringThread.FreeOnTerminate := False;
        BringThread.Start;
      End Else
        BringThread := nil;

      ret := p(
        args.Floats[0],
        args.Floats[1],
        args.Floats[2],
        args.Integers[3],
        args.Integers[4],
        ansistring(args.Strings[5])
        );

      If Assigned(BringThread) Then Begin
        BringThread.Terminate;
        BringThread.WaitFor;
        BringThread.Free;
      End;
      Writeln('OK:' + IntToStr(ret));

    End Else Begin
      // 範例：其他簽名可在此擴充
      // 你只要複製上面一段，改成你的參數類型
      Writeln('ERROR: Function ' + funcName + ' not implemented in generic dispatcher. 請在 WbaseBridge.lpr 加上對應分支');
      // 範本：
      // if funcName = 'myFunc1' then begin
      //   var p: TGenericIntStr; Pointer(p) := GetProcAddress...
      //   ret := p(args.Integers[0], AnsiString(args.Strings[1]));
      // end
      Halt(5);
    End;

    FreeLibrary(hLib);
    args.Free;
  Except
    on E: Exception Do Begin
      Writeln('ERROR:' + E.ClassName + ':' + E.Message);
      Halt(9);
    End;
  End;
End.
