// Сохранение броней в localStorage под одним ключом приложения.
// Остальные данные браузера не затрагиваются.

import { HOUSES, MAX_NIGHTS } from './data.js';

export const STORAGE_KEY = 'bereg-booking-demo-v1';

export const emptyState = () => ({ version: 1, nextId: 1, bookings: [] });

function isValidBooking(b) {
  if (!b || typeof b !== 'object') return false;
  const house = HOUSES.find((h) => h.id === b.houseId);
  if (!house || house.busy) return false;
  return (
    typeof b.id === 'string' && b.id !== '' &&
    typeof b.houseName === 'string' &&
    Number.isInteger(b.guests) && b.guests >= 1 && b.guests <= house.capacity &&
    Number.isInteger(b.nights) && b.nights >= 1 && b.nights <= MAX_NIGHTS &&
    b.total === house.pricePerNight * b.nights &&
    typeof b.createdAt === 'string' && !Number.isNaN(Date.parse(b.createdAt))
  );
}

function isValidState(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.bookings)) return false;
  if (!Number.isInteger(data.nextId) || data.nextId < 1) return false;
  const ids = new Set();
  const houses = new Set();
  for (const b of data.bookings) {
    if (!isValidBooking(b) || ids.has(b.id) || houses.has(b.houseId)) return false;
    ids.add(b.id);
    houses.add(b.houseId);
  }
  return true;
}

/** Возвращает { state, error? }. Никогда не бросает исключений. */
export function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return {
      state: emptyState(),
      error: 'Браузер не разрешает читать сохранённые брони. Сайт работает, но брони не сохранятся после обновления.',
    };
  }
  if (raw === null) return { state: emptyState() };

  try {
    const data = JSON.parse(raw);
    if (isValidState(data)) return { state: data };
  } catch {
    /* падаем ниже, в сообщение о повреждении */
  }
  return {
    state: emptyState(),
    error: 'Сохранённые брони повреждены, поэтому список начат заново. Старые данные будут заменены при первой новой брони.',
  };
}

/** true — сохранено, false — браузер не дал записать. */
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
