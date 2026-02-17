@echo off
cd /d "c:\Dashboard de Control MRU"
echo Starting generation... > gen_wrapper.log
python generate_more_data.py >> gen_wrapper.log 2>&1
echo Done. >> gen_wrapper.log
