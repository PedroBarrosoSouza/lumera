import {
  DEFAULT_CREAMY_PLAN,
  getResolvedProductMap,
  INITIAL_CATALOG_PRODUCTS,
} from '../data/skincareData';
import type {
  AppSettings,
  CatalogProduct,
  Product,
  RoutineStep,
  SkincarePlan,
} from '../types';
import { addDays } from './dateUtils';
import { getDayPlan } from './schedule';

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function formatIcsDateTime(
  dateStr: string,
  timeStr: string,
  addMinutes = 0,
): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const dt = new Date(y, m - 1, d, hh, mm + addMinutes, 0);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  const hour = String(dt.getHours()).padStart(2, '0');
  const minute = String(dt.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}T${hour}${minute}00`;
}

function buildStepsText(
  steps: RoutineStep[],
  productMap: Record<string, Product>,
): string {
  return steps
    .map((step) => {
      const product = productMap[step.productId];
      if (!product) return `${step.stepNumber}. ${step.productId}`;
      const altProd = step.alternativeProductId
        ? productMap[step.alternativeProductId]
        : undefined;
      const alt = altProd ? ` (ou ${altProd.shortName})` : '';
      const wait = step.waitMinutes
        ? ` [aguardar ${step.waitMinutes} min]`
        : '';
      const area = product.whereToApply ? ` | Onde: ${product.whereToApply}` : '';
      return `${step.stepNumber}. ${product.shortName} (${product.brand})${alt} — ${product.quantity}${wait}${area}`;
    })
    .join('\n');
}

export function generatePlanICS(
  settings: AppSettings,
  plan: SkincarePlan = DEFAULT_CREAMY_PLAN,
  catalog: CatalogProduct[] = INITIAL_CATALOG_PRODUCTS,
): string {
  const productMap = getResolvedProductMap(plan, catalog);
  const totalDays = Math.max(1, plan.totalDays || 84);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lumera//Plano de Skincare//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(plan.name)}`,
  ];

  const dtStamp = formatIcsDateTime(settings.startDate, '08:00');

  for (let i = 0; i < totalDays; i++) {
    const dateStr = addDays(settings.startDate, i);
    const dayPlan = getDayPlan(dateStr, settings, plan, catalog);

    const morningSummary =
      dayPlan.laserStatus !== 'none'
        ? `Skincare Manhã (${dayPlan.nightLabel}) — Dia ${dayPlan.dayNumber}/${totalDays}`
        : `Skincare Manhã — Dia ${dayPlan.dayNumber}/${totalDays}`;

    const morningDesc = [
      `${dayPlan.phaseName} (Semana ${dayPlan.weekNumber})`,
      dayPlan.laserBanner ? `ATENÇÃO: ${dayPlan.laserBanner}` : '',
      'Passos da Manhã:',
      buildStepsText(dayPlan.morningSteps, productMap),
    ]
      .filter(Boolean)
      .join('\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:lumera-day-${dayPlan.dayNumber}-morning-${dateStr}@lumera.app`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${formatIcsDateTime(dateStr, settings.morningTime, 0)}`,
      `DTEND:${formatIcsDateTime(dateStr, settings.morningTime, 15)}`,
      `SUMMARY:${escapeIcsText(morningSummary)}`,
      `DESCRIPTION:${escapeIcsText(morningDesc)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(morningSummary)}`,
      'TRIGGER:-PT0M',
      'END:VALARM',
      'END:VEVENT',
    );

    const nightSummary = `Skincare ${dayPlan.nightLabel} — Dia ${dayPlan.dayNumber}/${totalDays}`;
    const nightDesc = [
      `${dayPlan.phaseName} (Semana ${dayPlan.weekNumber}) • ${dayPlan.nightSubtitle}`,
      dayPlan.laserBanner ? `ATENÇÃO: ${dayPlan.laserBanner}` : '',
      'Passos da Noite:',
      buildStepsText(dayPlan.nightSteps, productMap),
    ]
      .filter(Boolean)
      .join('\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:lumera-day-${dayPlan.dayNumber}-night-${dateStr}@lumera.app`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${formatIcsDateTime(dateStr, settings.nightTime, 0)}`,
      `DTEND:${formatIcsDateTime(dateStr, settings.nightTime, 25)}`,
      `SUMMARY:${escapeIcsText(nightSummary)}`,
      `DESCRIPTION:${escapeIcsText(nightDesc)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(nightSummary)}`,
      'TRIGGER:-PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR', '');
  return lines.join('\r\n');
}

export function downloadICS(
  settings: AppSettings,
  plan: SkincarePlan = DEFAULT_CREAMY_PLAN,
  catalog: CatalogProduct[] = INITIAL_CATALOG_PRODUCTS,
): void {
  const content = generatePlanICS(settings, plan, catalog);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lumera-${plan.id || 'skincare'}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
