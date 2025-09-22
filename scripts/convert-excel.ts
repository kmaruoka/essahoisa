import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

type FieldName =
  | 'number'
  | 'arrivalTime'
  | 'finishTime'
  | 'supplierName'
  | 'preparation'
  | 'note'
  | 'yard'
  | 'lane'
  | 'supplierReading'
  | 'materialReading';

type ColumnConfig = Partial<Record<FieldName, string>>;

interface SheetConfig {
  key?: string;
  sheetName: string;
  outputFile: string;
  headerRows?: number;
  terminationColumn?: FieldName;
  twoSupplierJoiner?: string;
  columns?: ColumnConfig;
}

interface ExcelConfig {
  headerRows?: number;
  terminationColumn?: FieldName;
  twoSupplierJoiner?: string;
  columns: ColumnConfig;
  sheets: SheetConfig[];
}

interface CliOptions {
  input?: string;
  config?: string;
  output?: string;
  sheets?: string[];
}

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case '--input':
      case '-i':
        options.input = args[++i];
        break;
      case '--config':
      case '-c':
        options.config = args[++i];
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--sheets':
      case '-s':
        options.sheets = args[++i]?.split(',').map((item) => item.trim());
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
      default:
        if (arg.startsWith('-')) {
          throw new Error(`不明なオプションです: ${arg}`);
        }
        break;
    }
  }
  return options;
};

const printUsage = () => {
  console.log(`利用方法: npm run convert -- --input <Excelファイル> --config <設定ファイル> --output <出力ディレクトリ> [--sheets east,west]`);
};

const ensureValue = <T>(value: T | undefined, message: string): T => {
  if (value == null) {
    throw new Error(message);
  }
  return value;
};

const getCellAddress = (column: string, row: number) => `${column}${row + 1}`;

const getCellValue = (worksheet: XLSX.WorkSheet, row: number, column?: string): string => {
  if (!column) return '';
  const address = getCellAddress(column, row);
  const cell = worksheet[address];
  if (!cell || cell.v == null) {
    return '';
  }
  const formatted = XLSX.utils.format_cell(cell);
  if (formatted != null && formatted !== '') {
    return String(formatted).trim();
  }
  if (typeof cell.v === 'string') {
    return cell.v.trim();
  }
  if (typeof cell.v === 'number') {
    return cell.v.toString();
  }
  return String(cell.v).trim();
};

const createEntryId = (sheetKey: string, arrivalTime: string, index: number) => {
  const normalizedTime = arrivalTime.replace(/[^0-9]/g, '') || '0000';
  return `${sheetKey}-${normalizedTime}-${String(index).padStart(3, '0')}`;
};

