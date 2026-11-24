import type {
  CatalogProduct,
  NightColorKey,
  Product,
  ProductId,
  SkincarePlan,
  UserProductConfig,
} from '../types';

export interface NightColorStyle {
  accentHex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
  chipActiveClass: string;
}

export const NIGHT_COLOR_STYLES: Record<NightColorKey, NightColorStyle> = {
  pink: {
    accentHex: '#DB2777',
    bgClass: 'bg-pink-50',
    textClass: 'text-pink-700',
    borderClass: 'border-pink-200',
    dotClass: 'bg-pink-500',
    chipActiveClass: 'bg-pink-600 text-white border-pink-600',
  },
  emerald: {
    accentHex: '#15803D',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-200',
    dotClass: 'bg-emerald-500',
    chipActiveClass: 'bg-emerald-600 text-white border-emerald-600',
  },
  sky: {
    accentHex: '#2563EB',
    bgClass: 'bg-sky-50',
    textClass: 'text-sky-700',
    borderClass: 'border-sky-200',
    dotClass: 'bg-sky-500',
    chipActiveClass: 'bg-sky-600 text-white border-sky-600',
  },
  violet: {
    accentHex: '#7C3AED',
    bgClass: 'bg-violet-50',
    textClass: 'text-violet-700',
    borderClass: 'border-violet-200',
    dotClass: 'bg-violet-500',
    chipActiveClass: 'bg-violet-600 text-white border-violet-600',
  },
  amber: {
    accentHex: '#D97706',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-800',
    borderClass: 'border-amber-200',
    dotClass: 'bg-amber-500',
    chipActiveClass: 'bg-amber-600 text-white border-amber-600',
  },
  rose: {
    accentHex: '#E11D48',
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-700',
    borderClass: 'border-rose-200',
    dotClass: 'bg-rose-500',
    chipActiveClass: 'bg-rose-600 text-white border-rose-600',
  },
  teal: {
    accentHex: '#0D9488',
    bgClass: 'bg-teal-50',
    textClass: 'text-teal-700',
    borderClass: 'border-teal-200',
    dotClass: 'bg-teal-500',
    chipActiveClass: 'bg-teal-600 text-white border-teal-600',
  },
};

export const BOTTLE_COLOR_PRESETS = [
  '#F4A7B9',
  '#8B929E',
  '#2E9E60',
  '#38BDF8',
  '#EF4444',
  '#EC4899',
  '#2563EB',
  '#F59E0B',
  '#8B5CF6',
  '#14B8A6',
];

export function normalizeTextToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function buildProductNormalizedKey(brand: string, name: string): string {
  return `${normalizeTextToken(brand)}::${normalizeTextToken(name)}`;
}

export function findExistingCatalogProduct(
  catalog: CatalogProduct[],
  candidate: {
    id?: string;
    brand?: string;
    name?: string;
    normalizedKey?: string;
  },
): CatalogProduct | undefined {
  const reqId = candidate.id?.trim();
  if (reqId) {
    const byId = catalog.find((c) => c.id === reqId);
    if (byId) return byId;
  }

  const normBrand = normalizeTextToken(candidate.brand ?? '');
  const normName = normalizeTextToken(candidate.name ?? '');
  const targetKey =
    candidate.normalizedKey?.trim() ||
    (normBrand && normName ? `${normBrand}::${normName}` : '');

  if (targetKey) {
    const byKey = catalog.find((c) => c.normalizedKey === targetKey);
    if (byKey) return byKey;
  }

  // Fallback when brand was omitted or generic ("sem marca"): match exact normalized name
  if (normName && (!normBrand || normBrand === 'sem marca')) {
    return catalog.find((c) => normalizeTextToken(c.name) === normName);
  }

  return undefined;
}

