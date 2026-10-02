Program WbaseBridge;
{$mode objfpc}{$H+}
Uses
  SysUtils,
  Windows,
  Classes,
  fpjson,
  jsonparser,
  base64;

Type
  Twaccrep3101_b = Function(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const path: ansistring): integer; stdcall;
  TGeneric2 = Function(a1: double; a2: ansistring): integer; stdcall;
  TGenericIntStr = Function(a1: integer; a2: ansistring): integer; stdcall;

Var
  hLib: HMODULE;

  Function GetDllPathFromKey(dllKey: string; explicitPath: string): string;
  Var
    exePath, cleanExplicit: string;
  Begin
    cleanExplicit := SetDirSeparators(explicitPath);
    If (cleanExplicit <> '') And FileExists(cleanExplicit) Then Exit(cleanExplicit);

    exePath := ExtractFilePath(ParamStr(0));
    If (dllKey <> '') And FileExists(exePath + 'wbase' + PathDelim + dllKey + '.dll') Then Exit(exePath + 'wbase' + PathDelim + dllKey + '.dll');
    If (dllKey <> '') And FileExists(exePath + dllKey + '.dll') Then Exit(exePath + dllKey + '.dll');
    If (dllKey <> '') And FileExists('F:\ADSProject\Wx3000\report\wbase\' + dllKey + '.dll') Then Exit('F:\ADSProject\Wx3000\report\wbase\' + dllKey + '.dll');
    If FileExists(exePath + 'wbase' + PathDelim + 'wbaseRP.dll') Then Exit(exePath + 'wbase' + PathDelim + 'wbaseRP.dll');
    If FileExists(exePath + 'wbaseRP.dll') Then Exit(exePath + 'wbaseRP.dll');
    If FileExists('F:\ADSProject\Wx3000\report\wbase\wbaseRP.dll') Then Exit('F:\ADSProject\Wx3000\report\wbase\wbaseRP.dll');

    Result := cleanExplicit;
  End;

  // --- 搶焦點執行緒 ---
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

  // --- 安全取出 JSON 參數輔助函式 ---
  Function GetFloatArg(arr: TJSONArray; idx: integer; defaultVal: double = 0.0): double;
  Begin
    If (arr = nil) Or (idx < 0) Or (idx >= arr.Count) Then Exit(defaultVal);
    Try
      If arr.Types[idx] = jtNumber Then
        Result := arr.Floats[idx]
      Else If arr.Types[idx] = jtString Then
        Result := StrToFloatDef(arr.Strings[idx], defaultVal)
      Else
        Result := defaultVal;
    Except
      Result := defaultVal;
    End;
  End;

  Function GetIntArg(arr: TJSONArray; idx: integer; defaultVal: integer = 0): integer;
  Begin
    If (arr = nil) Or (idx < 0) Or (idx >= arr.Count) Then Exit(defaultVal);
    Try
      If arr.Types[idx] = jtNumber Then
        Result := arr.Integers[idx]
      Else If arr.Types[idx] = jtString Then
        Result := StrToIntDef(arr.Strings[idx], defaultVal)
      Else
        Result := defaultVal;
    Except
      Result := defaultVal;
    End;
  End;

  Function GetStrArg(arr: TJSONArray; idx: integer; defaultVal: string = ''): string;
  Begin
    If (arr = nil) Or (idx < 0) Or (idx >= arr.Count) Then Exit(defaultVal);
    Try
      If arr.Types[idx] = jtNull Then
        Result := ''
      Else
        Result := arr.Strings[idx];
    Except
      Result := defaultVal;
    End;
  End;

  // --- 參數解析 ---
  Function ParseArgs(Const jsonStr: string): TJSONArray;
  Var
    parser: TJSONParser;
    Data: TJSONData;
    s: string;
  Begin
    Result := TJSONArray.Create;
    s := Trim(jsonStr);
    If s = '' Then Exit;
    // 若傳入為 Base64 字串，先進行解碼
    If (Length(s) > 0) And (s[1] <> '[') And (s[1] <> '{') And (s[1] <> '"') Then Begin
      Try
        s := DecodeStringBase64(s);
      Except
      End;
    End;

    If (Length(s) >= 2) And (s[1] = '"') And (s[Length(s)] = '"') And (s[2] = '[') Then
      s := Copy(s, 2, Length(s) - 2);

    Try
      parser := TJSONParser.Create(s, True);
      Try
        Data := parser.Parse;
        If Data Is TJSONArray Then Begin
          Result.Free;
          Result := TJSONArray(Data);
        End Else If Data <> nil Then
          Data.Free;
      Finally
        parser.Free;
      End;
    Except
    End;
  End;

Var
  dllPath, funcName, argsJsonStr, dllKey: string;
  args: TJSONArray;
  i: integer;
  BringThread: TBringThread;
  ret: integer;
  p6: Twaccrep3101_b;
  p2: TGeneric2;
  pIntStr: TGenericIntStr;
  needBring: boolean;
Begin
  Try
    // 支援兩種呼叫: 舊版 6參數, 新版 --dll --func --args
    dllPath := '';
    funcName := '';
    argsJsonStr := '';
    dllKey := '';
    needBring := False;

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
    If funcName = '' Then Begin
      If ParamCount >= 6 Then Begin
        funcName := 'waccrep3101_b';
        dllKey := 'wbaseRP';
        dllPath := GetDllPathFromKey('wbaseRP', dllPath);
        // 舊版轉 JSON
        argsJsonStr := Format('[%s,%s,%s,%s,%s,"%s"]', [ParamStr(1), ParamStr(2), ParamStr(3), ParamStr(4), ParamStr(5), StringReplace(ParamStr(6), '"', '\"', [rfReplaceAll])]);
      End Else Begin
        Writeln('Usage: WbaseBridge.exe --dll <path> --func <name> --args "[...]"');
        Writeln('   or: WbaseBridge.exe hs_chk top_mag left_mag PrtIndex IsPrint path  (legacy waccrep3101_b)');
        Halt(1);
      End;
    End;

    dllPath := GetDllPathFromKey(dllKey, dllPath);
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
    If (funcName = 'waccrep3101_b') Or (funcName = 'wbase320_buyinv') Or (args.Count >= 5) Then Begin
      // 6參數標準報表版: double, double, double, int, int, str
      Pointer(p6) := GetProcAddress(hLib, PChar(funcName));
      If Not Assigned(p6) Then Begin
        Writeln('ERROR: GetProcAddress ' + funcName);
        Halt(4);
      End;

      // 判斷是否預覽 (IsPrint = 第5個參數, 0:預覽, 1:直接列印)
      If GetIntArg(args, 4, 0) = 0 Then needBring := True;

      If needBring Then Begin
        BringThread := TBringThread.Create(True);
        BringThread.FreeOnTerminate := False;
        BringThread.Start;
      End Else
        BringThread := nil;

      ret := p6(
        GetFloatArg(args, 0, 0.0),
        GetFloatArg(args, 1, 0.0),
        GetFloatArg(args, 2, 0.0),
        GetIntArg(args, 3, 0),
        GetIntArg(args, 4, 0),
        ansistring(GetStrArg(args, 5, ''))
      );

      If Assigned(BringThread) Then Begin
        BringThread.Terminate;
        BringThread.WaitFor;
        BringThread.Free;
      End;
      Writeln('OK:' + IntToStr(ret));

    End Else If args.Count = 2 Then Begin
      // 2參數版: int, str 或 double, str
      Pointer(pIntStr) := GetProcAddress(hLib, PChar(funcName));
      If Not Assigned(pIntStr) Then Begin
        Writeln('ERROR: GetProcAddress ' + funcName);
        Halt(4);
      End;
      ret := pIntStr(GetIntArg(args, 0, 0), ansistring(GetStrArg(args, 1, '')));
      Writeln('OK:' + IntToStr(ret));

    End Else Begin
      Writeln('ERROR: Function ' + funcName + ' not implemented in generic dispatcher. 請在 WbaseBridge.lpr 加上對應分支');
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

