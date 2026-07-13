const assert = require("assert");
const fs = require("fs");

const scriptHtml = fs.readFileSync("google-apps-script/Script.html", "utf8");
const indexHtml = fs.readFileSync("google-apps-script/Index.html", "utf8");
const backend = fs.readFileSync("google-apps-script/Code.gs", "utf8");
const styles = fs.readFileSync("google-apps-script/Styles.html", "utf8");
const scriptSource = scriptHtml.replace(/^\s*<script>\s*/, "").replace(/\s*<\/script>\s*$/, "");

assert.doesNotThrow(() => new Function(scriptSource), "Script.html JavaScript must remain syntactically valid");

const expectedDelivery = ["07:30", "08:00", "08:30", "09:00"];
const expectedPickup = ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const validHalfHour = /^(?:[01]\d|2[0-3]):(?:00|30)$/;

[...expectedDelivery, ...expectedPickup].forEach((time) => {
  assert.ok(validHalfHour.test(time), `${time} must satisfy the unchanged 30-minute rule`);
  assert.ok(scriptHtml.includes(`"${time}"`), `${time} must be present in the shortcut configuration`);
});

["07:40", "07:50", "10:20"].forEach((time) => {
  assert.ok(!scriptHtml.includes(`"${time}"`), `${time} must not be added as a shortcut`);
});

assert.ok(indexHtml.includes('name="deliveryTime"'), "delivery still uses the existing form field");
assert.ok(indexHtml.includes('name="pickupTime"'), "pickup still uses the existing form field");
assert.ok(scriptHtml.includes('(?:00|30)'), "frontend keeps the 00/30-minute validation rule");
assert.ok(backend.includes('(?:00|30)'), "backend keeps the 00/30-minute validation rule");
assert.ok(!backend.includes("QUICK_TIME_OPTIONS"), "shortcut UI does not alter backend booking logic");
assert.ok(!styles.includes("var(--primary)"), "selected shortcut styling must not use an undefined color variable");
assert.ok(styles.includes(".quick-time-button.is-selected"), "selected shortcut remains in place and is styled by class");
assert.ok(styles.includes("transform: translateY(-2px)"), "selected shortcut receives the requested subtle lift");
assert.ok(
  (scriptHtml.match(/resetTimeShortcutFields\(\);/g) || []).length >= 3,
  "calendar prefill, successful submission, and form reset must clear shortcut state",
);

console.log("time-shortcuts-v1-4: all tests passed");
