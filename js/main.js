import { HOUSES, MAX_NIGHTS } from './data.js';
import { STORAGE_KEY, emptyState, loadState, saveState, clearState } from './storage.js';

const $ = (selector) => document.querySelector(selector);
const money = new Intl.NumberFormat('ru-RU');
const rub = (n) => `${money.format(n)} ₽`;
const SUBMIT_LOCK_MS = 800;

const STATUS_TEXT = { free: 'Свободен', selected: 'Выбран ✓', busy: 'Занят ×' };
const STATUS_WORD = { free: 'свободен', selected: 'выбран', busy: 'занят' };
const STATUS_MARK = { free: '', selected: '✓', busy: '×' };

const els = {
  notice: $('#notice'),
  fGuests: $('#filter-guests'),
  fGuestsError: $('#filter-guests-error'),
  fPrice: $('#filter-price'),
  fPriceError: $('#filter-price-error'),
  fReset: $('#filters-reset'),
  resultCount: $('#result-count'),
  pins: $('#pins'),
  list: $('#house-list'),
  emptyHint: $('#empty-hint'),
  cardInfo: $('#card-info'),
  form: $('#booking-form'),
  guests: $('#guests'),
  guestsError: $('#guests-error'),
  nights: $('#nights'),
  nightsError: $('#nights-error'),
  total: $('#total'),
  totalNote: $('#total-note'),
  formError: $('#form-error'),
  confirm: $('#confirm'),
  bookingsTitle: $('#bookings-title'),
  bookingsList: $('#bookings-list'),
  bookingsEmpty: $('#bookings-empty'),
  bookingsCount: $('#bookings-count'),
  resetDemo: $('#reset-demo'),
};

// ---------- Состояние ----------
const initial = loadState();
let state = initial.state;          // { nextId, bookings: [] }
let selectedId = null;              // id выбранного дома или null
let filters = { guests: null, maxPrice: null };
let attempted = false;              // пользователь уже нажимал «Подтвердить»
const touched = { guests: false, nights: false };
let submitLock = false;
const views = new Map();            // id дома -> элементы списка и схемы

// ---------- Помощники ----------
const houseById = (id) => HOUSES.find((h) => h.id === id);
const isOccupied = (h) => h.busy || state.bookings.some((b) => b.houseId === h.id);
const statusOf = (h) => (isOccupied(h) ? 'busy' : h.id === selectedId ? 'selected' : 'free');
const matches = (h, f) =>
  (f.guests === null || h.capacity >= f.guests) &&
  (f.maxPrice === null || h.pricePerNight <= f.maxPrice);

function parseStrictInt(raw) {
  const s = String(raw).trim();
  return /^\d+$/.test(s) ? Number(s) : NaN;
}

function notify(message, kind = 'info') {
  els.notice.textContent = message;
  els.notice.className = `notice notice--${kind}`;
  els.notice.hidden = false;
}