export const INITIAL_CATALOG_PRODUCTS: CatalogProduct[] = [
  {
    id: 'emulsao-limpeza',
    brand: 'Creamy',
    name: 'Emulsão de Limpeza',
    shortName: 'Emulsão de Limpeza',
    normalizedKey: buildProductNormalizedKey('Creamy', 'Emulsão de Limpeza'),
    bottleLabel: 'Frasco rosa claro, 200ml',
    bottleColor: '#F4A7B9',
    usageOfficial:
      'Aplique 1 pump sobre a pele úmida, massageie até formar espuma leve e enxágue em seguida.',
    precautions:
      'Evite contato direto com os olhos abertos; em caso de ardência, enxágue com água abundante.',
    quantity: '1 pump',
    defaultFocus: 'Limpeza suave sem ressecar ou agredir a pele normal.',
    isAcid: false,
  },
  {
    id: 'eye-cream',
    brand: 'Creamy',
    name: 'Eye Cream',
    shortName: 'Eye Cream',
    normalizedKey: buildProductNormalizedKey('Creamy', 'Eye Cream'),
    bottleLabel: 'Frasco cinza, 15g',
    bottleColor: '#8B929E',
    usageOfficial:
      'Com a pele limpa e seca, aplique uma pequena quantidade com leves batidinhas usando o dedo anelar, sem puxar a pele. Aguarde secar.',
    precautions:
      'Evite a linha dos cílios e o contato direto dentro dos olhos. Não esfregue a pálpebra.',
    quantity: 'Pequena quantidade',
    defaultFocus: 'Clareamento de olheiras, firmeza e hidratação dos olhos.',
    isAcid: false,
  },
  {
    id: 'acido-tranexamico',
    brand: 'Creamy',
    name: 'Solução Clareadora Ácido Tranexâmico',
    shortName: 'Ácido Tranexâmico',
    normalizedKey: buildProductNormalizedKey(
      'Creamy',
      'Solução Clareadora Ácido Tranexâmico',
    ),
    bottleLabel: 'Frasco verde, 90ml',
    bottleColor: '#2E9E60',
    usageOfficial:
      'Com a pele limpa e seca, aplique de 5 a 10 gotas nas mãos e espalhe suavemente. Aguarde absorver completamente antes do próximo passo.',
    precautions:
      'Contém ácido glicólico na fórmula: usar protetor solar pela manhã. Na depilação a laser, pausar 7 a 14 dias antes e 5 a 7 dias depois na área disparada (pode manter no nariz e olhos).',
    quantity: '5 a 10 gotas',
    defaultFocus: 'Clareamento de manchas e uniformização do tom.',
    isAcid: true,
  },
  {
    id: 'serum-hidratante',
    brand: 'Creamy',
    name: 'Sérum Hidratante',
    shortName: 'Sérum Hidratante',
    normalizedKey: buildProductNormalizedKey('Creamy', 'Sérum Hidratante'),
    bottleLabel: 'Bisnaga azul-água, 30ml',
    bottleColor: '#38BDF8',
    usageOfficial:
      'Coloque algumas gotas sobre a pele limpa e espalhe suavemente. Aguarde secar antes de aplicar o protetor solar ou outro creme.',
    precautions: 'Evite contato direto com os olhos. Uso externo.',
    quantity: 'Algumas gotas',
    defaultFocus:
      'Hidratação profunda e leve em camadas, sem pesar ou entupir poros.',
    isAcid: false,
  },
  {
    id: 'calming-cream',
    brand: 'Creamy',
    name: 'Calming Cream',
    shortName: 'Calming Cream',
    normalizedKey: buildProductNormalizedKey('Creamy', 'Calming Cream'),
    bottleLabel: 'Bisnaga vermelha, 40g',
    bottleColor: '#EF4444',
    usageOfficial:
      'Espalhe uma camada fina e uniforme. Quando usado antes dos ácidos noturnos, aguarde cerca de 15 minutos para absorção completa.',
    precautions:
      'Uso externo. Aguardar absorção completa antes de aplicar ácidos sobre ele para evitar ardência.',
    quantity: 'Camada fina e uniforme',
    defaultFocus:
      'Acalma a pele, reforça a barreira e reduz ardência dos ácidos.',
    isAcid: false,
  },
  {
    id: 'acido-mandelico',
    brand: 'Creamy',
    name: 'Gel 7% AHA Ácido Mandélico',
    shortName: 'Ácido Mandélico 7%',
    normalizedKey: buildProductNormalizedKey(
      'Creamy',
      'Gel 7% AHA Ácido Mandélico',
    ),
    bottleLabel: 'Frasco pink, 30g',
    bottleColor: '#EC4899',
    usageOfficial:
      'Uso exclusivo noturno. Com a pele limpa, seca e previamente hidratada com Calming Cream, aplique de 1 a 2 pumps espalhando suavemente.',
    precautions:
      'Uso exclusivo noturno. Evite contorno dos olhos, cantos do nariz e boca. Obrigatório protetor solar de manhã. Suspenda 7 a 14 dias antes e 5 a 7 dias depois do laser na área tratada.',
    quantity: '1 a 2 pumps',
    defaultFocus:
      'Combate espinhas ativas, regula oleosidade e clareia manchas sem irritar.',
    isAcid: true,
  },
  {
    id: 'acido-glicolico',
    brand: 'Creamy',
    name: 'Creme 10% AHA Ácido Glicólico',
    shortName: 'Ácido Glicólico 10%',
    normalizedKey: buildProductNormalizedKey(
      'Creamy',
      'Creme 10% AHA Ácido Glicólico',
    ),
    bottleLabel: 'Frasco azul, 30g',
    bottleColor: '#2563EB',
    usageOfficial:
      'Uso exclusivo noturno. Sobre a pele hidratada (após Calming Cream) e bem seca, aplique pequena quantidade espalhando suavemente.',
    precautions:
      'Uso exclusivo noturno. Evite pálpebras e mucosas. Não aplicar em pele úmida ou sensibilizada. Suspenda 7 a 14 dias antes e 5 a 7 dias depois do laser na área tratada.',
    quantity: 'Pequena quantidade',
    defaultFocus: 'Esfoliação química para cravos e textura irregular.',
    isAcid: true,
  },
  {
    id: 'protetor-solar',
    brand: 'Uso Diário',
    name: 'Protetor Solar Facial',
    shortName: 'Protetor Solar Facial',
    normalizedKey: buildProductNormalizedKey(
      'Uso Diário',
      'Protetor Solar Facial',
    ),
    bottleLabel: 'Item complementar obrigatório',
    bottleColor: '#F59E0B',
    usageOfficial:
      'Aplique quantidade generosa (regra dos dois dedos) como último passo da manhã, mesmo em dias nublados ou ambientes fechados.',
    precautions:
      'Reaplicar ao longo do dia em caso de exposição solar direta, suor intenso ou contato com água.',
    quantity: 'Regra dos dois dedos',
    defaultFocus:
      'Impede que o sol escureça as manchas durante o uso de ácidos.',
    isAcid: false,
  },
  {
    id: 'gel-limpeza',
    brand: 'Uso Diário',
    name: 'Gel de Limpeza Facial',
    shortName: 'Limpeza Facial',
    normalizedKey: buildProductNormalizedKey(
      'Uso Diário',
      'Gel de Limpeza Facial',
    ),
    bottleLabel: 'Limpeza diária',
    bottleColor: '#38BDF8',
    usageOfficial:
      'Aplique pequena quantidade na pele úmida, massageie suavemente e enxágue completamente.',
    precautions:
      'Evite contato direto com os olhos. Não esfregue com força para não agredir a barreira cutânea.',
    quantity: '1 pump ou moeda pequena',
    defaultFocus: 'Remover impurezas e oleosidade sem ressecar a pele.',
    isAcid: false,
  },
  {
    id: 'hidratante-facial',
    brand: 'Uso Diário',
    name: 'Hidratante Facial',
    shortName: 'Hidratante',
    normalizedKey: buildProductNormalizedKey(
      'Uso Diário',
      'Hidratante Facial',
    ),
    bottleLabel: 'Hidratação diária',
    bottleColor: '#2E9E60',
    usageOfficial:
      'Espalhe uma camada uniforme após a limpeza e aguarde absorver antes do protetor solar.',
    precautions: 'Uso externo. Evite área interna dos olhos.',
    quantity: 'Camada fina',
    defaultFocus: 'Manter a barreira cutânea saudável e hidratada.',
    isAcid: false,
  },
];

