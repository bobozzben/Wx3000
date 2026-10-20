* lock_holder.prg - multi-station concurrency test: simulate "station A" holding a lock.
* ASCII only. Launched headless:  vfp9.exe -cconfig.fpw lock_holder.prg
*
* Reads  lock_cmd.txt (same dir):
*   line1 = full path of DBF
*   line2 = mode: RLOCK | FLOCK | EXCL
*   line3 = recno (for RLOCK)
*   line4 = max hold seconds (auto release safety)
* Writes (same dir):
*   locked.flag    - lock acquired, now holding
*   released.flag  - lock released, exiting
*   fail.flag      - could not acquire lock (contains error text)
* Releases early as soon as release.flag appears.

LOCAL lcDir, lcCmd, lcDbf, lcMode, lnRec, lnMax, lnStart, llOk, lcErr, lnDummy
LOCAL ARRAY laL[1]

lcDir = ADDBS(JUSTPATH(SYS(16)))
SET SAFETY OFF
SET TALK OFF
SET DELETED ON
SET EXCLUSIVE OFF

IF FILE(lcDir + "locked.flag")
	DELETE FILE (lcDir + "locked.flag")
ENDIF
IF FILE(lcDir + "released.flag")
	DELETE FILE (lcDir + "released.flag")
ENDIF
IF FILE(lcDir + "fail.flag")
	DELETE FILE (lcDir + "fail.flag")
ENDIF

llOk  = .F.
lcErr = ""
lnRec = 1
lnMax = 12

TRY
	lcCmd = FILETOSTR(lcDir + "lock_cmd.txt")
	ALINES(laL, lcCmd)
	lcDbf  = ALLTRIM(laL[1])
	lcMode = UPPER(ALLTRIM(laL[2]))
	IF ALEN(laL) >= 3
		lnRec = MAX(1, VAL(laL[3]))
	ENDIF
	IF ALEN(laL) >= 4
		lnMax = MAX(1, VAL(laL[4]))
	ENDIF

	IF lcMode == "EXCL"
		USE (lcDbf) ALIAS kk EXCLUSIVE IN 0
		llOk = .T.
	ELSE
		USE (lcDbf) ALIAS kk SHARED IN 0
		SELECT kk
		IF lcMode == "FLOCK"
			llOk = FLOCK()
		ELSE
			GO lnRec
			llOk = RLOCK()
		ENDIF
		IF !llOk
			lcErr = "lock function returned .F."
		ENDIF
	ENDIF
CATCH TO oErr
	lcErr = TRANSFORM(oErr.ErrorNo) + " " + oErr.Message
ENDTRY

IF llOk
	STRTOFILE(lcMode + " recno=" + TRANSFORM(lnRec), lcDir + "locked.flag")
	lnStart = SECONDS()
	DO WHILE !FILE(lcDir + "release.flag") AND (SECONDS() - lnStart) < lnMax
		lnDummy = INKEY(0.2)
	ENDDO
	UNLOCK ALL
	USE IN SELECT("kk")
	STRTOFILE("done", lcDir + "released.flag")
ELSE
	STRTOFILE("LOCK FAIL: " + lcErr, lcDir + "fail.flag")
ENDIF
QUIT
