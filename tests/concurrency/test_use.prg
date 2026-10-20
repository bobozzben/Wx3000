SET SAFETY OFF
ON ERROR DO errHandler WITH ERROR(), MESSAGE()
USE "C:\w3000\comm\keyin.dbf" ALIAS kk SHARED IN 0
STRTOFILE("SUCCESS", "F:/ADSProject/Wx3000/tests/concurrency/result.txt")
QUIT

PROCEDURE errHandler(nErr, cMsg)
   STRTOFILE(TRANSFORM(nErr) + " " + cMsg, "F:/ADSProject/Wx3000/tests/concurrency/result.txt")
   QUIT
ENDPROC