export const DEFAULT_CREAMY_PLAN: SkincarePlan = {
  id: 'creamy-12-semanas',
  name: 'Plano de Skincare Creamy',
  subtitle: 'Protocolo progressivo de 12 semanas',
  totalDays: 84,
  userProducts: {
    'emulsao-limpeza': {
      productId: 'emulsao-limpeza',
      whereToApply: 'Rosto e pescoço (com a pele úmida)',
      whenToUse: 'Manhã e Noite (Diário)',
    },
    'eye-cream': {
      productId: 'eye-cream',
      whereToApply:
        'Ao redor do contorno dos olhos (região óssea), evitando a linha dos cílios',
      whenToUse: 'Manhã e Noite (Diário)',
    },
    'acido-tranexamico': {
      productId: 'acido-tranexamico',
      whereToApply:
        'Todo o rosto e pescoço (inclui manchas na raiz dos pelos; na depilação a laser, pausar na área do disparo)',
      personalFocus:
        'Clareamento de manchas (rosto, pescoço e raiz dos pelos) e uniformização.',
      whenToUse: 'Manhã e Noite B',
    },
    'serum-hidratante': {
      productId: 'serum-hidratante',
      whereToApply: 'Rosto e pescoço',
      whenToUse: 'Manhã e Noite B',
    },
    'calming-cream': {
      productId: 'calming-cream',
      whereToApply: 'Rosto e pescoço',
      whenToUse: 'Noites A, B, C e Pós-laser',
    },
    'acido-mandelico': {
      productId: 'acido-mandelico',
      whereToApply:
        'Rosto e pescoço — evite contorno dos olhos, cantos do nariz e boca',
      whenToUse: 'Noite A',
    },
    'acido-glicolico': {
      productId: 'acido-glicolico',
      whereToApply:
        'Rosto (atenção à zona T/nariz) e pescoço — evite pálpebras e mucosas',
      personalFocus:
        'Esfoliação química para cravos do nariz e textura irregular.',
      whenToUse: 'Noite C',
    },
    'protetor-solar': {
      productId: 'protetor-solar',
      whereToApply: 'Todo o rosto e pescoço (último passo da manhã)',
      whenToUse: 'Manhã (Diário)',
    },
  },
  morningSteps: [
    {
      productId: 'emulsao-limpeza',
      shortHint: '1 pump • lavar e secar',
    },
    {
      productId: 'eye-cream',
      shortHint: 'Ao redor dos olhos',
    },
    {
      productId: 'acido-tranexamico',
      shortHint: '5 a 10 gotas • rosto e pescoço',
    },
    {
      productId: 'serum-hidratante',
      shortHint: 'Algumas gotas • hidratar',
    },
    {
      productId: 'protetor-solar',
      shortHint: 'Regra dos dois dedos • obrigatório',
    },
  ],
  nightRoutines: [
    {
      id: 'A',
      badge: 'A',
      label: 'Noite A',
      subtitle: 'Espinhas e Manchas • Mandélico 7%',
      color: 'pink',
      steps: [
        {
          productId: 'emulsao-limpeza',
          shortHint: '1 pump • lavar e secar',
        },
        {
          productId: 'eye-cream',
          shortHint: 'Ao redor dos olhos',
        },
        {
          productId: 'calming-cream',
          shortHint: 'Camada fina • aguardar 15 min',
          waitMinutes: 15,
        },
        {
          productId: 'acido-mandelico',
          shortHint: '1 a 2 pumps • após absorção do Calming',
        },
      ],
    },
    {
      id: 'B',
      badge: 'B',
      label: 'Noite B',
      subtitle: 'Descanso e Hidratação • Tranexâmico',
      color: 'emerald',
      steps: [
        {
          productId: 'emulsao-limpeza',
          shortHint: '1 pump • lavar e secar',
        },
        {
          productId: 'eye-cream',
          shortHint: 'Ao redor dos olhos',
        },
        {
          productId: 'acido-tranexamico',
          shortHint: '5 a 10 gotas • rosto e pescoço',
        },
        {
          productId: 'serum-hidratante',
          shortHint: 'Algumas gotas (ou Calming Cream)',
          alternativeProductId: 'calming-cream',
          note: 'Você pode usar Sérum Hidratante ou Calming Cream nesta etapa.',
        },
      ],
    },
    {
      id: 'C',
      badge: 'C',
      label: 'Noite C',
      subtitle: 'Cravos do Nariz e Textura • Glicólico 10%',
      color: 'sky',
      steps: [
        {
          productId: 'emulsao-limpeza',
          shortHint: '1 pump • lavar e secar',
        },
        {
          productId: 'eye-cream',
          shortHint: 'Ao redor dos olhos',
        },
        {
          productId: 'calming-cream',
          shortHint: 'Camada fina • aguardar 15 min',
          waitMinutes: 15,
        },
        {
          productId: 'acido-glicolico',
          shortHint: 'Pequena quantidade • foco zona T/nariz',
        },
      ],
    },
  ],
  phases: [
    {
      phase: 1,
      name: 'Fase 1: Adaptação',
      weeksLabel: 'Semanas 1 e 2 (Dias 1 a 14)',
      startDay: 1,
      endDay: 14,
      patternLabel: 'Seg: B • Ter: A • Qua/Qui: B • Sex: C • Sáb/Dom: B',
      objective:
        'Acostumar a pele aos ácidos sem ardência ou descamação; acalmar espinhas ativas.',
      nightPattern: ['B', 'A', 'B', 'B', 'C', 'B', 'B'],
    },
    {
      phase: 2,
      name: 'Fase 2: Ativação',
      weeksLabel: 'Semanas 3 a 6 (Dias 15 a 42)',
      startDay: 15,
      endDay: 42,
      patternLabel: 'Ciclo de 4 noites: Noite B → Noite A → Noite B → Noite C',
      objective:
        'Clareamento visível das manchas recentes e redução na formação de novos cravos e espinhas.',
      nightPattern: ['B', 'A', 'B', 'C'],
    },
    {
      phase: 3,
      name: 'Fase 3: Consolidação',
      weeksLabel: 'Semanas 7 a 12 (Dias 43 a 84)',
      startDay: 43,
      endDay: 84,
      patternLabel: 'Ciclo evoluído de 3 noites: Noite B → Noite A → Noite C',
      objective:
        'Limpeza profunda dos cravos do nariz, textura lisa e uniformização completa do tom.',
      nightPattern: ['B', 'A', 'C'],
    },
  ],
  laserProtocol: {
    enabled: true,
    preLaserMorningSteps: [
      {
        productId: 'emulsao-limpeza',
        shortHint: '1 pump • lavar e secar',
      },
      {
        productId: 'eye-cream',
        shortHint: 'Ao redor dos olhos',
      },
      {
        productId: 'serum-hidratante',
        shortHint: 'Algumas gotas (ácido pausado na área do laser)',
      },
      {
        productId: 'protetor-solar',
        shortHint: 'Regra dos dois dedos • obrigatório',
      },
    ],
    preLaserNightSteps: [
      {
        productId: 'emulsao-limpeza',
        shortHint: '1 pump • lavar e secar',
      },
      {
        productId: 'eye-cream',
        shortHint: 'Ao redor dos olhos',
      },
      {
        productId: 'serum-hidratante',
        shortHint: 'Algumas gotas • sem ácidos na área do laser',
      },
      {
        productId: 'calming-cream',
        shortHint: 'Camada fina • protege a barreira',
      },
    ],
    postLaserMorningSteps: [
      {
        productId: 'emulsao-limpeza',
        shortHint: '1 pump • lavar e secar',
      },
      {
        productId: 'eye-cream',
        shortHint: 'Ao redor dos olhos',
      },
      {
        productId: 'serum-hidratante',
        shortHint: 'Algumas gotas • hidratação suave',
      },
      {
        productId: 'calming-cream',
        shortHint: 'Acalma calor e vermelhidão pós-laser',
      },
      {
        productId: 'protetor-solar',
        shortHint: 'Regra dos dois dedos • obrigatório',
      },
    ],
    postLaserNightSteps: [
      {
        productId: 'emulsao-limpeza',
        shortHint: '1 pump • lavar e secar',
      },
      {
        productId: 'eye-cream',
        shortHint: 'Ao redor dos olhos',
      },
      {
        productId: 'serum-hidratante',
        shortHint: 'Algumas gotas • hidratação leve',
      },
      {
        productId: 'calming-cream',
        shortHint: 'Acalma o calor e a vermelhidão',
      },
    ],
  },
};

