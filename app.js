const CONFIG = window.APP_CONFIG || {};
const APP_VERSION = "1.2.1-beta";
const APP_VERSION_LABEL = "V1.2.1 Beta";
const RELEASE_NOTES = [
  "修正取消借用後月行程表未同步釋出的問題。",
  "取消時直接釋出同日該儀器的送達、醫院與取回排程。",
  "修正取消流程讀取錯誤的儀器欄位，並可修復舊版未釋出的排程。",
  "取消已預約儀器時，系統會依申請順序自動遞補第一順位備取。",
  "修正手機版公司帳號登入資訊讀取與提示。",
  "修正 iPhone 開啟 Apps Script 時被縮小的手機版面。",
  "移除 Safari 不相容的強制縮放，恢復完整可操作版面。",
  "Facebook、LINE 等內建瀏覽器改為提示使用 Safari 或 Chrome。",
  "新增手動釋出排程後的自動檢查遞補與 LINE 分享通知文字。",
  "自動取消與遞補只處理 App 建立的借用；人工 key-in 排程維持人工檢查。",
  "我的儀器新增 Google 帳戶登入按鈕，登入失敗時可直接切換公司帳號。",
  "登入 API 加入逾時保護，避免帳號讀取失敗時畫面持續卡在讀取中。",
  "我的儀器改為手動 Google 帳戶登入，避免開啟 App 時背景登入卡住。",
  "成功登入一次後會記住此 App 的登入狀態，僅登出或帳戶失效時才重新要求登入。",
  "修正 Apps Script 內嵌頁面阻擋 Google 登入視窗時，登入按鈕沒有反應的問題。",
  "Google 登入改用瀏覽器原生連結；選擇公司帳戶後回到 App 即自動載入。",
  "主畫面改為三個獨立分頁，並新增簡潔固定底部導覽列。",
  "公司帳號登入後顯示使用者名稱、登入信箱與登出帳號按鈕。",
  "修正 Apps Script 公司登入版讀取登入帳號與我的借用失敗問題。",
  "新增「我的儀器」測試頁，可查看自己的借用與備取紀錄。",
  "新增取消借用測試流程：取消後同步釋出月行程表。",
  "新增人員權限表雛形，可限制特定帳號可借醫院、區域與儀器類別。",
];
const RELEASE_STORAGE_KEY = "instrument-helper-last-seen-version";
const GOOGLE_LOGIN_STORAGE_KEY = "instrument-helper-google-login";
const APP_PAGE_IDS = ["booking-form", "status-panel", "my-instruments"];

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
const HOSPITAL_OPTIONS = HOSPITAL_GROUPS.flatMap(([region, hospitals]) =>
  hospitals.map((name) => ({ name, region }))
);

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

const DEMO_INSTRUMENTS = INSTRUMENT_CATALOG.flatMap(([category, code, instruments]) =>
  instruments.map((name) => {
    const id = `${code}-${name}`;
    return {
      id,
      name,
      category,
      code,
      region: INSTRUMENT_REGIONS[id] || "",
    };
  }),
);
const els = {
  form: document.querySelector("#booking-form"),
  date: document.querySelector("#borrow-date"),
  borrower: document.querySelector("#borrower-name"),
  hospital: document.querySelector("#hospital-name"),
  hospitalSuggestions: document.querySelector("#hospital-suggestions"),
  instrumentGroups: document.querySelector("#instrument-groups"),
  availabilityHint: document.querySelector("#availability-hint"),
  deliveryTime: document.querySelector("#delivery-time"),
  pickupTime: document.querySelector("#pickup-time"),
  notes: document.querySelector("#notes"),
  notesCount: document.querySelector("#notes-count"),
  error: document.querySelector("#form-error"),
  submit: document.querySelector(".submit-button"),
  reviewModal: document.querySelector("#review-modal"),
  reviewSummary: document.querySelector("#review-summary"),
  reviewError: document.querySelector("#review-error"),
  closeReview: document.querySelector("#close-review-button"),
  editBooking: document.querySelector("#edit-booking-button"),
  confirmBooking: document.querySelector("#confirm-booking-button"),
  successModal: document.querySelector("#success-modal"),
  successSummary: document.querySelector("#success-summary"),
  newBooking: document.querySelector("#new-booking-button"),
  successTitle: document.querySelector("#success-title"),
  shareText: document.querySelector("#share-text"),
  shareResultButton: document.querySelector("#share-result-button"),
  chooseToday: document.querySelector("#choose-today"),
  todayLabel: document.querySelector("#today-label"),
  statusDatePicker: document.querySelector("#status-date-picker"),
  availableCount: document.querySelector("#available-count"),
  bookedCount: document.querySelector("#booked-count"),
  statusList: document.querySelector("#status-list"),
  profileEmail: document.querySelector("#profile-email"),
  profilePermission: document.querySelector("#profile-permission"),
  googleLoginButton: document.querySelector("#google-login-button"),
  googleLogoutButton: document.querySelector("#google-logout-button"),
  myBookingsList: document.querySelector("#my-bookings-list"),
  refreshMyBookings: document.querySelector("#refresh-my-bookings"),
  footerVersion: document.querySelector(".footer-version"),
  releaseModal: document.querySelector("#release-modal"),
  releaseVersion: document.querySelector("#release-version"),
  releaseNotes: document.querySelector("#release-notes"),
  closeRelease: document.querySelector("#close-release-button"),
  unsupportedBrowserNotice: document.querySelector("#unsupported-browser-notice"),
  retrySupportedBrowser: document.querySelector("#retry-supported-browser"),
};

