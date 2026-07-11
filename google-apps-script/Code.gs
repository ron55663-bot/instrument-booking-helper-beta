/**
 * 儀器借用幫手 — Google Apps Script 後端
 *
 * 使用方式：
 * 1. 在目標 Google 試算表中開啟「擴充功能 → Apps Script」
 * 2. 將此檔案完整貼入 Code.gs
 * 3. 另外新增 Index、Styles、Script 三個 HTML 檔，貼上同資料夾內對應內容
 * 4. 執行 setupSheets() 一次
 * 5. 若要限制公司帳號登入後使用：
 *    部署為網路應用程式（執行身分：自己；存取權：網域內任何人）
 *    若測試帳號不在公司網域，可暫時改成「任何擁有連結的人」測試。
 */

const BOOKINGS_SHEET = "借用紀錄";
const INSTRUMENTS_SHEET = "儀器清單";
const PERMISSIONS_SHEET = "人員權限表";
const SPREADSHEET_ID = "1srzjbSmguIPuV8OAEZ-6NlKJJyRUe9o3nNpm9ZLWEXs";
const SCHEDULE_SHEET_SUFFIX = "月行程表";
const SCHEDULE_FIRST_DATE_COLUMN = 6; // F 欄
const SCHEDULE_DATE_BLOCK_WIDTH = 6;
const HOSPITAL_GROUPS = [
  ["北區", [
    "北辦", "北榮", "北榮動物實驗", "台大", "林長一科", "林長二科", "基長", "北醫", "三總", "北馬", "淡馬",
    "竹馬", "亞東", "新光", "陽明", "竹北生醫", "新竹中國", "竹大", "萬芳", "土城", "花慈", "北慈",
    "新慈", "國桃", "敏盛", "北國", "輔大", "竹中", "部北", "新耕", "雙和", "聖母",
  ]],
  ["中區", [
    "中辦", "中榮", "中榮兒科", "中國醫", "中國兒科", "中國醫H棟", "亞大", "彰基", "員基", "中山", "署豐",
    "大里仁愛", "長安", "彰秀", "濱秀", "雲林台大", "斗六成大", "部苗", "部南投", "光田", "老醫",
    "埔榮", "嘉榮", "童綜合",
  ]],
  ["南區", [
    "高辦", "南辦", "高長", "嘉長", "高醫", "高醫岡山", "大同", "成大", "奇美", "802", "高榮",
    "屏榮", "屏基", "麻新", "嘉基", "高醫鳳山", "阮綜合", "東馬",
  ]],
];
const HOSPITALS = HOSPITAL_GROUPS.reduce(function (all, group) {
  return all.concat(group[1]);
}, []);
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
const INSTRUMENT_REGIONS = {
  "3DX-EX2": "北",
  "3DX-EX3": "北",
  "3DX-EX4": "北",
  "3DX-EX1": "中南",
  "3DX-Enstie X校正箱": "北",
  "3DP-E1": "北",
  "3DP-E2": "北",
  "3DP-E3": "中南",
  "3DP-E4": "中南",
  "3DP-Enstie P校正箱": "北",
  "ICE-ICE-H": "北",
  "ICE-ICE-H-2": "北",
  "ICE-ICE-H-3": "北",
  "ICE-ICE(CX50)-1": "北",
  "ICE-ICE(CX50)-2": "北",
  "ICE-ICE-TS": "北",
  "WMC-WMC-2": "北",
  "WMC-Claris校正包": "北",
  "LM-LM2": "北",
  "LM-LM3": "北",
  "LM-LM1": "北",
  "A-A1": "北",
  "A-A4": "北",
  "A-A5": "北",
  "A-A6(無Remote)": "北",
  "A-A2": "中南",
  "A-A7": "中南",
  "P-P1": "北",
  "P-P2": "北",
  "P-P5": "北",
  "P-P3": "中南",
  "P-P4": "中南",
  "CF-33921": "北",
  "CF-34244": "北",
  "CF-36614": "北",
  "CF-36814": "中南",
  "CF-34478": "中南",
  "CF-36503": "中南",
  "RC-RG1": "北",
  "RC-RG2": "北",
  "RC-RG4": "北",
  "RC-RB1": "北",
  "RC-RB4": "北",
  "RC-RW1": "北",
  "RC-RW3": "北",
  "RC-RW4": "北",
  "RC-RG3": "中南",
  "RC-RB2": "中南",
  "RC-RB3": "中南",
  "RC-RS1": "中南",
  "ST-ST2": "北",
  "ST-ST": "中南",
  "EP4-EP1": "北",
  "EP4-EP2": "北",
  "EP4-EP3": "北",
  "EP4-EP4": "北",
  "EP4-EP5": "北",
  "EP4-EP6": "北",
  "T-T1": "備機",
  "T-T2": "備機",
  "T-T3": "備機",
  "T-T4": "備機",
  "T-T5": "備機",
  "OT-WetLab-1": "北",
  "OT-Splitter +螢幕": "備機",
  "OT-CathLink(C1)": "備機",
  "OT-CathLink(C2)": "備機",
};