export const STARTER_SIMPLE_PLAN: SkincarePlan = {
  id: 'rotina-basica',
  name: 'Rotina Personalizada',
  subtitle: 'Modelo básico editável • adicione produtos da base ou importe do Gemini',
  totalDays: 84,
  userProducts: {
    'gel-limpeza': {
      productId: 'gel-limpeza',
      whereToApply: 'Rosto e pescoço úmidos',
      whenToUse: 'Manhã e Noite',
    },
    'hidratante-facial': {
      productId: 'hidratante-facial',
      whereToApply: 'Rosto e pescoço',
      whenToUse: 'Manhã e Noite',
    },
    'protetor-solar': {
      productId: 'protetor-solar',
      whereToApply: 'Todo o rosto, orelhas e pescoço',
      whenToUse: 'Manhã (Diário)',
    },
  },
  morningSteps: [
    { productId: 'gel-limpeza', shortHint: 'Lavar e secar suavemente' },
    { productId: 'hidratante-facial', shortHint: 'Camada leve no rosto e pescoço' },
    { productId: 'protetor-solar', shortHint: 'Regra dos dois dedos • obrigatório' },
  ],
  nightRoutines: [
    {
      id: 'N',
      badge: 'N',
      label: 'Noite Padrão',
      subtitle: 'Limpeza e Hidratação Noturna',
      color: 'emerald',
      steps: [
        { productId: 'gel-limpeza', shortHint: 'Lavar e secar suavemente' },
        {
          productId: 'hidratante-facial',
          shortHint: 'Camada uniforme antes de dormir',
        },
      ],
    },
  ],
  phases: [
    {
      phase: 1,
      name: 'Fase 1: Rotina Contínua',
      weeksLabel: 'Semanas 1 a 12 (Dias 1 a 84)',
      startDay: 1,
      endDay: 84,
      patternLabel: 'Rotina noturna diária contínua',
      objective:
        'Manter constância diária com limpeza, hidratação e proteção solar.',
      nightPattern: ['N'],
    },
  ],
};

