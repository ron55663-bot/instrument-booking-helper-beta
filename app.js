const CONFIG = window.APP_CONFIG || {};
const APP_VERSION = "1.03";
const RELEASE_NOTES = [
  "新增借用人欄位，送出前可再次確認負責同仁。",
  "新增醫院智慧搜尋與正式名稱驗證，避免同一家醫院出現不同名稱。",
  "放大儀器名稱、編號、類別與狀態文字，提升閱讀辨識度。",
  "更新設計者署名。",
];
const RELEASE_STORAGE_KEY = "instrument-helper-last-seen-version";

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

const DEMO_INSTRUMENTS = INSTRUMENT_CATALOG.flatMap(([category, code, instruments]) =>
  instruments.map((name) => ({
    id: `${code}-${name}`,
    name,
    category,
    code,
  })),
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
  chooseToday: document.querySelector("#choose-today"),
  todayLabel: document.querySelector("#today-label"),
  statusDate: document.querySelector("#status-date"),
  availableCount: document.querySelector("#available-count"),
  bookedCount: document.querySelector("#booked-count"),
  statusList: document.querySelector("#status-list"),
  footerVersion: document.querySelector(".footer-version"),
  releaseModal: document.querySelector("#release-modal"),
  releaseVersion: document.querySelector("#release-version"),
  releaseNotes: document.querySelector("#release-notes"),
  closeRelease: document.querySelector("#close-release-button"),
};

let currentInstruments = [];
let selectedInstrumentIds = new Set();
let openCategory = "";
let pendingPayload = null;
let hospitalMatches = [];
let hospitalSuggestionIndex = -1;

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

function isDemoMode() {
  return CONFIG.demoMode || !CONFIG.googleAppsScriptUrl;
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
  els.statusDate.textContent = date.slice(5).replace("-", " / ");
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

  const url = new URL(CONFIG.googleAppsScriptUrl);
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
        <small>${selected.length ? `已選 ${selected.length} 台：${escapeHtml(selected.map((item) => `${item.name}${item.available ? "" : "（備取）"}`).join("、"))}` : `${availableCount} 台可借・其餘可備取`}</small>
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
        const option = document.createElement("button");
        option.type = "button";
        option.className = `multi-instrument-option${isSelected ? " selected" : ""}${instrument.available || instrument.scheduleMissing ? "" : " waitlist-option"}`;
        option.dataset.id = instrument.id;
        option.disabled = Boolean(instrument.scheduleMissing);
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(isSelected));
        option.innerHTML = `
          <span class="option-check">${isSelected ? "✓" : ""}</span>
          <span><strong>${escapeHtml(instrument.name)}</strong><small>儀器編號</small></span>
          ${instrument.scheduleMissing
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
  if (!canonicalizeHospital(els.hospital.value)) return "請從建議清單選擇正式醫院名稱。";
  if (!selectedInstrumentIds.size) return "請至少選擇一台借用儀器。";
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
      .map(({ id, name, category, code, available }) => ({
        id,
        name,
        category,
        code,
        requestType: available ? "booking" : "waitlist",
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
      `${escapeHtml(item.name)}${item.requestType === "waitlist" ? ' <em class="waitlist-label">備取</em>' : ""}`
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

  const response = await fetch(CONFIG.googleAppsScriptUrl, {
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
    await submitBooking(pendingPayload);
    els.reviewModal.hidden = true;
    showSuccess(pendingPayload);
  } catch (error) {
    els.reviewError.textContent = error.message;
    els.reviewError.hidden = false;
  } finally {
    els.confirmBooking.disabled = false;
    els.confirmBooking.textContent = "確定送出";
  }
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
  els.successModal.hidden = false;
  els.newBooking.focus();
}

function resetForm() {
  els.form.reset();
  currentInstruments = [];
  selectedInstrumentIds = new Set();
  openCategory = "";
  pendingPayload = null;
  renderInstrumentGroups([]);
  els.availabilityHint.textContent = "每個類別皆可複選；已借用的儀器仍可點選排隊備取。";
  els.statusDate.textContent = "請選擇日期";
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
  const versionLabel = `V${APP_VERSION}`;
  const forcePreview = new URLSearchParams(window.location.search).get("previewRelease") === "1";
  els.footerVersion.textContent = versionLabel;
  els.releaseVersion.textContent = versionLabel;
  els.releaseNotes.innerHTML = RELEASE_NOTES
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
els.closeRelease.addEventListener("click", closeReleaseNotes);
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
showReleaseNotesOnce();