function setupSheets() {
  const spreadsheet = getSpreadsheet();
  let bookings = spreadsheet.getSheetByName(BOOKINGS_SHEET);
  let instruments = spreadsheet.getSheetByName(INSTRUMENTS_SHEET);
  let permissions = spreadsheet.getSheetByName(PERMISSIONS_SHEET);

  if (!bookings) bookings = spreadsheet.insertSheet(BOOKINGS_SHEET);
  if (!instruments) instruments = spreadsheet.insertSheet(INSTRUMENTS_SHEET);
  if (!permissions) permissions = spreadsheet.insertSheet(PERMISSIONS_SHEET);

  if (bookings.getLastRow() === 0) {
    bookings.appendRow([
      "申請編號",
      "借用日期",
      "借用醫院",
      "借用人",
      "系統識別碼",
      "儀器名稱",
      "儀器類別",
      "送達時間",
      "取回時間",
      "備註／手術內容",
      "申請時間",
      "狀態",
      "建立來源",
    ]);
    bookings.setFrozenRows(1);
  }
  ensureBookingsSheetSchema(bookings);

  if (instruments.getLastRow() === 0) {
    instruments.appendRow(["系統識別碼", "儀器編號", "分類", "畫面代碼", "啟用", "區域劃分"]);
    getCatalogRows().forEach((row) => instruments.appendRow(row));
    instruments.setFrozenRows(1);
  }
  ensureInstrumentsSheetSchema(instruments);

  if (permissions.getLastRow() === 0) {
    permissions.appendRow(["使用者Email", "姓名", "可借醫院", "可借區域", "可借儀器類別", "管理者", "啟用"]);
    permissions.appendRow(["*", "測試預設：全部開放", "*", "*", "*", false, true]);
    permissions.setFrozenRows(1);
  }

  [bookings, instruments, permissions].forEach((sheet) => {
    sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .setBackground("#12372f")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
    sheet.autoResizeColumns(1, sheet.getLastColumn());
  });
}

function ensureBookingsSheetSchema(sheet) {
  if (!sheet || sheet.getLastColumn() === 0) return;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const requiredHeaders = ["借用人", "使用者Email", "建立來源", "取消申請時間", "取消原因", "遞補時間", "遞補自申請編號"];
  const hospitalColumn = headers.indexOf("借用醫院") + 1;
  requiredHeaders.forEach(function (header) {
    if (headers.indexOf(header) >= 0) return;
    if (header === "借用人" && hospitalColumn) {
      sheet.insertColumnAfter(hospitalColumn);
      sheet.getRange(1, hospitalColumn + 1).setValue(header);
    } else {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
    }
    sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .setBackground("#12372f")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
  });
}

function ensureInstrumentsSheetSchema(sheet) {
  if (!sheet || sheet.getLastColumn() === 0) return;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  let regionColumn = headers.indexOf("區域劃分") + 1;

  if (!regionColumn) {
    sheet.insertColumnAfter(sheet.getLastColumn());
    regionColumn = sheet.getLastColumn();
    sheet.getRange(1, regionColumn)
      .setValue("區域劃分")
      .setBackground("#12372f")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
  }

  const idColumn = headers.indexOf("系統識別碼") + 1;
  if (!idColumn || sheet.getLastRow() < 2) return;

  const ids = sheet.getRange(2, idColumn, sheet.getLastRow() - 1, 1).getDisplayValues();
  const regions = ids.map(function (row) {
    return [INSTRUMENT_REGIONS[row[0]] || ""];
  });
  sheet.getRange(2, regionColumn, regions.length, 1).setValues(regions);
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
      INSTRUMENT_REGIONS[code + "-" + name] || "",
    ]));
  });
  return rows;
}

