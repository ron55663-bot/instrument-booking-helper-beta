const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("google-apps-script/Code.gs", "utf8");
const context = vm.createContext({ console });
vm.runInContext(source, context);

function tableSheet(values, displayValues = values) {
  return {
    getDataRange() {
      return {
        getValues: () => values,
        getDisplayValues: () => displayValues,
      };
    },
  };
}

function scheduleSheet(fixedRows, monthGrid) {
  return {
    getLastRow: () => fixedRows.length,
    getLastColumn: () => 6 + monthGrid[0].length,
    getRange(row, column, rowCount, columnCount) {
      if (column === 1 && columnCount === 5) {
        return { getDisplayValues: () => fixedRows.slice(row - 1, row - 1 + rowCount) };
      }
      if (column === 6) {
        return {
          getDisplayValues: () => monthGrid
            .slice(row - 1, row - 1 + rowCount)
            .map((item) => item.slice(0, columnCount)),
        };
      }
      throw new Error(`Unexpected range ${row},${column},${rowCount},${columnCount}`);
    },
  };
}

const instrumentValues = [
  ["系統識別碼", "儀器編號", "分類", "畫面代碼", "啟用", "區域劃分"],
  ["3DX-EX1", "EX1", "3D類別 X", "3DX", true, "中南"],
  ["3DX-EX2", "EX2", "3D類別 X", "3DX", true, "北"],
  ["3DX-EX3", "EX3", "3D類別 X", "3DX", false, "北"],
  ["3DX-Enstie X校正箱", "Enstie X校正箱", "校正類", "3DX", true, "北"],
  ["3DP-Enstie P校正箱", "Enstie P校正箱", "校正類", "3DP", true, "北"],
  ["WMC-Claris校正包", "Claris校正包", "校正類", "WMC", true, "北"],
];
const bookingValues = [
  ["申請編號", "借用日期", "借用醫院", "借用人", "系統識別碼", "儀器名稱", "儀器類別", "送達時間", "取回時間", "備註／手術內容", "申請時間", "狀態"],
  ["B1", "2026-07-02", "中國醫", "Ron", "3DX-EX1", "EX1", "3D類別 X", "08:00", "12:00", "AF", "", "已預約"],
  ["B2", "2026-07-03", "南辦", "Jeff", "3DX-EX1", "EX1", "3D類別 X", "08:00", "12:00", "取消資料", "", "已取消"],
  ["B3", "2026-07-02", "中榮", "Eric", "3DX-EX1", "EX1", "3D類別 X", "", "", "備取", "", "備取中"],
];

const fixedRows = Array.from({ length: 10 }, () => ["", "", "", "", ""]);
fixedRows[2] = ["", "", "EX1", "", "原始位置"];
fixedRows[3] = ["", "", "EX1", "", "目的地"];
fixedRows[5] = ["", "", "EX2", "", "原始位置"];
fixedRows[6] = ["", "", "EX2", "", "目的地"];
fixedRows[8] = ["", "", "EX3", "", "原始位置"];
fixedRows[9] = ["", "", "EX3", "", "目的地"];

const width = 31 * 6;
const monthGrid = Array.from({ length: fixedRows.length }, () => Array(width).fill(""));
monthGrid[3][6] = "中國醫"; // 7/2 EX1, matches App booking.
monthGrid[6][6] = "北榮";   // 7/2 EX2, manual schedule.
monthGrid[6][12] = "北醫";  // 7/3 EX2, manual; EX1 cancellation must not occupy.

const instrumentSheet = tableSheet(instrumentValues);
const bookingSheet = tableSheet(bookingValues, bookingValues);
const julySheet = scheduleSheet(fixedRows, monthGrid);

context.ensureInstrumentsSheetSchema = () => {};
context.ensureBookingsSheetSchema = () => {};
context.getRequiredSheet = (name) => {
  if (name === "儀器清單") return instrumentSheet;
  if (name === "借用紀錄") return bookingSheet;
  throw new Error(`Unknown sheet: ${name}`);
};
context.getSpreadsheet = () => ({ getSheetByName: (name) => name === "07月行程表" ? julySheet : null });

const categories = context.getScheduleCategoryCatalog();
assert.strictEqual(categories[0].name, "3D類別 X");
assert.strictEqual(categories[0].enabledCount, 2, "disabled instruments are excluded from enabled count");
const calibrationCategory = categories.find((category) => category.name === "校正類");
assert.ok(calibrationCategory, "calibration instruments are grouped under the centralized category");
assert.strictEqual(calibrationCategory.enabledCount, 3);
assert.deepStrictEqual(
  Array.from(calibrationCategory.instruments, (instrument) => instrument.id),
  ["3DX-Enstie X校正箱", "3DP-Enstie P校正箱", "WMC-Claris校正包"],
  "regrouping preserves every existing system identifier",
);

const result = context.getInstrumentCategoryMonthSchedule("2026-07", "3D類別 X");
assert.strictEqual(result.days["2026-07-01"].status, "available", "at least one available instrument produces a green state");
assert.strictEqual(result.days["2026-07-02"].status, "booked", "all enabled instruments occupied produces an orange state");
assert.strictEqual(result.days["2026-07-02"].availableCount, 0);
assert.strictEqual(result.days["2026-07-02"].instruments.find((item) => item.id === "3DX-EX2").manualSchedule, true, "manual schedule is identified without a Booking ID");
assert.strictEqual(result.days["2026-07-03"].availableCount, 1, "cancelled booking does not occupy an instrument");
assert.strictEqual(result.days["2026-07-03"].instruments.find((item) => item.id === "3DX-EX3").status, "disabled");
assert.ok(result.days["2026-07-02"].instruments.find((item) => item.id === "3DX-EX1").waitlistCount >= 1);

console.log("category-calendar-v1-4: all tests passed");
