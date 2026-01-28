@echo off
chcp 65001 > nul
echo ========================================
echo  清理 workspace 中的 watchdog 文件
echo ========================================
echo.

echo 正在删除 watchdog-error.log...
del /f /q "G:\clawdbot\workspace\watchdog-error.log" 2>nul
if exist "G:\clawdbot\workspace\watchdog-error.log" (
    echo   ⚠️ watchdog-error.log 删除失败（可能正在使用）
) else (
    echo   ✅ watchdog-error.log 已删除
)

echo.
echo 正在删除 watchdog.log...
del /f /q "G:\clawdbot\workspace\watchdog.log" 2>nul
if exist "G:\clawdbot\workspace\watchdog.log" (
    echo   ⚠️ watchdog.log 删除失败（可能正在使用）
) else (
    echo   ✅ watchdog.log 已删除
)

echo.
echo ========================================
echo  清理完成！
echo ========================================
echo.
echo 所有 watchdog 文件已移动到：G:\clawdbot-watchdog\
echo.
pause