let currentInstruments = [];
let selectedInstrumentIds = new Set();
let openCategory = "";
let pendingPayload = null;
let hospitalMatches = [];
let hospitalSuggestionIndex = -1;
let currentProfile = null;
let myBookingsCache = [];
let currentShareText = "";

function normalizeHospitalName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\s　·・,，.。()（）-]/g, "")
    .toUpperCase();
}

function canonicalizeHospital(value) {
  const normalized = normalizeHospitalName(value);
  return HOSPITAL_OPTIONS.find((item) => normalizeHospitalName(item.name) === normalized)?.name || "";
}

function getInstrumentLabel(instrument) {
  const region = instrument.region || INSTRUMENT_REGIONS[instrument.id] || "";
  return region ? `${instrument.name}（${region}）` : instrument.name;
}

function isAllowedValue(value, allowedValues = ["*"]) {
  return allowedValues.includes("*") || allowedValues.includes(value);
}

function canUseHospital(name) {
  if (!currentProfile || currentProfile.unrestricted || currentProfile.isAdmin) return true;
  return isAllowedValue(name, currentProfile.hospitals);
}

function canUseInstrument(instrument) {
  if (!currentProfile || currentProfile.unrestricted || currentProfile.isAdmin) return true;
  const region = instrument.region || INSTRUMENT_REGIONS[instrument.id] || "";
  return isAllowedValue(region, currentProfile.regions) && isAllowedValue(instrument.category, currentProfile.categories);
}

function levenshteinDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function rankHospitals(query) {
  const normalizedQuery = normalizeHospitalName(query);
  if (!normalizedQuery) return [];
  return HOSPITAL_OPTIONS
    .filter((item) => canUseHospital(item.name))
    .map((item, originalIndex) => {
      const normalizedName = normalizeHospitalName(item.name);
      let score;
      if (normalizedName === normalizedQuery) score = 0;
      else if (normalizedName.startsWith(normalizedQuery)) score = 1 + (normalizedName.length - normalizedQuery.length) / 100;
      else if (normalizedName.includes(normalizedQuery)) score = 2 + normalizedName.indexOf(normalizedQuery) / 100;
      else score = 3 + levenshteinDistance(normalizedQuery, normalizedName) / Math.max(normalizedQuery.length, normalizedName.length);
      return { ...item, score, originalIndex };
    })
    .sort((left, right) => left.score - right.score || left.originalIndex - right.originalIndex)
    .slice(0, 8);
}

function hideHospitalSuggestions() {
  els.hospitalSuggestions.hidden = true;
  els.hospital.setAttribute("aria-expanded", "false");
  els.hospital.removeAttribute("aria-activedescendant");
  hospitalMatches = [];
  hospitalSuggestionIndex = -1;
}

function renderHospitalSuggestions() {
  hospitalMatches = rankHospitals(els.hospital.value);
  hospitalSuggestionIndex = hospitalMatches.length ? 0 : -1;
  if (!hospitalMatches.length) {
    hideHospitalSuggestions();
    return;
  }
  els.hospitalSuggestions.innerHTML = hospitalMatches
    .map((item, index) => `
      <button
        id="hospital-option-${index}"
        class="hospital-suggestion${index === hospitalSuggestionIndex ? " active" : ""}"
        type="button"
        role="option"
        aria-selected="${index === hospitalSuggestionIndex}"
        data-hospital="${escapeHtml(item.name)}"
      >
        <span>${escapeHtml(item.region)}</span>
        <strong>${escapeHtml(item.name)}</strong>
      </button>
    `)
    .join("");
  els.hospitalSuggestions.hidden = false;
  els.hospital.setAttribute("aria-expanded", "true");
  els.hospital.setAttribute("aria-activedescendant", `hospital-option-${hospitalSuggestionIndex}`);
}

function selectHospital(name) {
  const canonicalName = canonicalizeHospital(name);
  if (!canonicalName) return;
  els.hospital.value = canonicalName;
  hideHospitalSuggestions();
}

function moveHospitalSuggestion(direction) {
  if (!hospitalMatches.length) return;
  hospitalSuggestionIndex = (hospitalSuggestionIndex + direction + hospitalMatches.length) % hospitalMatches.length;
  const options = els.hospitalSuggestions.querySelectorAll(".hospital-suggestion");
  options.forEach((option, index) => {
    const active = index === hospitalSuggestionIndex;
    option.classList.toggle("active", active);
    option.setAttribute("aria-selected", String(active));
  });
  els.hospital.setAttribute("aria-activedescendant", `hospital-option-${hospitalSuggestionIndex}`);
}

function todayInTaipei() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

