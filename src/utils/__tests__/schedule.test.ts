import { describe, expect, it } from 'vitest';
import { DEFAULT_CREAMY_PLAN } from '../../data/skincareData';
import type { AppSettings, DayCompletion } from '../../types';
import { addDays } from '../dateUtils';
import { generatePlanICS } from '../ics';
import { computeProgressStats, getDayPlan, getDayStatus } from '../schedule';

const baseSettings: AppSettings = {
  startDate: '2026-11-23', // Segunda-feira
  morningTime: '07:30',
  nightTime: '21:30',
  webNotificationsEnabled: false,
  laserSessions: [],
};

describe('Cronograma Creamy Skincare (12 Semanas)', () => {
  it('aplica corretamente o padrão semanal da Fase 1 (Dias 1 a 14)', () => {
    const expectedTwoWeeks = [
      'B', 'A', 'B', 'B', 'C', 'B', 'B',
      'B', 'A', 'B', 'B', 'C', 'B', 'B',
    ];
    const actual = Array.from({ length: 14 }, (_, i) => {
      const plan = getDayPlan(
        addDays(baseSettings.startDate, i),
        baseSettings,
        DEFAULT_CREAMY_PLAN,
      );
      expect(plan.phase).toBe(1);
      expect(plan.dayNumber).toBe(i + 1);
      return plan.nightType;
    });
    expect(actual).toEqual(expectedTwoWeeks);
  });

  it('aplica corretamente o ciclo de 4 noites na Fase 2 (Dias 15 a 42)', () => {
    const actual = Array.from({ length: 28 }, (_, i) => {
      const plan = getDayPlan(
        addDays(baseSettings.startDate, 14 + i),
        baseSettings,
        DEFAULT_CREAMY_PLAN,
      );
      expect(plan.phase).toBe(2);
      return plan.nightType;
    });

    for (let i = 0; i < actual.length; i++) {
      expect(actual[i]).toBe(['B', 'A', 'B', 'C'][i % 4]);
    }
  });

  it('evolui para o ciclo de 3 noites na Fase 3 (Dias 43 a 84)', () => {
    const actual = Array.from({ length: 42 }, (_, i) => {
      const plan = getDayPlan(
        addDays(baseSettings.startDate, 42 + i),
        baseSettings,
        DEFAULT_CREAMY_PLAN,
      );
      expect(plan.phase).toBe(3);
      return plan.nightType;
    });

    for (let i = 0; i < actual.length; i++) {
      expect(actual[i]).toBe(['B', 'A', 'C'][i % 3]);
    }
  });

  it('inclui espera de 15 min no Calming Cream nas Noites A e C e opção alternativa na Noite B', () => {
    const dayB = getDayPlan(
      baseSettings.startDate,
      baseSettings,
      DEFAULT_CREAMY_PLAN,
    );
    expect(dayB.nightSteps.map((s) => s.productId)).toEqual([
      'emulsao-limpeza',
      'eye-cream',
      'acido-tranexamico',
      'serum-hidratante',
    ]);
    expect(dayB.nightSteps[3].alternativeProductId).toBe('calming-cream');

    const dayA = getDayPlan(
      addDays(baseSettings.startDate, 1),
      baseSettings,
      DEFAULT_CREAMY_PLAN,
    );
    expect(dayA.nightSteps.map((s) => s.productId)).toEqual([
      'emulsao-limpeza',
      'eye-cream',
      'calming-cream',
      'acido-mandelico',
    ]);
    expect(dayA.nightSteps[2].waitMinutes).toBe(15);

    const dayC = getDayPlan(
      addDays(baseSettings.startDate, 4),
      baseSettings,
      DEFAULT_CREAMY_PLAN,
    );
    expect(dayC.nightSteps.map((s) => s.productId)).toEqual([
      'emulsao-limpeza',
      'eye-cream',
      'calming-cream',
      'acido-glicolico',
    ]);
    expect(dayC.nightSteps[2].waitMinutes).toBe(15);
  });

  it('pausa ácidos e aplica protocolo calmante no Modo Depilação a Laser', () => {
    const laserDate = addDays(baseSettings.startDate, 20);
    const withLaser: AppSettings = {
      ...baseSettings,
      laserSessions: [
        {
          id: 's1',
          date: laserDate,
          daysBefore: 10,
          daysAfter: 7,
        },
      ],
    };

    const outsideBefore = getDayPlan(
      addDays(laserDate, -11),
      withLaser,
      DEFAULT_CREAMY_PLAN,
    );
    expect(outsideBefore.laserStatus).toBe('none');
    expect(outsideBefore.morningSteps.map((s) => s.productId)).toContain(
      'acido-tranexamico',
    );

    const preLaser = getDayPlan(
      addDays(laserDate, -10),
      withLaser,
      DEFAULT_CREAMY_PLAN,
    );
    expect(preLaser.laserStatus).toBe('pre-laser');
    expect(preLaser.pausedAcids).toEqual([
      'acido-tranexamico',
      'acido-mandelico',
      'acido-glicolico',
    ]);
    expect(preLaser.morningSteps.map((s) => s.productId)).toEqual([
      'emulsao-limpeza',
      'eye-cream',
      'serum-hidratante',
      'protetor-solar',
    ]);
    expect(preLaser.nightSteps.map((s) => s.productId)).toEqual([
      'emulsao-limpeza',
      'eye-cream',
      'serum-hidratante',
      'calming-cream',
    ]);

    const laserDay = getDayPlan(laserDate, withLaser, DEFAULT_CREAMY_PLAN);
    expect(laserDay.laserStatus).toBe('laser-day');
    expect(laserDay.morningSteps.map((s) => s.productId)).toEqual([
      'emulsao-limpeza',
      'eye-cream',
      'serum-hidratante',
      'calming-cream',
      'protetor-solar',
    ]);

    const postLaser = getDayPlan(
      addDays(laserDate, 7),
      withLaser,
      DEFAULT_CREAMY_PLAN,
    );
    expect(postLaser.laserStatus).toBe('post-laser');

    const outsideAfter = getDayPlan(
      addDays(laserDate, 8),
      withLaser,
      DEFAULT_CREAMY_PLAN,
    );
    expect(outsideAfter.laserStatus).toBe('none');
  });

  it('classifica dias feitos, parciais e perdidos corretamente', () => {
    const today = addDays(baseSettings.startDate, 3);
    const completions: Record<string, DayCompletion> = {
      [baseSettings.startDate]: {
        morningSteps: [],
        nightSteps: [],
        morningDone: true,
        nightDone: true,
      },
      [addDays(baseSettings.startDate, 1)]: {
        morningSteps: [],
        nightSteps: [],
        morningDone: true,
        nightDone: false,
      },
    };

    expect(
      getDayStatus(
        baseSettings.startDate,
        today,
        baseSettings.startDate,
        completions,
        DEFAULT_CREAMY_PLAN.totalDays,
      ),
    ).toBe('completed');
    expect(
      getDayStatus(
        addDays(baseSettings.startDate, 1),
        today,
        baseSettings.startDate,
        completions,
        DEFAULT_CREAMY_PLAN.totalDays,
      ),
    ).toBe('partial');
    expect(
      getDayStatus(
        addDays(baseSettings.startDate, 2),
        today,
        baseSettings.startDate,
        completions,
        DEFAULT_CREAMY_PLAN.totalDays,
      ),
    ).toBe('missed');
    expect(
      getDayStatus(
        today,
        today,
        baseSettings.startDate,
        completions,
        DEFAULT_CREAMY_PLAN.totalDays,
      ),
    ).toBe('pending');

    const stats = computeProgressStats(
      today,
      baseSettings,
      completions,
      DEFAULT_CREAMY_PLAN,
    );
    expect(stats.completedDays).toBe(1);
    expect(stats.partialDays).toBe(1);
    expect(stats.missedDays).toBe(1);
    expect(stats.currentStreak).toBe(0);
    expect(stats.bestStreak).toBe(2);
  });

  it('gera arquivo .ics válido com 168 eventos (Manhã e Noite dos 84 dias) e alarmes', () => {
    const withLaser: AppSettings = {
      ...baseSettings,
      laserSessions: [
        {
          id: 'l1',
          date: addDays(baseSettings.startDate, 10),
          daysBefore: 7,
          daysAfter: 5,
        },
      ],
    };

    const ics = generatePlanICS(withLaser, DEFAULT_CREAMY_PLAN);
    expect(ics.includes('\r\n')).toBe(true);
    const eventCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    const alarmCount = (ics.match(/BEGIN:VALARM/g) ?? []).length;
    expect(eventCount).toBe(168);
    expect(alarmCount).toBe(168);
    expect(ics).toContain('DTSTART:20261123T073000');
    expect(ics).toContain('DTSTART:20261123T213000');
    expect(ics).toContain('Dia do Laser');
  });
});
