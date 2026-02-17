@echo off
cd /d "c:\Dashboard de Control MRU"
echo Running synthesize_mrua_results.py... > synthesize_log.txt
python synthesize_mrua_results.py >> synthesize_log.txt 2>&1
echo Done. >> synthesize_log.txt
exit /b 0