function populateTimeOptions(select) {
  for (let hour = 0; hour < 24; hour += 1) {
    ["00", "30"].forEach((minute) => {
      const hourText = String(hour).padStart(2, "0");
      const value = `${hourText}:${minute}`;
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }
}

function getApiBaseUrl() {
  const rawUrl = CONFIG.googleAppsScriptUrl || (CONFIG.useCurrentUrlApi ? window.location.href : "");
  if (!rawUrl) return null;
  const url = new URL(rawUrl, window.location.href);
  url.hash = "";
  url.search = "";
  return url;
}

function isDemoMode() {
  return CONFIG.demoMode || !getApiBaseUrl();
}

function canUseGoogleScriptRun() {
  return Boolean(window.google && google.script && google.script.run);
}

function isUnsupportedInAppBrowser() {
  const agent = navigator.userAgent || "";
  return /FBAN|FBAV|FB_IAB|Instagram|Line\//i.test(agent);
}

function enforceSupportedBrowser() {
  if (!isUnsupportedInAppBrowser()) return true;
  if (els.unsupportedBrowserNotice) els.unsupportedBrowserNotice.hidden = false;
  return false;
}

function fixIPhoneWideViewport() {
  const root = document.documentElement;
  // Safari 的 zoom 對 Apps Script 容器會造成內容只停在左半邊，因此不使用強制縮放。
  root.classList.remove("ios-wide-viewport");
  root.style.removeProperty("--ios-wide-viewport-scale");
}

function runServer(functionName, ...args) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      callback(value);
    };
    const timeout = window.setTimeout(() => {
      finish(reject, new Error("登入驗證逾時，請按下方按鈕選擇公司 Google 帳戶後重新開啟。"));
    }, 15000);
    google.script.run
      .withSuccessHandler((result) => finish(resolve, result))
      .withFailureHandler((error) => finish(reject, new Error(error && error.message ? error.message : "Apps Script 執行失敗")))
      [functionName](...args);
  });
}

async function fetchProfile() {
  if (isDemoMode()) {
    return {
      email: CONFIG.userEmail || "demo@silverbell.com.tw",
      isAdmin: true,
      unrestricted: true,
      hospitals: ["*"],
      regions: ["*"],
      categories: ["*"],
    };
  }
  if (canUseGoogleScriptRun()) {
    const result = await runServer("apiGetProfile");
    if (result && result.success && result.profile) return normalizeProfile(result.profile);
    // 相容少數仍使用舊版後端回傳格式的部署。
    if (result && typeof result === "object" && result.email !== undefined) return normalizeProfile(result);
    throw new Error((result && result.message) || "無法取得公司帳號，請以公司 Google 帳號重新開啟。 ");
  }
  const url = getApiBaseUrl();
  url.searchParams.set("action", "profile");
  const response = await fetch(url);
  const result = await response.json();
  if (!response.ok || !result || !result.success || !result.profile) {
    throw new Error((result && result.message) || "無法取得公司帳號，請以公司 Google 帳號重新開啟。");
  }
  return normalizeProfile(result.profile);
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== "object") {
    throw new Error("無法取得公司帳號，請以公司 Google 帳號重新開啟。");
  }
  return {
    email: String(profile.email || ""),
    name: String(profile.name || ""),
    isAdmin: Boolean(profile.isAdmin),
    unrestricted: Boolean(profile.unrestricted),
    hospitals: Array.isArray(profile.hospitals) ? profile.hospitals : [],
    regions: Array.isArray(profile.regions) ? profile.regions : [],
    categories: Array.isArray(profile.categories) ? profile.categories : [],
  };
}

async function fetchMyBookings() {
  if (isDemoMode()) return [];
  if (canUseGoogleScriptRun()) {
    const result = await runServer("apiGetMyBookings");
    if (!result.success) throw new Error(result.message || "無法取得我的借用");
    return result.bookings || [];
  }
  const url = getApiBaseUrl();
  url.searchParams.set("action", "myBookings");
  const response = await fetch(url);
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || "無法取得我的借用");
  return result.bookings || [];
}

async function requestCancelBooking(bookingId) {
  if (canUseGoogleScriptRun()) {
    const result = await runServer("apiCancelBooking", {
      action: "cancel",
      bookingId,
      reason: "使用者於我的儀器頁面申請取消",
    });
    if (!result.success) throw new Error(result.message || "取消申請失敗");
    return result;
  }
  const response = await fetch(getApiBaseUrl(), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "cancel",
      bookingId,
      reason: "使用者於我的儀器頁面申請取消",
    }),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.message || "取消申請失敗");
  return result;
}

function getDemoInstruments() {
  return DEMO_INSTRUMENTS.map((instrument) => ({
    ...instrument,
    available: true,
    waitlistCount: 0,
    borrowedHospital: "",
  }));
}

function renderStatus(instruments, date) {
  const available = instruments.filter((item) => item.available);
  els.availableCount.textContent = available.length;
  els.bookedCount.textContent = instruments.length - available.length;
  if (els.statusDatePicker) els.statusDatePicker.value = date;
  els.statusList.innerHTML = instruments.map((item) => `
    <div class="status-item${item.available ? "" : " unavailable"}">
      <span class="instrument-symbol">${escapeHtml(item.code || "EQ")}</span>
      <span>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${escapeHtml(item.category || "儀器設備")}${item.available || !item.borrowedHospital ? "" : `・${escapeHtml(item.borrowedHospital)}借用`}</small>
      </span>
      <span class="status-pill">${item.scheduleMissing ? "未對應" : item.available ? "可借" : "可備取"}</span>
    </div>
  `).join("");
}

async function fetchAvailability(date) {
  if (isDemoMode()) {
    await new Promise((resolve) => setTimeout(resolve, 220));
    return getDemoInstruments(date);
  }

  if (canUseGoogleScriptRun()) {
    const result = await runServer("apiGetAvailability", date);
    if (!result.success) throw new Error(result.message || "目前無法取得儀器狀態");
    return result.instruments;
  }

  const url = getApiBaseUrl();
  url.searchParams.set("action", "availability");
  url.searchParams.set("date", date);
  const response = await fetch(url);
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || "目前無法取得儀器狀態");
  }
  return result.instruments;
}

