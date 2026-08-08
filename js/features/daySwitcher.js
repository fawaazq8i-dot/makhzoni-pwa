import { storage } from "../storage.js";

const WEEKDAYS_LONG = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

// Shared across every tab that mounts a switcher — same pattern as
// دفتري's monthSwitcher.js, but stepping by day instead of by month.
let currentDateKey;

function ensureInit() {
  if (currentDateKey === undefined) currentDateKey = storage.todayKey();
}

export function getSelectedDate() {
  ensureInit();
  return currentDateKey;
}

function shiftDay(delta) {
  const [y, m, d] = currentDateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  currentDateKey = storage.todayKey(dt);
}

function formatLabel(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const isToday = dateKey === storage.todayKey();
  return `${WEEKDAYS_LONG[dt.getDay()]}، ${d} ${MONTHS[m - 1]}${isToday ? " (اليوم)" : ""}`;
}

export function mountDaySwitcher(el, onChange) {
  ensureInit();

  function render() {
    el.innerHTML = `
      <div class="date-switcher">
        <button class="btn btn-sm btn-outline" data-action="prev">‹ السابق</button>
        <div class="date-switcher-title">${formatLabel(currentDateKey)}</div>
        <button class="btn btn-sm btn-outline" data-action="next">التالي ›</button>
      </div>
    `;
    el.querySelector('[data-action="prev"]').addEventListener("click", () => {
      shiftDay(-1);
      render();
      onChange(currentDateKey);
    });
    el.querySelector('[data-action="next"]').addEventListener("click", () => {
      shiftDay(1);
      render();
      onChange(currentDateKey);
    });
  }

  render();
}
