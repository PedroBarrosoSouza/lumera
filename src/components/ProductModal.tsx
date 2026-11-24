import {
  AlertTriangle,
  Clock,
  Droplets,
  MapPin,
  ShieldAlert,
  Sparkles,
  Tag,
  Target,
  X,
} from 'lucide-react';
import type { Product } from '../types';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

export function ProductModal({ product, onClose }: ProductModalProps) {
  if (!product) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#22120C]/50 backdrop-blur-xs p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#EFE5DC] overflow-hidden animate-sheet-up max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-[#F2E8DF]">
          <div className="flex items-center gap-3.5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner border border-black/5"
              style={{ backgroundColor: `${product.bottleColor}22` }}
            >
              <span
                className="w-5 h-5 rounded-full shadow-sm ring-2 ring-white"
                style={{ backgroundColor: product.bottleColor }}
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#5A2C1C] bg-[#F7EAE0] px-2.5 py-0.5 rounded-full">
                  <Tag className="w-3 h-3" />
                  {product.brand}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#755D52] bg-[#F6EDE4] px-2.5 py-0.5 rounded-full">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: product.bottleColor }}
                  />
                  {product.bottleLabel}
                </span>
              </div>
              <h2
                id="product-modal-title"
                className="mt-1 text-lg font-bold text-[#261610] leading-snug"
              >
                {product.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes do produto"
            className="p-2 -mr-1 rounded-full text-[#856C60] hover:bg-[#F6EDE4] hover:text-[#261610] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="px-5 py-4 space-y-3.5 overflow-y-auto no-scrollbar">
          {/* Onde aplicar (Individual do usuário) */}
          <div className="rounded-2xl bg-[#F7EAE0]/65 border border-[#5A2C1C]/15 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5A2C1C]">
                <MapPin className="w-4 h-4" />
                Onde aplicar
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#5A2C1C] border border-[#5A2C1C]/20">
                Seu Plano
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-[#261610] leading-relaxed">
              {product.whereToApply}
            </p>
          </div>

          {/* Quantidade + Quando usar */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-[#FBF7F2] border border-[#EFE5DC] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#755D52]">
                <Droplets className="w-3.5 h-3.5 text-[#5A2C1C]" />
                Quantidade
              </div>
              <p className="mt-1 text-sm font-semibold text-[#261610]">
                {product.quantity}
              </p>
            </div>

            <div className="rounded-2xl bg-[#FBF7F2] border border-[#EFE5DC] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#755D52]">
                <Clock className="w-3.5 h-3.5 text-[#5A2C1C]" />
                Quando usar
              </div>
              <p className="mt-1 text-sm font-semibold text-[#261610]">
                {product.whenToUse}
              </p>
            </div>
          </div>

          {/* Modo de Uso Oficial */}
          <div className="rounded-2xl bg-[#FBF7F2] border border-[#EFE5DC] p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#755D52]">
              <Sparkles className="w-4 h-4 text-[#5A2C1C]" />
              Modo de Uso
            </div>
            <p className="mt-1.5 text-sm text-[#3E2920] leading-relaxed">
              {product.usageOfficial}
            </p>
          </div>

          {/* Precauções */}
          {product.precautions && (
            <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-3.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
                <ShieldAlert className="w-4 h-4" />
                Precauções
              </div>
              <p className="mt-1.5 text-sm text-amber-950 leading-relaxed">
                {product.precautions}
              </p>
            </div>
          )}

          {/* Foco no rosto */}
          <div className="rounded-2xl bg-[#FBF7F2] border border-[#EFE5DC] p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#755D52]">
              <Target className="w-4 h-4 text-[#5A2C1C]" />
              Foco na sua pele
            </div>
            <p className="mt-1 text-sm text-[#3E2920] leading-relaxed">
              {product.focus}
            </p>
          </div>

          {/* Laser note if acid */}
          {product.laserNote && (
            <div className="rounded-2xl bg-rose-50/75 border border-rose-200 p-3.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-800">
                <AlertTriangle className="w-4 h-4" />
                Depilação a Laser
              </div>
              <p className="mt-1 text-xs text-rose-900 leading-relaxed">
                {product.laserNote}
              </p>
            </div>
          )}
        </div>

        {/* Footer button */}
        <div className="px-5 py-3.5 border-t border-[#F2E8DF] bg-[#FBF7F2]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-[#5A2C1C] hover:bg-[#3D1C11] text-white font-semibold text-sm transition-colors cursor-pointer"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