function collectReferencedProductIds(plan: SkincarePlan): ProductId[] {
  const seen = new Set<ProductId>();
  const ordered: ProductId[] = [];

  const add = (id?: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ordered.push(id);
  };

  if (plan.userProducts) {
    Object.keys(plan.userProducts).forEach(add);
  }
  plan.morningSteps?.forEach((s) => {
    add(s.productId);
    add(s.alternativeProductId);
  });
  plan.nightRoutines?.forEach((n) =>
    n.steps?.forEach((s) => {
      add(s.productId);
      add(s.alternativeProductId);
    }),
  );
  plan.products?.forEach((p) => add(p.id));

  return ordered;
}

export function resolvePlanProducts(
  plan: SkincarePlan,
  catalog: CatalogProduct[] = INITIAL_CATALOG_PRODUCTS,
): Product[] {
  const catalogById = new Map(catalog.map((c) => [c.id, c]));
  const legacyById = new Map((plan.products ?? []).map((p) => [p.id, p]));
  const ids = collectReferencedProductIds(plan);
  const resolved: Product[] = [];

  for (const id of ids) {
    const cat = catalogById.get(id);
    const leg = legacyById.get(id);
    const userCfg: UserProductConfig | undefined = plan.userProducts?.[id];

    if (cat) {
      resolved.push({
        id: cat.id,
        brand: cat.brand,
        name: cat.name,
        shortName: cat.shortName,
        normalizedKey: cat.normalizedKey,
        bottleLabel: cat.bottleLabel,
        bottleColor: cat.bottleColor,
        usageOfficial: cat.usageOfficial,
        precautions: cat.precautions,
        quantity: cat.quantity,
        isAcid: cat.isAcid,
        whereToApply:
          userCfg?.whereToApply?.trim() ||
          leg?.whereToApply?.trim() ||
          'Rosto e pescoço (defina a área no seu plano)',
        focus:
          userCfg?.personalFocus?.trim() ||
          leg?.focus?.trim() ||
          cat.defaultFocus,
        whenToUse:
          userCfg?.whenToUse?.trim() ||
          leg?.whenToUse?.trim() ||
          'Conforme seu cronograma',
        ...(cat.isAcid
          ? {
              laserNote:
                leg?.laserNote ||
                'Produto ácido/esfoliante: pausar na área do laser 7 a 14 dias antes e 5 a 7 dias depois.',
            }
          : {}),
      });
    } else if (leg) {
      resolved.push({
        ...leg,
        brand: leg.brand || 'Uso Diário',
        precautions:
          leg.precautions ||
          'Evite contato direto com olhos e mucosas. Em caso de irritação, suspenda o uso.',
        whereToApply:
          userCfg?.whereToApply?.trim() ||
          leg.whereToApply ||
          'Rosto e pescoço',
        focus: userCfg?.personalFocus?.trim() || leg.focus || 'Cuidado facial.',
        whenToUse:
          userCfg?.whenToUse?.trim() ||
          leg.whenToUse ||
          'Conforme cronograma',
      });
    }
  }

  return resolved;
}

