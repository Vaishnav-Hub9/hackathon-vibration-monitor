@echo off
echo ====================================================
echo Starting SmartBearing ML Prediction Server...
echo ====================================================

cd artifacts\api-server\src\ml

echo Installing required Python packages...
pip install -r requirements.txt

echo.
echo Starting FastAPI server on port 8000...
uvicorn server:app --host 127.0.0.1 --port 8000