function renderInstrumentGroups(instruments) {
  if (!instruments.length) {
    els.instrumentGroups.innerHTML = '<div class="instrument-groups-placeholder">請先選擇借用日期</div>';
    return;
  }

  els.instrumentGroups.innerHTML = "";
  INSTRUMENT_CATALOG.forEach(([category, code]) => {
    const items = instruments.filter((item) => item.category === category);
    const selected = items.filter((item) => selectedInstrumentIds.has(item.id));
    const availableCount = items.filter((item) => item.available).length;
    const wrapper = document.createElement("div");
    wrapper.className = `instrument-category${openCategory === category ? " open" : ""}`;

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "category-trigger";
    trigger.dataset.category = category;
    trigger.setAttribute("aria-expanded", String(openCategory === category));
    trigger.innerHTML = `
      <span class="instrument-symbol">${escapeHtml(code)}</span>
      <span class="category-trigger-copy">
        <strong>${escapeHtml(category)}</strong>
        <small>${selected.length ? `已選 ${selected.length} 台：${escapeHtml(selected.map((item) => `${getInstrumentLabel(item)}${item.available ? "" : "（備取）"}`).join("、"))}` : `${availableCount} 台可借・其餘可備取`}</small>
      </span>
      ${selected.length ? `<b>${selected.length}</b>` : ""}
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
    `;
    trigger.addEventListener("click", (event) => {
      event.stopImmediatePropagation();
      openCategory = openCategory === category ? "" : category;
      renderInstrumentGroups(currentInstruments);
    });
    wrapper.appendChild(trigger);

    if (openCategory === category) {
      const menu = document.createElement("div");
      menu.className = "category-menu";
      menu.setAttribute("role", "listbox");
      menu.setAttribute("aria-multiselectable", "true");

      items.forEach((instrument) => {
        const isSelected = selectedInstrumentIds.has(instrument.id);
        const canSelect = canUseInstrument(instrument);
        const option = document.createElement("button");
        option.type = "button";
        option.className = `multi-instrument-option${isSelected ? " selected" : ""}${instrument.available || instrument.scheduleMissing ? "" : " waitlist-option"}${canSelect ? "" : " unauthorized-option"}`;
        option.dataset.id = instrument.id;
        option.disabled = Boolean(instrument.scheduleMissing || !canSelect);
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(isSelected));
        option.innerHTML = `
          <span class="option-check">${isSelected ? "✓" : ""}</span>
          <span><strong>${escapeHtml(getInstrumentLabel(instrument))}</strong><small>儀器編號</small></span>
          ${!canSelect
            ? '<span class="missing-tag">無權限</span>'
            : instrument.scheduleMissing
            ? '<span class="missing-tag">試算表未對應</span>'
            : instrument.available
            ? '<span class="booking-tag">可借</span>'
            : `<span class="availability-tag">排隊備取，${escapeHtml(instrument.borrowedHospital || "其他醫院")}借用${instrument.waitlistCount ? `・已有 ${instrument.waitlistCount} 組` : ""}</span>`}
        `;
        option.addEventListener("click", (event) => {
          event.stopImmediatePropagation();
          toggleInstrument(instrument.id, instrument.category);
        });
        menu.appendChild(option);
      });
      wrapper.appendChild(menu);
    }
    els.instrumentGroups.appendChild(wrapper);
  });
}

function toggleInstrument(id, category) {
  if (selectedInstrumentIds.has(id)) {
    selectedInstrumentIds.delete(id);
  } else {
    selectedInstrumentIds.add(id);
  }
  openCategory = category;
  renderInstrumentGroups(currentInstruments);
  updateAvailabilityHint();
  clearError();
}

function updateAvailabilityHint() {
  const available = currentInstruments.filter((item) => item.available).length;
  const selected = currentInstruments.filter((item) => selectedInstrumentIds.has(item.id));
  const bookingCount = selected.filter((item) => item.available).length;
  const waitlistCount = selected.length - bookingCount;
  els.availabilityHint.textContent = selected.length
    ? `已選 ${selected.length} 台：${bookingCount} 台直接借用、${waitlistCount} 台排隊備取。`
    : `共有 ${available} 台可直接借用；已借用的儀器仍可點選排隊備取。`;
}

async function handleDateChange() {
  clearError();
  selectedInstrumentIds = new Set();
  openCategory = "";
  els.instrumentGroups.innerHTML = '<div class="instrument-groups-placeholder">正在確認可借狀態…</div>';

  if (!els.date.value) {
    renderInstrumentGroups([]);
    return;
  }

  try {
    currentInstruments = await fetchAvailability(els.date.value);
    renderInstrumentGroups(currentInstruments);
    renderStatus(currentInstruments, els.date.value);
    updateAvailabilityHint();
  } catch (error) {
    currentInstruments = [];
    renderInstrumentGroups([]);
    showError(error.message);
    els.availabilityHint.textContent = "無法讀取儀器狀態，請稍後再試。";
  }
}

