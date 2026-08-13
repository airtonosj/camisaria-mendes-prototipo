import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { buildRoute } from "../App";
import { createInfinitePayCheckout, createOrderInApi } from "../api";
import type { PrivateCampaign, ShirtColorOption, ShirtModelName, SizeCode, VariantArtwork } from "../data";
import { defaultCampaignColors, defaultCampaignSizes, shirtModels, sizeCatalog, sizeGroupLabels } from "../data";
import { Brand } from "./Brand";
import { ShirtMockupPreview } from "./ShirtMockupPreview";

type CampaignStep = "model" | "details" | "payment" | "received";

type CartItem = {
  variantId: number;
  modelName: ShirtModelName;
  color: ShirtColorOption;
  size: SizeCode;
  quantity: number;
  unitPriceCents: number;
};

type MeasurementRow = { size: string; [measurement: string]: string };
type MeasurementColumn = { key: string; label: string };

const standardMeasurements: MeasurementRow[] = [
  { size: "P", length: "67", width: "46,5", shoulder: "38" },
  { size: "M", length: "72", width: "49,5", shoulder: "42,5" },
  { size: "G", length: "77", width: "54", shoulder: "45" },
  { size: "GG", length: "78", width: "59", shoulder: "48" },
  { size: "EXGG", length: "80,5", width: "67", shoulder: "55" },
];

const babyLookMeasurements: MeasurementRow[] = [
  { size: "PB", length: "57", width: "45", shoulder: "31", waist: "39" },
  { size: "MB", length: "61,5", width: "47,5", shoulder: "34", waist: "42,5" },
  { size: "GB", length: "64", width: "51", shoulder: "38", waist: "45" },
];

const oversizedMeasurements: MeasurementRow[] = [
  { size: "PP", width: "51,4", length: "73,8", sleeve: "21" },
  { size: "P", width: "54,4", length: "76,3", sleeve: "22,5" },
  { size: "M", width: "57,4", length: "78,8", sleeve: "24" },
  { size: "G", width: "60,4", length: "81,3", sleeve: "25,5" },
  { size: "GG", width: "63,4", length: "83,8", sleeve: "27" },
  { size: "XG", width: "66,4", length: "86,3", sleeve: "28,5" },
];

const standardColumns: MeasurementColumn[] = [
  { key: "length", label: "Comprimento" },
  { key: "width", label: "Largura" },
  { key: "shoulder", label: "Ombro" },
];

const babyLookColumns: MeasurementColumn[] = [
  ...standardColumns,
  { key: "waist", label: "Cintura" },
];

const oversizedColumns: MeasurementColumn[] = [
  { key: "width", label: "Largura" },
  { key: "length", label: "Comprimento" },
  { key: "sleeve", label: "Manga" },
];

const sizeGroupOf = new Map(sizeCatalog.map((item) => [item.code, item.group]));

function campaignModels(campaign: PrivateCampaign) {
  if (campaign.models?.length) {
    return shirtModels.filter((model) => campaign.models?.includes(model.name));
  }
  if (campaign.variantIds) {
    return shirtModels.filter((model) => Object.keys(campaign.variantIds?.[model.name] ?? {}).length > 0);
  }
  // Compatibilidade somente com campanhas demonstrativas salvas antes deste campo existir.
  return shirtModels;
}

function campaignSizes(campaign: PrivateCampaign, model: ShirtModelName) {
  const allowed = new Set(defaultCampaignSizes[model]);
  const configured = campaign.sizes?.[model]?.filter((size) => allowed.has(size));
  if (campaign.models || campaign.variantIds) return configured ?? [];
  return configured?.length ? configured : defaultCampaignSizes[model];
}

function campaignColors(campaign: PrivateCampaign, model: ShirtModelName) {
  const configured = campaign.colors?.[model];
  if (campaign.models || campaign.variantIds) return configured ?? [];
  return configured?.length ? configured : defaultCampaignColors[model];
}

function cartStorageKey(campaignCode: string) {
  return `camisaria-cart:${campaignCode}`;
}

function itemKey(item: Pick<CartItem, "variantId" | "size">) {
  return `${item.variantId}:${item.size}`;
}

function artworkForVariant(campaign: PrivateCampaign, variantId: number): VariantArtwork {
  return campaign.variantArtworks?.[variantId] ?? {
    front: campaign.art.front ? { url: campaign.art.front, transform: campaign.art.frontTransform ?? { x: 0, y: 0, scale: 1, rotation: 0 } } : null,
    back: campaign.art.back ? { url: campaign.art.back, transform: campaign.art.backTransform ?? { x: 0, y: 0, scale: 1, rotation: 0 } } : null,
  };
}

