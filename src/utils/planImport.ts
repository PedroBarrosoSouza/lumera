import {
  BOTTLE_COLOR_PRESETS,
  buildProductNormalizedKey,
  findExistingCatalogProduct,
  INITIAL_CATALOG_PRODUCTS,
} from '../data/skincareData';
import type {
  CatalogProduct,
  CatalogProductInput,
  NightColorKey,
  NightRoutineConfig,
  PhaseConfig,
  PlanStep,
  SkincarePlan,
  UserProductConfig,
} from '../types';

const ALLOWED_COLORS: NightColorKey[] = [
  'pink',
  'emerald',
  'sky',
  'violet',
  'amber',
  'rose',
  'teal',
];

export function buildGeminiPrompt(
  catalog: CatalogProduct[] = INITIAL_CATALOG_PRODUCTS,
): string {
  const catalogList = catalog
    .map((p) => `- id: "${p.id}" | marca: "${p.brand}" | nome: "${p.name}"`)
    .join('\n');

  return `Converta o plano de skincare acima (produtos, áreas de aplicação dessa pessoa, turnos e fases) em um JSON VÁLIDO seguindo EXATAMENTE a estrutura abaixo.
Responda APENAS com um bloco JSON (sem comentários nem texto fora do bloco).

Regras importantes:
1. O sistema usa uma BASE ACUMULATIVA DE PRODUTOS. Se o produto já existir na lista abaixo, REUTILIZE o mesmo "id" e "brand" (não invente outro produto duplicado!).
2. Para todo produto novo que ainda não esteja na base, preencha obrigatoriamente: "brand" (marca), "name", "usageOfficial" (modo de uso) e "precautions" (precauções/cuidados).
3. "whereToApply" é INDIVIDUAL desta pessoa (onde ELA deve aplicar aquele produto no plano dela, ex: "Apenas zona T/nariz" ou "Todo o rosto e pescoço").
4. Marque "isAcid": true em ácidos/esfoliantes químicos ou ativos que devam ser pausados durante depilação a laser.
5. Em "nightRoutines", escolha "color" entre: "pink", "emerald", "sky", "violet", "amber", "rose", "teal".
6. Se algum passo exigir tempo de espera (ex: aguardar 15 min antes do ácido), preencha "waitMinutes": 15.
7. Em "phases", cada fase tem "startDay", "endDay" e "nightPattern" listando os IDs de "nightRoutines" na ordem do rodízio.

Produtos já existentes na base do sistema (reutilize o "id" se usar algum deles):
${catalogList}

Modelo JSON esperado:
\`\`\`json
{
  "name": "Plano de Skincare Personalizado",
  "subtitle": "Protocolo completo de 12 semanas",
  "totalDays": 84,
  "products": [
    {
      "id": "emulsao-limpeza",
      "brand": "Creamy",
      "name": "Emulsão de Limpeza",
      "shortName": "Emulsão de Limpeza",
      "bottleLabel": "Frasco rosa claro, 200ml",
      "bottleColor": "#F4A7B9",
      "usageOfficial": "Aplique 1 pump sobre a pele úmida, massageie até formar espuma leve e enxágue.",
      "precautions": "Evite contato direto com os olhos abertos.",
      "quantity": "1 pump",
      "focus": "Limpeza suave sem ressecar",
      "whereToApply": "Rosto e pescoço úmidos",
      "whenToUse": "Manhã e Noite (Diário)",
      "isAcid": false
    }
  ],
  "morningSteps": [
    { "productId": "emulsao-limpeza", "shortHint": "1 pump • lavar e secar" }
  ],
  "nightRoutines": [
    {
      "id": "A",
      "badge": "A",
      "label": "Noite A",
      "subtitle": "Tratamento principal",
      "color": "pink",
      "steps": [
        { "productId": "emulsao-limpeza", "shortHint": "1 pump • lavar e secar", "waitMinutes": 15 }
      ]
    }
  ],
  "phases": [
    {
      "phase": 1,
      "name": "Fase 1: Adaptação",
      "weeksLabel": "Semanas 1 a 12 (Dias 1 a 84)",
      "startDay": 1,
      "endDay": 84,
      "patternLabel": "Ciclo contínuo: Noite A",
      "objective": "Manter constância diária.",
      "nightPattern": ["A"]
    }
  ]
}
\`\`\``;
}

export const GEMINI_PROMPT_TEMPLATE = buildGeminiPrompt(INITIAL_CATALOG_PRODUCTS);

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

