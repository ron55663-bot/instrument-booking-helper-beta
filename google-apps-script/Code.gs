/**
 * 儀器借用幫手 — Google Apps Script 後端
 *
 * 使用方式：
 * 1. 在目標 Google 試算表中開啟「擴充功能 → Apps Script」
 * 2. 將此檔案完整貼入 Code.gs
 * 3. 執行 setupSheets() 一次
 * 4. 部署為網路應用程式（執行身分：自己；存取權：所有人）
 */

const BOOKINGS_SHEET = "借用紀錄";
const INSTRUMENTS_SHEET = "儀器清單";
const SPREADSHEET_ID = "1srzjbSmguIPuV8OAEZ-6NlKJJyRUe9o3nNpm9ZLWEXs";
const SCHEDULE_SHEET_SUFFIX = "月行程表";
const SCHEDULE_FIRST_DATE_COLUMN = 6; // F 欄
const SCHEDULE_DATE_BLOCK_WIDTH = 6;
const INSTRUMENT_CATALOG = [
  ["3D類別 X", "3DX", ["EX2", "EX3", "EX4", "EX1", "Enstie X校正箱"]],
  ["3D類別 P", "3DP", ["E1", "E2", "E3", "E4", "Enstie P校正箱"]],
  ["ICE系列", "ICE", ["ICE-H", "ICE-H-2", "ICE-H-3", "ICE(CX50)-1", "ICE(CX50)-2", "ICE-TS"]],
  ["WMC系列", "WMC", ["WMC-2", "Claris校正包"]],
  ["LM系列", "LM", ["LM2", "LM3", "LM1"]],
  ["電燒機", "A", ["A1", "A4", "A5", "A6(無Remote)", "A2", "A7"]],
  ["Pump", "P", ["P1", "P2", "P5", "P3", "P4"]],
  ["CF系列", "CF", ["33921", "34244", "36614", "36814", "34478", "36503"]],
  ["RecordConnect", "RC", ["RG1", "RG2", "RG4", "RB1", "RB4", "RW1", "RW3", "RW4", "RG3", "RB2", "RB3", "RS1"]],
  ["食道溫", "ST", ["ST2", "ST"]],
  ["刺激器", "EP4", ["EP1", "EP2", "EP3", "EP4", "EP5", "EP6"]],
  ["刺激器螢幕", "T", ["T1", "T2", "T3", "T4", "T5"]],
  ["其他", "OT", ["WetLab-1", "Splitter +螢幕", "CathLink(C1)", "CathLink(C2)"]],
];

function setupSheets() {
  const spreadsheet = getSpreadsheet();
  let bookings = spreadsheet.getSheetByName(BOOKINGS_SHEET);
  let instruments = spreadsheet.getSheetByName(INSTRUMENTS_SHEET);

  if (!bookings) bookings = spreadsheet.insertSheet(BOOKINGS_SHEET);
  if (!instruments) instruments = spreadsheet.insertSheet(INSTRUMENTS_SHEET);

  if (bookings.getLastRow() === 0) {
    bookings.appendRow([
      "申請編號",
      "借用日期",
      "借用醫院",
      "系統識別碼",
      "儀器名稱",
      "儀器類別",
      "送達時間",
      "取回時間",
      "備註／手術內容",
      "申請時間",
      "狀態",
    ]);
    bookings.setFrozenRows(1);
  }

  if (instruments.getLastRow() === 0) {
    instruments.appendRow(["系統識別碼", "儀器編號", "分類", "畫面代碼", "啟用"]);
    getCatalogRows().forEach((row) => instruments.appendRow(row));
    instruments.setFrozenRows(1);
  }

  [bookings, instruments].forEach((sheet) => {
    sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .setBackground("#12372f")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
    sheet.autoResizeColumns(1, sheet.getLastColumn());
  });
}

function getCatalogRows() {
  const rows = [];
  INSTRUMENT_CATALOG.forEach((group) => {
    const category = group[0];
    const code = group[1];
    group[2].forEach((name) => rows.push([
      code + "-" + name,
      name,
      category,
      code,
      true,
    ]));
  });
  return rows;
}