function doGet(e) {
  try {
    if (!e || !e.parameter || !e.parameter.action) {
      return HtmlService
        .createTemplateFromFile("Index")
        .evaluate()
        .setTitle("儀器借用幫手 Beta測試版")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    if (e.parameter.action === "profile") {
      return jsonResponse({ success: true, profile: getUserProfile() });
    }

    if (e.parameter.action === "myBookings") {
      return jsonResponse({ success: true, bookings: getMyBookings() });
    }

    if (e.parameter.action === "scheduleMonth") {
      return jsonResponse({ success: true, schedule: getInstrumentMonthSchedule(
        sanitizeText(e.parameter.month, 7),
        sanitizeText(e.parameter.instrumentId, 120)
      ) });
    }

    if (e.parameter.action !== "availability") throw new Error("未知的查詢動作。");

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

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getWebAppUrl() {
  return ScriptApp.getService().getUrl() || "";
}

function getActiveUserEmail() {
  const email = Session.getActiveUser().getEmail() || "";
  if (!email) {
    throw new Error("無法辨識公司帳號，請以公司 Google 帳號開啟此 App。");
  }
  return email;
}

function apiGetProfile() {
  return { success: true, profile: getUserProfile() };
}

function apiGetMyBookings() {
  return { success: true, bookings: getMyBookings() };
}

function apiGetAvailability(date) {
  assertValidDate(date);
  return { success: true, instruments: getAvailability(date) };
}

function apiGetInstrumentMonthSchedule(month, instrumentId) {
  getActiveUserEmail();
  return { success: true, schedule: getInstrumentMonthSchedule(month, instrumentId) };
}

function apiSubmitBooking(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    return handleBookingSubmission(data);
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function apiCancelBooking(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    return cancelMyBooking(data);
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

// 安裝一次即可：每 5 分鐘檢查月行程表是否被授權人員手動清空，並遞補第一順位備取。
function installAutoSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "syncManualScheduleChanges") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger("syncManualScheduleChanges").timeBased().everyMinutes(5).create();
  SpreadsheetApp.getActive().toast("已啟用每 5 分鐘自動檢查與備取遞補。", "儀器借用幫手");
}

// 供時間觸發器執行，也可由管理者手動執行測試。
function syncManualScheduleChanges() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = getRequiredSheet(BOOKINGS_SHEET);
    ensureBookingsSheetSchema(sheet);
    const values = sheet.getDataRange().getDisplayValues();
    const headers = values[0] || [];
    const statusColumn = headers.indexOf("狀態") + 1;
    const cancelAtColumn = headers.indexOf("取消申請時間") + 1;
    const cancelReasonColumn = headers.indexOf("取消原因") + 1;
    const today = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd");
    let released = 0;
    let promoted = 0;
    const errors = [];

    values.slice(1).forEach(function (row, index) {
      try {
        const date = normalizeDate(getCell(row, headers, "借用日期"));
        // 僅處理由 App 建立且可完整追蹤的紀錄；人工 key-in 資料一律不自動異動。
        if (getCell(row, headers, "建立來源") !== "App" || getCell(row, headers, "狀態") !== "已預約" || date < today) return;
        if (!isBookedRecordMissingFromSchedule(row, headers)) return;

        const rowNumber = index + 2;
        const bookingId = getCell(row, headers, "申請編號");
        sheet.getRange(rowNumber, statusColumn).setValue("已取消");
        if (cancelAtColumn) sheet.getRange(rowNumber, cancelAtColumn).setValue(new Date());
        if (cancelReasonColumn) sheet.getRange(rowNumber, cancelReasonColumn).setValue("管理者於月行程表手動釋出");
        released += 1;

        const replacement = promoteFirstWaitlist(sheet, row, headers, bookingId);
        if (replacement) promoted += 1;
      } catch (error) {
        errors.push("第 " + (index + 2) + " 列：" + error.message);
      }
    });
    return { success: true, released: released, promoted: promoted, errors: errors };
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

// 供管理者在修正程式後手動執行一次：只釋出「已取消」但月表仍保有
// 相同醫院名稱的排程。這可安全修復舊版取消成功、月表卻未清空的資料。
function repairCancelledSchedules() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = getRequiredSheet(BOOKINGS_SHEET);
    ensureBookingsSheetSchema(sheet);
    const values = sheet.getDataRange().getDisplayValues();
    const headers = values[0] || [];
    let repaired = 0;
    const errors = [];

    values.slice(1).forEach(function (row) {
      if (getCell(row, headers, "狀態") !== "已取消") return;
      try {
        if (isCancelledBookingStillOnSchedule(row, headers)) {
          releaseMonthlyScheduleForBooking(row, headers);
          repaired += 1;
        }
      } catch (error) {
        errors.push(error.message);
      }
    });
    SpreadsheetApp.getActive().toast("已修復 " + repaired + " 筆未釋出的取消排程。", "儀器借用幫手");
    if (errors.length) throw new Error("部分資料無法修復：" + errors.join("；"));
    return { success: true, repaired: repaired };
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const data = JSON.parse(e.postData.contents);
    if (data && data.action === "cancel") {
      return jsonResponse(cancelMyBooking(data));
    }

    return jsonResponse(handleBookingSubmission(data));
  } catch (error) {
    return jsonResponse({ success: false, message: error.message });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function handleBookingSubmission(data) {
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
  ensureBookingsSheetSchema(sheet);
  const hospital = canonicalizeHospital(data.hospital);
  const borrower = sanitizeText(data.borrower, 50);
  const notes = sanitizeText(data.notes || "", 500);
  const userEmail = getActiveUserEmail();
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
      borrower,
      instrument.id,
      instrument.name,
      instrument.category,
      data.deliveryTime,
      data.pickupTime,
      notes,
      submittedAt,
      status,
    ]);
    setBookingRowExtras(sheet, sheet.getLastRow(), {
      "使用者Email": userEmail,
      "建立來源": "App",
    });
  });

  return {
    success: true,
    bookingId: bookingId,
    instrumentCount: selections.length,
    bookingCount: bookingCount,
    waitlistCount: waitlistCount,
  };
}

