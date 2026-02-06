const fs = require("fs/promises");
const path = require("path");

const ROOT = "/Users/coo/Desktop/LR";
const SRC_JSON = path.join(ROOT, "TestData.json");
const SRC_XLSX = path.join(ROOT, "DataNew_filled.xlsx");
const OUT_COPY = path.join(ROOT, "TestData_copy.json");
const OUT_MERGED = path.join(ROOT, "TestData_merged.json");
const TSV_ARG = "--tsv";

const REQUIRED_HEADERS = [
  "date",
  "set",
  "num",
  "timeSec",
  "scene",
  "prompt",
  "audio",
  "picture",
  "script",
  "type",
  "length",
  "difficulty",
];

function toNumber(value, rowNum, colName) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`Empty value at row ${rowNum}, column ${colName}`);
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    throw new Error(`NaN value at row ${rowNum}, column ${colName}`);
  }
  return num;
}

function toStringTrim(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function isRowEmpty(row) {
  return row.every((cell) => {
    if (cell === null || cell === undefined) {
      return true;
    }
    return String(cell).trim() === "";
  });
}

function getIdFromAudio(audio) {
  if (!audio) {
    return "";
  }
  return audio.replace(/\.[^./\\]+$/, "");
}

function compareItems(a, b) {
  const setA = a.set || "";
  const setB = b.set || "";
  const setCmp = setA.localeCompare(setB);
  if (setCmp !== 0) {
    return setCmp;
  }
  return (a.num || 0) - (b.num || 0);
}

async function readRowsFromXlsx(filePath) {
  const xlsx = require("xlsx");
  const workbook = xlsx.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Excel file has no sheets");
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  return rows;
}

async function readRowsFromTsv(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== "");
  return lines.map((line) => line.split("\t"));
}

async function main() {
  const rawJson = await fs.readFile(SRC_JSON, "utf8");
  const data = JSON.parse(rawJson);
  const dataCopy = JSON.parse(JSON.stringify(data));

  if (!Array.isArray(dataCopy.items)) {
    throw new Error("TestData.json has no items array");
  }

  await fs.writeFile(OUT_COPY, JSON.stringify(dataCopy, null, 2));

  const tsvIndex = process.argv.indexOf(TSV_ARG);
  const tsvPath = tsvIndex !== -1 ? process.argv[tsvIndex + 1] : "";
  const rows = tsvPath
    ? await readRowsFromTsv(tsvPath)
    : await readRowsFromXlsx(SRC_XLSX);

  if (rows.length === 0) {
    throw new Error("Excel sheet is empty");
  }

  const headerRow = rows[0].map((cell) => toStringTrim(cell));
  const headerIndex = new Map(
    headerRow.map((name, idx) => [name, idx])
  );

  for (const col of REQUIRED_HEADERS) {
    if (!headerIndex.has(col)) {
      throw new Error(`Missing required column in Excel: ${col}`);
    }
  }

  const existingIds = new Set(dataCopy.items.map((item) => item.id));
  const newIds = new Set();
  const newItems = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || isRowEmpty(row)) {
      continue;
    }

    const rowNum = i + 1;
    const getCell = (name) => row[headerIndex.get(name)];

    const date = toNumber(getCell("date"), rowNum, "date");
    const set = toStringTrim(getCell("set"));
    const num = toNumber(getCell("num"), rowNum, "num");
    const timeSec = toNumber(getCell("timeSec"), rowNum, "timeSec");
    const scene = toStringTrim(getCell("scene"));
    const prompt = toStringTrim(getCell("prompt"));
    const audio = toStringTrim(getCell("audio"));
    const picture = toStringTrim(getCell("picture"));
    const script = toStringTrim(getCell("script"));
    const type = toStringTrim(getCell("type"));
    const length = toNumber(getCell("length"), rowNum, "length");
    const difficulty = toNumber(getCell("difficulty"), rowNum, "difficulty");

    const allowedTypes = new Set(["simple", "compound", "complex"]);
    if (!allowedTypes.has(type)) {
      throw new Error(`Invalid type at row ${rowNum}: ${type}`);
    }
    if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
      throw new Error(`Invalid difficulty at row ${rowNum}: ${difficulty}`);
    }

    let id = getIdFromAudio(audio);
    if (!id) {
      const numStr = Number.isInteger(num)
        ? String(num).padStart(2, "0")
        : String(num);
      id = `${set}-${numStr}`;
    }

    if (existingIds.has(id)) {
      throw new Error(`Duplicate id vs original at row ${rowNum}: ${id}`);
    }
    if (newIds.has(id)) {
      throw new Error(`Duplicate id within new rows at row ${rowNum}: ${id}`);
    }
    newIds.add(id);

    newItems.push({
      id,
      date,
      set,
      num,
      timeSec,
      scene,
      type,
      length,
      difficulty,
      prompt,
      script,
      audio,
      picture,
    });
  }

  dataCopy.items.push(...newItems);
  dataCopy.items.sort(compareItems);
  dataCopy.version = new Date().toISOString();
  dataCopy.source = "TestData.json + DataNew_filled.xlsx merged";

  await fs.writeFile(OUT_MERGED, JSON.stringify(dataCopy, null, 2));

  console.log(`Source items: ${data.items.length}`);
  console.log(`New rows: ${newItems.length}`);
  console.log(`Merged items: ${dataCopy.items.length}`);
  console.log(`Copy output: ${OUT_COPY}`);
  console.log(`Merged output: ${OUT_MERGED}`);
  console.log("Original TestData.json was NOT modified.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
