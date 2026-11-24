import { describe, expect, it } from 'vitest';
import {
  getResolvedProductMap,
  INITIAL_CATALOG_PRODUCTS,
} from '../../data/skincareData';
import {
  createLocalDemoBackend,
  type SimpleStorage,
} from '../../services/backend';
import type { AppSettings } from '../../types';
import { addDays } from '../dateUtils';
import { generatePlanICS } from '../ics';
import { parseAndValidatePlanJson } from '../planImport';
import { getDayPlan } from '../schedule';

function createMemoryStorage(): SimpleStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe('Base Acumulativa Global, Deduplicação e Importação Gemini', () => {
  const sampleGeminiResponse = `Claro! Aqui está o JSON do plano da Sabrina:
\`\`\`json
{
  "name": "Rotina da Sabrina",
  "subtitle": "Protocolo 30 dias",
  "totalDays": 30,
  "products": [
    {
      "id": "limpador-creamy-alias",
      "brand": "CREAMY",
      "name": "Emulsao de Limpeza",
      "whereToApply": "Apenas rosto (sem pescoço)"
    },
    {
      "id": "effaclar-gel",
      "brand": "La Roche-Posay",
      "name": "Effaclar Gel Concentrado",
      "shortName": "Effaclar Gel",
      "bottleLabel": "Frasco verde, 150g",
      "bottleColor": "#10B981",
      "usageOfficial": "Aplicar na pele úmida, massagear e enxaguar.",
      "precautions": "Evitar área dos olhos e mucosas.",
      "quantity": "1 pump",
      "focus": "Controle de oleosidade",
      "whereToApply": "Zona T e nariz",
      "whenToUse": "Noite S",
      "isAcid": true
    }
  ],
  "morningSteps": [
    { "productId": "limpador-creamy-alias", "shortHint": "Lavar" }
  ],
  "nightRoutines": [
    {
      "id": "S",
      "badge": "S",
      "label": "Noite Tratamento",
      "subtitle": "Effaclar",
      "color": "violet",
      "steps": [
        { "productId": "limpador-creamy-alias", "shortHint": "Lavar", "waitMinutes": 10 },
        { "productId": "effaclar-gel", "shortHint": "Zona T" }
      ]
    },
    {
      "id": "H",
      "badge": "H",
      "label": "Noite Descanso",
      "subtitle": "Limpeza simples",
      "color": "teal",
      "steps": [
        { "productId": "limpador-creamy-alias", "shortHint": "Lavar" }
      ]
    }
  ],
  "phases": [
    {
      "phase": 1,
      "name": "Fase Única",
      "weeksLabel": "Dias 1 a 30",
      "startDay": 1,
      "endDay": 30,
      "patternLabel": "Alternando S e H",
      "objective": "Adaptação segura",
      "nightPattern": ["S", "H"]
    }
  ]
}
\`\`\``;

  it('reutiliza produto já existente na base (sem duplicar) e registra apenas produtos inéditos', () => {
    const parsed = parseAndValidatePlanJson(
      sampleGeminiResponse,
      INITIAL_CATALOG_PRODUCTS,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.plan.name).toBe('Rotina da Sabrina');
    expect(parsed.plan.totalDays).toBe(30);

    // O limpador da Creamy deve ter sido reutilizado e remapeado para 'emulsao-limpeza'
    expect(parsed.matchedProducts[0].reusedFromBase).toBe(true);
    expect(parsed.matchedProducts[0].canonicalId).toBe('emulsao-limpeza');

    // Apenas Effaclar Gel deve constar como novo produto para inserir na base global
    expect(parsed.matchedProducts[1].reusedFromBase).toBe(false);
    expect(parsed.newCatalogProducts).toHaveLength(1);
    expect(parsed.newCatalogProducts[0].brand).toBe('La Roche-Posay');

    // Passos devem estar remapeados para os IDs canônicos
    expect(parsed.plan.morningSteps[0].productId).toBe('emulsao-limpeza');
    expect(
      parsed.plan.userProducts['emulsao-limpeza']?.whereToApply,
    ).toBe('Apenas rosto (sem pescoço)');

    // Cronograma e .ics funcionam com catálogo atualizado
    const fullCatalog = [
      ...INITIAL_CATALOG_PRODUCTS,
      {
        ...parsed.newCatalogProducts[0],
        normalizedKey: 'la roche-posay::effaclar gel concentrado',
      },
    ];

    const settings: AppSettings = {
      startDate: '2026-12-01',
      morningTime: '08:00',
      nightTime: '22:00',
      webNotificationsEnabled: false,
      laserSessions: [
        { id: 'l1', date: '2026-12-05', daysBefore: 2, daysAfter: 2 },
      ],
    };

    const day1 = getDayPlan('2026-12-01', settings, parsed.plan, fullCatalog);
    expect(day1.nightBadge).toBe('S');
    expect(day1.nightColor).toBe('violet');
    expect(day1.nightSteps[0].waitMinutes).toBe(10);

    // No dia do laser, Effaclar (isAcid: true) deve ser filtrado automaticamente
    const laserDay = getDayPlan('2026-12-05', settings, parsed.plan, fullCatalog);
    expect(laserDay.laserStatus).toBe('laser-day');
    expect(laserDay.nightSteps.map((s) => s.productId)).toEqual([
      'emulsao-limpeza',
    ]);

    const ics = generatePlanICS(settings, parsed.plan, fullCatalog);
    const events = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(events).toBe(60);
    expect(ics).toContain('Zona T e nariz');
  });

  it('rejeita JSON com productId inexistente ou nightPattern inválido', () => {
    const badProd = parseAndValidatePlanJson(
      JSON.stringify({
        name: 'Teste',
        products: [{ id: 'p1', brand: 'Marca X', name: 'Produto 1' }],
        morningSteps: [{ productId: 'nao-existe' }],
        nightRoutines: [{ id: 'A', steps: [{ productId: 'p1' }] }],
        phases: [{ startDay: 1, endDay: 10, nightPattern: ['A'] }],
      }),
      INITIAL_CATALOG_PRODUCTS,
    );
    expect(badProd.ok).toBe(false);

    const badNight = parseAndValidatePlanJson(
      JSON.stringify({
        name: 'Teste',
        products: [{ id: 'p1', brand: 'Marca X', name: 'Produto 1' }],
        morningSteps: [{ productId: 'p1' }],
        nightRoutines: [{ id: 'A', steps: [{ productId: 'p1' }] }],
        phases: [{ startDay: 1, endDay: 10, nightPattern: ['Z'] }],
      }),
      INITIAL_CATALOG_PRODUCTS,
    );
    expect(badNight.ok).toBe(false);
  });
});

