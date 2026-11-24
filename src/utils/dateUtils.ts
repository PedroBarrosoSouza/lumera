export function toDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return toDateStr(dt);
}

export function diffDays(fromStr: string, toStr: string): number {
  const [y1, m1, d1] = fromStr.split('-').map(Number);
  const [y2, m2, d2] = toStr.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / 86_400_000);
}

export function getMondayOfWeek(dateStr: string): string {
  const dt = parseDateStr(dateStr);
  const day = dt.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return addDays(dateStr, diffToMonday);
}

export function getTodayStr(): string {
  return toDateStr(new Date());
}

const WEEKDAYS_LONG = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const MONTHS_LONG = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const MONTHS_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

export function formatDatePtBr(
  dateStr: string,
  style: 'long' | 'short' | 'weekday' = 'long',
): string {
  const dt = parseDateStr(dateStr);
  const weekday = dt.getDay();
  const day = dt.getDate();
  const month = dt.getMonth();
  const year = dt.getFullYear();

  if (style === 'weekday') {
    return `${WEEKDAYS_LONG[weekday]}, ${day} de ${MONTHS_LONG[month].toLowerCase()}`;
  }
  if (style === 'short') {
    return `${String(day).padStart(2, '0')} ${MONTHS_SHORT[month]} ${year}`;
  }
  return `${WEEKDAYS_LONG[weekday]}, ${day} de ${MONTHS_LONG[month].toLowerCase()} de ${year}`;
}

export function getWeekdayShort(dateStr: string): string {
  return WEEKDAYS_SHORT[parseDateStr(dateStr).getDay()];
}

export function formatMonthYearPtBr(year: number, monthIndex: number): string {
  return `${MONTHS_LONG[monthIndex]} ${year}`;
}

export function getMonthGrid(year: number, monthIndex: number): (string | null)[] {
  const firstDay = new Date(year, monthIndex, 1);
  const leadingBlanks = firstDay.getDay(); // 0 (Sunday) .. 6 (Saturday)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const grid: (string | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) {
    grid.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    grid.push(toDateStr(new Date(year, monthIndex, day)));
  }
  while (grid.length % 7 !== 0) {
    grid.push(null);
  }
  return grid;
}