function validateForm() {
  if (!els.date.value) return "請選擇借用日期。";
  if (!els.borrower.value.trim()) return "請填寫借用人姓名。";
  if (!els.hospital.value.trim()) return "請填寫借用醫院名稱。";
  const hospital = canonicalizeHospital(els.hospital.value);
  if (!hospital) return "請從建議清單選擇正式醫院名稱。";
  if (!canUseHospital(hospital)) return "你的帳號目前沒有借用這家醫院的權限。";
  if (!selectedInstrumentIds.size) return "請至少選擇一台借用儀器。";
  if (currentInstruments.some((item) => selectedInstrumentIds.has(item.id) && !canUseInstrument(item))) {
    return "你選到未授權的儀器，請重新選擇。";
  }
  if (!els.deliveryTime.value) return "請選擇送達時間。";
  if (!els.pickupTime.value) return "請選擇取回時間。";
  if (!isHalfHourTime(els.deliveryTime.value) || !isHalfHourTime(els.pickupTime.value)) {
    return "時間必須以 30 分鐘為單位，例如 08:30 或 14:00。";
  }
  if (els.pickupTime.value <= els.deliveryTime.value) return "取回時間必須晚於送達時間。";
  return "";
}

function isHalfHourTime(value) {
  return /^(?:[01]\d|2[0-3]):(?:00|30)$/.test(value || "");
}

function buildPayload() {
  return {
    date: els.date.value,
    borrower: els.borrower.value.trim(),
    hospital: canonicalizeHospital(els.hospital.value),
    instruments: currentInstruments
      .filter((item) => selectedInstrumentIds.has(item.id))
      .map((item) => ({
        id: item.id,
        name: item.name,
        displayName: getInstrumentLabel(item),
        category: item.category,
        code: item.code,
        requestType: item.available ? "booking" : "waitlist",
      })),
    deliveryTime: els.deliveryTime.value,
    pickupTime: els.pickupTime.value,
    notes: els.notes.value.trim(),
  };
}

function formatDate(date) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Taipei",
  }).format(new Date(`${date}T12:00:00+08:00`));
}

function handleSubmit(event) {
  event.preventDefault();
  clearError();
  const validationError = validateForm();
  if (validationError) {
    showError(validationError);
    return;
  }
  pendingPayload = buildPayload();
  showReview(pendingPayload);
}

function showReview(payload) {
  const instrumentRows = INSTRUMENT_CATALOG.map(([category]) => {
    const items = payload.instruments.filter((item) => item.category === category);
    const labels = items.map((item) =>
      `${escapeHtml(item.displayName || item.name)}${item.requestType === "waitlist" ? ' <em class="waitlist-label">備取</em>' : ""}`
    );
    return labels.length ? `<li><strong>${escapeHtml(category)}</strong><span>${labels.join("、")}</span></li>` : "";
  }).join("");

  els.reviewSummary.innerHTML = `
    <div><dt>借用日期</dt><dd>${escapeHtml(formatDate(payload.date))}</dd></div>
    <div><dt>借用人</dt><dd>${escapeHtml(payload.borrower)}</dd></div>
    <div><dt>借用醫院</dt><dd>${escapeHtml(payload.hospital)}</dd></div>
    <div><dt>借用時間</dt><dd>${escapeHtml(payload.deliveryTime)} 送達・${escapeHtml(payload.pickupTime)} 取回</dd></div>
    <div class="review-instruments"><dt>借用儀器</dt><dd><ul>${instrumentRows}</ul></dd></div>
    <div><dt>備註資訊</dt><dd>${payload.notes ? escapeHtml(payload.notes) : '<span class="muted-text">無</span>'}</dd></div>
  `;
  els.reviewError.hidden = true;
  els.reviewModal.hidden = false;
  els.confirmBooking.focus();
}

function closeReview() {
  els.reviewModal.hidden = true;
  els.reviewError.hidden = true;
}

async function submitBooking(payload) {
  if (isDemoMode()) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    return { success: true, bookingId: `DEMO-${Date.now()}` };
  }

  if (canUseGoogleScriptRun()) {
    const result = await runServer("apiSubmitBooking", payload);
    if (!result.success) throw new Error(result.message || "送出失敗，請稍後再試");
    return result;
  }

  const response = await fetch(getApiBaseUrl(), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.message || "送出失敗，請稍後再試");
  return result;
}

async function confirmBooking() {
  if (!pendingPayload) return;
  els.confirmBooking.disabled = true;
  els.confirmBooking.textContent = "正在送出…";
  els.reviewError.hidden = true;

  try {
    const result = await submitBooking(pendingPayload);
    els.reviewModal.hidden = true;
    showSuccess(pendingPayload, result);
  } catch (error) {
    els.reviewError.textContent = error.message;
    els.reviewError.hidden = false;
  } finally {
    els.confirmBooking.disabled = false;
    els.confirmBooking.textContent = "確定送出";
  }
}

function formatShareDate(date) {
  const parts = String(date || "").split("-");
  return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : String(date || "");
}

function setShareText(text) {
  currentShareText = text;
  if (els.shareText) els.shareText.value = text;
}

function buildBookingShareText(payload) {
  const booked = payload.instruments.filter((item) => item.requestType === "booking").map((item) => item.name);
  const waitlisted = payload.instruments.filter((item) => item.requestType === "waitlist").map((item) => item.name);
  const lines = [
    "借用申請送出",
    `日期：${formatShareDate(payload.date)}`,
    `醫院：${payload.hospital}`,
    `借用人：${payload.borrower}`,
    `備註/手術內容：${payload.notes || "無"}`,
    `借用：${booked.join("、") || "無"}`,
  ];
  if (waitlisted.length) lines.push(`備取：${waitlisted.join("、")}`);
  lines.push("---App借用並完成自動更新---");
  return lines.join("\n");
}