function setBookingRowExtras(sheet, rowNumber, values) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  Object.keys(values).forEach(function (header) {
    const column = headers.indexOf(header) + 1;
    if (column) sheet.getRange(rowNumber, column).setValue(values[header]);
  });
}

function getAvailability(date) {
  const instrumentSheet = getRequiredSheet(INSTRUMENTS_SHEET);
  const bookingSheet = getRequiredSheet(BOOKINGS_SHEET);
  ensureInstrumentsSheetSchema(instrumentSheet);
  const instrumentValues = instrumentSheet.getDataRange().getValues();
  const instrumentHeaders = instrumentValues[0] || [];
  const instrumentRows = instrumentValues.slice(1);
  const regionIndex = instrumentHeaders.indexOf("區域劃分");
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
        region: regionIndex >= 0 ? String(row[regionIndex] || "") : (INSTRUMENT_REGIONS[id] || ""),
        available: !scheduleMissing && !borrowedHospital,
        waitlistCount: Math.max(waitlistCounts[id] || 0, scheduleWaitlistCount),
        borrowedHospital: borrowedHospital,
        scheduleMissing: scheduleMissing,
        scheduleRow: scheduleMissing ? null : baseIndex + 1,
      };
    });
}

function getInstrumentMonthSchedule(month, instrumentId) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ""))) throw new Error("月份格式不正確。");
  const parts = month.split("-").map(Number);
  const year = parts[0];
  const monthNumber = parts[1];
  if (year < 2020 || year > 2100 || monthNumber < 1 || monthNumber > 12) throw new Error("月份超出可查詢範圍。");

  const instrumentSheet = getRequiredSheet(INSTRUMENTS_SHEET);
  ensureInstrumentsSheetSchema(instrumentSheet);
  const instrumentValues = instrumentSheet.getDataRange().getDisplayValues();
  const instrumentHeaders = instrumentValues[0] || [];
  const instrumentRow = instrumentValues.slice(1).find(function (row) {
    return String(row[0]) === instrumentId && row[4] !== "FALSE";
  });
  if (!instrumentRow) throw new Error("找不到可借用儀器。");
  const instrument = {
    id: String(instrumentRow[0]),
    name: String(instrumentRow[1]),
    category: String(instrumentRow[2] || "儀器設備"),
    code: String(instrumentRow[3] || "EQ"),
    region: instrumentHeaders.indexOf("區域劃分") >= 0 ? String(instrumentRow[instrumentHeaders.indexOf("區域劃分")] || "") : "",
  };

  const bookingSheet = getRequiredSheet(BOOKINGS_SHEET);
  ensureBookingsSheetSchema(bookingSheet);
  const bookingValues = bookingSheet.getDataRange().getDisplayValues();
  const headers = bookingValues[0] || [];
  const grouped = {};
  bookingValues.slice(1).forEach(function (row) {
    const date = normalizeDate(getCell(row, headers, "借用日期"));
    const id = getCell(row, headers, "系統識別碼") || getCell(row, headers, "儀器編號");
    const status = getCell(row, headers, "狀態");
    if (date.slice(0, 7) !== month || id !== instrumentId || (status !== "已預約" && status !== "備取中")) return;
    if (!grouped[date]) grouped[date] = { booked: [], waitlist: [] };
    const record = {
      hospital: getCell(row, headers, "借用醫院"),
      borrower: getCell(row, headers, "借用人"),
      notes: getCell(row, headers, "備註／手術內容"),
      deliveryTime: getCell(row, headers, "送達時間"),
      pickupTime: getCell(row, headers, "取回時間"),
    };
    if (status === "已預約") grouped[date].booked.push(record);
    if (status === "備取中") {
      record.order = grouped[date].waitlist.length + 1;
      grouped[date].waitlist.push(record);
    }
  });

  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const scheduleSheet = getSpreadsheet().getSheetByName(("0" + monthNumber).slice(-2) + SCHEDULE_SHEET_SUFFIX);
  let scheduleRows = null;
  let baseIndex = -1;
  if (scheduleSheet) {
    const lastRow = scheduleSheet.getLastRow();
    const fixedRows = scheduleSheet.getRange(1, 1, lastRow, 5).getDisplayValues();
    baseIndex = findScheduleBaseRowIndex(fixedRows, instrument.name);
    if (baseIndex >= 0) {
      scheduleRows = scheduleSheet.getRange(baseIndex + 1, SCHEDULE_FIRST_DATE_COLUMN, 2, daysInMonth * SCHEDULE_DATE_BLOCK_WIDTH).getDisplayValues();
    }
  }

  const days = {};
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = month + "-" + ("0" + day).slice(-2);
    const records = grouped[date] || { booked: [], waitlist: [] };
    const offset = (day - 1) * SCHEDULE_DATE_BLOCK_WIDTH;
    const scheduleHospital = scheduleRows ? sanitizeText((scheduleRows[1] || [])[offset], 100) : "";
    if (scheduleHospital && !records.booked.length) {
      records.booked.push({
        hospital: scheduleHospital,
        borrower: "",
        notes: "人工排程（詳細資料請查月行程表）",
        deliveryTime: "",
        pickupTime: "",
      });
    }
    days[date] = {
      available: records.booked.length === 0 && !scheduleHospital,
      booked: records.booked,
      waitlist: records.waitlist,
    };
  }
  return { month: month, instrument: instrument, days: days };
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
  if (!sanitizeText(data.borrower, 50)) throw new Error("請填寫借用人姓名。");
  if (!canonicalizeHospital(data.hospital)) throw new Error("請從正式清單選擇借用醫院。");
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
  assertUserCanBook(data);
}