export function getResolvedProductMap(
  plan: SkincarePlan,
  catalog: CatalogProduct[] = INITIAL_CATALOG_PRODUCTS,
): Record<string, Product> {
  const map: Record<string, Product> = {};
  for (const p of resolvePlanProducts(plan, catalog)) {
    map[p.id] = p;
  }
  return map;
}

export function ensureNormalizedPlan(
  rawPlan: SkincarePlan,
  catalog: CatalogProduct[] = INITIAL_CATALOG_PRODUCTS,
): SkincarePlan {
  const userProducts: Record<ProductId, UserProductConfig> = {
    ...(rawPlan.userProducts ?? {}),
  };

  if (Array.isArray(rawPlan.products)) {
    for (const leg of rawPlan.products) {
      const matched = findExistingCatalogProduct(catalog, {
        id: leg.id,
        brand: leg.brand,
        name: leg.name,
      });
      const cid = matched?.id ?? leg.id;
      if (!userProducts[cid]) {
        userProducts[cid] = {
          productId: cid,
          whereToApply: leg.whereToApply || 'Rosto e pescoço',
          personalFocus: leg.focus,
          whenToUse: leg.whenToUse,
        };
      }
    }
  }

  // Ensure every step references a key in userProducts
  const ensureKey = (pid?: string) => {
    if (!pid || userProducts[pid]) return;
    userProducts[pid] = {
      productId: pid,
      whereToApply: 'Rosto e pescoço',
      whenToUse: 'Conforme cronograma',
    };
  };

  rawPlan.morningSteps?.forEach((s) => {
    ensureKey(s.productId);
    ensureKey(s.alternativeProductId);
  });
  rawPlan.nightRoutines?.forEach((n) =>
    n.steps?.forEach((s) => {
      ensureKey(s.productId);
      ensureKey(s.alternativeProductId);
    }),
  );

  return {
    id: rawPlan.id || 'plano-personalizado',
    name: rawPlan.name || 'Meu Plano de Skincare',
    subtitle: rawPlan.subtitle || 'Protocolo personalizado',
    totalDays: Math.max(1, rawPlan.totalDays || 84),
    userProducts,
    morningSteps: rawPlan.morningSteps ?? [],
    nightRoutines: rawPlan.nightRoutines ?? [],
    phases: rawPlan.phases ?? [],
    ...(rawPlan.laserProtocol ? { laserProtocol: rawPlan.laserProtocol } : {}),
  };
}

export function clonePlan(plan: SkincarePlan): SkincarePlan {
  return JSON.parse(JSON.stringify(plan)) as SkincarePlan;
}
