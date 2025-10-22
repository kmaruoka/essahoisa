@echo off
echo 発車データを登録します。
pause
npm run convert -- --input 発車データ.xlsx --config config/excel-config.json --output public/data
echo 発車データを登録しました。
pause