function getUserProfile() {
  const email = getActiveUserEmail();
  const permission = getUserPermission(email);
  return {
    email: email,
    name: permission.name || "",
    isAdmin: permission.isAdmin,
    unrestricted: permission.unrestricted,
    hospitals: permission.hospitals,
    regions: permission.regions,
    categories: permission.categories,
  };
}

function getUserPermission(email) {
  const sheet = getSpreadsheet().getSheetByName(PERMISSIONS_SHEET);
  const defaultPermission = {
    email: email,
    name: "",
    isAdmin: false,
    unrestricted: true,
    hospitals: ["*"],
    regions: ["*"],
    categories: ["*"],
  };
  if (!sheet || sheet.getLastRow() < 2) return defaultPermission;
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0] || [];
  const rows = values.slice(1).filter(function (row) {
    const active = getCell(row, headers, "啟用");
    return active === "" || active === "TRUE" || active === "true" || active === "是";
  });
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const row = rows.find(function (item) {
    const value = getCell(item, headers, "使用者Email").toLowerCase();
    return value === normalizedEmail;
  }) || rows.find(function (item) {
    return getCell(item, headers, "使用者Email") === "*";
  });
  // 權限表已建立時，未列入名單的帳號一律不可借用；只有啟用中的「*」
  // 預設列才代表全部開放。這可避免漏建帳號時意外取得借用權限。
  if (!row) {
    return {
      email: email,
      name: "",
      isAdmin: false,
      unrestricted: false,
      hospitals: [],
      regions: [],
      categories: [],
    };
  }
  return {
    email: email,
    name: getCell(row, headers, "姓名"),
    isAdmin: parseBoolean(getCell(row, headers, "管理者")),
    unrestricted: false,
    hospitals: parseList(getCell(row, headers, "可借醫院")),
    regions: parseList(getCell(row, headers, "可借區域")),
    categories: parseList(getCell(row, headers, "可借儀器類別")),
  };
}