export function slugifyId(input: string, fallback: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

export interface ImportedProductPreview {
  requestedId: string;
  canonicalId: string;
  brand: string;
  name: string;
  bottleColor: string;
  whereToApply: string;
  reusedFromBase: boolean;
}

export type PlanParseResult =
  | {
      ok: true;
      plan: SkincarePlan;
      newCatalogProducts: CatalogProductInput[];
      matchedProducts: ImportedProductPreview[];
      warnings: string[];
    }
  | { ok: false; error: string };

function normalizeSteps(
  rawSteps: unknown,
  idMap: Map<string, string>,
  contextLabel: string,
): { steps: PlanStep[]; error?: string } {
  if (!Array.isArray(rawSteps)) {
    return {
      steps: [],
      error: `"${contextLabel}" precisa ser uma lista de passos.`,
    };
  }

  const steps: PlanStep[] = [];
  for (let i = 0; i < rawSteps.length; i++) {
    const item = rawSteps[i] as Record<string, unknown> | null;
    if (!item || typeof item !== 'object') {
      return {
        steps: [],
        error: `Passo ${i + 1} em "${contextLabel}" está inválido.`,
      };
    }
    const rawProdId = String(item.productId ?? '').trim();
    const canonicalId = idMap.get(rawProdId);
    if (!rawProdId || !canonicalId) {
      return {
        steps: [],
        error: `Em "${contextLabel}", o produto "${rawProdId || '(vazio)'}" não existe na lista de "products".`,
      };
    }

    const waitMinutes =
      typeof item.waitMinutes === 'number' && item.waitMinutes > 0
        ? Math.round(item.waitMinutes)
        : undefined;

    const rawAltId =
      typeof item.alternativeProductId === 'string'
        ? item.alternativeProductId.trim()
        : '';
    const canonicalAltId = rawAltId ? idMap.get(rawAltId) : undefined;

    steps.push({
      productId: canonicalId,
      shortHint:
        String(item.shortHint ?? '').trim() || 'Aplicar conforme orientação',
      ...(waitMinutes ? { waitMinutes } : {}),
      ...(canonicalAltId ? { alternativeProductId: canonicalAltId } : {}),
      ...(typeof item.note === 'string' && item.note.trim()
        ? { note: item.note.trim() }
        : {}),
    });
  }

  return { steps };
}

export function parseAndValidatePlanJson(
  rawInput: string,
  existingCatalog: CatalogProduct[] = INITIAL_CATALOG_PRODUCTS,
): PlanParseResult {
  if (!rawInput.trim()) {
    return { ok: false, error: 'Cole o JSON gerado pela IA antes de validar.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(rawInput));
  } catch (err) {
    return {
      ok: false,
      error: `JSON inválido: ${err instanceof Error ? err.message : 'erro de sintaxe'}.`,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      error:
        'O JSON precisa ser um objeto com products, morningSteps, nightRoutines e phases.',
    };
  }

  const obj = parsed as Record<string, unknown>;
  const warnings: string[] = [];

  if (!Array.isArray(obj.products) || obj.products.length === 0) {
    return {
      ok: false,
      error: 'O campo "products" deve conter pelo menos 1 produto.',
    };
  }

  const idMap = new Map<string, string>();
  const userProducts: Record<string, UserProductConfig> = {};
  const newCatalogProducts: CatalogProductInput[] = [];
  const matchedProducts: ImportedProductPreview[] = [];
  const workingCatalog: CatalogProduct[] = [...existingCatalog];
  const seenRequestedIds = new Set<string>();

  for (let i = 0; i < obj.products.length; i++) {
    const raw = obj.products[i] as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') {
      return {
        ok: false,
        error: `Produto na posição ${i + 1} está inválido.`,
      };
    }

    const name = String(raw.name ?? '').trim();
    if (!name) {
      return { ok: false, error: `Produto #${i + 1} está sem "name".` };
    }

    const rawBrand = String(raw.brand ?? '').trim();
    const requestedId =
      String(raw.id ?? '').trim() ||
      slugifyId(rawBrand ? `${rawBrand}-${name}` : name, `produto-${i + 1}`);

    if (seenRequestedIds.has(requestedId)) {
      return {
        ok: false,
        error: `ID de produto duplicado no JSON: "${requestedId}".`,
      };
    }
    seenRequestedIds.add(requestedId);

    const existing = findExistingCatalogProduct(workingCatalog, {
      id: requestedId,
      brand: rawBrand,
      name,
    });

    const whereToApply =
      String(raw.whereToApply ?? '').trim() || 'Rosto e pescoço';
    const personalFocus = String(raw.focus ?? '').trim() || undefined;
    const whenToUse = String(raw.whenToUse ?? '').trim() || undefined;

    if (existing) {
      idMap.set(requestedId, existing.id);
      userProducts[existing.id] = {
        productId: existing.id,
        whereToApply,
        ...(personalFocus ? { personalFocus } : {}),
        ...(whenToUse ? { whenToUse } : {}),
      };
      matchedProducts.push({
        requestedId,
        canonicalId: existing.id,
        brand: existing.brand,
        name: existing.name,
        bottleColor: existing.bottleColor,
        whereToApply,
        reusedFromBase: true,
      });
    } else {
      const brand = rawBrand || 'Sem marca';
      const usageOfficial = String(raw.usageOfficial ?? '').trim();
      const precautions = String(raw.precautions ?? '').trim();

      if (!rawBrand) {
        warnings.push(
          `Produto novo "${name}" veio sem marca ("brand"); definido como "Sem marca".`,
        );
      }
      if (!usageOfficial) {
        warnings.push(
          `Produto novo "${name}" veio sem modo de uso ("usageOfficial").`,
        );
      }
      if (!precautions) {
        warnings.push(
          `Produto novo "${name}" veio sem precauções ("precautions").`,
        );
      }

      const rawColor = String(raw.bottleColor ?? '').trim();
      const bottleColor = /^#[0-9a-fA-F]{6}$/.test(rawColor)
        ? rawColor
        : BOTTLE_COLOR_PRESETS[i % BOTTLE_COLOR_PRESETS.length];

      let uniqueId = requestedId;
      let suffix = 2;
      while (workingCatalog.some((c) => c.id === uniqueId)) {
        uniqueId = `${requestedId}-${suffix++}`;
      }

      const normalizedKey = buildProductNormalizedKey(brand, name);
      const createdCatalogItem: CatalogProduct = {
        id: uniqueId,
        brand,
        name,
        shortName: String(raw.shortName ?? '').trim() || name,
        normalizedKey,
        bottleLabel: String(raw.bottleLabel ?? '').trim() || 'Item da rotina',
        bottleColor,
        usageOfficial:
          usageOfficial || 'Aplicar conforme orientação da rotina.',
        precautions:
          precautions ||
          'Uso externo. Evite contato com olhos e mucosas; em caso de irritação, suspenda o uso.',
        quantity: String(raw.quantity ?? '').trim() || 'Quantidade indicada',
        defaultFocus: personalFocus || 'Cuidado facial diário.',
        isAcid: Boolean(raw.isAcid),
      };

      workingCatalog.push(createdCatalogItem);
      newCatalogProducts.push(createdCatalogItem);
      idMap.set(requestedId, uniqueId);

      userProducts[uniqueId] = {
        productId: uniqueId,
        whereToApply,
        ...(personalFocus ? { personalFocus } : {}),
        ...(whenToUse ? { whenToUse } : {}),
      };

      matchedProducts.push({
        requestedId,
        canonicalId: uniqueId,
        brand: createdCatalogItem.brand,
        name: createdCatalogItem.name,
        bottleColor: createdCatalogItem.bottleColor,
        whereToApply,
        reusedFromBase: false,
      });
    }
  }

  const morningParsed = normalizeSteps(
    obj.morningSteps,
    idMap,
    'morningSteps',
  );
  if (morningParsed.error) {
    return { ok: false, error: morningParsed.error };
  }
  if (morningParsed.steps.length === 0) {
    warnings.push(
      'Rotina da manhã veio vazia; você pode adicionar passos no editor.',
    );
  }

  if (!Array.isArray(obj.nightRoutines) || obj.nightRoutines.length === 0) {
    return {
      ok: false,
      error: 'O campo "nightRoutines" deve conter pelo menos 1 tipo de noite.',
    };
  }

  const nightRoutines: NightRoutineConfig[] = [];
  const nightIds = new Set<string>();

  for (let i = 0; i < obj.nightRoutines.length; i++) {
    const rawNight = obj.nightRoutines[i] as Record<string, unknown> | null;
    if (!rawNight || typeof rawNight !== 'object') {
      return {
        ok: false,
        error: `Tipo de noite na posição ${i + 1} está inválido.`,
      };
    }
    const id =
      String(rawNight.id ?? '').trim() || String.fromCharCode(65 + i);
    if (nightIds.has(id)) {
      return {
        ok: false,
        error: `ID de noite duplicado: "${id}".`,
      };
    }
    nightIds.add(id);

    const rawColor = String(rawNight.color ?? '').trim() as NightColorKey;
    const color = ALLOWED_COLORS.includes(rawColor)
      ? rawColor
      : ALLOWED_COLORS[i % ALLOWED_COLORS.length];

    const nightStepsParsed = normalizeSteps(
      rawNight.steps,
      idMap,
      `nightRoutines[${id}].steps`,
    );
    if (nightStepsParsed.error) {
      return { ok: false, error: nightStepsParsed.error };
    }

    nightRoutines.push({
      id,
      badge: String(rawNight.badge ?? '').trim() || id.slice(0, 2),
      label: String(rawNight.label ?? '').trim() || `Noite ${id}`,
      subtitle:
        String(rawNight.subtitle ?? '').trim() || 'Tratamento noturno',
      color,
      steps: nightStepsParsed.steps,
    });
  }

  if (!Array.isArray(obj.phases) || obj.phases.length === 0) {
    return {
      ok: false,
      error: 'O campo "phases" deve conter pelo menos 1 fase no calendário.',
    };
  }

  const phases: PhaseConfig[] = [];
  let maxEndDay = 0;

  for (let i = 0; i < obj.phases.length; i++) {
    const rawPhase = obj.phases[i] as Record<string, unknown> | null;
    if (!rawPhase || typeof rawPhase !== 'object') {
      return {
        ok: false,
        error: `Fase na posição ${i + 1} está inválida.`,
      };
    }

    const startDay = Number(rawPhase.startDay);
    const endDay = Number(rawPhase.endDay);
    if (
      !Number.isFinite(startDay) ||
      !Number.isFinite(endDay) ||
      startDay < 1 ||
      endDay < startDay
    ) {
      return {
        ok: false,
        error: `Fase #${i + 1} tem intervalo de dias inválido (startDay=${rawPhase.startDay}, endDay=${rawPhase.endDay}).`,
      };
    }

    if (endDay > maxEndDay) maxEndDay = endDay;

    if (
      !Array.isArray(rawPhase.nightPattern) ||
      rawPhase.nightPattern.length === 0
    ) {
      return {
        ok: false,
        error: `Fase #${i + 1} precisa de "nightPattern" com pelo menos 1 tipo de noite.`,
      };
    }

    const nightPattern = rawPhase.nightPattern.map((n) => String(n).trim());
    for (const nid of nightPattern) {
      if (!nightIds.has(nid)) {
        return {
          ok: false,
          error: `Fase #${i + 1} referencia a noite "${nid}", que não existe em "nightRoutines".`,
        };
      }
    }

    phases.push({
      phase:
        typeof rawPhase.phase === 'number' && rawPhase.phase > 0
          ? Math.round(rawPhase.phase)
          : i + 1,
      name: String(rawPhase.name ?? '').trim() || `Fase ${i + 1}`,
      weeksLabel:
        String(rawPhase.weeksLabel ?? '').trim() ||
        `Dias ${Math.round(startDay)} a ${Math.round(endDay)}`,
      startDay: Math.round(startDay),
      endDay: Math.round(endDay),
      patternLabel:
        String(rawPhase.patternLabel ?? '').trim() ||
        `Ciclo: ${nightPattern.join(' → ')}`,
      objective:
        String(rawPhase.objective ?? '').trim() ||
        'Seguir o cronograma progressivo desta fase.',
      nightPattern,
    });
  }

  const rawTotalDays = Number(obj.totalDays);
  const totalDays =
    Number.isFinite(rawTotalDays) && rawTotalDays >= 1
      ? Math.round(rawTotalDays)
      : maxEndDay || 84;

  const planName = String(obj.name ?? '').trim() || 'Meu Plano de Skincare';

  return {
    ok: true,
    warnings,
    newCatalogProducts,
    matchedProducts,
    plan: {
      id: slugifyId(planName, 'plano-ia'),
      name: planName,
      subtitle:
        String(obj.subtitle ?? '').trim() ||
        `Protocolo de ${totalDays} dias importado via IA`,
      totalDays,
      userProducts,
      morningSteps: morningParsed.steps,
      nightRoutines,
      phases: phases.sort((a, b) => a.startDay - b.startDay),
    },
  };
}