const main = () => {
  try {
    const options = parseArgs();
    const inputPath = ensureValue(options.input, '--input でExcelファイルを指定してください。');
    const configPath = ensureValue(options.config, '--config で設定ファイルを指定してください。');
    const outputDir = ensureValue(options.output, '--output で出力先ディレクトリを指定してください。');

    if (!fs.existsSync(inputPath)) {
      throw new Error(`Excelファイルが見つかりません: ${inputPath}`);
    }
    if (!fs.existsSync(configPath)) {
      throw new Error(`設定ファイルが見つかりません: ${configPath}`);
    }

    const config: ExcelConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!config.columns) {
      throw new Error('設定ファイルにcolumnsが定義されていません。');
    }
    if (!Array.isArray(config.sheets) || config.sheets.length === 0) {
      throw new Error('設定ファイルに変換対象シートが定義されていません。');
    }

    const workbook = XLSX.readFile(inputPath, { cellDates: false });

    const selectedSheets = config.sheets.filter((sheet) => {
      if (!options.sheets || options.sheets.length === 0) {
        return true;
      }
      const sheetKey = sheet.key ?? sheet.sheetName;
      return options.sheets.includes(sheetKey);
    });

    if (selectedSheets.length === 0) {
      throw new Error('指定されたシートが設定ファイルに見つかりませんでした。');
    }

    fs.mkdirSync(outputDir, { recursive: true });

    selectedSheets.forEach((sheetConfig) => {
      const worksheet = workbook.Sheets[sheetConfig.sheetName];
      if (!worksheet) {
        throw new Error(`シート「${sheetConfig.sheetName}」がExcelに存在しません。`);
      }

      const sheetKey = sheetConfig.key ?? sheetConfig.sheetName;
      const headerRows = sheetConfig.headerRows ?? config.headerRows ?? 0;
      const joiner = sheetConfig.twoSupplierJoiner ?? config.twoSupplierJoiner ?? '　';
      const columns: ColumnConfig = { ...config.columns, ...sheetConfig.columns };
      const terminationField = sheetConfig.terminationColumn ?? config.terminationColumn ?? 'arrivalTime';
      const terminationColumn = ensureValue(
        columns[terminationField],
        `列「${terminationField}」の位置が設定されていません。`
      );

      const rangeRef = worksheet['!ref'];
      const range = rangeRef ? XLSX.utils.decode_range(rangeRef) : { s: { r: 0, c: 0 }, e: { r: 1000, c: 10 } };
      const lastRowIndex = range.e.r;

      const entries: Record<string, string>[] = [];

      for (let row = headerRows; row <= lastRowIndex; row += 1) {
        const arrivalTime = getCellValue(worksheet, row, terminationColumn);
        const supplierNameRaw = getCellValue(worksheet, row, columns.supplierName);

        if (!arrivalTime) {
          if (!supplierNameRaw) {
            break;
          }
          continue;
        }

        const entry: Record<string, string> = {};
        (Object.keys(columns) as FieldName[]).forEach((field) => {
          const value = getCellValue(worksheet, row, columns[field]);
          if (value) {
            entry[field] = value;
          }
        });

        const supplierNames: string[] = [];
        const supplierReadings: string[] = [];
        const materialReadings: string[] = [];

        if (entry.supplierName) {
          supplierNames.push(entry.supplierName);
        }
        if (entry.supplierReading) {
          supplierReadings.push(entry.supplierReading);
        }
        if (entry.materialReading) {
          materialReadings.push(entry.materialReading);
        }

        let offset = 1;
        while (true) {
          const nextRow = row + offset;
          if (nextRow > lastRowIndex) {
            break;
          }
          const nextArrival = getCellValue(worksheet, nextRow, terminationColumn);
          const nextSupplier = getCellValue(worksheet, nextRow, columns.supplierName);
          if (nextArrival || !nextSupplier) {
            break;
          }
          supplierNames.push(nextSupplier);
          const nextSupplierReading = getCellValue(worksheet, nextRow, columns.supplierReading);
          if (nextSupplierReading) {
            supplierReadings.push(nextSupplierReading);
          }
          const nextMaterialReading = getCellValue(worksheet, nextRow, columns.materialReading);
          if (nextMaterialReading) {
            materialReadings.push(nextMaterialReading);
          }
          offset += 1;
        }

        if (supplierNames.length > 0) {
          entry.supplierName = supplierNames.join(joiner);
        }
        if (supplierReadings.length > 0) {
          entry.supplierReading = supplierReadings.join(joiner);
        }
        if (materialReadings.length > 0) {
          entry.materialReading = materialReadings.join(joiner);
        }

        const index = entries.length + 1;
        entry.id = createEntryId(sheetKey, arrivalTime, index);
        entry.arrivalTime = arrivalTime;

        entries.push(entry);
        row += offset - 1;
      }

      const output = {
        meta: {
          sheetName: sheetConfig.sheetName,
          sourceFile: path.basename(inputPath),
          generatedAt: new Date().toISOString(),
          configKey: sheetConfig.key,
        },
        entries,
      };

      const outputPath = path.join(outputDir, sheetConfig.outputFile);
      fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
      console.log(`生成しました: ${outputPath}`);
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
};

main();