describe('Base Acumulativa no Backend, Áreas Individuais e Permissões Admin', () => {
  it('não duplica produto na base global e mantém áreas individuais por pessoa', async () => {
    const backend = createLocalDemoBackend(createMemoryStorage());

    const pedro = await backend.login('pedro', '123');
    const sabrina = await backend.login('sabrina', '123');

    const initialCatalog = await backend.listCatalog(pedro.token);
    const initialCount = initialCatalog.length;

    // Tenta cadastrar um produto já existente com acento/caixa diferente + 1 novo
    const upsertRes = await backend.upsertCatalogProducts(pedro.token, [
      {
        id: 'gel-mandelico-outro-id',
        brand: 'CREAMY',
        name: 'Gel 7% AHA Acido Mandelico',
        shortName: 'Mandélico',
        bottleLabel: 'Frasco pink',
        bottleColor: '#EC4899',
        usageOfficial: 'Uso noturno.',
        precautions: 'Evitar olhos.',
        quantity: '1 pump',
        defaultFocus: 'Espinhas',
        isAcid: true,
      },
      {
        id: 'bioderma-sensibio',
        brand: 'Bioderma',
        name: 'Sensibio H2O Água Micelar',
        shortName: 'Sensibio H2O',
        bottleLabel: 'Frasco 250ml',
        bottleColor: '#F43F5E',
        usageOfficial: 'Aplicar com algodão suavemente.',
        precautions: 'Uso externo. Não ingerir.',
        quantity: 'Algumas gotas no algodão',
        defaultFocus: 'Limpeza suave',
        isAcid: false,
      },
    ]);

    expect(upsertRes.results[0].reused).toBe(true);
    expect(upsertRes.results[0].canonicalId).toBe('acido-mandelico');
    expect(upsertRes.results[1].reused).toBe(false);
    expect(upsertRes.catalog.length).toBe(initialCount + 1);

    // Sabrina imediatamente enxerga o produto novo na base global
    const sabrinaCatalog = await backend.listCatalog(sabrina.token);
    expect(sabrinaCatalog.some((c) => c.brand === 'Bioderma')).toBe(true);

    // Áreas de aplicação individuais para o mesmo produto ('acido-tranexamico')
    pedro.data.plan.userProducts['acido-tranexamico'] = {
      productId: 'acido-tranexamico',
      whereToApply: 'Rosto, pescoço e barba',
    };
    sabrina.data.plan.userProducts['acido-tranexamico'] = {
      productId: 'acido-tranexamico',
      whereToApply: 'Apenas bochechas e testa',
    };

    await backend.saveUserData(pedro.token, pedro.data);
    await backend.saveUserData(sabrina.token, sabrina.data);

    const pedroRestored = await backend.restoreSession(pedro.token);
    const sabrinaRestored = await backend.restoreSession(sabrina.token);

    const pedroMap = getResolvedProductMap(pedroRestored!.data.plan, sabrinaCatalog);
    const sabrinaMap = getResolvedProductMap(sabrinaRestored!.data.plan, sabrinaCatalog);

    expect(pedroMap['acido-tranexamico'].whereToApply).toBe(
      'Rosto, pescoço e barba',
    );
    expect(sabrinaMap['acido-tranexamico'].whereToApply).toBe(
      'Apenas bochechas e testa',
    );
    // Ambos compartilham marca, modo de uso e precauções da base global
    expect(pedroMap['acido-tranexamico'].brand).toBe('Creamy');
    expect(sabrinaMap['acido-tranexamico'].brand).toBe('Creamy');
    expect(pedroMap['acido-tranexamico'].precautions).toBe(
      sabrinaMap['acido-tranexamico'].precautions,
    );
  });

  it('restringe painel admin ao pedro, permite criar/resetar/excluir usuários e alterar senha', async () => {
    const backend = createLocalDemoBackend(createMemoryStorage());
    const pedro = await backend.login('pedro', '123');
    const sabrina = await backend.login('sabrina', '123');

    await expect(backend.adminListUsers(sabrina.token)).rejects.toThrow();
    await expect(
      backend.adminCreateUser(sabrina.token, {
        username: 'maria',
        displayName: 'Maria',
        password: '123',
        role: 'user',
        starterTemplate: 'simple',
      }),
    ).rejects.toThrow();

    const maria = await backend.adminCreateUser(pedro.token, {
      username: 'maria',
      displayName: 'Maria',
      password: 'abc',
      role: 'user',
      starterTemplate: 'simple',
    });
    expect(maria.username).toBe('maria');

    const mariaLogin = await backend.login('maria', 'abc');
    expect(mariaLogin.data.plan.name).toBe('Rotina Personalizada');
    await backend.changePassword(mariaLogin.token, 'abc', 'nova123');
    await expect(backend.login('maria', 'abc')).rejects.toThrow();
    const mariaNewLogin = await backend.login('maria', 'nova123');
    expect(mariaNewLogin.user.username).toBe('maria');

    await backend.adminResetPassword(pedro.token, sabrina.user.id, '999');
    expect(await backend.restoreSession(sabrina.token)).toBeNull();
    expect((await backend.login('sabrina', '999')).user.username).toBe('sabrina');

    await expect(
      backend.adminDeleteUser(pedro.token, pedro.user.id),
    ).rejects.toThrow();
    await backend.adminDeleteUser(pedro.token, maria.id);
    const remaining = await backend.adminListUsers(pedro.token);
    expect(remaining.map((u) => u.username)).not.toContain('maria');

    expect(addDays('2026-12-01', 1)).toBe('2026-12-02');
  });
});
