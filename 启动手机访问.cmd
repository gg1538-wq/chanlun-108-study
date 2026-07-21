@echo off
chcp 65001 >nul
title 缠论108课学习 PWA - 手机访问启动器
cd /d %~dp0

set NODE="C:\Users\Administrator\AppData\Local\Programs\kimi-desktop\resources\resources\runtime\node.exe"
set SSH=%WINDIR%\System32\OpenSSH\ssh.exe

echo ============================================================
echo   缠论108课学习 PWA ^| iPhone 访问启动器
echo ============================================================
echo.
echo [1/2] 正在启动本地服务器（端口 7100）...
start "缠论PWA-本地服务器" /min %NODE% server.js --port 7100 --host 127.0.0.1
timeout /t 2 /nobreak >nul

echo [2/2] 正在建立 HTTPS 隧道（localhost.run）...
echo.
echo ------------------------------------------------------------
echo  稍等几秒，下方会出现一行：
echo     https://xxxxxxxx.lhr.life tunneled with tls termination
echo.
echo  用 iPhone 相机扫描屏幕上的二维码，或在 Safari 输入该网址
echo  打开后：点"分享"按钮 -^> "添加到主屏幕"即可变成 App
echo ------------------------------------------------------------
echo.
echo 【关闭本窗口即停止手机访问；你的学习数据保存在手机本机】
echo.

:retry
%SSH% -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -R 80:127.0.0.1:7100 nokey@localhost.run
echo.
echo 隧道已断开。按任意键重新连接，或直接关闭窗口退出...
pause >nul
goto retry