function buildCancelShareText(group, result) {
  const instruments = group.instruments.map((item) => item.instrumentName).filter(Boolean);
  const promotions = (result.promotions || []).map((item) => item.hospital).filter(Boolean);
  return [
    "---取消借用---",
    `日期：${formatShareDate(group.date)}`,
    `醫院：${group.hospital}`,
    `借用人：${group.borrower}`,
    `取消借用：${instruments.join("、") || "無"}`,
    "",
    `遞補備取：${promotions.join("、") || "無"}`,
    "---App取消/遞補備取並完成自動更新---",
  ].join("\n");
}

async function shareCurrentResult() {
  if (!currentShareText) return;
  try {
    if (navigator.share) {
      await navigator.share({ title: "儀器借用通知", text: currentShareText });
      return;
    }
    copyShareText();
  } catch (error) {
    if (error && error.name === "AbortError") return;
    copyShareText();
  }
}

function copyShareText() {
  const source = els.shareText;
  if (!source || !currentShareText) return;
  source.focus();
  source.select();
  source.setSelectionRange(0, source.value.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (error) {
    copied = false;
  }
  window.alert(copied ? "通知文字已複製，可開啟 LINE 貼上分享。" : "文字已全選，請長按後選擇「複製」，再貼到 LINE。");
}

function showSuccess(payload) {
  const bookingCount = payload.instruments.filter((item) => item.requestType === "booking").length;
  const waitlistCount = payload.instruments.length - bookingCount;
  els.successSummary.innerHTML = `
    <strong>${escapeHtml(payload.hospital)}</strong><br>
    借用人：${escapeHtml(payload.borrower)}<br>
    ${escapeHtml(formatDate(payload.date))}・${escapeHtml(payload.deliveryTime)}－${escapeHtml(payload.pickupTime)}<br>
    ${bookingCount ? `直接借用 ${bookingCount} 台` : ""}${bookingCount && waitlistCount ? "・" : ""}${waitlistCount ? `排隊備取 ${waitlistCount} 台` : ""}
  `;
  if (els.successTitle) els.successTitle.textContent = "借用申請已送出";
  if (els.newBooking) els.newBooking.textContent = "再新增一筆";
  if (els.shareResultButton) els.shareResultButton.textContent = navigator.share ? "分享至 LINE／其他 App" : "複製通知文字";
  setShareText(buildBookingShareText(payload));
  els.successModal.hidden = false;
  els.newBooking.focus();
  loadMyBookings();
}

function resetForm() {
  els.form.reset();
  currentInstruments = [];
  selectedInstrumentIds = new Set();
  openCategory = "";
  pendingPayload = null;
  renderInstrumentGroups([]);
  els.availabilityHint.textContent = "每個類別皆可複選；已借用的儀器仍可點選排隊備取。";
  if (els.statusDatePicker) els.statusDatePicker.value = "";
  els.availableCount.textContent = "—";
  els.bookedCount.textContent = "—";
  els.statusList.innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /></svg>
      <p>從上方選擇日期<br>查看儀器排程</p>
    </div>
  `;
  els.notesCount.textContent = "0";
  els.successModal.hidden = true;
  currentShareText = "";
  els.date.focus();
}

function showError(message) {
  els.error.textContent = message;
  els.error.hidden = false;
  els.error.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearError() {
  els.error.hidden = true;
  els.error.textContent = "";
}

function showReleaseNotesOnce() {
  const versionLabel = APP_VERSION_LABEL;
  const forcePreview = new URLSearchParams(window.location.search).get("previewRelease") === "1";
  els.footerVersion.textContent = versionLabel;
  els.releaseVersion.textContent = versionLabel;
  els.releaseNotes.innerHTML = RELEASE_NOTES.slice(-10)
    .map((note) => `<li>${escapeHtml(note)}</li>`)
    .join("");

  let hasSeenVersion = false;
  try {
    hasSeenVersion = localStorage.getItem(RELEASE_STORAGE_KEY) === APP_VERSION;
    if (!hasSeenVersion) localStorage.setItem(RELEASE_STORAGE_KEY, APP_VERSION);
  } catch (error) {
    hasSeenVersion = false;
  }

  if (!hasSeenVersion || forcePreview) {
    els.releaseModal.hidden = false;
    els.closeRelease.focus();
  }
}

function renderProfile(profile) {
  currentProfile = normalizeProfile(profile);
  if (!els.profileEmail) return;
  if (els.googleLoginButton) els.googleLoginButton.hidden = true;
  if (els.googleLogoutButton) els.googleLogoutButton.hidden = false;
  const displayName = currentProfile.name.trim() || currentProfile.email.split("@")[0] || "使用者";
  els.profileEmail.textContent = `Hi ${displayName}`;
  const loginLabel = currentProfile.email ? `已登入：${currentProfile.email}` : "公司帳號已登入";
  if (currentProfile.isAdmin) {
    els.profilePermission.textContent = `${loginLabel}・管理者權限：可查看全部借用。`;
  } else if (currentProfile.unrestricted || currentProfile.hospitals.includes("*")) {
    els.profilePermission.textContent = `${loginLabel}・測試版目前全部開放。`;
  } else {
    els.profilePermission.textContent = `${loginLabel}・可借醫院 ${currentProfile.hospitals.length} 項・區域：${currentProfile.regions.join("、")}。`;
  }
}

function groupBookings(bookings) {
  const groups = new Map();
  bookings.forEach((booking) => {
    if (!groups.has(booking.bookingId)) {
      groups.set(booking.bookingId, { ...booking, instruments: [] });
    }
    groups.get(booking.bookingId).instruments.push(booking);
  });
  return Array.from(groups.values());
}

function renderMyBookings(bookings) {
  if (!els.myBookingsList) return;
  const groups = groupBookings(bookings);
  if (!groups.length) {
    els.myBookingsList.innerHTML = `
      <div class="empty-state compact">
        <svg viewBox="0 0 24 24"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /></svg>
        <p>目前沒有你的借用紀錄</p>
      </div>
    `;
    return;
  }
  els.myBookingsList.innerHTML = groups.map((group) => {
    const canCancel = !["申請取消", "已取消"].includes(group.status);
    const statusClass = group.status === "備取中" ? "waitlist" : group.status === "申請取消" ? "canceling" : "booked";
    const instruments = group.instruments
      .map((item) => `${escapeHtml(item.instrumentName)}${item.status === "備取中" ? "（備取）" : ""}`)
      .join("、");
    return `
      <article class="my-booking-card">
        <div class="my-booking-head">
          <span class="status-chip ${statusClass}">${escapeHtml(group.status || "未知")}</span>
          <strong>${escapeHtml(formatDate(group.date))}</strong>
        </div>
        <p>${escapeHtml(group.hospital)}・${escapeHtml(group.deliveryTime)} 送達 / ${escapeHtml(group.pickupTime)} 取回</p>
        <small>${instruments}</small>
        <div class="my-booking-actions">
          <span>申請編號：${escapeHtml(group.bookingId)}</span>
          ${canCancel ? `<button class="secondary-button cancel-booking-button" type="button" data-booking-id="${escapeHtml(group.bookingId)}">申請取消</button>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

async function loadProfile() {
  try {
    renderProfile(await fetchProfile());
    localStorage.setItem(GOOGLE_LOGIN_STORAGE_KEY, "1");
    await loadMyBookings();
  } catch (error) {
    localStorage.removeItem(GOOGLE_LOGIN_STORAGE_KEY);
    if (els.profileEmail) els.profileEmail.textContent = "無法讀取登入資訊";
    if (els.profilePermission) els.profilePermission.textContent = error.message;
    if (els.googleLoginButton) {
      els.googleLoginButton.hidden = false;
      els.googleLoginButton.textContent = "使用 Google 帳戶登入";
    }
    if (els.googleLogoutButton) els.googleLogoutButton.hidden = true;
  }
}

function buildGoogleAccountLoginUrl() {
  const appUrl = new URL(CONFIG.googleAppsScriptUrl || window.location.href, window.location.href);
  appUrl.searchParams.set("login", "1");
  appUrl.hash = "my-instruments";
  const chooser = new URL(["https:", "", "accounts.google.com", "AccountChooser"].join("/"));
  chooser.searchParams.set("continue", appUrl.toString());
  chooser.searchParams.set("hl", "zh-TW");
  chooser.searchParams.set("service", "wise");
  return chooser.toString();
}

function configureGoogleAccountLoginLink() {
  if (!els.googleLoginButton) return;
  els.googleLoginButton.href = "#my-instruments";
  els.googleLoginButton.removeAttribute("target");
}

async function handleGoogleAccountLogin(event) {
  event.preventDefault();
  if (!els.googleLoginButton) return;
  els.googleLoginButton.textContent = "正在登入…";
  els.googleLoginButton.setAttribute("aria-disabled", "true");
  await loadProfile();
  els.googleLoginButton.removeAttribute("aria-disabled");
  if (!currentProfile) els.googleLoginButton.textContent = "使用 Google 帳戶登入";
}

function getRequestedAppPage() {
  const pageId = window.location.hash.replace(/^#/, "");
  return APP_PAGE_IDS.includes(pageId) ? pageId : "booking-form";
}

function showAppPage(pageId, updateHistory = false) {
  const activePage = APP_PAGE_IDS.includes(pageId) ? pageId : "booking-form";
  document.documentElement.dataset.activePage = activePage;
  document.querySelectorAll("[data-app-page]").forEach((section) => {
    section.hidden = section.dataset.appPage !== activePage;
  });
  document.querySelectorAll(".page-tabs a").forEach((link) => {
    const isActive = link.getAttribute("href") === `#${activePage}`;
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (updateHistory && window.location.hash !== `#${activePage}`) {
    window.history.pushState({}, "", `#${activePage}`);
  }
  window.scrollTo({ top: 0, behavior: "auto" });
}

function logoutAppAccount() {
  localStorage.removeItem(GOOGLE_LOGIN_STORAGE_KEY);
  currentProfile = null;
  if (els.profileEmail) els.profileEmail.textContent = "尚未登入公司帳戶";
  if (els.profilePermission) els.profilePermission.textContent = "請按下方按鈕選擇公司 Google 帳戶，再讀取你的借用與權限。";
  if (els.googleLoginButton) {
    els.googleLoginButton.hidden = false;
    els.googleLoginButton.textContent = "使用 Google 帳戶登入";
  }
  if (els.googleLogoutButton) els.googleLogoutButton.hidden = true;
  if (els.myBookingsList) {
    els.myBookingsList.innerHTML = '<div class="empty-state compact"><p>登入後即可查看你的借用與備取紀錄</p></div>';
  }
}

async function loadMyBookings() {
  if (!els.myBookingsList) return;
  els.myBookingsList.innerHTML = '<div class="instrument-groups-placeholder">正在讀取我的借用…</div>';
  try {
    myBookingsCache = await fetchMyBookings();
    renderMyBookings(myBookingsCache);
  } catch (error) {
    els.myBookingsList.innerHTML = `<div class="form-message error">${escapeHtml(error.message)}</div>`;
  }
}

async function handleMyBookingsClick(event) {
  const button = event.target.closest(".cancel-booking-button");
  if (!button) return;
  const bookingId = button.dataset.bookingId;
  const group = groupBookings(myBookingsCache).find((item) => item.bookingId === bookingId);
  if (!window.confirm(`確定要取消 ${bookingId} 這筆借用嗎？\n系統會同步更新月行程表，並自動遞補第一順位備取。`)) return;
  button.disabled = true;
  button.textContent = "申請中…";
  try {
    const result = await requestCancelBooking(bookingId);
    await loadMyBookings();
    if (els.date.value) await handleDateChange();
    if (els.successTitle) els.successTitle.textContent = "取消借用完成";
    if (els.newBooking) els.newBooking.textContent = "返回借用申請";
    if (els.shareResultButton) els.shareResultButton.textContent = navigator.share ? "分享至 LINE／其他 App" : "複製通知文字";
    els.successSummary.innerHTML = `<strong>${escapeHtml(group?.hospital || "")}</strong><br>已取消 ${escapeHtml(group?.instruments.map((item) => item.instrumentName).join("、") || "借用")}${result.promotions?.length ? "，並已完成備取遞補。" : "。"}`;
    setShareText(buildCancelShareText(group || { date: "", hospital: "", borrower: "", instruments: [] }, result));
    els.successModal.hidden = false;
  } catch (error) {
    window.alert(error.message);
    button.disabled = false;
    button.textContent = "申請取消";
  }
}

function closeReleaseNotes() {
  els.releaseModal.hidden = true;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.date.min = todayInTaipei();
if (els.statusDatePicker) els.statusDatePicker.min = todayInTaipei();
populateTimeOptions(els.deliveryTime);
populateTimeOptions(els.pickupTime);
els.todayLabel.textContent = new Intl.DateTimeFormat("zh-TW", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "Asia/Taipei",
}).format(new Date());
els.date.addEventListener("change", handleDateChange);
els.statusDatePicker?.addEventListener("change", () => {
  els.date.value = els.statusDatePicker.value;
  handleDateChange();
});
els.hospital.addEventListener("input", renderHospitalSuggestions);
els.hospital.addEventListener("focus", () => {
  if (els.hospital.value.trim()) renderHospitalSuggestions();
});
els.hospital.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (els.hospitalSuggestions.hidden) renderHospitalSuggestions();
    else moveHospitalSuggestion(event.key === "ArrowDown" ? 1 : -1);
  } else if (event.key === "Enter" && !els.hospitalSuggestions.hidden && hospitalSuggestionIndex >= 0) {
    event.preventDefault();
    selectHospital(hospitalMatches[hospitalSuggestionIndex].name);
  } else if (event.key === "Escape") {
    hideHospitalSuggestions();
  }
});
els.hospitalSuggestions.addEventListener("mousedown", (event) => {
  const option = event.target.closest(".hospital-suggestion");
  if (!option) return;
  event.preventDefault();
  selectHospital(option.dataset.hospital);
});
els.chooseToday.addEventListener("click", () => {
  els.date.value = todayInTaipei();
  handleDateChange();
});
els.notes.addEventListener("input", () => {
  els.notesCount.textContent = els.notes.value.length;
});
els.form.addEventListener("submit", handleSubmit);
els.closeReview.addEventListener("click", closeReview);
els.editBooking.addEventListener("click", closeReview);
els.confirmBooking.addEventListener("click", confirmBooking);
els.newBooking.addEventListener("click", resetForm);
els.shareResultButton?.addEventListener("click", shareCurrentResult);
els.shareText?.addEventListener("click", function () {
  if (!els.shareText.value) return;
  els.shareText.select();
  els.shareText.setSelectionRange(0, els.shareText.value.length);
});
els.closeRelease.addEventListener("click", closeReleaseNotes);
els.refreshMyBookings?.addEventListener("click", loadProfile);
els.googleLogoutButton?.addEventListener("click", logoutAppAccount);
els.googleLoginButton?.addEventListener("click", handleGoogleAccountLogin);
document.querySelectorAll(".page-tabs a").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showAppPage(link.getAttribute("href").slice(1), true);
  });
});
window.addEventListener("popstate", () => showAppPage(getRequestedAppPage()));
window.addEventListener("hashchange", () => showAppPage(getRequestedAppPage()));
els.myBookingsList?.addEventListener("click", handleMyBookingsClick);
document.addEventListener("click", (event) => {
  if (!event.target.closest(".hospital-field")) hideHospitalSuggestions();
  if (openCategory && !event.target.closest(".instrument-category")) {
    openCategory = "";
    renderInstrumentGroups(currentInstruments);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.reviewModal.hidden) closeReview();
});
const supportedBrowser = enforceSupportedBrowser();
if (supportedBrowser) {
  showAppPage(getRequestedAppPage());
  configureGoogleAccountLoginLink();
  showReleaseNotesOnce();
  fixIPhoneWideViewport();
  window.visualViewport?.addEventListener("resize", fixIPhoneWideViewport);
  const loginRequested = new URLSearchParams(window.location.search).get("login") === "1";
  const rememberedLogin = localStorage.getItem(GOOGLE_LOGIN_STORAGE_KEY) === "1";
  if (loginRequested || rememberedLogin) {
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    loadProfile();
  }
} else {
  els.retrySupportedBrowser?.addEventListener("click", () => window.location.reload());
}
