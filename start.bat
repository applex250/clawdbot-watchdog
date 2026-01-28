@echo off
chcp 65001 > nul
title Clawdbot Gateway 监控守护进程

cls
echo ========================================
echo  🐕 Clawdbot Gateway 监控守护进程
echo ========================================
echo.
echo 按 Ctrl+C 或输入 quit 可以停止监控
echo.

node "%~dp0clawdbot-watchdog-interactive.js"
