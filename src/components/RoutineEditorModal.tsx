import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bot,
  CalendarRange,
  Check,
  Copy,
  Database,
  Edit3,
  MapPin,
  Package,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  BOTTLE_COLOR_PRESETS,
  clonePlan,
  DEFAULT_CREAMY_PLAN,
  ensureNormalizedPlan,
  findExistingCatalogProduct,
  NIGHT_COLOR_STYLES,
  resolvePlanProducts,
} from '../data/skincareData';
import type {
  CatalogProduct,
  CatalogProductInput,
  CatalogUpsertResult,
  NightColorKey,
  NightRoutineConfig,
  PhaseConfig,
  PlanStep,
  Product,
  SkincarePlan,
} from '../types';
import {
  buildGeminiPrompt,
  parseAndValidatePlanJson,
  slugifyId,
  type ImportedProductPreview,
} from '../utils/planImport';

type EditorTab = 'ai' | 'products' | 'schedule';

interface RoutineEditorModalProps {
  isOpen: boolean;
  plan: SkincarePlan;
  catalog: CatalogProduct[];
  initialTab?: EditorTab;
  onClose: () => void;
  onSavePlan: (nextPlan: SkincarePlan) => void;
  onUpsertCatalogProducts: (
    products: CatalogProductInput[],
  ) => Promise<{ catalog: CatalogProduct[]; results: CatalogUpsertResult[] }>;
  onUpdateCatalogProduct: (
    product: CatalogProductInput,
  ) => Promise<CatalogProduct[]>;
}

const NIGHT_COLOR_KEYS: NightColorKey[] = [
  'pink',
  'emerald',
  'sky',
  'violet',
  'amber',
  'rose',
  'teal',
];

interface ProductFormState {
  brand: string;
  name: string;
  shortName: string;
  bottleLabel: string;
  bottleColor: string;
  quantity: string;
  usageOfficial: string;
  precautions: string;
  defaultFocus: string;
  isAcid: boolean;
  // Campos individuais do plano do usuário
  whereToApply: string;
  personalFocus: string;
  whenToUse: string;
}

const EMPTY_PRODUCT_FORM: ProductFormState = {
  brand: '',
  name: '',
  shortName: '',
  bottleLabel: '',
  bottleColor: '#2E9E60',
  quantity: '',
  usageOfficial: '',
  precautions: '',
  defaultFocus: '',
  isAcid: false,
  whereToApply: '',
  personalFocus: '',
  whenToUse: '',
};

