Program WbaseBridge;
{$APPTYPE CONSOLE}
{$mode objfpc}{$H+}
Uses
  Windows,
  SysUtils,
  Classes;

  // 動態載入宣告
Type
  Twaccrep3101_b = Function(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const path: ansistring): integer; stdcall;

  TBringThread = Class(TThread)
  protected
    Procedure Execute; override;
  End;

Var
  hLib: HMODULE;
  waccrep3101_b: Twaccrep3101_b = nil;

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

    // 關鍵：附加到前景執行緒，才有權限搶焦點
    If ForeThread <> CurThread Then Begin
      AttachThreadInput(CurThread, ForeThread, True);
    End;

    ShowWindow(hWnd, SW_RESTORE);
    ShowWindow(hWnd, SW_SHOW);
    SetWindowPos(hWnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE Or SWP_NOSIZE Or SWP_SHOWWINDOW);
    SetWindowPos(hWnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE Or SWP_NOSIZE Or SWP_SHOWWINDOW);
    SetForegroundWindow(hWnd);
    BringWindowToTop(hWnd);
    SetActiveWindow(hWnd);

    If ForeThread <> CurThread Then
      AttachThreadInput(CurThread, ForeThread, False);
    Result := True;
  End;

  Function EnumFindAndBring(Wnd: HWND; Param: LPARAM): BOOL; stdcall;
  Var
    pid: DWORD;
    buf: Array[0..255] Of char;
    style: longint;
  Begin
    Result := True;
    GetWindowThreadProcessId(Wnd, @pid);
    If pid <> GetCurrentProcessId Then Exit;
    If Not IsWindowVisible(Wnd) Then Exit;
    If Wnd = GetConsoleWindow Then Exit;
    GetWindowText(Wnd, buf, 255);
    If StrLen(buf) = 0 Then Exit;
    // 排除 Console 自己，標題有東西的才可能是預覽
    style := GetWindowLong(Wnd, GWL_STYLE);
    If (style And WS_VISIBLE) = 0 Then Exit;

    // 找到！強行提到前景
    ForceForeground(Wnd);
    Result := False; // 停
  End;

  Procedure TBringThread.Execute;
  Var
    i: integer;
  Begin
    // 每 200ms 嘗試一次，持續 5 秒，因為 DLL 開啟有延遲
    For i := 1 To 25 Do Begin
      If Terminated Then Exit;
      Sleep(200);
      EnumWindows(@EnumFindAndBring, 0);
    End;
  End;

  Function GetDllPath: string;
  Var
    exePath: string;
  Begin
    exePath := ExtractFilePath(ParamStr(0));
    If FileExists(exePath + 'wbase' + PathDelim + 'wbaseRP.dll') Then
      Result := exePath + 'wbase' + PathDelim + 'wbaseRP.dll'
    Else If FileExists(exePath + 'wbaseRP.dll') Then Result := exePath + 'wbaseRP.dll'
    Else If FileExists(exePath + '..' + PathDelim + 'wbase' + PathDelim + 'wbaseRP.dll') Then
      Result := exePath + '..' + PathDelim + 'wbase' + PathDelim + 'wbaseRP.dll'
    Else If FileExists('F:\ADSProject\Wx3000\report\wbase\wbaseRP.dll') Then
      Result := 'F:\ADSProject\Wx3000\report\wbase\wbaseRP.dll'
    Else If FileExists('C:\Wx3000\wbaseRP.dll') Then Result := 'C:\Wx3000\wbaseRP.dll'
    Else
      Result := 'wbaseRP.dll';
  End;

  Function LoadMyDll(Const dllPath: string): boolean;
  Begin
    Result := False;

    hLib := LoadLibrary(PChar(dllPath));
    If hLib = 0 Then Begin
      Writeln(Format('ERROR: LoadLibrary failed: %s Code=%d', [dllPath, GetLastError]));
      Exit;
    End;

    Pointer(waccrep3101_b) := GetProcAddress(hLib, 'waccrep3101_b');
    If Not Assigned(waccrep3101_b) Then Begin
      Pointer(waccrep3101_b) := GetProcAddress(hLib, '_waccrep3101_b');
      If Not Assigned(waccrep3101_b) Then Begin
        Writeln('ERROR: GetProcAddress waccrep3101_b failed');
        FreeLibrary(hLib);
        Exit;
      End;
    End;
    Result := True;
  End;

  //------------------------------------------------------------------------------------------
Var
  hs_chk, top_mag, left_mag: double;
  PrtIndex, IsPrint: integer;
  savePath: ansistring;
  ret: integer;
  dllPath: string;
  BringThread: TBringThread;
Begin
  Try
    If ParamCount < 6 Then  Begin
      Writeln('Usage: WbaseBridge.exe hs_chk top_mag left_mag PrtIndex IsPrint path');
      Halt(1);
    End;

    dllPath := GetDllPath;
    If Not FileExists(dllPath) Then  Begin
      Writeln('ERROR: DLL file not found: ' + dllPath);
      Halt(2);
    End;

    If Not LoadMyDll(dllPath) Then Halt(3);

    hs_chk := StrToFloatDef(ParamStr(1), 0);
    top_mag := StrToFloatDef(ParamStr(2), 0);
    left_mag := StrToFloatDef(ParamStr(3), 0);
    PrtIndex := StrToIntDef(ParamStr(4), 0);
    IsPrint := StrToIntDef(ParamStr(5), 0);
    savePath := ansistring(ParamStr(6));

    ForceDirectories(ExtractFilePath(string(savePath)));

    // 關鍵：如果是預覽 (IsPrint=0)，先開一個執行緒去搶焦點
    BringThread := nil;
    if IsPrint = 0 then begin
      BringThread := TBringThread.Create(True);
      BringThread.FreeOnTerminate := False;
      BringThread.Start;
    end;
    // 呼叫 DLL
    ret := waccrep3101_b(hs_chk, top_mag, left_mag, PrtIndex, IsPrint, savePath);

    // DLL 返回了，關掉搶焦點執行緒
    If Assigned(BringThread) Then  Begin
      BringThread.Terminate;
      BringThread.WaitFor;
      BringThread.Free;
    End;
    Writeln('OK:' + IntToStr(ret));

    If hLib <> 0 Then FreeLibrary(hLib);
  Except
    on E: Exception Do Begin
      Writeln('ERROR:' + E.ClassName + ':' + E.Message);
      Halt(4);
    End;
  End;

End.
