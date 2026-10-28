program DBFBridge;

{$mode objfpc}{$H+}
{$codepage utf8}

uses
  SysUtils,
  Classes,
  Windows,
  Variants,
  ComObj,
  ActiveX,
  fpjson,
  jsonparser,
  base64;

var
  gComObj: OleVariant;
  gDllPath: string;

{ 取字串中最後一個獨立數字 }
function LastNumberToken(const S: string): Integer;
var
  i, j: Integer;
begin
  Result := 0;
  i := Length(S);
  while i >= 1 do
  begin
    if S[i] in ['0'..'9'] then
    begin
      j := i;
      while (j > 1) and (S[j - 1] in ['0'..'9']) do
        Dec(j);
      if (j = 1) or not (S[j - 1] in ['0'..'9', 'A'..'Z', 'a'..'z']) then
      begin
        Result := StrToIntDef(Copy(S, j, i - j + 1), 0);
        Exit;
      end;
      i := j - 1;
      Continue;
    end;
    Dec(i);
  end;
end;

{ 辨識 VFP 錯誤是否為多站撞鎖 }
function VFPLockErrorHint(const AErr: string): string;
var
  code: Integer;
begin
  code := LastNumberToken(AErr);
  case code of
    108, 109, 130:
      Result := '此筆資料正被其他工作站編輯中，這次存檔已取消(未寫入)。請稍候幾秒再存一次。';
    3, 1705:
      Result := '資料檔正被其他工作站獨佔使用(例如正在執行資料重整)，請等該站作業完成後再試。';
  else
    Result := '';
  end;
end;

{ COM 介面 OleVariant (VT_BSTR) 自動走 UTF-16 雙向傳遞，由 Windows COM 原生轉換為 UTF-8 }

function OleStrToUTF8(pw: PWideChar): string;
var
  n: Integer;
