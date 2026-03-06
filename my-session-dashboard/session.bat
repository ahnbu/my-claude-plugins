@echo off
chcp 65001 > nul
title Claude Session Dashboard
cd /d "%~dp0"
node serve.js