function setError(input, errorEl, message) {
  errorEl.textContent = message || '';
  errorEl.hidden = !message;
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Построение схемы и списка (один раз) ----------
function buildViews() {
  for (const h of HOUSES) {
    const li = document.createElement('li');
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'house-item';
    item.dataset.houseId = h.id;
    const name = document.createElement('span');
    name.className = 'hi-name';
    name.textContent = `${h.id}. ${h.name}`;
    const badge = document.createElement('span');
    badge.className = 'badge';
    const meta = document.createElement('span');
    meta.className = 'hi-meta';
    meta.textContent = `до ${h.capacity} гост., ${rub(h.pricePerNight)} за ночь`;
    item.append(name, badge, meta);
    li.append(item);
    els.list.append(li);

    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'pin';
    pin.dataset.houseId = h.id;
    pin.style.left = `${h.x}%`;
    pin.style.top = `${h.y}%`;
    const num = document.createElement('span');
    num.textContent = h.id;
    const mark = document.createElement('span');
    mark.className = 'pin-mark';
    mark.setAttribute('aria-hidden', 'true');
    pin.append(num, mark);
    els.pins.append(pin);

    views.set(h.id, { li, item, badge, pin, mark });
  }
}

// ---------- Отрисовка ----------
function updateView() {
  let visible = 0;
  for (const h of HOUSES) {
    const v = views.get(h.id);
    const status = statusOf(h);
    const show = matches(h, filters);
    if (show) visible += 1;

    v.li.hidden = !show;
    v.pin.hidden = !show;
    for (const el of [v.item, v.pin]) {
      el.dataset.status = status;
      el.setAttribute('aria-pressed', String(status === 'selected'));
      el.setAttribute('aria-disabled', String(status === 'busy'));
    }
    v.badge.textContent = STATUS_TEXT[status];
    v.mark.textContent = STATUS_MARK[status];
    v.pin.setAttribute(
      'aria-label',
      `${h.name}, до ${h.capacity} гостей, ${rub(h.pricePerNight)} за ночь, ${STATUS_WORD[status]}`
    );
  }
  els.resultCount.textContent = `Показано домов: ${visible} из ${HOUSES.length}`;
  els.emptyHint.hidden = visible !== 0;
}

function renderCard() {
  const h = selectedId ? houseById(selectedId) : null;
  els.cardInfo.replaceChildren();
  if (!h) {
    const p = document.createElement('p');
    p.className = 'placeholder';
    p.textContent = 'Дом не выбран. Нажмите на домик на схеме или выберите его в списке.';
    els.cardInfo.append(p);
    els.guests.removeAttribute('max');
  } else {
    const title = document.createElement('h3');
    title.textContent = h.name;
    const desc = document.createElement('p');
    desc.textContent = h.description;
    const facts = document.createElement('p');
    facts.className = 'facts';
    facts.textContent = `До ${h.capacity} гостей. ${rub(h.pricePerNight)} за ночь.`;
    els.cardInfo.append(title, desc, facts);
    els.guests.max = String(h.capacity);
  }
  refreshForm();
}

function renderBookings() {
  els.bookingsList.replaceChildren();
  for (const b of state.bookings) {
    const li = document.createElement('li');
    li.className = 'booking';

    const head = document.createElement('p');
    head.className = 'b-head';
    head.textContent = `Бронь ${b.id}: ${b.houseName}`;
    const details = document.createElement('p');
    details.textContent = `Гостей: ${b.guests}. Ночей: ${b.nights}. Сумма: ${rub(b.total)}.`;
    const date = document.createElement('p');
    date.className = 'b-date';
    date.textContent = `Оформлена ${new Date(b.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}`;

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn danger';
    cancel.dataset.cancel = b.id;
    cancel.textContent = 'Отменить бронь';
    cancel.setAttribute('aria-label', `Отменить бронь ${b.id}, ${b.houseName}`);

    li.append(head, details, date, cancel);
    els.bookingsList.append(li);
  }
  els.bookingsEmpty.hidden = state.bookings.length > 0;
  els.bookingsCount.textContent = String(state.bookings.length);
}

function render() {
  updateView();
  renderCard();
  renderBookings();
}

// ---------- Фильтры ----------
function readFilterValue(input, errorEl, label) {
  const raw = input.value.trim();
  if (raw === '') {
    setError(input, errorEl, '');
    return null;
  }
  const n = parseStrictInt(raw);
  if (!Number.isInteger(n) || n < 1) {
    setError(input, errorEl, `${label}: введите целое число больше нуля.`);
    return null;
  }
  setError(input, errorEl, '');
  return n;
}

function applyFilters() {
  filters = {
    guests: readFilterValue(els.fGuests, els.fGuestsError, 'Гостей'),
    maxPrice: readFilterValue(els.fPrice, els.fPriceError, 'Цена'),
  };
  const selected = selectedId ? houseById(selectedId) : null;
  if (selected && !matches(selected, filters)) {
    selectedId = null;
    resetFormFields();
    notify(`Дом «${selected.name}» скрыт фильтром, поэтому выбор сброшен.`, 'info');
  }
  render();
}

function resetFilters() {
  els.fGuests.value = '';
  els.fPrice.value = '';
  applyFilters();
  notify('Фильтры сброшены.', 'info');
}

// ---------- Выбор дома ----------
function resetFormFields(house = null) {
  els.guests.value = String(house ? Math.min(filters.guests ?? 2, house.capacity) : 2);
  els.nights.value = '1';
  touched.guests = false;
  touched.nights = false;
  attempted = false;
}

function selectHouse(id) {
  const h = houseById(id);
  if (!h) return;
  if (isOccupied(h)) {
    notify(`Дом «${h.name}» занят. Выберите свободный дом.`, 'warn');
    return;
  }
  if (selectedId === id) {
    selectedId = null;
    resetFormFields();
  } else {
    selectedId = id;
    resetFormFields(h);
  }
  render();
  if (selectedId && window.matchMedia('(max-width: 899px)').matches) {
    $('#card-title').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }
}

// ---------- Форма и сумма ----------
function validate() {
  const errors = {};
  const h = selectedId ? houseById(selectedId) : null;

  if (!h) errors.form = 'Сначала выберите свободный дом на схеме или в списке.';
  else if (isOccupied(h)) errors.form = 'Этот дом уже занят. Выберите другой.';

  const guests = parseStrictInt(els.guests.value);
  const maxGuests = h ? h.capacity : null;
  if (!Number.isInteger(guests) || guests < 1 || (maxGuests !== null && guests > maxGuests)) {
    errors.guests = maxGuests
      ? `Гостей: целое число от 1 до ${maxGuests}.`
      : 'Гостей: целое число, не меньше 1.';
  }

  const nights = parseStrictInt(els.nights.value);
  if (!Number.isInteger(nights) || nights < 1 || nights > MAX_NIGHTS) {
    errors.nights = `Ночей: целое число от 1 до ${MAX_NIGHTS}.`;
  }

  return { errors, house: h, guests, nights };
}

function refreshForm() {
  const { errors, house, nights } = validate();

  setError(els.guests, els.guestsError, touched.guests || attempted ? errors.guests : '');
  setError(els.nights, els.nightsError, touched.nights || attempted ? errors.nights : '');
  els.formError.textContent = attempted && errors.form ? errors.form : '';
  els.formError.hidden = !(attempted && errors.form);

  if (house && !errors.nights) {
    els.total.textContent = rub(house.pricePerNight * nights);
    els.totalNote.textContent = `${nights} × ${rub(house.pricePerNight)}`;
  } else {
    els.total.textContent = '—';
    els.totalNote.textContent = house ? 'Укажите число ночей от 1 до 30.' : 'Выберите дом, чтобы увидеть стоимость.';
  }
}

function onSubmit(event) {
  event.preventDefault();
  if (submitLock) return; // защита от двойного нажатия

  attempted = true;
  touched.guests = true;
  touched.nights = true;
  const { errors, house, guests, nights } = validate();
  refreshForm();

  if (Object.keys(errors).length > 0) {
    if (errors.guests) els.guests.focus();
    else if (errors.nights) els.nights.focus();
    return;
  }

  submitLock = true;
  els.confirm.disabled = true;
  setTimeout(() => {
    submitLock = false;
    els.confirm.disabled = false;
  }, SUBMIT_LOCK_MS);

  const booking = {
    id: `B-${String(state.nextId).padStart(4, '0')}`,
    houseId: house.id,
    houseName: house.name,
    guests,
    nights,
    total: house.pricePerNight * nights,
    createdAt: new Date().toISOString(),
  };
  state.nextId += 1;
  state.bookings.push(booking);
  const saved = saveState(state);

  selectedId = null;
  resetFormFields();
  render();

  let message = `Бронь ${booking.id} оформлена: «${house.name}», гостей ${guests}, ночей ${nights}, сумма ${rub(booking.total)}. Это учебная бронь.`;
  if (!saved) message += ' Браузер не дал её сохранить, после обновления страницы она пропадёт.';
  notify(message, saved ? 'success' : 'warn');
}

// ---------- Мои брони ----------
function cancelBooking(id) {
  const booking = state.bookings.find((b) => b.id === id);
  if (!booking) return;
  state.bookings = state.bookings.filter((b) => b.id !== id);
  const saved = saveState(state);
  render();
  els.bookingsTitle.focus();
  let message = `Бронь ${id} отменена. Дом «${booking.houseName}» снова свободен.`;
  if (!saved) message += ' Браузер не дал сохранить изменение, после обновления бронь может вернуться.';
  notify(message, saved ? 'success' : 'warn');
}

function resetDemo() {
  if (!window.confirm('Удалить все брони этого демо? Действие нельзя отменить.')) return;
  state = emptyState();
  const cleared = clearState();
  selectedId = null;
  resetFormFields();
  render();
  notify(
    cleared ? 'Демо сброшено: все брони удалены.' : 'Брони удалены на странице, но браузер не дал очистить хранилище.',
    cleared ? 'success' : 'warn'
  );
}

// ---------- События ----------
function onHouseClick(event) {
  const target = event.target.closest('[data-house-id]');
  if (target) selectHouse(Number(target.dataset.houseId));
}

els.list.addEventListener('click', onHouseClick);
els.pins.addEventListener('click', onHouseClick);
els.fGuests.addEventListener('input', applyFilters);
els.fPrice.addEventListener('input', applyFilters);
els.fReset.addEventListener('click', resetFilters);
els.guests.addEventListener('input', () => { touched.guests = true; refreshForm(); });
els.nights.addEventListener('input', () => { touched.nights = true; refreshForm(); });
els.form.addEventListener('submit', onSubmit);
els.bookingsList.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-cancel]');
  if (btn) cancelBooking(btn.dataset.cancel);
});
els.resetDemo.addEventListener('click', resetDemo);
$('#filters').addEventListener('submit', (e) => e.preventDefault());

// Если брони изменили в другой вкладке, подтягиваем изменения.
window.addEventListener('storage', (event) => {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  state = loadState().state;
  const selected = selectedId ? houseById(selectedId) : null;
  if (selected && isOccupied(selected)) {
    selectedId = null;
    resetFormFields();
  }
  render();
  notify('Брони обновились в другой вкладке.', 'info');
});

// ---------- Старт ----------
buildViews();
render();
if (initial.error) notify(initial.error, 'warn');
