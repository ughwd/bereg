// Единый источник данных: список и схема строятся по этому массиву.
// x, y — положение кнопки на схеме в процентах от ширины и высоты.
// busy — дом занят изначально (отменить такую занятость нельзя, это «чужие» брони).

export const MAX_NIGHTS = 30;

export const HOUSES = [
  { id: 1, name: 'Сосновый', description: 'Бревенчатый дом с печью и верандой среди сосен. Две спальни.', capacity: 4, pricePerNight: 5200, x: 14, y: 14, busy: false },
  { id: 2, name: 'Берёзка', description: 'Небольшой светлый домик для двоих. Тихая сторона посёлка.', capacity: 2, pricePerNight: 3200, x: 38, y: 12, busy: false },
  { id: 3, name: 'Лесная сторожка', description: 'Уютная сторожка с камином на краю леса.', capacity: 3, pricePerNight: 3900, x: 62, y: 14, busy: true },
  { id: 4, name: 'Дом на холме', description: 'Просторный дом с панорамными окнами и видом на озеро. Три спальни.', capacity: 6, pricePerNight: 7800, x: 86, y: 16, busy: false },
  { id: 5, name: 'Рыбацкий', description: 'Простой дом рядом с дорогой к пирсу. Есть мангал и удочки.', capacity: 2, pricePerNight: 2900, x: 22, y: 31, busy: false },
  { id: 6, name: 'Семейный', description: 'Большой дом для компании: четыре спальни, кухня-гостиная, баня.', capacity: 8, pricePerNight: 9800, x: 50, y: 30, busy: true },
  { id: 7, name: 'Озёрный', description: 'Дом у самой воды с террасой и лодочным причалом.', capacity: 5, pricePerNight: 6400, x: 78, y: 32, busy: false },
  { id: 8, name: 'Студия у дороги', description: 'Компактная студия с кухней. Удобно для короткой остановки.', capacity: 2, pricePerNight: 2400, x: 24, y: 78, busy: false },
];