function assertUserCanBook(data) {
  const permission = getUserPermission(getActiveUserEmail());
  if (permission.unrestricted || permission.isAdmin) return;
  const hospital = canonicalizeHospital(data.hospital);
  if (!isAllowedValue(hospital, permission.hospitals)) {
    throw new Error("你的帳號目前沒有借用「" + hospital + "」的權限。");
  }
  const instrumentSheet = getRequiredSheet(INSTRUMENTS_SHEET);
  ensureInstrumentsSheetSchema(instrumentSheet);
  const values = instrumentSheet.getDataRange().getDisplayValues();
  const headers = values[0] || [];
  const rows = values.slice(1);
  const requestedIds = data.instruments.map(function (item) { return item.id; });
  rows.forEach(function (row) {
    const id = getCell(row, headers, "系統識別碼");
    if (requestedIds.indexOf(id) < 0) return;
    const region = getCell(row, headers, "區域劃分");
    const category = getCell(row, headers, "分類");
    if (!isAllowedValue(region, permission.regions)) {
      throw new Error("你的帳號目前沒有借用「" + region + "」區儀器的權限。");
    }
    if (!isAllowedValue(category, permission.categories)) {
      throw new Error("你的帳號目前沒有借用「" + category + "」的權限。");
    }
  });
}

function getMyBookings() {
  const email = getActiveUserEmail();
  const permission = getUserPermission(email);
  const sheet = getRequiredSheet(BOOKINGS_SHEET);
  ensureBookingsSheetSchema(sheet);
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0] || [];
  return values.slice(1)
    .map(function (row, index) {
      return {
        rowNumber: index + 2,
        bookingId: getCell(row, headers, "申請編號"),
        date: normalizeDate(getCell(row, headers, "借用日期")),
        hospital: getCell(row, headers, "借用醫院"),
        borrower: getCell(row, headers, "借用人"),
        userEmail: getCell(row, headers, "使用者Email"),
        instrumentId: getCell(row, headers, "系統識別碼"),
        instrumentName: getCell(row, headers, "儀器名稱"),
        category: getCell(row, headers, "儀器類別"),
        deliveryTime: getCell(row, headers, "送達時間"),
        pickupTime: getCell(row, headers, "取回時間"),
        notes: getCell(row, headers, "備註／手術內容"),
        submittedAt: getCell(row, headers, "申請時間"),
        status: getCell(row, headers, "狀態"),
        cancelRequestedAt: getCell(row, headers, "取消申請時間"),
      };
    })
    .filter(function (item) {
      if (permission.isAdmin) return true;
      return item.userEmail && item.userEmail.toLowerCase() === String(email || "").toLowerCase();
    })
    .filter(function (item) {
      return item.status !== "已取消";
    })
    .sort(function (left, right) {
      return String(left.date).localeCompare(String(right.date)) || String(left.bookingId).localeCompare(String(right.bookingId));
    });
}

function cancelMyBooking(data) {
  const bookingId = sanitizeText(data.bookingId, 40);
  const reason = sanitizeText(data.reason || "使用者申請取消", 200);
  if (!bookingId) throw new Error("缺少取消申請編號。");
  const email = getActiveUserEmail();
  const permission = getUserPermission(email);
  const sheet = getRequiredSheet(BOOKINGS_SHEET);
  ensureBookingsSheetSchema(sheet);
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0] || [];
  const bookingIdIndex = headers.indexOf("申請編號");
  const emailIndex = headers.indexOf("使用者Email");
  const statusColumn = headers.indexOf("狀態") + 1;
  const cancelAtColumn = headers.indexOf("取消申請時間") + 1;
  const cancelReasonColumn = headers.indexOf("取消原因") + 1;
  let updated = 0;
  const promotions = [];
  const scheduleErrors = [];
  values.slice(1).forEach(function (row, index) {
    if (row[bookingIdIndex] !== bookingId) return;
    const rowEmail = emailIndex >= 0 ? String(row[emailIndex] || "").toLowerCase() : "";
    if (!permission.isAdmin && rowEmail !== String(email || "").toLowerCase()) return;
    const rowNumber = index + 2;
    const originalStatus = getCell(row, headers, "狀態");
    let released = false;
    try {
      releaseMonthlyScheduleForBooking(row, headers);
      released = true;
    } catch (error) {
      scheduleErrors.push(error.message);
    }
    sheet.getRange(rowNumber, statusColumn).setValue("已取消");
    if (cancelAtColumn) sheet.getRange(rowNumber, cancelAtColumn).setValue(new Date());
    if (cancelReasonColumn) sheet.getRange(rowNumber, cancelReasonColumn).setValue(reason);
    if (released && originalStatus === "已預約") {
      try {
        const promotion = promoteFirstWaitlist(sheet, row, headers, bookingId);
        if (promotion) promotions.push(promotion);
      } catch (error) {
        scheduleErrors.push("遞補失敗：" + error.message);
      }
    }
    updated += 1;
  });
  if (!updated) throw new Error("找不到可取消的借用資料，或這筆資料不屬於你的帳號。");
  if (scheduleErrors.length) {
    throw new Error("取消紀錄已更新，但月行程表未完全釋出：" + scheduleErrors.join("；"));
  }
  const promotedText = promotions.length
    ? " 已自動遞補 " + promotions.map(function (item) { return item.instrumentName + "（" + item.hospital + "）"; }).join("、") + "。"
    : "";
  return {
    success: true,
    updated: updated,
    promotions: promotions,
    message: "已取消借用並同步更新月行程表。" + promotedText,
  };
}

