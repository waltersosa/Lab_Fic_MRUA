@echo off
echo Running analysis wrapper... > wrapper_log.txt
python --version >> wrapper_log.txt 2>&1
if %errorlevel% neq 0 echo Python command failed >> wrapper_log.txt

echo Running synthesize_mrua_results.py >> wrapper_log.txt
python synthesize_mrua_results.py >> wrapper_log.txt 2>&1
if %errorlevel% neq 0 echo Script execution failed >> wrapper_log.txt

echo Done. >> wrapper_log.txt
