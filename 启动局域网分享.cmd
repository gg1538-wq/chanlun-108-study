@echo off
chcp 65001 >nul
title 缠论108课学习 PWA - 局域网内部分享
cd /d %~dp0

set NODE="C:\Users\Administrator\AppData\Local\Programs\kimi-desktop\resources\resources\runtime\node.exe"

echo ============================================================
echo   缠论108课学习 PWA ^| 局域网内部分享（仅限同一WiFi）
echo ============================================================
echo.

REM 获取本机局域网IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%

echo  正在启动服务器...
echo.
echo  让同一 WiFi 下的手机/平板/电脑在浏览器打开：
echo.
echo      http://%IP%:7100
echo.
echo  iPhone 打开后可：分享 -^> 添加到主屏幕
echo  （局域网 http 下 iOS 不提供离线缓存，在线使用功能完整）
echo ------------------------------------------------------------
echo  首次启动如弹出 Windows 防火墙提示，请勾选"专用网络"并允许。
echo  关闭本窗口即停止分享。
echo ------------------------------------------------------------
echo.

%NODE% server.js --port 7100 --host 0.0.0.0
pause