function doGet(e) {
  try {
    if (!e || !e.parameter || e.parameter.action !== "availability") {
      return jsonResponse({ success: true, message: "儀器借用幫手 API 運作中" });
    }

    const date = sanitizeText(e.parameter.date, 10);
    assertValidDate(date);
    return jsonResponse({
      success: true,
      instruments: getAvailability(date),
    });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const data = JSON.parse(e.postData.contents);
    validateBooking(data);

    // 在鎖定狀態下再次逐台檢查，避免多人同時預約相同儀器。
    const availability = getAvailability(data.date);
    const selections = data.instruments.map((requested) => ({
      requested: requested,
      instrument: availability.find((item) => item.id === requested.id),
    }));
    if (selections.some((selection) => !selection.instrument)) {
      throw new Error("部分儀器資料不存在，請返回重新選擇。");
    }
    const newlyUnavailable = selections.filter((selection) =>
      selection.requested.requestType === "booking" && !selection.instrument.available
    );
    if (newlyUnavailable.length) {
      throw new Error("部分原本可借的儀器剛剛已被借用，請返回改選備取。");
    }

    const bookingId = Utilities.getUuid().slice(0, 8).toUpperCase();
    const sheet = getRequiredSheet(BOOKINGS_SHEET);
    const hospital = sanitizeText(data.hospital, 100);
    const notes = sanitizeText(data.notes || "", 500);
    const submittedAt = new Date();
    let bookingCount = 0;
    let waitlistCount = 0;
    selections.forEach((selection) => {
      const instrument = selection.instrument;
      const status = instrument.available ? "已預約" : "備取中";
      if (status === "已預約") bookingCount += 1;
      if (status === "備取中") waitlistCount += 1;
      updateMonthlySchedule({
        date: data.date,
        hospital: hospital,
        deliveryTime: data.deliveryTime,
        pickupTime: data.pickupTime,
        notes: notes,
        instrument: instrument,
        status: status,
        waitlistNumber: instrument.waitlistCount + 1,
      });
      sheet.appendRow([
        bookingId,
        data.date,
        hospital,
        instrument.id,
        instrument.name,
        instrument.category,
        data.deliveryTime,
        data.pickupTime,
        notes,
        submittedAt,
        status,
      ]);
    });

    return jsonResponse({
      success: true,
      bookingId: bookingId,
      instrumentCount: selections.length,
      bookingCount: bookingCount,
      waitlistCount: waitlistCount,
    });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function getAvailability(date) {
  const instrumentSheet = getRequiredSheet(INSTRUMENTS_SHEET);
  const bookingSheet = getRequiredSheet(BOOKINGS_SHEET);
  const instrumentRows = instrumentSheet.getDataRange().getValues().slice(1);
  const schedule = getScheduleContext(date);
  const scheduleLastRow = schedule.sheet.getLastRow();
  const fixedRows = schedule.sheet.getRange(1, 1, scheduleLastRow, 5).getDisplayValues();
  const dateRows = schedule.sheet
    .getRange(1, schedule.dateColumn, scheduleLastRow, 3)
    .getDisplayValues();
  const bookingValues = bookingSheet.getDataRange().getDisplayValues();
  const bookingHeaders = bookingValues[0] || [];
  const bookingRows = bookingValues.slice(1);
  const dateIndex = bookingHeaders.indexOf("借用日期");
  const idIndex = bookingHeaders.indexOf("系統識別碼") >= 0
    ? bookingHeaders.indexOf("系統識別碼")
    : bookingHeaders.indexOf("儀器編號");
  const statusIndex = bookingHeaders.indexOf("狀態");

  const waitlistCounts = {};
  bookingRows.forEach((row) => {
    const status = row[statusIndex];
    if (normalizeDate(row[dateIndex]) === date) {
      if (status === "備取中") {
        waitlistCounts[row[idIndex]] = (waitlistCounts[row[idIndex]] || 0) + 1;
      }
    }
  });

  return instrumentRows
    .filter((row) => row[0] && row[4] !== false)
    .map((row) => {
      const id = String(row[0]);
      const name = String(row[1]);
      const baseIndex = findScheduleBaseRowIndex(fixedRows, name);
      const scheduleMissing = baseIndex < 0;
      const scheduleHospital = scheduleMissing
        ? ""
        : sanitizeText((dateRows[baseIndex + 1] || [])[0], 100);
      const scheduleWaitlistCount = scheduleMissing
        ? 0
        : getScheduleWaitlistCount((dateRows[baseIndex + 1] || [])[2]);
      const borrowedHospital = scheduleHospital;
      return {
        id: id,
        name: name,
        category: String(row[2] || "儀器設備"),
        code: String(row[3] || "EQ"),
        available: !scheduleMissing && !borrowedHospital,
        waitlistCount: Math.max(waitlistCounts[id] || 0, scheduleWaitlistCount),
        borrowedHospital: borrowedHospital,
        scheduleMissing: scheduleMissing,
        scheduleRow: scheduleMissing ? null : baseIndex + 1,
      };
    });
}

function getScheduleWaitlistCount(note) {
  const text = String(note || "");
  let maximum = 0;
  const pattern = /備取\s*(\d+)\s*[:：]/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    maximum = Math.max(maximum, Number(match[1]) || 0);
  }
  return maximum;
}

function getScheduleContext(date) {
  const parts = date.split("-");
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const sheetName = ("0" + month).slice(-2) + SCHEDULE_SHEET_SUFFIX;
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error("找不到「" + sheetName + "」，無法讀取該月排程。");

  const dateColumn = SCHEDULE_FIRST_DATE_COLUMN + (day - 1) * SCHEDULE_DATE_BLOCK_WIDTH;
  if (dateColumn + SCHEDULE_DATE_BLOCK_WIDTH - 1 > sheet.getLastColumn()) {
    throw new Error("「" + sheetName + "」沒有 " + month + "/" + day + " 的排程欄位。");
  }

  const header = sheet.getRange(1, dateColumn).getDisplayValue();
  if (header.indexOf(month + "月" + day + "日") !== 0) {
    throw new Error(
      "日期欄位不符合預期：" + sheetName + " " + columnToA1(dateColumn) + "1"
    );
  }
  return { sheet: sheet, dateColumn: dateColumn, sheetName: sheetName };
}

function findScheduleBaseRowIndex(fixedRows, instrumentName) {
  const candidates = getScheduleCodeCandidates(instrumentName);
  for (let index = 2; index < fixedRows.length; index += 1) {
    const row = fixedRows[index];
    if (row[4] !== "原始位置") continue;
    const code = normalizeScheduleCode(row[2]);
    const serialOrAlias = normalizeScheduleCode(row[3]);
    if (candidates.indexOf(code) >= 0 || candidates.indexOf(serialOrAlias) >= 0) {
      return index;
    }
  }
  return -1;
}

function getScheduleCodeCandidates(instrumentName) {
  const name = normalizeScheduleCode(instrumentName);
  const aliases = {
    "ENSTIE X校正箱": ["ENSITE X校正箱"],
    "ENSTIE P校正箱": ["ENSITE PRECISION 校正箱"],
    "A6(無REMOTE)": ["A6"],
    "CLARIS校正包": ["WORKMATE CLARIS校正包"],
    "CATHLINK(C1)": ["C1"],
    "CATHLINK(C2)": ["C2"],
  };
  if (/^\d{5}$/.test(name)) {
    return [name, "CF(" + name + ")"];
  }
  return [name].concat(aliases[name] || []);
}

function normalizeScheduleCode(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function updateMonthlySchedule(data) {
  const schedule = getScheduleContext(data.date);
  if (!data.instrument.scheduleRow) {
    throw new Error("找不到儀器「" + data.instrument.name + "」在月行程表中的列。");
  }

  const baseRow = data.instrument.scheduleRow;
  const destinationRow = baseRow + 1;
  if (data.status === "已預約") {
    schedule.sheet
      .getRange(baseRow, schedule.dateColumn + 1)
      .setValue(formatScheduleTime("送達", data.deliveryTime));
    schedule.sheet
      .getRange(destinationRow, schedule.dateColumn)
      .setValue(data.hospital);
    schedule.sheet
      .getRange(destinationRow, schedule.dateColumn + 1)
      .setValue(formatScheduleTime("取回", data.pickupTime));
    if (data.notes) {
      appendCellText(
        schedule.sheet.getRange(destinationRow, schedule.dateColumn + 2),
        data.notes
      );
    }
  } else {
    const waitlistText = "備取" + data.waitlistNumber + ":" + data.hospital;
    appendCellText(
      schedule.sheet.getRange(destinationRow, schedule.dateColumn + 2),
      waitlistText
    );
  }
}

function formatScheduleTime(prefix, value) {
  return prefix + String(value || "");
}

function appendCellText(cell, text) {
  const current = cell.getDisplayValue().trim();
  if (!current) {
    cell.setValue(text);
  } else if (current.indexOf(text) < 0) {
    cell.setValue(current + "\n" + text);
  }
}

function columnToA1(column) {
  let result = "";
  let value = column;
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function validateBooking(data) {
  if (!data) throw new Error("未收到借用資料。");
  assertValidDate(data.date);
  if (!sanitizeText(data.hospital, 100)) throw new Error("請填寫借用醫院名稱。");
  if (!Array.isArray(data.instruments) || !data.instruments.length) {
    throw new Error("請至少選擇一台借用儀器。");
  }
  const ids = data.instruments.map((item) => sanitizeText(item && item.id, 100));
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
    throw new Error("借用儀器資料不正確。");
  }
  const validTypes = { booking: true, waitlist: true };
  if (data.instruments.some((item) => !validTypes[item.requestType])) {
    throw new Error("借用或備取狀態不正確。");
  }
  if (!isTime(data.deliveryTime) || !isTime(data.pickupTime)) throw new Error("時間格式不正確。");
  if (data.pickupTime <= data.deliveryTime) throw new Error("取回時間必須晚於送達時間。");
}

function assertValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new Error("日期格式不正確。");
  const today = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd");
  if (date < today) throw new Error("不能選擇過去的日期。");
}

function isTime(value) {
  return /^(?:[01]\d|2[0-3]):(?:00|30)$/.test(value || "");
}

function normalizeDate(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, "Asia/Taipei", "yyyy-MM-dd");
  }
  const text = String(value || "");
  const match = text.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (!match) return text;
  return [match[1], ("0" + match[2]).slice(-2), ("0" + match[3]).slice(-2)].join("-");
}

function sanitizeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function getRequiredSheet(name) {
  const sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error("找不到「" + name + "」工作表，請先執行 setupSheets()。");
  return sheet;
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