export function RoutineEditorModal({
  isOpen,
  plan,
  catalog,
  initialTab = 'ai',
  onClose,
  onSavePlan,
  onUpsertCatalogProducts,
  onUpdateCatalogProduct,
}: RoutineEditorModalProps) {
  const [editorTab, setEditorTab] = useState<EditorTab>(initialTab);
  const [draft, setDraft] = useState<SkincarePlan>(() =>
    ensureNormalizedPlan(clonePlan(plan), catalog),
  );

  // AI Import states
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [rawJson, setRawJson] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [previewPlan, setPreviewPlan] = useState<SkincarePlan | null>(null);
  const [previewNewProducts, setPreviewNewProducts] = useState<
    CatalogProductInput[]
  >([]);
  const [previewMatches, setPreviewMatches] = useState<
    ImportedProductPreview[]
  >([]);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [isApplyingImport, setIsApplyingImport] = useState(false);

  // Product CRUD & Catalog states
  const [catalogSearch, setCatalogSearch] = useState('');
  const [reuseTarget, setReuseTarget] = useState<CatalogProduct | null>(null);
  const [reuseWhereToApply, setReuseWhereToApply] = useState('');
  const [reuseWhenToUse, setReuseWhenToUse] = useState('');

  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] =
    useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [productError, setProductError] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Schedule editor helper states
  const [newMorningProductId, setNewMorningProductId] = useState<string>('');
  const [newNightStepProductByNight, setNewNightStepProductByNight] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (isOpen) {
      const normalized = ensureNormalizedPlan(clonePlan(plan), catalog);
      setDraft(normalized);
      setEditorTab(initialTab);
      setParseError(null);
      setPreviewPlan(null);
      setPreviewNewProducts([]);
      setPreviewMatches([]);
      setPreviewWarnings([]);
      setIsEditingProduct(false);
      setEditingProductId(null);
      setProductError(null);
      setReuseTarget(null);
      setCatalogSearch('');
      const firstId =
        Object.keys(normalized.userProducts)[0] ?? catalog[0]?.id ?? '';
      setNewMorningProductId(firstId);
    }
  }, [isOpen, plan, catalog, initialTab]);

  if (!isOpen) return null;

  const resolvedPlanProducts = resolvePlanProducts(draft, catalog);
  const resolvedProductMap: Record<string, Product> = {};
  for (const p of resolvedPlanProducts) {
    resolvedProductMap[p.id] = p;
  }
  const catalogMap = new Map(catalog.map((c) => [c.id, c]));

  const planProductIds = new Set(Object.keys(draft.userProducts));
  const availableCatalogProducts = catalog.filter((c) => {
    if (planProductIds.has(c.id)) return false;
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q)
    );
  });

  // Check duplicate in real time when creating a new catalog product
  const duplicateCatalogMatch =
    isEditingProduct && !editingProductId
      ? findExistingCatalogProduct(catalog, {
          brand: productForm.brand,
          name: productForm.name,
        })
      : undefined;

  const currentPromptText = buildGeminiPrompt(catalog);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(currentPromptText);
      setCopiedPrompt(true);
      window.setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      setShowPromptPreview(true);
    }
  };

  const handleValidateJson = () => {
    setParseError(null);
    const res = parseAndValidatePlanJson(rawJson, catalog);
    if (!res.ok) {
      setPreviewPlan(null);
      setPreviewNewProducts([]);
      setPreviewMatches([]);
      setPreviewWarnings([]);
      setParseError(res.error);
      return;
    }
    setPreviewPlan(res.plan);
    setPreviewNewProducts(res.newCatalogProducts);
    setPreviewMatches(res.matchedProducts);
    setPreviewWarnings(res.warnings);
  };

  const handleApplyImportedPlan = async () => {
    if (!previewPlan) return;
    setIsApplyingImport(true);
    setParseError(null);
    try {
      let finalPlan = clonePlan(previewPlan);
      if (previewNewProducts.length > 0) {
        const { results } = await onUpsertCatalogProducts(previewNewProducts);
        const remap = new Map<string, string>();
        for (const r of results) {
          if (r.requestedId && r.requestedId !== r.canonicalId) {
            remap.set(r.requestedId, r.canonicalId);
          }
        }
        if (remap.size > 0) {
          const nextUserProducts = { ...finalPlan.userProducts };
          for (const [oldId, newId] of remap.entries()) {
            const cfg = nextUserProducts[oldId];
            if (cfg) {
              delete nextUserProducts[oldId];
              nextUserProducts[newId] = { ...cfg, productId: newId };
            }
          }
          finalPlan = {
            ...finalPlan,
            userProducts: nextUserProducts,
            morningSteps: finalPlan.morningSteps.map((s) => ({
              ...s,
              productId: remap.get(s.productId) ?? s.productId,
              ...(s.alternativeProductId
                ? {
                    alternativeProductId:
                      remap.get(s.alternativeProductId) ??
                      s.alternativeProductId,
                  }
                : {}),
            })),
            nightRoutines: finalPlan.nightRoutines.map((n) => ({
              ...n,
              steps: n.steps.map((s) => ({
                ...s,
                productId: remap.get(s.productId) ?? s.productId,
                ...(s.alternativeProductId
                  ? {
                      alternativeProductId:
                        remap.get(s.alternativeProductId) ??
                        s.alternativeProductId,
                    }
                  : {}),
              })),
            })),
          };
        }
      }
      onSavePlan(finalPlan);
      onClose();
    } catch (err) {
      setParseError(
        err instanceof Error
          ? err.message
          : 'Erro ao salvar produtos na base global.',
      );
    } finally {
      setIsApplyingImport(false);
    }
  };

  const handleLoadCreamyDefault = () => {
    const creamy = clonePlan(DEFAULT_CREAMY_PLAN);
    setDraft(creamy);
    setPreviewPlan(null);
    setRawJson('');
    setParseError(null);
    setEditorTab('products');
  };

  // Reuse existing catalog product in user's plan
  const openReuseDialog = (cat: CatalogProduct) => {
    setReuseTarget(cat);
    setReuseWhereToApply('Rosto e pescoço');
    setReuseWhenToUse('Conforme cronograma');
  };

  const handleConfirmReuse = () => {
    if (!reuseTarget) return;
    setDraft((prev) => ({
      ...prev,
      userProducts: {
        ...prev.userProducts,
        [reuseTarget.id]: {
          productId: reuseTarget.id,
          whereToApply: reuseWhereToApply.trim() || 'Rosto e pescoço',
          whenToUse: reuseWhenToUse.trim() || 'Conforme cronograma',
        },
      },
    }));
    setNewMorningProductId(reuseTarget.id);
    setReuseTarget(null);
  };

  // Product Create / Edit
  const openNewProductForm = () => {
    setEditingProductId(null);
    setProductForm({
      ...EMPTY_PRODUCT_FORM,
      bottleColor:
        BOTTLE_COLOR_PRESETS[catalog.length % BOTTLE_COLOR_PRESETS.length],
    });
    setProductError(null);
    setIsEditingProduct(true);
  };

  const openEditProductForm = (p: Product) => {
    const cat = catalogMap.get(p.id);
    setEditingProductId(p.id);
    setProductForm({
      brand: cat?.brand ?? p.brand,
      name: cat?.name ?? p.name,
      shortName: cat?.shortName ?? p.shortName,
      bottleLabel: cat?.bottleLabel ?? p.bottleLabel,
      bottleColor: cat?.bottleColor ?? p.bottleColor,
      quantity: cat?.quantity ?? p.quantity,
      usageOfficial: cat?.usageOfficial ?? p.usageOfficial,
      precautions: cat?.precautions ?? p.precautions,
      defaultFocus: cat?.defaultFocus ?? p.focus,
      isAcid: cat?.isAcid ?? p.isAcid,
      whereToApply: p.whereToApply,
      personalFocus: draft.userProducts[p.id]?.personalFocus ?? p.focus,
      whenToUse: draft.userProducts[p.id]?.whenToUse ?? p.whenToUse,
    });
    setProductError(null);
    setIsEditingProduct(true);
  };

  const handleReuseFromDuplicateAlert = () => {
    if (!duplicateCatalogMatch) return;
    setDraft((prev) => ({
      ...prev,
      userProducts: {
        ...prev.userProducts,
        [duplicateCatalogMatch.id]: {
          productId: duplicateCatalogMatch.id,
          whereToApply:
            productForm.whereToApply.trim() || 'Rosto e pescoço',
          ...(productForm.personalFocus.trim()
            ? { personalFocus: productForm.personalFocus.trim() }
            : {}),
          whenToUse: productForm.whenToUse.trim() || 'Conforme cronograma',
        },
      },
    }));
    setNewMorningProductId(duplicateCatalogMatch.id);
    setIsEditingProduct(false);
    setEditingProductId(null);
    setProductError(null);
  };

  const handleSaveProductForm = async () => {
    const brand = productForm.brand.trim();
    const name = productForm.name.trim();
    const usageOfficial = productForm.usageOfficial.trim();
    const precautions = productForm.precautions.trim();
    const whereToApply = productForm.whereToApply.trim();

    if (!brand || !name || !usageOfficial || !precautions) {
      setProductError(
        'Preencha Marca, Nome, Modo de Uso e Precauções para a base do produto.',
      );
      return;
    }

    if (!whereToApply) {
      setProductError(
        'Informe onde você aplica este produto no seu plano pessoal.',
      );
      return;
    }

    if (!editingProductId && duplicateCatalogMatch) {
      setProductError(
        `Este produto (${duplicateCatalogMatch.brand} • ${duplicateCatalogMatch.name}) já existe na base. Clique em "Reutilizar este produto da base" abaixo.`,
      );
      return;
    }

    setIsSavingProduct(true);
    setProductError(null);
    try {
      if (editingProductId) {
        if (catalogMap.has(editingProductId)) {
          await onUpdateCatalogProduct({
            id: editingProductId,
            brand,
            name,
            shortName: productForm.shortName.trim() || name,
            bottleLabel: productForm.bottleLabel.trim() || 'Item da rotina',
            bottleColor: productForm.bottleColor || '#2E9E60',
            usageOfficial,
            precautions,
            quantity: productForm.quantity.trim() || 'Quantidade indicada',
            defaultFocus:
              productForm.defaultFocus.trim() || 'Cuidado facial diário.',
            isAcid: productForm.isAcid,
          });
        }

        setDraft((prev) => ({
          ...prev,
          userProducts: {
            ...prev.userProducts,
            [editingProductId]: {
              productId: editingProductId,
              whereToApply,
              ...(productForm.personalFocus.trim()
                ? { personalFocus: productForm.personalFocus.trim() }
                : {}),
              whenToUse: productForm.whenToUse.trim() || 'Conforme cronograma',
            },
          },
        }));
      } else {
        const candidateId = slugifyId(`${brand}-${name}`, 'produto');
        const { results } = await onUpsertCatalogProducts([
          {
            id: candidateId,
            brand,
            name,
            shortName: productForm.shortName.trim() || name,
            bottleLabel: productForm.bottleLabel.trim() || 'Item da rotina',
            bottleColor: productForm.bottleColor || '#2E9E60',
            usageOfficial,
            precautions,
            quantity: productForm.quantity.trim() || 'Quantidade indicada',
            defaultFocus:
              productForm.defaultFocus.trim() ||
              productForm.personalFocus.trim() ||
              'Cuidado facial diário.',
            isAcid: productForm.isAcid,
          },
        ]);

        const canonicalId = results[0]?.canonicalId ?? candidateId;
        setDraft((prev) => ({
          ...prev,
          userProducts: {
            ...prev.userProducts,
            [canonicalId]: {
              productId: canonicalId,
              whereToApply,
              ...(productForm.personalFocus.trim()
                ? { personalFocus: productForm.personalFocus.trim() }
                : {}),
              whenToUse: productForm.whenToUse.trim() || 'Conforme cronograma',
            },
          },
        }));
        setNewMorningProductId(canonicalId);
      }

      setIsEditingProduct(false);
      setEditingProductId(null);
    } catch (err) {
      setProductError(
        err instanceof Error ? err.message : 'Erro ao salvar produto.',
      );
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleRemoveProductFromUserPlan = (id: string) => {
    if (resolvedPlanProducts.length <= 1) return;
    setDraft((prev) => {
      const nextUserProducts = { ...prev.userProducts };
      delete nextUserProducts[id];
      return {
        ...prev,
        userProducts: nextUserProducts,
        morningSteps: prev.morningSteps.filter((s) => s.productId !== id),
        nightRoutines: prev.nightRoutines.map((n) => ({
          ...n,
          steps: n.steps.filter((s) => s.productId !== id),
        })),
      };
    });
  };

  // Schedule helpers
  const moveStep = (
    list: PlanStep[],
    index: number,
    dir: -1 | 1,
  ): PlanStep[] => {
    const target = index + dir;
    if (target < 0 || target >= list.length) return list;
    const copy = [...list];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    return copy;
  };

  const ensureProductInDraft = (
    prev: SkincarePlan,
    pid: string,
  ): SkincarePlan => {
    if (prev.userProducts[pid]) return prev;
    return {
      ...prev,
      userProducts: {
        ...prev.userProducts,
        [pid]: {
          productId: pid,
          whereToApply: 'Rosto e pescoço',
          whenToUse: 'Conforme cronograma',
        },
      },
    };
  };

  const handleAddMorningStep = () => {
    const pid =
      newMorningProductId ||
      resolvedPlanProducts[0]?.id ||
      catalog[0]?.id ||
      '';
    if (!pid) return;
    const cat = catalogMap.get(pid);
    setDraft((prev) => {
      const withProd = ensureProductInDraft(prev, pid);
      return {
        ...withProd,
        morningSteps: [
          ...withProd.morningSteps,
          {
            productId: pid,
            shortHint: cat?.quantity || 'Aplicar conforme orientação',
          },
        ],
      };
    });
  };

  const handleAddNightRoutine = () => {
    const usedIds = new Set(draft.nightRoutines.map((n) => n.id));
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const nextId =
      letters.find((l) => !usedIds.has(l)) ??
      `N${draft.nightRoutines.length + 1}`;
    const color =
      NIGHT_COLOR_KEYS[draft.nightRoutines.length % NIGHT_COLOR_KEYS.length];
    const firstProd = resolvedPlanProducts[0] ?? catalog[0];

    const created: NightRoutineConfig = {
      id: nextId,
      badge: nextId,
      label: `Noite ${nextId}`,
      subtitle: 'Tratamento personalizado',
      color,
      steps: firstProd
        ? [{ productId: firstProd.id, shortHint: firstProd.quantity }]
        : [],
    };
    setDraft((prev) => ({
      ...prev,
      nightRoutines: [...prev.nightRoutines, created],
    }));
  };

  const handleRemoveNightRoutine = (nightId: string) => {
    if (draft.nightRoutines.length <= 1) return;
    const remaining = draft.nightRoutines.filter((n) => n.id !== nightId);
    const fallbackId = remaining[0].id;
    setDraft((prev) => ({
      ...prev,
      nightRoutines: remaining,
      phases: prev.phases.map((ph) => {
        const filtered = ph.nightPattern.filter((id) => id !== nightId);
        return {
          ...ph,
          nightPattern: filtered.length > 0 ? filtered : [fallbackId],
        };
      }),
    }));
  };

  const handleAddPhase = () => {
    const last = draft.phases[draft.phases.length - 1];
    const startDay = last ? last.endDay + 1 : 1;
    const endDay = Math.max(startDay, startDay + 13);
    const fallbackNightId = draft.nightRoutines[0]?.id ?? 'A';

    const nextPhase: PhaseConfig = {
      phase: draft.phases.length + 1,
      name: `Fase ${draft.phases.length + 1}`,
      weeksLabel: `Dias ${startDay} a ${endDay}`,
      startDay,
      endDay,
      patternLabel: `Ciclo: ${fallbackNightId}`,
      objective: 'Objetivo desta fase do tratamento.',
      nightPattern: [fallbackNightId],
    };

    setDraft((prev) => ({
      ...prev,
      totalDays: Math.max(prev.totalDays, endDay),
      phases: [...prev.phases, nextPhase],
    }));
  };

  const handleSaveManualPlan = () => {
    const maxPhaseEnd = draft.phases.reduce(
      (max, p) => Math.max(max, p.endDay),
      0,
    );
    const cleaned: SkincarePlan = {
      ...draft,
      name: draft.name.trim() || 'Meu Plano de Skincare',
      totalDays: Math.max(1, draft.totalDays || maxPhaseEnd || 84),
      phases: draft.phases
        .slice()
        .sort((a, b) => a.startDay - b.startDay)
        .map((p, idx) => ({
          ...p,
          phase: idx + 1,
          patternLabel:
            p.patternLabel.trim() ||
            `Ciclo: ${p.nightPattern.join(' → ')}`,
        })),
    };
    onSavePlan(cleaned);
    onClose();
  };

  // Options for step selectors: prioritize user's plan products, then rest of catalog
  const selectableProductsForSteps = [
    ...resolvedPlanProducts,
    ...catalog.filter((c) => !planProductIds.has(c.id)),
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="routine-editor-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#22120C]/55 backdrop-blur-xs p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#FBF7F2] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#EFE5DC] overflow-hidden animate-sheet-up max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white px-5 pt-4 pb-3 border-b border-[#EFE5DC]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2
                id="routine-editor-title"
                className="text-lg font-extrabold text-[#261610]"
              >
                Personalizar Rotina & Produtos
              </h2>
              <p className="text-xs text-[#755D52]">
                Base global acumulativa + suas áreas de aplicação e fases
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar editor"
              className="p-2 -mr-1 rounded-full text-[#856C60] hover:bg-[#F6EDE4] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5 bg-[#FBF7F2] p-1 rounded-2xl border border-[#EFE5DC]">
            <button
              type="button"
              onClick={() => setEditorTab('ai')}
              className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                editorTab === 'ai'
                  ? 'bg-[#5A2C1C] text-white shadow-2xs'
                  : 'text-[#755D52] hover:text-[#261610]'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              Importar IA
            </button>

            <button
              type="button"
              onClick={() => setEditorTab('products')}
              className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                editorTab === 'products'
                  ? 'bg-[#5A2C1C] text-white shadow-2xs'
                  : 'text-[#755D52] hover:text-[#261610]'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Produtos ({resolvedPlanProducts.length})
            </button>

            <button
              type="button"
              onClick={() => setEditorTab('schedule')}
              className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                editorTab === 'schedule'
                  ? 'bg-[#5A2C1C] text-white shadow-2xs'
                  : 'text-[#755D52] hover:text-[#261610]'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              Rotina/Fases
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto no-scrollbar flex-1">
          {/* TAB 1: IMPORTAR VIA IA */}
          {editorTab === 'ai' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#F7EAE0]/75 border border-[#5A2C1C]/20 p-4 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-5 h-5 text-[#5A2C1C] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-[#5A2C1C]">
                      Como importar do Gemini sem duplicar produtos
                    </p>
                    <ol className="text-xs text-[#3E2920] mt-1 space-y-1 list-decimal list-inside">
                      <li>
                        Copie o prompt modelo (ele já leva a lista dos{' '}
                        <strong>{catalog.length} produtos</strong> da base para o
                        Gemini reutilizar).
                      </li>
                      <li>
                        Cole na conversa do Gemini e peça para converter seu
                        plano — informando as <strong>suas áreas de aplicação</strong>.
                      </li>
                      <li>
                        Cole o JSON abaixo: produtos já existentes são
                        reaproveitados automaticamente e os inéditos entram na
                        base.
                      </li>
                    </ol>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#5A2C1C] hover:bg-[#3D1C11] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="w-4 h-4" /> Prompt copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" /> Copiar Prompt para o Gemini
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPromptPreview((v) => !v)}
                    className="py-2.5 px-3 rounded-xl bg-white border border-[#DFCFC2] text-xs font-semibold text-[#261610] cursor-pointer"
                  >
                    {showPromptPreview ? 'Ocultar' : 'Ver prompt'}
                  </button>
                </div>

                {showPromptPreview && (
                  <pre className="mt-2 p-3 rounded-xl bg-white border border-[#DFCFC2] text-[10px] leading-relaxed text-[#3E2920] overflow-x-auto max-h-48 whitespace-pre-wrap">
                    {currentPromptText}
                  </pre>
                )}
              </div>

              <div className="rounded-2xl bg-white border border-[#EFE5DC] p-4 space-y-3">
                <label className="block">
                  <span className="text-xs font-bold text-[#261610]">
                    Cole aqui o JSON gerado pela IA
                  </span>
                  <textarea
                    rows={6}
                    value={rawJson}
                    onChange={(e) => {
                      setRawJson(e.target.value);
                      setParseError(null);
                      setPreviewPlan(null);
                    }}
                    placeholder='{"name": "Minha Rotina", "totalDays": 84, "products": [...], ...}'
                    className="mt-1.5 w-full rounded-xl border border-[#DFCFC2] bg-[#FBF7F2] p-3 text-xs font-mono text-[#261610] focus:outline-hidden focus:border-[#5A2C1C]"
                  />
                </label>

                {parseError && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800">
                    {parseError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleValidateJson}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#261610] hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Validar e Ver Prévia
                </button>

                {previewPlan && (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 space-y-2.5">
                    <div>
                      <p className="text-xs font-extrabold text-emerald-900">
                        Prévia validada: {previewPlan.name}
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        {previewPlan.totalDays} dias •{' '}
                        {previewMatches.length} produto(s) •{' '}
                        {previewPlan.nightRoutines.length} tipo(s) de noite •{' '}
                        {previewPlan.phases.length} fase(s)
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      {previewMatches.map((m) => (
                        <div
                          key={m.canonicalId}
                          className="rounded-xl bg-white border border-emerald-200/80 px-2.5 py-2 flex items-start justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: m.bottleColor }}
                              />
                              <p className="text-xs font-bold text-[#261610] truncate">
                                {m.brand} • {m.name}
                              </p>
                            </div>
                            <p className="text-[11px] text-[#755D52] mt-0.5">
                              Aplicar: {m.whereToApply}
                            </p>
                          </div>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              m.reusedFromBase
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {m.reusedFromBase ? 'Já na base' : 'Novo na base'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {previewWarnings.map((w, idx) => (
                      <p key={idx} className="text-[11px] text-amber-800">
                        {w}
                      </p>
                    ))}

                    <button
                      type="button"
                      disabled={isApplyingImport}
                      onClick={handleApplyImportedPlan}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      {isApplyingImport
                        ? 'Salvando na base e aplicando...'
                        : 'Aplicar este Plano na Minha Conta'}
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleLoadCreamyDefault}
                className="w-full py-2.5 px-4 rounded-xl border border-[#DFCFC2] bg-white hover:bg-[#FBF7F2] text-xs font-semibold text-[#755D52] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Carregar Modelo Padrão Creamy (12 Semanas)
              </button>
            </div>
          )}

          {/* TAB 2: PRODUTOS (SEU PLANO + BASE ACUMULATIVA GLOBAL) */}
          {editorTab === 'products' && (
            <div className="space-y-4">
              {!isEditingProduct ? (
                <>
                  {/* Bloco A: Produtos no plano atual deste usuário */}
                  <section className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#5A2C1C]">
                          No Seu Plano ({resolvedPlanProducts.length})
                        </h3>
                        <p className="text-[11px] text-[#755D52]">
                          As áreas de aplicação são individuais desta conta
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={openNewProductForm}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#5A2C1C] hover:bg-[#3D1C11] text-white text-xs font-bold shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Novo Produto
                      </button>
                    </div>

                    <div className="space-y-2">
                      {resolvedPlanProducts.map((prod) => (
                        <div
                          key={prod.id}
                          className="rounded-2xl bg-white border border-[#EFE5DC] p-3 flex items-start justify-between gap-2.5"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <span
                              className="w-4 h-4 rounded-full shrink-0 mt-0.5 ring-2 ring-[#FBF7F2]"
                              style={{ backgroundColor: prod.bottleColor }}
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F7EAE0] text-[#5A2C1C]">
                                  {prod.brand}
                                </span>
                                <p className="text-sm font-bold text-[#261610] truncate">
                                  {prod.name}
                                </p>
                                {prod.isAcid && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                                    Ácido
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#3E2920] mt-1 flex items-start gap-1">
                                <MapPin className="w-3.5 h-3.5 text-[#5A2C1C] shrink-0 mt-0.5" />
                                <span>{prod.whereToApply}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              aria-label={`Editar ${prod.name}`}
                              onClick={() => openEditProductForm(prod)}
                              className="p-2 rounded-xl text-[#5A2C1C] hover:bg-[#F7EAE0] cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Remover ${prod.name} do meu plano`}
                              disabled={resolvedPlanProducts.length <= 1}
                              onClick={() =>
                                handleRemoveProductFromUserPlan(prod.id)
                              }
                              className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 disabled:opacity-30 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Modal inline para definir onde usar um produto reutilizado da base */}
                  {reuseTarget && (
                    <div className="rounded-2xl bg-[#F7EAE0] border-2 border-[#5A2C1C]/40 p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-extrabold text-[#5A2C1C]">
                            Reutilizar: {reuseTarget.brand} • {reuseTarget.name}
                          </p>
                          <p className="text-[11px] text-[#3E2920]">
                            Defina onde VOCÊ vai aplicar este produto no seu plano:
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReuseTarget(null)}
                          className="p-1 text-[#755D52] cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <input
                        type="text"
                        placeholder="Ex.: Apenas zona T e nariz"
                        value={reuseWhereToApply}
                        onChange={(e) => setReuseWhereToApply(e.target.value)}
                        className="w-full rounded-xl border border-[#DFCFC2] bg-white px-3 py-2 text-xs font-semibold"
                      />
                      <input
                        type="text"
                        placeholder="Quando usar (ex.: Noites alternadas)"
                        value={reuseWhenToUse}
                        onChange={(e) => setReuseWhenToUse(e.target.value)}
                        className="w-full rounded-xl border border-[#DFCFC2] bg-white px-3 py-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleConfirmReuse}
                        className="w-full py-2 rounded-xl bg-[#5A2C1C] text-white text-xs font-bold cursor-pointer"
                      >
                        Adicionar ao Meu Plano
                      </button>
                    </div>
                  )}

                  {/* Bloco B: Base Acumulativa Global do Sistema */}
                  <section className="rounded-2xl bg-white border border-[#EFE5DC] p-3.5 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-[#5A2C1C]" />
                      <div>
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#261610]">
                          Base Acumulativa do Sistema ({catalog.length})
                        </h3>
                        <p className="text-[11px] text-[#755D52]">
                          Produtos já cadastrados no sistema. Reutilize sem
                          duplicar!
                        </p>
                      </div>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#947C70] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar por marca ou nome..."
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#DFCFC2] bg-[#FBF7F2] text-xs"
                      />
                    </div>

                    {availableCatalogProducts.length === 0 ? (
                      <p className="text-xs text-[#755D52] py-2 text-center">
                        {catalogSearch.trim()
                          ? 'Nenhum produto encontrado fora do seu plano. Use "Novo Produto" acima para cadastrar na base.'
                          : 'Você já está utilizando todos os produtos cadastrados na base.'}
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-52 overflow-y-auto no-scrollbar">
                        {availableCatalogProducts.map((cat) => (
                          <div
                            key={cat.id}
                            className="rounded-xl bg-[#FBF7F2] border border-[#EFE5DC] px-3 py-2 flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: cat.bottleColor }}
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-[#261610] truncate">
                                  {cat.brand} • {cat.name}
                                </p>
                                <p className="text-[11px] text-[#755D52] truncate">
                                  {cat.usageOfficial}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => openReuseDialog(cat)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#F7EAE0] text-[#5A2C1C] hover:bg-[#EED8C7] text-[11px] font-bold shrink-0 cursor-pointer"
                            >
                              + Usar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              ) : (
                <div className="rounded-2xl bg-white border border-[#EFE5DC] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-[#261610]">
                      {editingProductId
                        ? 'Editar Produto e Áreas'
                        : 'Cadastrar Produto na Base'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsEditingProduct(false)}
                      className="text-xs font-semibold text-[#755D52] hover:underline cursor-pointer"
                    >
                      Voltar à lista
                    </button>
                  </div>

                  {/* Aviso em tempo real se já existe na base global */}
                  {duplicateCatalogMatch && (
                    <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-950">
                            Este produto já existe na base do sistema!
                          </p>
                          <p className="text-[11px] text-amber-900 mt-0.5">
                            <strong>{duplicateCatalogMatch.brand}</strong> •{' '}
                            {duplicateCatalogMatch.name}. Para não duplicar,
                            reutilize-o definindo apenas onde você vai aplicar.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleReuseFromDuplicateAlert}
                        className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
                      >
                        Reutilizar este produto da base
                      </button>
                    </div>
                  )}

                  {/* Seção Individual do Plano */}
                  <div className="rounded-xl bg-[#F7EAE0]/55 border border-[#5A2C1C]/20 p-3 space-y-2">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#5A2C1C]">
                      No Seu Plano (Individual)
                    </p>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-[#3E2920]">
                        Onde você aplica *
                      </span>
                      <input
                        type="text"
                        value={productForm.whereToApply}
                        onChange={(e) =>
                          setProductForm({
                            ...productForm,
                            whereToApply: e.target.value,
                          })
                        }
                        placeholder="Ex.: Rosto e pescoço, ou Apenas zona T"
                        className="mt-1 w-full rounded-xl border border-[#DFCFC2] bg-white px-3 py-2 text-xs font-semibold"
                      />
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[11px] font-semibold text-[#3E2920]">
                          Foco na sua pele
                        </span>
                        <input
                          type="text"
                          value={productForm.personalFocus}
                          onChange={(e) =>
                            setProductForm({
                              ...productForm,
                              personalFocus: e.target.value,
                            })
                          }
                          placeholder="Ex.: Controle de oleosidade"
                          className="mt-1 w-full rounded-xl border border-[#DFCFC2] bg-white px-3 py-1.5 text-xs"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-semibold text-[#3E2920]">
                          Quando você usa
                        </span>
                        <input
                          type="text"
                          value={productForm.whenToUse}
                          onChange={(e) =>
                            setProductForm({
                              ...productForm,
                              whenToUse: e.target.value,
                            })
                          }
                          placeholder="Ex.: Manhã e Noite"
                          className="mt-1 w-full rounded-xl border border-[#DFCFC2] bg-white px-3 py-1.5 text-xs"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Seção Global da Base Acumulativa */}
                  <div className="rounded-xl bg-[#FBF7F2] border border-[#EFE5DC] p-3 space-y-2.5">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#755D52]">
                      Base Global do Produto (Compartilhada)
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[11px] font-semibold text-[#755D52]">
                          Marca *
                        </span>
                        <input
                          type="text"
                          value={productForm.brand}
                          onChange={(e) =>
                            setProductForm({
                              ...productForm,
                              brand: e.target.value,
                            })
                          }
                          placeholder="Ex.: La Roche-Posay, Creamy..."
                          className="mt-1 w-full rounded-xl border border-[#DFCFC2] bg-white px-3 py-2 text-xs font-semibold"
                        />
                      </label>

                      <label className="block">
                        <span className="text-[11px] font-semibold text-[#755D52]">
                          Nome do produto *
                        </span>
                        <input
                          type="text"
                          value={productForm.name}
                          onChange={(e) =>
                            setProductForm({
                              ...productForm,
                              name: e.target.value,
                            })
                          }
                          placeholder="Ex.: Effaclar Gel Concentrado"
                          className="mt-1 w-full rounded-xl border border-[#DFCFC2] bg-white px-3 py-2 text-xs font-semibold"
                        />
                      </label>

                      <label className="block">
                        <span className="text-[11px] font-semibold text-[#755D52]">
                          Nome curto
                        </span>
                        <input
                          type="text"
                          value={productForm.shortName}
                          onChange={(e) =>
                            setProductForm({
                              ...productForm,
                              shortName: e.target.value,
                            })
                          }
                          placeholder="Ex.: Effaclar Gel"
                          className="mt-1 w-full rounded-xl border border-[#DFCFC2] bg-white px-3 py-2 text-xs"
                        />
                      </label>

                      <label className="block">
                        <span className="text-[11px] font-semibold text-[#755D52]">
                          Quantidade padrão
                        </span>
                        <input
                          type="text"
                          value={productForm.quantity}
                          onChange={(e) =>
                            setProductForm({
                              ...productForm,
                              quantity: e.target.value,
                            })
                          }
                          placeholder="Ex.: 1 pump / 3 gotas"
                          className="mt-1 w-full rounded-xl border border-[#DFCFC2] bg-white px-3 py-2 text-xs"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="text-[11px] font-semibold text-[#755D52]">
                        Frasco / volume
                      </span>
                      <input
                        type="text"
                        value={productForm.bottleLabel}
                        onChange={(e) =>
                          setProductForm({
                            ...productForm,
                            bottleLabel: e.target.value,
                          })
                        }
                        placeholder="Ex.: Bisnaga azul, 150g"
                        className="mt-1 w-full rounded-xl border border-[#DFCFC2] bg-white px-3 py-2 text-xs"
                      />
                    </label>

                    <div>
                      <span className="text-[11px] font-semibold text-[#755D52]">
                        Cor do frasco
                      </span>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {BOTTLE_COLOR_PRESETS.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() =>
                              setProductForm({
                                ...productForm,
                                bottleColor: hex,
                              })
                            }
                            className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                              productForm.bottleColor === hex
                                ? 'scale-115 ring-2 ring-[#5A2C1C] ring-offset-1'
                                : ''
                            }`}
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                        <input
                          type="color"
                          value={productForm.bottleColor}
                          onChange={(e) =>
                            setProductForm({
                              ...productForm,
                              bottleColor: e.target.value,
                            })
                          }
                          className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
                        />
                      </div>
                    </div>

                    <label className="block">
                      <span className="text-[11px] font-semibold text-[#755D52]">
                        Modo de uso *
                      </span>
                      <textarea
                        rows={2}
                        value={productForm.usageOfficial}
                        onChange={(e) =>
                          setProductForm({
                            ...productForm,
                            usageOfficial: e.target.value,
                          })
                        }
                        placeholder="Como aplicar, se enxágua, tempo de espera..."
                        className="mt-1 w-full rounded-xl border border-[#DFCFC2] bg-white px-3 py-2 text-xs"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-semibold text-[#755D52]">
                        Precauções *
                      </span>
                      <textarea
                        rows={2}
                        value={productForm.precautions}
                        onChange={(e) =>
                          setProductForm({
                            ...productForm,
                            precautions: e.target.value,
                          })
                        }
                        placeholder="Ex.: Evitar área dos olhos, uso noturno, exige protetor solar..."
                        className="mt-1 w-full rounded-xl border border-[#DFCFC2] bg-white px-3 py-2 text-xs"
                      />
                    </label>

                    <label className="flex items-center gap-2 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={productForm.isAcid}
                        onChange={(e) =>
                          setProductForm({
                            ...productForm,
                            isAcid: e.target.checked,
                          })
                        }
                        className="rounded accent-[#5A2C1C]"
                      />
                      <span className="text-xs font-semibold text-[#261610]">
                        É ácido / ativo (pausar automaticamente no Modo Laser)
                      </span>
                    </label>
                  </div>

                  {productError && (
                    <p className="text-xs font-semibold text-rose-700">
                      {productError}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={isSavingProduct || Boolean(duplicateCatalogMatch)}
                    onClick={handleSaveProductForm}
                    className="w-full py-2.5 rounded-xl bg-[#5A2C1C] hover:bg-[#3D1C11] disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                  >
                    {isSavingProduct
                      ? 'Salvando...'
                      : editingProductId
                        ? 'Atualizar Produto e Áreas'
                        : 'Cadastrar na Base e Usar no Meu Plano'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ROTINA & FASES */}
          {editorTab === 'schedule' && (
            <div className="space-y-4">
              <section className="rounded-2xl bg-white border border-[#EFE5DC] p-3.5 space-y-2.5">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#5A2C1C]">
                  Dados Gerais do Plano
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="block sm:col-span-2">
                    <span className="text-[11px] font-semibold text-[#755D52]">
                      Nome do plano
                    </span>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(e) =>
                        setDraft({ ...draft, name: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-[#DFCFC2] bg-[#FBF7F2] px-3 py-1.5 text-xs font-semibold"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-[#755D52]">
                      Total de dias
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={draft.totalDays}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          totalDays: Math.max(1, Number(e.target.value) || 84),
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-[#DFCFC2] bg-[#FBF7F2] px-3 py-1.5 text-xs font-semibold"
                    />
                  </label>
                </div>
              </section>

              {/* Passos da Manhã */}
              <section className="rounded-2xl bg-white border border-[#EFE5DC] p-3.5 space-y-2.5">
                <p className="text-xs font-extrabold uppercase tracking-wider text-amber-700">
                  Rotina da Manhã ({draft.morningSteps.length} passos)
                </p>

                <div className="space-y-2">
                  {draft.morningSteps.map((step, idx) => {
                    const prod =
                      resolvedProductMap[step.productId] ??
                      catalogMap.get(step.productId);
                    return (
                      <div
                        key={`m-${idx}-${step.productId}`}
                        className="rounded-xl bg-[#FBF7F2] border border-[#EFE5DC] p-2.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#261610] truncate">
                            {idx + 1}. {prod?.shortName ?? step.productId}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  morningSteps: moveStep(
                                    prev.morningSteps,
                                    idx,
                                    -1,
                                  ),
                                }))
                              }
                              className="p-1 rounded hover:bg-white disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === draft.morningSteps.length - 1}
                              onClick={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  morningSteps: moveStep(
                                    prev.morningSteps,
                                    idx,
                                    1,
                                  ),
                                }))
                              }
                              className="p-1 rounded hover:bg-white disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  morningSteps: prev.morningSteps.filter(
                                    (_, i) => i !== idx,
                                  ),
                                }))
                              }
                              className="p-1 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={step.shortHint}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              morningSteps: prev.morningSteps.map((s, i) =>
                                i === idx
                                  ? { ...s, shortHint: e.target.value }
                                  : s,
                              ),
                            }))
                          }
                          placeholder="Dica rápida do passo"
                          className="w-full rounded-lg border border-[#DFCFC2] bg-white px-2.5 py-1 text-[11px]"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <select
                    value={
                      newMorningProductId ||
                      selectableProductsForSteps[0]?.id ||
                      ''
                    }
                    onChange={(e) => setNewMorningProductId(e.target.value)}
                    className="flex-1 rounded-xl border border-[#DFCFC2] bg-[#FBF7F2] px-2.5 py-2 text-xs font-semibold"
                  >
                    {selectableProductsForSteps.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.brand} • {p.shortName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddMorningStep}
                    className="px-3 py-2 rounded-xl bg-[#5A2C1C] text-white text-xs font-bold shrink-0 cursor-pointer"
                  >
                    + Passo
                  </button>
                </div>
              </section>

              {/* Tipos de Noite */}
              <section className="rounded-2xl bg-white border border-[#EFE5DC] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-indigo-700">
                    Tipos de Noite ({draft.nightRoutines.length})
                  </p>
                  <button
                    type="button"
                    onClick={handleAddNightRoutine}
                    className="text-xs font-bold text-[#5A2C1C] hover:underline cursor-pointer"
                  >
                    + Nova Noite
                  </button>
                </div>

                <div className="space-y-3">
                  {draft.nightRoutines.map((night) => {
                    const style = NIGHT_COLOR_STYLES[night.color];
                    const selectedAddId =
                      newNightStepProductByNight[night.id] ||
                      selectableProductsForSteps[0]?.id ||
                      '';
                    return (
                      <div
                        key={night.id}
                        className="rounded-xl border border-[#EFE5DC] bg-[#FBF7F2] p-3 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${style.bgClass} ${style.textClass} ${style.borderClass}`}
                          >
                            Badge: {night.badge}
                          </span>
                          <div className="flex items-center gap-1">
                            {NIGHT_COLOR_KEYS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    nightRoutines: prev.nightRoutines.map((n) =>
                                      n.id === night.id ? { ...n, color: c } : n,
                                    ),
                                  }))
                                }
                                className={`w-4 h-4 rounded-full cursor-pointer ${
                                  NIGHT_COLOR_STYLES[c].dotClass
                                } ${
                                  night.color === c
                                    ? 'ring-2 ring-[#261610] ring-offset-1'
                                    : 'opacity-50'
                                }`}
                              />
                            ))}
                            {draft.nightRoutines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveNightRoutine(night.id)}
                                className="ml-1 p-1 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={night.label}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                nightRoutines: prev.nightRoutines.map((n) =>
                                  n.id === night.id
                                    ? { ...n, label: e.target.value }
                                    : n,
                                ),
                              }))
                            }
                            placeholder="Nome (ex: Noite A)"
                            className="rounded-lg border border-[#DFCFC2] bg-white px-2.5 py-1.5 text-xs font-bold"
                          />
                          <input
                            type="text"
                            value={night.subtitle}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                nightRoutines: prev.nightRoutines.map((n) =>
                                  n.id === night.id
                                    ? { ...n, subtitle: e.target.value }
                                    : n,
                                ),
                              }))
                            }
                            placeholder="Subtítulo"
                            className="rounded-lg border border-[#DFCFC2] bg-white px-2.5 py-1.5 text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          {night.steps.map((step, sIdx) => {
                            const prod =
                              resolvedProductMap[step.productId] ??
                              catalogMap.get(step.productId);
                            return (
                              <div
                                key={`${night.id}-${sIdx}-${step.productId}`}
                                className="flex flex-wrap items-center gap-1.5 bg-white rounded-lg border border-[#EFE5DC] p-2"
                              >
                                <span className="text-[11px] font-bold text-[#261610] flex-1 min-w-[120px] truncate">
                                  {sIdx + 1}. {prod?.shortName ?? step.productId}
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  max={60}
                                  value={step.waitMinutes ?? 0}
                                  title="Minutos de espera (opcional)"
                                  onChange={(e) => {
                                    const mins = Number(e.target.value) || 0;
                                    setDraft((prev) => ({
                                      ...prev,
                                      nightRoutines: prev.nightRoutines.map(
                                        (n) =>
                                          n.id === night.id
                                            ? {
                                                ...n,
                                                steps: n.steps.map((st, i) =>
                                                  i === sIdx
                                                    ? {
                                                        ...st,
                                                        waitMinutes:
                                                          mins > 0
                                                            ? mins
                                                            : undefined,
                                                      }
                                                    : st,
                                                ),
                                              }
                                            : n,
                                      ),
                                    }));
                                  }}
                                  className="w-14 rounded border border-[#DFCFC2] px-1.5 py-0.5 text-[11px] text-center"
                                />
                                <span className="text-[10px] text-[#755D52]">
                                  min
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraft((prev) => ({
                                      ...prev,
                                      nightRoutines: prev.nightRoutines.map(
                                        (n) =>
                                          n.id === night.id
                                            ? {
                                                ...n,
                                                steps: n.steps.filter(
                                                  (_, i) => i !== sIdx,
                                                ),
                                              }
                                            : n,
                                      ),
                                    }))
                                  }
                                  className="p-1 text-rose-600 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={selectedAddId}
                            onChange={(e) =>
                              setNewNightStepProductByNight((prev) => ({
                                ...prev,
                                [night.id]: e.target.value,
                              }))
                            }
                            className="flex-1 rounded-lg border border-[#DFCFC2] bg-white px-2 py-1.5 text-xs font-semibold"
                          >
                            {selectableProductsForSteps.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.brand} • {p.shortName}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              if (!selectedAddId) return;
                              const prod = catalogMap.get(selectedAddId);
                              setDraft((prev) => {
                                const withProd = ensureProductInDraft(
                                  prev,
                                  selectedAddId,
                                );
                                return {
                                  ...withProd,
                                  nightRoutines: withProd.nightRoutines.map(
                                    (n) =>
                                      n.id === night.id
                                        ? {
                                            ...n,
                                            steps: [
                                              ...n.steps,
                                              {
                                                productId: selectedAddId,
                                                shortHint:
                                                  prod?.quantity ||
                                                  'Aplicar conforme orientação',
                                              },
                                            ],
                                          }
                                        : n,
                                  ),
                                };
                              });
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[#5A2C1C] text-white text-xs font-bold cursor-pointer"
                          >
                            + Passo
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Fases do Calendário */}
              <section className="rounded-2xl bg-white border border-[#EFE5DC] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-[#5A2C1C]">
                    Fases no Calendário ({draft.phases.length})
                  </p>
                  <button
                    type="button"
                    onClick={handleAddPhase}
                    className="text-xs font-bold text-[#5A2C1C] hover:underline cursor-pointer"
                  >
                    + Nova Fase
                  </button>
                </div>

                <div className="space-y-2.5">
                  {draft.phases.map((phase, pIdx) => (
                    <div
                      key={`phase-${pIdx}`}
                      className="rounded-xl bg-[#FBF7F2] border border-[#EFE5DC] p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={phase.name}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              phases: prev.phases.map((ph, i) =>
                                i === pIdx
                                  ? { ...ph, name: e.target.value }
                                  : ph,
                              ),
                            }))
                          }
                          className="flex-1 rounded-lg border border-[#DFCFC2] bg-white px-2.5 py-1 text-xs font-bold"
                        />
                        {draft.phases.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                phases: prev.phases.filter(
                                  (_, i) => i !== pIdx,
                                ),
                              }))
                            }
                            className="p-1 text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#755D52]">
                          Dia início:
                          <input
                            type="number"
                            min={1}
                            value={phase.startDay}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                phases: prev.phases.map((ph, i) =>
                                  i === pIdx
                                    ? {
                                        ...ph,
                                        startDay: Math.max(
                                          1,
                                          Number(e.target.value) || 1,
                                        ),
                                      }
                                    : ph,
                                ),
                              }))
                            }
                            className="w-16 rounded-lg border border-[#DFCFC2] bg-white px-2 py-1 text-xs font-bold text-[#261610]"
                          />
                        </label>

                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#755D52]">
                          Dia fim:
                          <input
                            type="number"
                            min={phase.startDay}
                            value={phase.endDay}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                phases: prev.phases.map((ph, i) =>
                                  i === pIdx
                                    ? {
                                        ...ph,
                                        endDay: Math.max(
                                          ph.startDay,
                                          Number(e.target.value) || ph.startDay,
                                        ),
                                      }
                                    : ph,
                                ),
                              }))
                            }
                            className="w-16 rounded-lg border border-[#DFCFC2] bg-white px-2 py-1 text-xs font-bold text-[#261610]"
                          />
                        </label>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold text-[#755D52] mb-1">
                          Sequência do rodízio ({phase.nightPattern.join(' → ')}
                          ):
                        </p>
                        <div className="flex flex-wrap items-center gap-1">
                          {draft.nightRoutines.map((n) => (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  phases: prev.phases.map((ph, i) =>
                                    i === pIdx
                                      ? {
                                          ...ph,
                                          nightPattern: [
                                            ...ph.nightPattern,
                                            n.id,
                                          ],
                                        }
                                      : ph,
                                  ),
                                }))
                              }
                              className={`px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${NIGHT_COLOR_STYLES[n.color].bgClass} ${NIGHT_COLOR_STYLES[n.color].textClass} ${NIGHT_COLOR_STYLES[n.color].borderClass}`}
                            >
                              + {n.badge}
                            </button>
                          ))}
                          {phase.nightPattern.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  phases: prev.phases.map((ph, i) =>
                                    i === pIdx
                                      ? {
                                          ...ph,
                                          nightPattern: ph.nightPattern.slice(
                                            0,
                                            -1,
                                          ),
                                        }
                                      : ph,
                                  ),
                                }))
                              }
                              className="px-2 py-1 rounded-lg border border-rose-200 bg-white text-[11px] font-semibold text-rose-700 cursor-pointer"
                            >
                              Remover último
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        {editorTab !== 'ai' && (
          <div className="px-5 py-3.5 bg-white border-t border-[#EFE5DC] flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-2xl border border-[#DFCFC2] text-xs font-bold text-[#755D52] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveManualPlan}
              className="flex-1 py-3 rounded-2xl bg-[#5A2C1C] hover:bg-[#3D1C11] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Salvar Alterações no Meu Plano
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