begin
  Result := '';
  if (pw = nil) or (pw^ = #0) then Exit;
  n := WideCharToMultiByte(CP_UTF8, 0, pw, -1, nil, 0, nil, nil);
  if n <= 1 then Exit;
  SetLength(Result, n - 1);
  WideCharToMultiByte(CP_UTF8, 0, pw, -1, PChar(Result), n, nil, nil);
  SetCodePage(RawByteString(Result), CP_UTF8, False);
end;

function VariantToUTF8(const v: OleVariant): string;
begin
  if VarIsNull(v) or VarIsEmpty(v) then
    Result := ''
  else if TVarData(v).VType = varOleStr then
    Result := OleStrToUTF8(TVarData(v).VOleStr)
  else
    Result := VarToStr(v);
end;

function GetCLSIDFromVBR(const AVbrFile: string): string;
var
  lines: TStringList;
  i: Integer;
  key, curLine: string;
begin
  Result := '';
  key := UpperCase('HKEY_CLASSES_ROOT\w3000_dbf.w3000_dbf\CLSID =');
  if not FileExists(AVbrFile) then Exit;
  lines := TStringList.Create;
  try
    lines.LoadFromFile(AVbrFile);
    for i := 0 to lines.Count - 1 do
    begin
      curLine := UpperCase(lines[i]);
      if Pos(key, curLine) > 0 then
      begin
        Result := Trim(Copy(lines[i], Pos('=', lines[i]) + 1, MaxInt));
        Exit;
      end;
    end;
  finally
    lines.Free;
  end;
end;

{ 自動尋找 w3000_dbf.dll }
function FindDbfDll(const explicitPath: string): string;
var
  candidates: array[0..6] of string;
  i: Integer;
  exeDir: string;
begin
  if (explicitPath <> '') and FileExists(explicitPath) then
    Exit(explicitPath);

  exeDir := ExtractFilePath(ParamStr(0));
  candidates[0] := exeDir + 'w3000_dbf.dll';
  candidates[1] := exeDir + '..\w3000_dbf.dll';
  candidates[2] := exeDir + '..\..\w3000_dbf.dll';
  candidates[3] := 'F:\ADSProject\Wx3000\localagent\w3000_dbf.dll';
  candidates[4] := 'F:\ADSProject\Wx3000\localagent\bridge\lazarus\w3000_dbf.dll';
  candidates[5] := 'F:\w3000_upgrade\common\vfp\w3000_dbf.dll';
  candidates[6] := 'C:\W3000\dll\lz\w3000_dbf.dll';

  for i := 0 to High(candidates) do
  begin
    if FileExists(candidates[i]) then
      Exit(candidates[i]);
  end;

  Result := candidates[0];
end;

{ 載入 VFP COM 物件 (先試標準 COM，失敗則走 FreeLoadCOM) }
function InitVfpCom(const ADllPath: string; out AError: string): Boolean;
var
  dllFile, vbrFile, clsidStr: string;
  libHandle: TLibHandle;
  DllGetClassObject: function(const CLSID, IID: TGUID; var Obj): HResult; stdcall;
  ClassF: IClassFactory;
  clsidGuid: TGUID;
  myDisp: IDispatch;
begin
  AError := '';
  Result := False;

  if not (VarIsEmpty(gComObj) or VarIsNull(gComObj)) then
    Exit(True);

  // 1. 嘗試系統已註冊的 COM 物件
  try
    gComObj := CreateOleObject('w3000_dbf.w3000_dbf');
    if not (VarIsEmpty(gComObj) or VarIsNull(gComObj)) then
    begin
      Result := True;
      Exit;
    end;
  except
    // 忽略，繼續嘗試免註冊載入
  end;

  try
    gComObj := CreateOleObject('w3000_dbf');
    if not (VarIsEmpty(gComObj) or VarIsNull(gComObj)) then
    begin
      Result := True;
      Exit;
    end;
  except
    // 忽略
  end;

  // 2. 免註冊載入 (FreeLoadCOM)
  dllFile := FindDbfDll(ADllPath);
  gDllPath := dllFile;
  if not FileExists(dllFile) then
  begin
    AError := '找不到 w3000_dbf.dll: ' + dllFile;
    Exit;
  end;

  vbrFile := ChangeFileExt(dllFile, '.VBR');
  clsidStr := GetCLSIDFromVBR(vbrFile);
  if clsidStr = '' then
    clsidStr := '{E2FA1BD5-B02F-4026-8A1B-2A8CC85D370E}';

  libHandle := LoadLibraryW(PWideChar(UnicodeString(dllFile)));
  if libHandle = 0 then
  begin
    AError := 'LoadLibrary 失敗: ' + dllFile + ' (Win32 Error: ' + IntToStr(GetLastError) + ')';
    Exit;
  end;

  Pointer(DllGetClassObject) := GetProcAddress(libHandle, 'DllGetClassObject');
  if not Assigned(DllGetClassObject) then
  begin
    AError := '無法取得 DllGetClassObject 函數指標';
    Exit;
  end;

  clsidGuid := StringToGUID(clsidStr);
  if S_OK <> DllGetClassObject(clsidGuid, IClassFactory, ClassF) then
  begin
    AError := 'DllGetClassObject 失敗 (CLSID: ' + clsidStr + ')';
    Exit;
  end;

  if S_OK <> ClassF.CreateInstance(nil, IDispatch, myDisp) then
  begin
    AError := 'IClassFactory.CreateInstance 失敗';
    ClassF := nil;
    Exit;
  end;

  ClassF := nil;
  gComObj := OleVariant(myDisp);
  Result := not (VarIsEmpty(gComObj) or VarIsNull(gComObj));
  if Result then
  begin
    try
      gComObj.DoCmd('SYS(3006, 1028)' + #13#10 +
                    'SYS(3005, 1028)' + #13#10 +
                    'SET MULTILOCKS ON' + #13#10 +
                    'SET REPROCESS TO 2 SECONDS');
    except
    end;
  end;
end;

{ 執行 CHECKSUM 指令 }
function HandleChecksum(req: TJSONObject): TJSONObject;
var
  filePath: string;
  cSum: string;
begin
  Result := TJSONObject.Create;
  filePath := req.Get('filePath', '');
  if filePath = '' then
  begin
    filePath := IncludeTrailingPathDelimiter(req.Get('dbfPath', '')) + req.Get('dbfName', '');
    if not (LowerCase(ExtractFileExt(filePath)) = '.dbf') then
      filePath := filePath + '.dbf';
  end;

  if not FileExists(filePath) then
  begin
    Result.Add('success', False);
    Result.Add('error', '檔案不存在: ' + filePath);
    Exit;
  end;

  try
    cSum := gComObj.CheckSum_SHA256(filePath);
    Result.Add('success', True);
    Result.Add('filePath', filePath);
    Result.Add('checksum', VariantToUTF8(cSum));
  except
    on E: Exception do
    begin
      Result.Add('success', False);
      Result.Add('error', 'Checksum 計算失敗: ' + E.Message);
    end;
  end;
end;

{ 輔助函式：根據 keyField 與 keyValue 產生 VFP LOCATE / WHERE 條件式 (支援單欄位、逗點多欄位複合鍵或原生 WHERE 表達式) }
function BuildWhereClause(const AKeyField, AKeyValue: string): string;
var
  keys, vals: TStringList;
  i: Integer;
  cond, k, v: string;
begin
  if Pos('=', AKeyField) > 0 then
    Exit(AKeyField);

  if Pos(',', AKeyField) > 0 then
  begin
    keys := TStringList.Create;
    vals := TStringList.Create;
    try
      keys.StrictDelimiter := True;
      keys.Delimiter := ',';
      keys.DelimitedText := AKeyField;

      vals.StrictDelimiter := True;
      vals.Delimiter := ',';
      vals.DelimitedText := AKeyValue;

      cond := '';
      for i := 0 to keys.Count - 1 do
      begin
        k := Trim(keys[i]);
        if k = '' then Continue;
        if cond <> '' then cond := cond + ' AND ';
        if i < vals.Count then
          v := Trim(vals[i])
        else
          v := '';
        cond := cond + k + ' = "' + StringReplace(v, '"', '""', [rfReplaceAll]) + '"';
      end;
      Result := cond;
    finally
      keys.Free;
      vals.Free;
    end;
    Exit;
  end;

  Result := AKeyField + ' = "' + StringReplace(AKeyValue, '"', '""', [rfReplaceAll]) + '"';
end;

{ 執行 READ 指令 }
function HandleRead(req: TJSONObject): TJSONObject;
var
  dbfPath, dbfName, keyField, keyValue, cAlias, fullPath, whereClause: string;
  fieldsArr: TJSONArray;
  dataObj: TJSONObject;
  i: Integer;
  fldName: string;
  rawVal: OleVariant;
  valStr: string;
  recFound: Boolean;
  recno: Integer;
begin
  Result := TJSONObject.Create;
  dbfPath := IncludeTrailingPathDelimiter(req.Get('dbfPath', 'C:\w3000\comm'));
  dbfName := req.Get('dbfName', 'keyin');
  keyField := req.Get('keyField', 'no');
  keyValue := req.Get('keyValue', '');
  cAlias := ChangeFileExt(dbfName, '');
  fullPath := dbfPath + dbfName;
  if LowerCase(ExtractFileExt(fullPath)) <> '.dbf' then
    fullPath := fullPath + '.dbf';

  if not FileExists(fullPath) then
  begin
    Result.Add('success', False);
    Result.Add('error', '找不到 DBF 檔案: ' + fullPath);
    Exit;
  end;

  try
    gComObj.Exec('USE "' + fullPath + '" IN 0 ALIAS ' + cAlias + ' SHARED AGAIN');
    try
      gComObj.Exec('SELECT ' + cAlias);
      whereClause := BuildWhereClause(keyField, keyValue);
      gComObj.Exec('LOCATE FOR ' + whereClause);
      recFound := not Boolean(gComObj.Eof());

      if not recFound then
      begin
        Result.Add('success', True);
        Result.Add('found', False);
        Result.Add('recno', 0);
      end
      else
      begin
        recno := Integer(gComObj.RecNo());
        Result.Add('success', True);
        Result.Add('found', True);
        Result.Add('recno', recno);

        dataObj := TJSONObject.Create;
        fieldsArr := req.Get('fields', TJSONArray(nil));
        if fieldsArr <> nil then
        begin
          for i := 0 to fieldsArr.Count - 1 do
          begin
            fldName := fieldsArr.Strings[i];
            try
              rawVal := gComObj.FieldValue(fldName);
              valStr := Trim(VariantToUTF8(rawVal));
              dataObj.Add(fldName, valStr);
            except
              dataObj.Add(fldName, '');
            end;
          end;
        end;
        Result.Add('data', dataObj);
      end;
    finally
      gComObj.Exec('USE IN ' + cAlias);
    end;
  except
    on E: Exception do
    begin
      Result.Add('success', False);
      Result.Add('error', E.Message);
      Result.Add('lockHint', VFPLockErrorHint(E.Message));
    end;
  end;
end;

{ 將 JSON 值格式化為 VFP SQL 字面量 (支援 Number, Boolean, String, Null) }
function FormatVfpLiteral(item: TJSONData): string;
var
  s: string;
begin
  if (item = nil) or (item.JSONType = jtNull) then
    Result := ''''''
  else if item.JSONType = jtNumber then
    Result := item.AsString
  else if item.JSONType = jtBoolean then
  begin
    if item.AsBoolean then
      Result := '.T.'
    else
      Result := '.F.';
  end
  else
  begin
    s := item.AsString;
    if Pos('''', s) = 0 then
      Result := '''' + s + ''''
    else if Pos('"', s) = 0 then
      Result := '"' + s + '"'
    else if (Pos('[', s) = 0) and (Pos(']', s) = 0) then
      Result := '[' + s + ']'
    else
      Result := 'STRCONV("' + EncodeStringBase64(s) + '", 14)';
  end;
end;

{ 執行 WRITE 指令 (INSERT / UPDATE / DELETE) }
function HandleWrite(req: TJSONObject): TJSONObject;
var
  dbfPath, dbfName, operation, keyField, keyValue, cAlias, fullPath, whereClause: string;
  fieldsObj: TJSONObject;
  i: Integer;
  fldName, fldLiteral, cCols, cVals, cSet: string;
  vfpScript: string;
  vRet: OleVariant;
  recno: Integer;
  errHint: string;
begin
  Result := TJSONObject.Create;
  dbfPath := IncludeTrailingPathDelimiter(req.Get('dbfPath', 'C:\w3000\comm'));
  dbfName := req.Get('dbfName', 'keyin');
  operation := UpperCase(req.Get('operation', 'UPDATE'));
  keyField := req.Get('keyField', 'no');
  keyValue := req.Get('keyValue', '');
  fieldsObj := req.Get('fields', TJSONObject(nil));
  cAlias := ChangeFileExt(dbfName, '');
  fullPath := dbfPath + dbfName;
  if LowerCase(ExtractFileExt(fullPath)) <> '.dbf' then
    fullPath := fullPath + '.dbf';

  if not FileExists(fullPath) then
  {
    Result.Add('success', False);
    Result.Add('error', '找不到 DBF 檔案: ' + fullPath);
    Exit;
  }
  begin
    Result.Add('success', False);
    Result.Add('error', '找不到 DBF 檔案: ' + fullPath);
    Exit;
  end;

  whereClause := BuildWhereClause(keyField, keyValue);

  try
    gComObj.Exec('USE "' + fullPath + '" IN 0 ALIAS ' + cAlias + ' SHARED AGAIN');
    try
      gComObj.Exec('SELECT ' + cAlias);

      if operation = 'INSERT' then
      begin
        cCols := '';
        cVals := '';
        if fieldsObj <> nil then
        begin
          for i := 0 to fieldsObj.Count - 1 do
          begin
            fldName := fieldsObj.Names[i];
            fldLiteral := FormatVfpLiteral(fieldsObj.Items[i]);
            if cCols <> '' then
            begin
              cCols := cCols + ', ';
              cVals := cVals + ', ';
            end;
            cCols := cCols + fldName;
            cVals := cVals + fldLiteral;
          end;
        end;

        vfpScript := 'INSERT INTO ' + cAlias + ' (' + cCols + ') VALUES (' + cVals + ')' + #13#10 +
                     'RETURN RECNO("' + cAlias + '")';
        vRet := gComObj.DoCmd(vfpScript);
        recno := Integer(vRet);

        Result.Add('success', True);
        Result.Add('operation', 'INSERT');
        Result.Add('recno', recno);
      end
      else if operation = 'UPDATE' then
      begin
        gComObj.Exec('LOCATE FOR ' + whereClause);
        if Boolean(gComObj.Eof()) then
        begin
          Result.Add('success', False);
          Result.Add('errorType', 'RECORD_NOT_FOUND');
          Result.Add('error', '找不到欲更新的記錄: ' + whereClause);
          Exit;
        end;

        cSet := '';
        if fieldsObj <> nil then
        begin
          for i := 0 to fieldsObj.Count - 1 do
          begin
            fldName := fieldsObj.Names[i];
            fldLiteral := FormatVfpLiteral(fieldsObj.Items[i]);
            if cSet <> '' then cSet := cSet + ', ';
            cSet := cSet + fldName + ' = ' + fldLiteral;
          end;
        end;

        if cSet <> '' then
        begin
          vfpScript := 'UPDATE ' + cAlias + ' SET ' + cSet + ' WHERE ' + whereClause + #13#10 +
                       'RETURN RECNO("' + cAlias + '")';
          vRet := gComObj.DoCmd(vfpScript);
          recno := Integer(vRet);
        end
        else
        begin
          recno := Integer(gComObj.RecNo());
        end;

        Result.Add('success', True);
        Result.Add('operation', 'UPDATE');
        Result.Add('recno', recno);
      end
      else if operation = 'DELETE' then
      begin
        gComObj.Exec('LOCATE FOR ' + whereClause);
        if Boolean(gComObj.Eof()) then
        begin
          Result.Add('success', False);
          Result.Add('errorType', 'RECORD_NOT_FOUND');
          Result.Add('error', '找不到欲刪除的記錄: ' + whereClause);
          Exit;
        end;

        recno := Integer(gComObj.RecNo());
        vfpScript := 'DELETE FROM ' + cAlias + ' WHERE ' + whereClause;
        gComObj.DoCmd(vfpScript);

        Result.Add('success', True);
        Result.Add('operation', 'DELETE');
        Result.Add('recno', recno);
      end
      else
      begin
        Result.Add('success', False);
        Result.Add('error', '未知的操作類型: ' + operation);
      end;

    finally
      gComObj.Exec('USE IN ' + cAlias);
    end;

  except
    on E: Exception do
    begin
      errHint := VFPLockErrorHint(E.Message);
      Result.Add('success', False);
      Result.Add('error', E.Message);
      if errHint <> '' then
      begin
        Result.Add('errorType', 'LOCK_TIMEOUT');
        Result.Add('message', errHint);
      end
      else
      begin
        Result.Add('errorType', 'VFP_EXCEPTION');
        Result.Add('message', E.Message);
      end;
    end;
  end;
end;

{ 執行 GET_PG_SCRIPT 指令 }
function HandleGetPgScript(req: TJSONObject): TJSONObject;
var
  dbfPath, dbfName, cAlias, schema, table, keyFields, hexFields, mode: string;
  script, fullPath: string;
begin
  Result := TJSONObject.Create;
  dbfPath := IncludeTrailingPathDelimiter(req.Get('dbfPath', 'C:\w3000\comm'));
  dbfName := req.Get('dbfName', 'keyin');
  cAlias := ChangeFileExt(req.Get('alias', dbfName), '');
  schema := req.Get('schema', 'c:/w3000/comm');
  table := req.Get('table', dbfName);
  keyFields := req.Get('keyFields', 'no');
  hexFields := req.Get('hexFields', '');
  mode := UpperCase(req.Get('mode', 'STRUCT'));
  fullPath := dbfPath + dbfName;
  if LowerCase(ExtractFileExt(fullPath)) <> '.dbf' then
    fullPath := fullPath + '.dbf';

  if not FileExists(fullPath) then
  begin
    Result.Add('success', False);
    Result.Add('error', '找不到 DBF 檔案: ' + fullPath);
    Exit;
  end;

  try
    gComObj.Exec('USE "' + fullPath + '" IN 0 ALIAS ' + cAlias + ' SHARED AGAIN');
    try
      if mode = 'STRUCT' then
      begin
        script := VariantToUTF8(gComObj.Stru_to_PG_Script(
          cAlias,
          schema,
          table,
          keyFields
        ));
      end
      else
      begin
        script := VariantToUTF8(gComObj.Data_to_PG_Script(
          cAlias,
          schema,
          table,
          keyFields,
          hexFields
        ));
      end;

      Result.Add('success', True);
      Result.Add('mode', mode);
      Result.Add('script', script);
    finally
      gComObj.Exec('USE IN ' + cAlias);
    end;
  except
    on E: Exception do
    begin
      Result.Add('success', False);
      Result.Add('error', E.Message);
    end;
  end;
end;

{ 執行 EXEC_VFP 指令 }
function HandleExecVfp(req: TJSONObject): TJSONObject;
var
  vfpScript: string;
  resVal: OleVariant;
begin
  Result := TJSONObject.Create;
  vfpScript := req.Get('script', '');
  if vfpScript = '' then
  begin
    Result.Add('success', False);
    Result.Add('error', 'VFP Script 不能為空');
    Exit;
  end;

  try
    resVal := gComObj.DoCmd(vfpScript);
    Result.Add('success', True);
    Result.Add('result', VariantToUTF8(resVal));
  except
    on E: Exception do
    begin
      Result.Add('success', False);
      Result.Add('error', E.Message);
      Result.Add('lockHint', VFPLockErrorHint(E.Message));
    end;
  end;
end;

{ 主調度器 }
function DispatchCommand(const jsonStr: string): string;
var
  parser: TJSONParser;
  rootData: TJSONData;
  reqObj: TJSONObject;
  respObj: TJSONObject;
  action: string;
  dllPath, comErr: string;
  t0: QWord;
begin
  t0 := GetTickCount64;
  rootData := nil;
  respObj := nil;
  try
    try
      parser := TJSONParser.Create(jsonStr, True);
      try
        rootData := parser.Parse;
      finally
        parser.Free;
      end;

      if not (rootData is TJSONObject) then
      begin
        respObj := TJSONObject.Create;
        respObj.Add('success', False);
        respObj.Add('error', 'JSON 格式錯誤，必須為 Object');
        Exit(respObj.AsJSON);
      end;

      reqObj := TJSONObject(rootData);
      action := UpperCase(reqObj.Get('action', 'PING'));
      dllPath := reqObj.Get('dllPath', '');

      // 初始化 VFP COM 物件
      if not InitVfpCom(dllPath, comErr) then
      begin
        respObj := TJSONObject.Create;
        respObj.Add('success', False);
        respObj.Add('error', 'VFP COM 物件載入失敗: ' + comErr);
        Exit(respObj.AsJSON);
      end;

      case action of
        'PING':
        begin
          respObj := TJSONObject.Create;
          respObj.Add('success', True);
          respObj.Add('version', 'DBFBridge 1.0.0 (32-bit i386)');
          respObj.Add('dllPath', gDllPath);
          respObj.Add('vfpVersion', VarToStr(gComObj.GetVersion()));
        end;

        'CHECKSUM':
          respObj := HandleChecksum(reqObj);

        'READ':
          respObj := HandleRead(reqObj);

        'WRITE':
          respObj := HandleWrite(reqObj);

        'GET_PG_SCRIPT':
          respObj := HandleGetPgScript(reqObj);

        'EXEC_VFP':
          respObj := HandleExecVfp(reqObj);

      else
        respObj := TJSONObject.Create;
        respObj.Add('success', False);
        respObj.Add('error', '未知的 Action: ' + action);
      end;

      respObj.Add('elapsedMs', Integer(GetTickCount64 - t0));
      Result := respObj.AsJSON;

    except
      on E: Exception do
      begin
        if respObj = nil then respObj := TJSONObject.Create;
        respObj.Add('success', False);
        respObj.Add('error', '執行例外: ' + E.Message);
        respObj.Add('elapsedMs', Integer(GetTickCount64 - t0));
        Result := respObj.AsJSON;
      end;
    end;
  finally
    if Assigned(respObj) then
      respObj.Free;
    if Assigned(rootData) then
      rootData.Free;
  end;
end;

{ 主程式入口 }
var
  i: Integer;
  jsonInput: string;
  jsonOutput: string;
  filePath: string;
  lineStr: string;
  lines: TStringList;
begin
  CoInitialize(nil);
  SetThreadLocale(1028);
  SetConsoleOutputCP(CP_UTF8);
  SetConsoleCP(CP_UTF8);
  try
    jsonInput := '';

    // 解析命令列參數
    i := 1;
    while i <= ParamCount do
    begin
      if ParamStr(i) = '--json' then
      begin
        if i + 1 <= ParamCount then
          jsonInput := ParamStr(i + 1);
        Inc(i, 2);
      end
      else if ParamStr(i) = '--file' then
      begin
        if i + 1 <= ParamCount then
        begin
          filePath := ParamStr(i + 1);
          if FileExists(filePath) then
          begin
            lines := TStringList.Create;
            try
              lines.LoadFromFile(filePath);
              jsonInput := lines.Text;
            finally
              lines.Free;
            end;
          end;
        end;
        Inc(i, 2);
      end
      else
      begin
        // 若直接傳入單一參數且看起來像 json 或 base64
        if jsonInput = '' then
          jsonInput := ParamStr(i);
        Inc(i);
      end;
    end;

    // 若從命令列無輸入，嘗試從 stdin 讀取
    if Trim(jsonInput) = '' then
    begin
      lines := TStringList.Create;
      try
        while not EOF do
        begin
          ReadLn(lineStr);
          lines.Add(lineStr);
        end;
        jsonInput := lines.Text;
      except
        // stdin 讀取結束
      end;
      lines.Free;
    end;

    jsonInput := Trim(jsonInput);
    if jsonInput = '' then
      jsonInput := '{"action":"PING"}';

    // 若為 Base64 字串，先解碼
    if (Length(jsonInput) > 0) and (jsonInput[1] <> '{') and (jsonInput[1] <> '[') then
    begin
      try
        jsonInput := DecodeStringBase64(jsonInput);
      except
        // 若非合法 Base64 則保持原樣
      end;
    end;

    SetCodePage(RawByteString(jsonInput), CP_UTF8, False);

    // 執行並輸出結果 JSON (走原始 UTF-8 Byte 寫入，避免 console 轉碼破壞)
    jsonOutput := DispatchCommand(jsonInput);
    FileWrite(StdOutputHandle, PChar(jsonOutput)^, Length(jsonOutput));
    FileWrite(StdOutputHandle, PChar(#13#10)^, 2);

  finally
    gComObj := Unassigned;
    CoUninitialize();
  end;
end.
