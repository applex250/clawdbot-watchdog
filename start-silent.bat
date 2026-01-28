@echo off
chcp 65001 > nul
title Clawdbot Gateway 监控守护进程 (静默版)

cls
echo ========================================
echo  🐕 Clawdbot Gateway 监控守护进程
echo  (静默版 - 后台运行)
echo ========================================
echo.
echo 按 Ctrl+C 可以停止监控
echo.

node "%~dp0clawdbot-watchdog-silent.js"