function promoteFirstWaitlist(sheet, cancelledRow, headers, cancelledBookingId) {
  const date = normalizeDate(getCell(cancelledRow, headers, "借用日期"));
  const instrumentId = getCell(cancelledRow, headers, "系統識別碼");
  const instrumentName = getCell(cancelledRow, headers, "儀器名稱") || getCell(cancelledRow, headers, "儀器編號");
  if (!date || !instrumentId) return null;

  const values = sheet.getDataRange().getDisplayValues();
  const currentHeaders = values[0] || headers;
  const candidates = values.slice(1).map(function (row, index) {
    return { row: row, rowNumber: index + 2 };
  }).filter(function (item) {
    return normalizeDate(getCell(item.row, currentHeaders, "借用日期")) === date &&
      getCell(item.row, currentHeaders, "系統識別碼") === instrumentId &&
      getCell(item.row, currentHeaders, "狀態") === "備取中";
  });
  if (!candidates.length) return null;

  // 借用紀錄以 appendRow 新增，列號最小者就是最早的備取申請。
  const candidate = candidates[0];
  const availability = getAvailability(date);
  const instrument = availability.find(function (item) {
    return item.id === instrumentId || item.name === instrumentName;
  });
  if (!instrument || !instrument.scheduleRow) {
    throw new Error("找不到「" + instrumentName + "」的月行程表位置");
  }

  const hospital = getCell(candidate.row, currentHeaders, "借用醫院");
  const notes = getCell(candidate.row, currentHeaders, "備註／手術內容");
  const schedule = getScheduleContext(date);
  const notesCell = schedule.sheet.getRange(instrument.scheduleRow + 1, schedule.dateColumn + 2);
  removeWaitlistText(notesCell, hospital);
  updateMonthlySchedule({
    date: date,
    hospital: hospital,
    deliveryTime: getCell(candidate.row, currentHeaders, "送達時間"),
    pickupTime: getCell(candidate.row, currentHeaders, "取回時間"),
    notes: notes,
    instrument: instrument,
    status: "已預約",
  });

  const statusColumn = currentHeaders.indexOf("狀態") + 1;
  sheet.getRange(candidate.rowNumber, statusColumn).setValue("已預約");
  setBookingRowExtras(sheet, candidate.rowNumber, {
    "遞補時間": new Date(),
    "遞補自申請編號": cancelledBookingId,
  });
  return {
    bookingId: getCell(candidate.row, currentHeaders, "申請編號"),
    hospital: hospital,
    borrower: getCell(candidate.row, currentHeaders, "借用人"),
    instrumentName: instrumentName,
  };
}

function releaseMonthlyScheduleForBooking(row, headers) {
  const date = normalizeDate(getCell(row, headers, "借用日期"));
  const instrumentId = getCell(row, headers, "系統識別碼");
  const instrumentName = getCell(row, headers, "儀器名稱") || getCell(row, headers, "儀器編號");
  const status = getCell(row, headers, "狀態");
  const hospital = getCell(row, headers, "借用醫院");
  const deliveryTime = getCell(row, headers, "送達時間");
  const pickupTime = getCell(row, headers, "取回時間");
  if (!date || !instrumentName) return;

  const availability = getAvailability(date);
  const instrument = availability.find(function (item) {
    return item.id === instrumentId || item.name === instrumentName;
  });
  if (!instrument || !instrument.scheduleRow) {
    throw new Error("找不到「" + instrumentName + "」在月行程表中的位置");
  }

  const schedule = getScheduleContext(date);
  const baseRow = instrument.scheduleRow;
  const destinationRow = baseRow + 1;
  const deliveryCell = schedule.sheet.getRange(baseRow, schedule.dateColumn + 1);
  const hospitalCell = schedule.sheet.getRange(destinationRow, schedule.dateColumn);
  const pickupCell = schedule.sheet.getRange(destinationRow, schedule.dateColumn + 1);
  const notesCell = schedule.sheet.getRange(destinationRow, schedule.dateColumn + 2);

  if (status === "備取中") {
    removeWaitlistText(notesCell, hospital);
    return;
  }

  // 日期與儀器列已確認相符，直接釋出三個排程欄位。不可依賴時間文字完全一致，
  // 因為試算表的自動格式化可能讓「送達08:00」等文字產生細微差異。
  deliveryCell.clearContent();
  hospitalCell.clearContent();
  pickupCell.clearContent();
  removeBookingNotes(notesCell, getCell(row, headers, "備註／手術內容"));
}

