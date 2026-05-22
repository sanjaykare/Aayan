@echo off
echo Installing KareXpert ADK...
pip install -e .
echo Copying configuration files...
mkdir %USERPROFILE%\.claude 2>nul
copy .claude\CLAUDE.md %USERPROFILE%\.claude\CLAUDE.md
echo KareXpert ADK installed successfully!
echo Run: cd hospital-adk-validator ^&^& python -m uvicorn app:app --reload --port 8000