function readCart(campaign: PrivateCampaign): CartItem[] {
  try {
    const raw = sessionStorage.getItem(cartStorageKey(campaign.code));
    if (!raw) return [];
    const stored = JSON.parse(raw);
    if (!Array.isArray(stored)) return [];
    const validated: CartItem[] = [];
    const availableModels = campaignModels(campaign);
    for (const candidate of stored) {
      const modelName = candidate?.modelName as ShirtModelName;
      if (!availableModels.some((model) => model.name === modelName)) continue;
      const color = campaignColors(campaign, modelName).find((option) => option.name === candidate?.color?.name);
      const size = candidate?.size as SizeCode;
      const variantId = campaign.variantIds?.[modelName]?.[color?.name ?? ""];
      const quantity = Number(candidate?.quantity);
      if (!color || !campaignSizes(campaign, modelName).includes(size)) continue;
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) continue;
      if (!variantId && !import.meta.env.DEV) continue;
      validated.push({
        variantId: variantId ?? Number(candidate.variantId),
        modelName,
        color,
        size,
        quantity,
        unitPriceCents: Math.round(campaign.prices[modelName] * 100),
      });
    }
    return validated.slice(0, 10);
  } catch {
    return [];
  }
}

function formatCents(value: number) {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function MeasurementTable({ title, columns, rows }: { title: string; columns: MeasurementColumn[]; rows: MeasurementRow[] }) {
  return (
    <section className="campaign-measurement-card" aria-labelledby={`measurement-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <h4 id={`measurement-${title.toLowerCase().replace(/\s/g, "-")}`}>{title}</h4>
      <div className="campaign-measurement-scroll">
        <table>
          <thead><tr><th scope="col">Tamanho</th>{columns.map((column) => <th scope="col" key={column.key}>{column.label}<small>cm</small></th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.size}><th scope="row">{row.size}</th>{columns.map((column) => <td key={column.key}>{row[column.key]}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function SizeGuide({ model, open, onClose }: { model: ShirtModelName; open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [guideModel, setGuideModel] = useState<ShirtModelName>(model);
  const showOversized = guideModel === "Oversized";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (open) setGuideModel(model);
  }, [model, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  return (
    <dialog
      className="campaign-size-guide"
      id="campaign-size-guide-table"
      ref={dialogRef}
      aria-labelledby="campaign-size-guide-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <header><span className="material-symbols-rounded" aria-hidden="true">straighten</span><div><h3 id="campaign-size-guide-title">Guia de medidas</h3><p>Compare com uma camiseta sua estendida sobre uma superfície plana.</p></div><button type="button" aria-label="Fechar guia de medidas" onClick={onClose}><span className="material-symbols-rounded" aria-hidden="true">close</span></button></header>
      <div className="campaign-size-guide-tabs" role="tablist" aria-label="Modelagem da camiseta">
        <button id="size-guide-common-tab" type="button" role="tab" aria-selected={!showOversized} aria-controls="size-guide-measurements" className={!showOversized ? "is-active" : ""} onClick={() => setGuideModel("Comum")}>Tradicional e Baby look</button>
        <button id="size-guide-oversized-tab" type="button" role="tab" aria-selected={showOversized} aria-controls="size-guide-measurements" className={showOversized ? "is-active" : ""} onClick={() => setGuideModel("Oversized")}>Oversized</button>
      </div>
      <div className={`campaign-measurement-grid${showOversized ? " is-single" : ""}`} id="size-guide-measurements" role="tabpanel" aria-labelledby={showOversized ? "size-guide-oversized-tab" : "size-guide-common-tab"}>
        {showOversized ? (
          <MeasurementTable title="Oversized" columns={oversizedColumns} rows={oversizedMeasurements} />
        ) : (
          <>
            <MeasurementTable title="Tradicional" columns={standardColumns} rows={standardMeasurements} />
            <MeasurementTable title="Baby look" columns={babyLookColumns} rows={babyLookMeasurements} />
          </>
        )}
      </div>
      {!showOversized && <p className="campaign-measurement-tolerance">As medidas da Tradicional e Baby look podem variar até 2,5 cm.</p>}
    </dialog>
  );
}

/** Mostra a primeira combinação do carrinho; campanhas antigas mantêm a imagem completa. */
function ArtThumbs({ campaign, label, items }: { campaign: PrivateCampaign; label: string; items: CartItem[] }) {
  if (items.length > 0 && campaign.presentation?.mockupEnabled === false && campaign.presentation.realPhotosEnabled) return (
    <div className={`campaign-art-thumbs campaign-art-thumbs--variants ${items.length === 1 ? "is-single" : ""}`} aria-label="Fotos reais das camisas selecionadas">
      {items.map((item) => {
        const photo = campaign.realPhotos?.[item.color.name]?.[0];
        return photo ? <img key={itemKey(item)} src={photo} alt={`${label} — ${item.modelName}, ${item.color.name}`} /> : null;
      })}
    </div>
  );
  if (items.length > 0 && campaign.art.mode !== "legacy_mockup") return (
    <div className={`campaign-art-thumbs campaign-art-thumbs--variants ${items.length === 1 ? "is-single" : ""}`} aria-label="Camisas selecionadas">
      {items.map((item) => {
        const artwork = artworkForVariant(campaign, item.variantId);
        const side = artwork.front ? "front" : "back";
        if (!artwork[side]) return null;
        return <ShirtMockupPreview key={itemKey(item)} model={item.modelName} color={item.color} art={campaign.art} artwork={artwork} side={side} label={`${label} — ${item.modelName}, ${item.color.name}`} compact />;
      })}
    </div>
  );
  return (
    <div className={`campaign-art-thumbs ${campaign.art.back ? "" : "is-single"}`} aria-label={campaign.art.back ? "Arte de frente e costas" : "Arte da campanha"}>
      <img src={campaign.art.front} alt={`${label} — frente`} />
      {campaign.art.back && <img src={campaign.art.back} alt={`${label} — costas`} />}
    </div>
  );
}

function CartLines({ items, editable = false, onQuantity, onRemove }: {
  items: CartItem[];
  editable?: boolean;
  onQuantity?: (key: string, quantity: number) => void;
  onRemove?: (key: string) => void;
}) {
  return (
    <div className="campaign-cart-lines">
      {items.map((item) => {
        const key = itemKey(item);
        return (
          <article className="campaign-cart-line" key={key}>
            <i className="campaign-cart-color" style={{ backgroundColor: item.color.hex }} />
            <div className="campaign-cart-copy">
              <strong>{item.modelName} · {item.color.name} · {item.size}</strong>
              <small>{formatCents(item.unitPriceCents)} por unidade</small>
            </div>
            {editable ? (
              <div className="campaign-cart-controls" aria-label={`Quantidade de ${item.modelName}, ${item.color.name}, tamanho ${item.size}`}>
                <button type="button" aria-label="Diminuir quantidade" onClick={() => onQuantity?.(key, item.quantity - 1)}>−</button>
                <output>{item.quantity}</output>
                <button type="button" aria-label="Aumentar quantidade" onClick={() => onQuantity?.(key, item.quantity + 1)}>+</button>
              </div>
            ) : <span className="campaign-cart-quantity">{item.quantity}×</span>}
            <b>{formatCents(item.unitPriceCents * item.quantity)}</b>
            {editable && <button className="campaign-cart-remove" type="button" onClick={() => onRemove?.(key)}>Remover</button>}
          </article>
        );
      })}
    </div>
  );
}

export function PrivateCampaignPage({ campaign, resumePayment }: { campaign: PrivateCampaign; resumePayment?: string }) {
  const initialModel = campaignModels(campaign)[0]?.name ?? shirtModels[0].name;
  const mockupEnabled = campaign.presentation?.mockupEnabled ?? true;
  const realPhotosEnabled = campaign.presentation?.realPhotosEnabled ?? false;
  const [step, setStep] = useState<CampaignStep>(resumePayment ? "payment" : "model");
  const [model, setModel] = useState<ShirtModelName>(initialModel);
  const [previewSide, setPreviewSide] = useState<"front" | "back">("front");
  const [previewMode, setPreviewMode] = useState<"mockup" | "real">(mockupEnabled ? "mockup" : "real");
  const [realPhotoIndex, setRealPhotoIndex] = useState(0);
  const [color, setColor] = useState(() => campaignColors(campaign, initialModel)[0]?.name ?? "");
  const [size, setSize] = useState<SizeCode>(() => campaignSizes(campaign, initialModel)[0] ?? "M");
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<CartItem[]>(() => readCart(campaign));
  const [cartMessage, setCartMessage] = useState("");
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [orderCopied, setOrderCopied] = useState(false);
  const [orderNumber, setOrderNumber] = useState(resumePayment ?? "");
  const [paymentError, setPaymentError] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const idempotency = useRef({ signature: "", key: "" });
  const availableModels = useMemo(() => campaignModels(campaign), [campaign]);

  /**
   * A campanha local pode aparecer por um instante enquanto a API carrega. Quando chega
   * a configuração persistida (inclusive após uma edição), troca o corte selecionado e
   * remove do carrinho qualquer opção que já não esteja à venda.
   */
  useEffect(() => {
    const firstAvailable = availableModels[0]?.name;
    if (!firstAvailable) return;
    if (!availableModels.some((item) => item.name === model)) {
      setModel(firstAvailable);
      setColor(campaignColors(campaign, firstAvailable)[0]?.name ?? "");
      setSize(campaignSizes(campaign, firstAvailable)[0] ?? "M");
    }
    setCart((current) => current.flatMap((item) => {
      if (!availableModels.some((available) => available.name === item.modelName)) return [];
      const variantId = campaign.variantIds?.[item.modelName]?.[item.color.name];
      const stillAvailable = campaignColors(campaign, item.modelName).some((option) => option.name === item.color.name)
        && campaignSizes(campaign, item.modelName).includes(item.size)
        && (Boolean(variantId) || import.meta.env.DEV && !campaign.variantIds);
      if (!stillAvailable) return [];
      return [{
        ...item,
        variantId: variantId ?? item.variantId,
        unitPriceCents: Math.round(campaign.prices[item.modelName] * 100),
      }];
    }));
  }, [availableModels, campaign, model]);

  useEffect(() => {
    if (cart.length) sessionStorage.setItem(cartStorageKey(campaign.code), JSON.stringify(cart));
    else sessionStorage.removeItem(cartStorageKey(campaign.code));
  }, [campaign.code, cart]);

  const selectedModel = availableModels.find((item) => item.name === model) ?? availableModels[0] ?? shirtModels[0];
  const activeModel = selectedModel.name;
  const availableColors = campaignColors(campaign, activeModel);
  const selectedColor = availableColors.find((item) => item.name === color) ?? availableColors[0];
  const availableSizes = campaignSizes(campaign, activeModel);
  const sizeGroups = useMemo(() => {
    const groups: Array<{ group: "standard" | "baby_look"; sizes: SizeCode[] }> = [];
    for (const group of ["standard", "baby_look"] as const) {
      const sizes = availableSizes.filter((item) => sizeGroupOf.get(item) === group);
      if (sizes.length) groups.push({ group, sizes });
    }
    return groups;
  }, [availableSizes]);

  const art = campaign.art;
  const selectedVariantId = campaign.variantIds?.[activeModel]?.[selectedColor.name] ?? 0;
  const selectedArtwork = artworkForVariant(campaign, selectedVariantId);
  const selectedRealPhotos = campaign.realPhotos?.[selectedColor.name] ?? [];
  const canShowBack = Boolean(selectedArtwork.back);
  const unitPriceCents = Math.round(campaign.prices[activeModel] * 100);
  const cartTotal = cart.reduce((total, item) => total + item.unitPriceCents * item.quantity, 0);
  const cartUnits = cart.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    if (!selectedArtwork[previewSide]) setPreviewSide(selectedArtwork.front ? "front" : "back");
  }, [selectedVariantId, selectedArtwork.front?.url, selectedArtwork.back?.url, previewSide]);

  useEffect(() => {
    setRealPhotoIndex(0);
    if (!mockupEnabled) setPreviewMode("real");
    else if (!realPhotosEnabled || !selectedRealPhotos.length) setPreviewMode("mockup");
  }, [selectedColor.name, selectedRealPhotos.length, mockupEnabled, realPhotosEnabled]);

  function selectModel(nextModel: ShirtModelName) {
    setModel(nextModel);
    setColor(campaignColors(campaign, nextModel)[0].name);
    const nextSizes = campaignSizes(campaign, nextModel);
    if (!nextSizes.includes(size)) setSize(nextSizes[0]);
    setCartMessage("");
  }

  function goToStep(nextStep: CampaignStep) {
    setStep(nextStep);
    setOrderCopied(false);
    setPaymentError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addSelection() {
    const persistedVariantId = selectedVariantId;
    if (!persistedVariantId && !import.meta.env.DEV) {
      setCartMessage("Esta combinação não está disponível. Escolha outra opção ou fale com o representante da turma.");
      return false;
    }
    const fallbackVariantId = -((shirtModels.findIndex((item) => item.name === activeModel) + 1) * 100 + availableColors.findIndex((item) => item.name === selectedColor.name) + 1);
    const nextItem: CartItem = { variantId: persistedVariantId ?? fallbackVariantId, modelName: activeModel, color: selectedColor, size, quantity, unitPriceCents };
    const key = itemKey(nextItem);
    const existing = cart.find((item) => itemKey(item) === key);
    if (!existing && cart.length >= 10) {
      setCartMessage("O carrinho aceita até 10 combinações diferentes por pedido.");
      return false;
    }
    if (existing && existing.quantity + quantity > 20) {
      setCartMessage("Cada combinação pode ter no máximo 20 unidades.");
      return false;
    }
    setCart((current) => existing
      ? current.map((item) => itemKey(item) === key ? { ...item, quantity: item.quantity + quantity } : item)
      : [...current, nextItem]);
    setCartMessage(`${selectedModel.name}, ${selectedColor.name}, tamanho ${size} adicionado ao carrinho.`);
    setQuantity(1);
    return true;
  }

  function submitConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addSelection();
  }

  function updateCartQuantity(key: string, nextQuantity: number) {
    if (nextQuantity < 1) {
      setCart((current) => current.filter((item) => itemKey(item) !== key));
      return;
    }
    setCart((current) => current.map((item) => itemKey(item) === key ? { ...item, quantity: Math.min(20, nextQuantity) } : item));
  }

  function submitCustomerDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length) return goToStep("model");
    goToStep("payment");
  }

  function currentIdempotencyKey() {
    const signature = JSON.stringify({ customerName, customerPhone, customerEmail, items: cart.map(({ variantId, size, quantity }) => ({ variantId, size, quantity })) });
    if (idempotency.current.signature !== signature) {
      idempotency.current = { signature, key: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}` };
    }
    return idempotency.current.key;
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaymentError("");
    setSubmittingOrder(true);
    try {
      if (resumePayment) {
        const checkout = await createInfinitePayCheckout(resumePayment, customerPhone);
        window.location.assign(checkout.url);
        return;
      }
      if (!cart.length) throw new Error("Seu carrinho está vazio.");
      if (cart.some((item) => item.variantId < 1)) {
        if (import.meta.env.DEV) {
          setSimulated(true);
          setOrderNumber("CM-DEMO-0000");
          goToStep("received");
          return;
        }
        throw new Error("Uma das combinações não está mais disponível nesta campanha.");
      }
      const created = await createOrderInApi({
        campaignCode: campaign.code,
        customer: { name: customerName, whatsapp: customerPhone, email: customerEmail },
        items: cart.map(({ variantId, size: itemSize, quantity: itemQuantity }) => ({ variantId, size: itemSize, quantity: itemQuantity })),
        idempotencyKey: currentIdempotencyKey(),
      });
      setOrderNumber(created.number);
      const checkout = await createInfinitePayCheckout(created.number, customerPhone);
      sessionStorage.removeItem(cartStorageKey(campaign.code));
      setCart([]);
      window.location.assign(checkout.url);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Não foi possível registrar o pedido.");
    } finally {
      setSubmittingOrder(false);
    }
  }

  async function copyOrderNumber() {
    try {
      await navigator.clipboard.writeText(orderNumber);
      setOrderCopied(true);
    } catch {
      setOrderCopied(false);
    }
  }

  return (
    <div className="private-campaign-page">
      <header className="campaign-shop-header">
        <div className="campaign-shop-header-inner">
          <a className="campaign-back" href="./" aria-label="Voltar ao site"><span className="material-symbols-rounded" aria-hidden="true">arrow_back</span></a>
          <Brand compact />
          <div className="campaign-private-meta"><span><span className="material-symbols-rounded" aria-hidden="true">lock</span>Campanha privada</span><small>{campaign.deadline}</small></div>
        </div>
      </header>

      {step === "model" ? (
        <main className="campaign-builder">
          <section className="campaign-builder-heading">
            <h1>{campaign.title}</h1>
            <div className="campaign-progress-copy"><strong>1 de 3</strong><span>·</span><span>Monte seu pedido</span></div>
            <div className="campaign-progress" aria-hidden="true"><span /></div>
          </section>
          <form className="campaign-configurator" onSubmit={submitConfiguration}>
            <section className="campaign-art-stage">
              {mockupEnabled && realPhotosEnabled && selectedRealPhotos.length > 0 && <div className="campaign-visual-switch" role="group" aria-label="Tipo de visualizacao da camisa"><button className={previewMode === "mockup" ? "is-active" : ""} type="button" aria-pressed={previewMode === "mockup"} onClick={() => setPreviewMode("mockup")}><span className="material-symbols-rounded" aria-hidden="true">checkroom</span>Mockup</button><button className={previewMode === "real" ? "is-active" : ""} type="button" aria-pressed={previewMode === "real"} onClick={() => setPreviewMode("real")}><span className="material-symbols-rounded" aria-hidden="true">photo_camera</span>Fotos reais</button></div>}
              {previewMode === "mockup" && (selectedArtwork.front && selectedArtwork.back || canShowBack && !selectedArtwork.front) && <div className="campaign-side-switch" role="group" aria-label="Visualizar lado da camiseta"><button className={previewSide === "front" ? "is-active" : ""} type="button" disabled={!selectedArtwork.front} aria-pressed={previewSide === "front"} onClick={() => setPreviewSide("front")}>Frente</button><button className={previewSide === "back" ? "is-active" : ""} type="button" disabled={!selectedArtwork.back} aria-pressed={previewSide === "back"} onClick={() => setPreviewSide("back")}>Costas</button></div>}
              <div className="campaign-art-viewer">
                {previewMode === "real" && selectedRealPhotos.length > 0 ? (
                  <img className="campaign-real-photo-main" src={selectedRealPhotos[realPhotoIndex] ?? selectedRealPhotos[0]} alt={`Foto real da camisa ${selectedColor.name}, imagem ${realPhotoIndex + 1}`} />
                ) : (
                  <ShirtMockupPreview
                  model={activeModel}
                  color={selectedColor}
                  art={art}
                  artwork={selectedArtwork}
                  side={previewSide}
                  label={`${selectedModel.name === "Comum" ? "Padrão" : selectedModel.name}, ${selectedColor.name}, ${previewSide === "front" ? "frente" : "costas"}`}
                  />
                )}
              </div>
              {previewMode === "real" && selectedRealPhotos.length > 1 && <div className="campaign-real-photo-thumbnails" role="group" aria-label={`Fotos reais da cor ${selectedColor.name}`}>{selectedRealPhotos.map((photo, index) => <button className={realPhotoIndex === index ? "is-active" : ""} type="button" aria-pressed={realPhotoIndex === index} onClick={() => setRealPhotoIndex(index)} key={photo}><img src={photo} alt="" /><span>{index + 1}</span></button>)}</div>}
              <p className="campaign-art-note">{previewMode === "real" ? `Foto real da camisa ${selectedColor.name}.` : art.mode === "legacy_mockup" ? "Imagem preservada da campanha original." : `${selectedModel.name === "Comum" ? "Padrão" : selectedModel.name} · ${selectedColor.name} · ${previewSide === "front" ? "Frente" : "Costas"}`}</p>
              {cart.length > 0 && (
                <section className="campaign-cart-preview" aria-labelledby="cart-preview-title">
                  <header>
                    <div><h2 id="cart-preview-title">Seu carrinho</h2><span>{cartUnits} {cartUnits === 1 ? "peça" : "peças"}</span></div>
                    <button type="button" onClick={() => setCart([])}>Limpar</button>
                  </header>
                  <CartLines items={cart} editable onQuantity={updateCartQuantity} onRemove={(key) => setCart((current) => current.filter((item) => itemKey(item) !== key))} />
                  <footer className="campaign-cart-summary">
                    <div><span>Total</span><strong>{formatCents(cartTotal)}</strong></div>
                    <button type="button" onClick={() => goToStep("details")}>Revisar pedido</button>
                  </footer>
                </section>
              )}
            </section>
            <section className="campaign-choice-stage campaign-cut-stage">
              <h2>1. Escolha o corte</h2>
              <div className="campaign-cut-options" role="radiogroup" aria-label="Corte da camiseta">{availableModels.map((item) => <label className={activeModel === item.name ? "is-selected" : ""} key={item.name}><input type="radio" name="model" checked={activeModel === item.name} onChange={() => selectModel(item.name)} /><span className="campaign-cut-head"><strong>{item.name === "Comum" ? "Padrão" : item.name}</strong><span className="campaign-cut-check material-symbols-rounded" aria-hidden="true">check</span></span><small>{item.description}</small><b>{formatCents(Math.round(campaign.prices[item.name] * 100))}</b></label>)}</div>
            </section>
            <section className="campaign-choice-stage campaign-color-stage">
              <div className="campaign-stage-heading"><h2>2. Escolha a cor</h2><span>{availableColors.length} {availableColors.length === 1 ? "opção" : "opções"}</span></div>
              <div className="campaign-color-options" role="radiogroup" aria-label={`Cor da camiseta ${selectedModel.name}`}>{availableColors.map((item) => <label className={selectedColor.name === item.name ? "is-selected" : ""} key={item.name}><input type="radio" name="color" checked={selectedColor.name === item.name} onChange={() => { setColor(item.name); setCartMessage(""); }} /><i style={{ backgroundColor: item.hex }} /><span>{item.name}</span><span className="material-symbols-rounded" aria-hidden="true">check</span></label>)}</div>
              <p className="campaign-color-note">A arte permanece fixa; a cor escolhida será aplicada à peça.</p>
            </section>
            <section className="campaign-choice-stage campaign-size-stage" id="size-guide">
              <div className="campaign-stage-heading"><h2>3. Escolha o tamanho</h2><button type="button" aria-expanded={showSizeGuide} aria-controls="campaign-size-guide-table" onClick={() => setShowSizeGuide((value) => !value)}>{showSizeGuide ? "Fechar tabela" : "Qual o meu tamanho?"}</button></div>
              {sizeGroups.map(({ group, sizes }) => {
                const groupLabel = activeModel === "Oversized" ? "Oversized" : sizeGroupLabels[group];
                return <div className="campaign-size-group" key={group}><p className="campaign-size-group-label">{groupLabel}</p><div className="campaign-size-options" role="radiogroup" aria-label={`Tamanho ${groupLabel}`}>{sizes.map((item) => <label className={size === item ? "is-selected" : ""} key={item}><input type="radio" name="size" checked={size === item} onChange={() => { setSize(item); setCartMessage(""); }} /><span>{item}</span></label>)}</div></div>;
              })}
              <SizeGuide model={activeModel} open={showSizeGuide} onClose={() => setShowSizeGuide(false)} />
            </section>
            <section className="campaign-choice-stage campaign-quantity-stage"><h2>4. Quantidade</h2><div className="campaign-quantity-picker"><button type="button" aria-label="Diminuir quantidade" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><output aria-live="polite">{quantity}</output><button type="button" aria-label="Aumentar quantidade" onClick={() => setQuantity((value) => Math.min(20, value + 1))}>+</button></div></section>
            {cartMessage && <p className={`campaign-order-notice${cartMessage.includes("adicionado") ? "" : " is-error"}`} role="status" aria-live="polite"><span className="material-symbols-rounded" aria-hidden="true">{cartMessage.includes("adicionado") ? "check_circle" : "error"}</span>{cartMessage}</p>}
            <aside className="campaign-order-bar">
              <div className="campaign-order-actions"><button type="submit">Adicionar</button></div>
            </aside>
          </form>
        </main>
      ) : step === "details" ? (
        <main className="campaign-checkout">
          <section className="campaign-checkout-heading"><h1>Revise e identifique</h1><div className="campaign-progress-copy"><strong>2 de 3</strong><span>·</span><span>Seus dados</span></div><div className="campaign-progress campaign-progress--details" aria-hidden="true"><span /></div></section>
          <form className="campaign-customer-form" onSubmit={submitCustomerDetails}>
            <section className="checkout-order-review" aria-labelledby="order-review-title"><h2 id="order-review-title">Seu pedido</h2><div className="checkout-product-row"><ArtThumbs campaign={campaign} label={`Camisa da campanha ${campaign.title}`} items={cart} /><div className="checkout-product-copy"><CartLines items={cart} /><div className="checkout-pickup"><span className="material-symbols-rounded" aria-hidden="true">person</span><span>Retirada com <b>{campaign.representative}</b></span></div><div className="checkout-total"><span>{cartUnits} {cartUnits === 1 ? "peça" : "peças"} · Total</span><strong>{formatCents(cartTotal)}</strong></div></div></div><button className="checkout-edit" type="button" onClick={() => goToStep("model")}>Editar carrinho</button></section>
            <section className="checkout-customer-fields" aria-labelledby="customer-fields-title"><h2 id="customer-fields-title">Quem vai retirar?</h2><label><span className="sr-only">Nome completo</span><input name="name" type="text" placeholder="Nome completo" autoComplete="name" minLength={3} value={customerName} onChange={(event) => setCustomerName(event.target.value)} required /></label><label><span className="sr-only">WhatsApp</span><input name="phone" type="tel" placeholder="WhatsApp" autoComplete="tel" inputMode="tel" minLength={10} value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} required /></label><label><span className="sr-only">E-mail</span><input name="email" type="email" placeholder="E-mail para confirmação" autoComplete="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} required /></label><p className="checkout-privacy"><span className="material-symbols-rounded" aria-hidden="true">lock</span><span>Seus dados serão usados para processar e acompanhar o pedido. <a href={buildRoute("politica-privacidade")} target="_blank">Leia a política de privacidade.</a></span></p></section>
            <button className="checkout-payment-button" type="submit">Ir para pagamento<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
          </form>
        </main>
      ) : step === "payment" ? (
        <main className="campaign-payment">
          <section className="campaign-payment-heading"><h1>Pagamento seguro</h1><div className="campaign-progress-copy"><strong>3 de 3</strong><span>·</span><span>Pagamento</span></div><div className="campaign-progress campaign-progress--payment" aria-hidden="true"><span /></div></section>
          {!resumePayment && <section className="payment-order-summary" aria-label="Resumo do pedido"><ArtThumbs campaign={campaign} label={`Camisa da campanha ${campaign.title}`} items={cart} /><div className="payment-order-copy"><strong>{cartUnits} {cartUnits === 1 ? "peça" : "peças"} em {cart.length} {cart.length === 1 ? "combinação" : "combinações"}</strong><b>{formatCents(cartTotal)}</b><button type="button" onClick={() => goToStep("details")}>Revisar pedido</button></div></section>}
          <form className="payment-form" onSubmit={submitPayment}>
            {resumePayment && <p className="payment-resume-note"><span className="material-symbols-rounded" aria-hidden="true">replay</span>Retomando o pagamento do pedido <strong>#{resumePayment}</strong>.</p>}
            <div className="payment-provider-choice"><span className="material-symbols-rounded" aria-hidden="true">verified_user</span><div><h2>Checkout InfinitePay</h2><p>Você escolherá Pix ou cartão no ambiente seguro da InfinitePay.</p></div></div>
            {!resumePayment && <dl className="payment-breakdown"><div><dt>{cartUnits} {cartUnits === 1 ? "peça" : "peças"}</dt><dd>{formatCents(cartTotal)}</dd></div><div><dt>Taxa</dt><dd>R$ 0,00</dd></div><div className="payment-breakdown-total"><dt>Total</dt><dd>{formatCents(cartTotal)}</dd></div></dl>}
            <p className="payment-security"><span className="material-symbols-rounded" aria-hidden="true">lock</span>Os dados do cartão e o Pix não passam pelo site da camisaria. A forma realmente utilizada será registrada após a confirmação da InfinitePay.</p>
            {paymentError && <p className="form-error" role="alert">{paymentError}</p>}
            <button className="payment-submit" type="submit" disabled={submittingOrder}>{submittingOrder ? "Abrindo checkout..." : "Ir para pagamento seguro"}<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
          </form>
        </main>
      ) : (
        <main className="campaign-received">
          <section className="received-hero"><span className="received-hero-icon material-symbols-rounded" aria-hidden="true">schedule</span><p className="received-eyebrow">Pedido recebido</p><h1>Aguardando a confirmação do pagamento.</h1><p className="received-intro">Seu pedido está guardado como pendente. Ele será liberado somente depois que a InfinitePay confirmar o pagamento.</p><span className="received-status"><span className="material-symbols-rounded" aria-hidden="true">hourglass_top</span>Aguardando confirmação</span></section>
          {simulated && <p className="received-simulation" role="status"><span className="material-symbols-rounded" aria-hidden="true">science</span>Pedido simulado em desenvolvimento. Nada foi gravado no banco e este número não existe.</p>}
          <section className="received-payment-panel"><header><span className="material-symbols-rounded" aria-hidden="true">verified_user</span><div><h2>Pagamento seguro pela InfinitePay</h2><p>Pix ou cartão serão vinculados ao número do pedido e confirmados automaticamente.</p></div></header><dl className="received-payment-summary"><div><dt>Forma de pagamento</dt><dd>Escolhida na InfinitePay</dd></div><div><dt>Valor</dt><dd>{formatCents(cartTotal)}</dd></div><div><dt>Pedido</dt><dd>#{orderNumber}</dd></div></dl></section>
          <div className="received-content"><section className="received-order-card"><header><div><small>Número do pedido</small><h2>#{orderNumber}</h2></div><button type="button" onClick={copyOrderNumber}><span className="material-symbols-rounded" aria-hidden="true">content_copy</span>Copiar</button></header><div className="received-product-row"><ArtThumbs campaign={campaign} label={`Camisa da campanha ${campaign.title}`} items={cart} /><div className="received-product-copy"><CartLines items={cart} /><dl><div><dt>Total</dt><dd>{formatCents(cartTotal)}</dd></div></dl></div></div><p className="received-pickup"><span className="material-symbols-rounded" aria-hidden="true">person</span>Retirada com <strong>{campaign.representative}</strong></p></section><aside className="received-next-steps"><h2>Próximos passos</h2><ol><li className="is-complete"><span className="material-symbols-rounded" aria-hidden="true">check</span><div><strong>Pedido criado</strong><small>Seus dados e suas peças foram registrados.</small></div></li><li className="is-current"><span className="material-symbols-rounded" aria-hidden="true">payments</span><div><strong>Pagamento na InfinitePay</strong><small>Conclua pelo checkout seguro do provedor.</small></div></li><li><span className="material-symbols-rounded" aria-hidden="true">verified</span><div><strong>Confirmação automática</strong><small>A InfinitePay atualiza o pedido pela integração.</small></div></li><li><span className="material-symbols-rounded" aria-hidden="true">inventory_2</span><div><strong>Envio para produção</strong><small>Acontece somente depois da confirmação.</small></div></li></ol></aside></div>
          <div className="received-actions"><button className="received-copy-action" type="button" onClick={copyOrderNumber}>Copiar número do pedido<span className="material-symbols-rounded" aria-hidden="true">content_copy</span></button><a className="received-back-action" href={buildRoute("acompanhar-pedido", undefined, orderNumber)}>Acompanhar pedido</a><p className="received-copy-status" role="status" aria-live="polite">{orderCopied ? "Número do pedido copiado." : "Guarde este número para acompanhar seu pedido."}</p></div>
        </main>
      )}
    </div>
  );
}