function isCancelledBookingStillOnSchedule(row, headers) {
  const date = normalizeDate(getCell(row, headers, "借用日期"));
  const instrumentId = getCell(row, headers, "系統識別碼");
  const instrumentName = getCell(row, headers, "儀器名稱") || getCell(row, headers, "儀器編號");
  const hospital = getCell(row, headers, "借用醫院");
  if (!date || !instrumentName || !hospital) return false;

  const availability = getAvailability(date);
  const instrument = availability.find(function (item) {
    return item.id === instrumentId || item.name === instrumentName;
  });
  if (!instrument || !instrument.scheduleRow) return false;

  const schedule = getScheduleContext(date);
  const currentHospital = schedule.sheet
    .getRange(instrument.scheduleRow + 1, schedule.dateColumn)
    .getDisplayValue()
    .trim();
  return currentHospital === hospital;
}

function isBookedRecordMissingFromSchedule(row, headers) {
  const date = normalizeDate(getCell(row, headers, "借用日期"));
  const instrumentId = getCell(row, headers, "系統識別碼");
  const instrumentName = getCell(row, headers, "儀器名稱") || getCell(row, headers, "儀器編號");
  if (!date || !instrumentName) return false;
  const availability = getAvailability(date);
  const instrument = availability.find(function (item) {
    return item.id === instrumentId || item.name === instrumentName;
  });
  if (!instrument || !instrument.scheduleRow) return false;
  const schedule = getScheduleContext(date);
  const currentHospital = schedule.sheet
    .getRange(instrument.scheduleRow + 1, schedule.dateColumn)
    .getDisplayValue()
    .trim();
  return !currentHospital;
}

function clearCellIfMatches(cell, expectedText) {
  const current = cell.getDisplayValue().trim();
  const expected = String(expectedText || "").trim();
  if (!current) return;
  if (!expected || current === expected) {
    cell.clearContent();
  }
}

function removeWaitlistText(cell, hospital) {
  const current = cell.getDisplayValue();
  if (!current) return;
  const hospitalText = String(hospital || "").trim();
  const lines = current
    .split(/\n/)
    .filter(function (line) {
      const text = line.trim();
      if (!text) return false;
      return !(hospitalText && /^備取\s*\d+\s*[:：]/.test(text) && text.indexOf(hospitalText) >= 0);
    });
  cell.setValue(lines.join("\n"));
}

function removeBookingNotes(cell, notes) {
  const noteText = String(notes || "").trim();
  const current = cell.getDisplayValue();
  if (!noteText || !current) return;
  if (current.trim() === noteText) {
    cell.clearContent();
    return;
  }
  const lines = current.split(/\n/).filter(function (line) {
    return line.trim() !== noteText;
  });
  cell.setValue(lines.join("\n"));
}

function getCell(row, headers, header) {
  const index = headers.indexOf(header);
  return index >= 0 ? String(row[index] || "").trim() : "";
}

function parseList(value) {
  const text = String(value || "").trim();
  if (!text || text === "*") return ["*"];
  return text.split(/[,，、\n]/).map(function (item) { return item.trim(); }).filter(Boolean);
}

function isAllowedValue(value, allowedValues) {
  return allowedValues.indexOf("*") >= 0 || allowedValues.indexOf(value) >= 0;
}

function parseBoolean(value) {
  const text = String(value || "").trim().toLowerCase();
  return text === "true" || text === "yes" || text === "1" || text === "是";
}

function normalizeHospitalName(value) {
  return sanitizeText(value, 100)
    .normalize("NFKC")
    .replace(/[\s　·・,，.。()（）-]/g, "")
    .toUpperCase();
}

function canonicalizeHospital(value) {
  const normalized = normalizeHospitalName(value);
  for (let index = 0; index < HOSPITALS.length; index += 1) {
    if (normalizeHospitalName(HOSPITALS[index]) === normalized) return HOSPITALS[index];
  }
  return "";
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
