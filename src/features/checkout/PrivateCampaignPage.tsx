import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { buildRoute } from '../../navigation';
import { createInfinitePayCheckout, createOrderInApi, validateCampaignCoupon } from "../../api";
import type { CampaignCoupon } from "../../api";
import type { PrivateCampaign, ShirtModelName, SizeCode } from "../../data";
import { shirtModels, sizeGroupLabels } from "../../data";
import { CampaignDeliveryInfo } from "../../components/CampaignDeliveryInfo";
import { Brand } from "../../components/Brand";
import { ContactInput } from "../../components/ContactInput";
import { normalizeCustomerEmail, parseWhatsapp } from "../../../shared/contact.mjs";
import { ShirtMockupPreview } from "../../components/ShirtMockupPreview";
import { sizeGroupOf, campaignModels, campaignSizes, campaignColors, cartStorageKey, itemKey, allocateCartCouponDiscount, artworkForVariant, readCart, formatCents } from "./cart";
import type { CampaignStep, GalleryMedia, CartItem } from "./cart";
import { SizeGuide } from "./SizeGuide";
import { ArtThumbs, CartLines } from "./CartLines";

export function PrivateCampaignPage({ campaign, resumePayment, initialCouponCode }: { campaign: PrivateCampaign; resumePayment?: string; initialCouponCode?: string }) {
  const initialModel = campaignModels(campaign)[0]?.name ?? shirtModels[0].name;
  const mockupEnabled = campaign.presentation?.mockupEnabled ?? true;
  const realPhotosEnabled = campaign.presentation?.realPhotosEnabled ?? false;
  const [step, setStep] = useState<CampaignStep>(resumePayment ? "payment" : "model");
  const [model, setModel] = useState<ShirtModelName>(initialModel);
  const [previewSide, setPreviewSide] = useState<"front" | "back">("front");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [color, setColor] = useState(() => campaignColors(campaign, initialModel)[0]?.name ?? "");
  const [size, setSize] = useState<SizeCode>(() => campaignSizes(campaign, initialModel)[0] ?? "M");
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<CartItem[]>(() => readCart(campaign));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const cartDialog = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const dialog = cartDialog.current;
    if (drawerOpen && dialog && !dialog.open) dialog.showModal();
    if (!drawerOpen && dialog?.open) dialog.close();
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [drawerOpen]);
  const [cartMessage, setCartMessage] = useState("");
  const [couponInput, setCouponInput] = useState(initialCouponCode ?? "");
  const [appliedCoupon, setAppliedCoupon] = useState<CampaignCoupon | null>(null);
  const [couponMessage, setCouponMessage] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);
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
  const galleryTrack = useRef<HTMLDivElement | null>(null);
  const galleryDrag = useRef({ pointerId: -1, startX: 0, startScrollLeft: 0, dragging: false });
  const galleryVideo = useRef<HTMLVideoElement | null>(null);
  const availableModels = useMemo(() => campaignModels(campaign), [campaign]);

  useEffect(() => {
    if (!initialCouponCode || resumePayment) return;
    void applyCoupon(initialCouponCode);
    // O código inicial vem do link compartilhado; uma mudança de campanha deve validá-lo novamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.code, initialCouponCode, resumePayment]);

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
  const selectedRealVideo = campaign.realVideos?.[selectedColor.name];
  const selectedGalleryMedia: GalleryMedia[] = [];
  if (mockupEnabled) selectedGalleryMedia.push({ type: "mockup" });
  if (realPhotosEnabled && selectedRealVideo) selectedGalleryMedia.push({
    type: "video",
    url: selectedRealVideo.url,
    posterUrl: selectedRealVideo.posterUrl,
    durationSeconds: selectedRealVideo.durationSeconds,
  });
  if (realPhotosEnabled) selectedGalleryMedia.push(...selectedRealPhotos.map((url) => ({ type: "image" as const, url })));
  const selectedMedia = selectedGalleryMedia[galleryIndex] ?? selectedGalleryMedia[0];
  const selectedVideoUrl = selectedMedia?.type === "video" ? selectedMedia.url : null;
  const canShowBack = Boolean(selectedArtwork.back);
  const unitPriceCents = Math.round(campaign.prices[activeModel] * 100);
  const configuredCouponDiscountsByModel = Object.fromEntries(
    (appliedCoupon?.discounts ?? []).map((discount) => [discount.modelName, discount.discountCents]),
  ) as Partial<Record<ShirtModelName, number>>;
  const cartSubtotal = cart.reduce((total, item) => total + item.unitPriceCents * item.quantity, 0);
  const cartUnits = cart.reduce((total, item) => total + item.quantity, 0);
  const couponMinimumQuantity = appliedCoupon?.minimumQuantity ?? 1;
  const couponMaximumDiscountQuantity = appliedCoupon?.maximumDiscountQuantity ?? null;
  const couponEligible = !appliedCoupon || cartUnits >= couponMinimumQuantity;
  const couponMissingUnits = Math.max(0, couponMinimumQuantity - cartUnits);
  const couponDiscountsByModel = couponEligible ? configuredCouponDiscountsByModel : {};
  const couponAllocation = allocateCartCouponDiscount(cart, couponDiscountsByModel, couponMaximumDiscountQuantity);
  const cartDiscount = couponAllocation.discountCents;
  const cartTotal = cartSubtotal - cartDiscount;

  useEffect(() => {
    if (!selectedArtwork[previewSide]) setPreviewSide(selectedArtwork.front ? "front" : "back");
  }, [selectedArtwork, previewSide]);

  useEffect(() => {
    setGalleryIndex(0);
    galleryTrack.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [activeModel, selectedColor.name, selectedGalleryMedia.length, mockupEnabled, realPhotosEnabled]);

  useEffect(() => {
    const video = galleryVideo.current;
    if (!video) return;
    if (selectedMedia?.type === "video") {
      video.currentTime = 0;
      void video.play().catch(() => {
        // Alguns modos de economia de bateria ainda podem bloquear o autoplay.
      });
      return;
    }
    video.pause();
    video.currentTime = 0;
  }, [selectedMedia?.type, selectedVideoUrl]);

  useEffect(() => () => { galleryVideo.current?.pause(); }, [selectedColor.name, activeModel]);

  function goToGalleryItem(index: number) {
    const nextIndex = Math.max(0, Math.min(index, selectedGalleryMedia.length - 1));
    setGalleryIndex(nextIndex);
    const track = galleryTrack.current;
    if (track) track.scrollTo({ left: track.clientWidth * nextIndex, behavior: "smooth" });
  }

  function syncGalleryIndex() {
    const track = galleryTrack.current;
    if (!track?.clientWidth) return;
    setGalleryIndex(Math.max(0, Math.min(Math.round(track.scrollLeft / track.clientWidth), selectedGalleryMedia.length - 1)));
  }

  function startGalleryDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    galleryDrag.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: event.currentTarget.scrollLeft, dragging: false };
  }

  function moveGalleryDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = galleryDrag.current;
    if (drag.pointerId !== event.pointerId || !(event.buttons & 1)) return;
    const distance = event.clientX - drag.startX;
    if (!drag.dragging && Math.abs(distance) < 6) return;
    drag.dragging = true;
    event.preventDefault();
    event.currentTarget.classList.add("is-dragging");
    event.currentTarget.scrollLeft = drag.startScrollLeft - distance;
  }

  function finishGalleryDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = galleryDrag.current;
    if (drag.pointerId !== event.pointerId) return;
    event.currentTarget.classList.remove("is-dragging");
    if (drag.dragging && event.currentTarget.clientWidth) {
      goToGalleryItem(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth));
    }
    galleryDrag.current = { pointerId: -1, startX: 0, startScrollLeft: 0, dragging: false };
  }

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
    setDrawerOpen(true);
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

  function syncCouponInAddress(code?: string) {
    const address = new URL(window.location.href);
    if (code) address.searchParams.set("cupom", code);
    else address.searchParams.delete("cupom");
    window.history.replaceState({}, "", address);
  }

  async function applyCoupon(rawCode = couponInput) {
    const normalized = rawCode.trim().toUpperCase().replace(/\s+/g, "-");
    if (!normalized) {
      setCouponMessage("Digite o código do cupom.");
      return;
    }
    setCheckingCoupon(true);
    setCouponMessage("");
    try {
      const coupon = await validateCampaignCoupon(campaign.code, normalized);
      setAppliedCoupon(coupon);
      setCouponInput(coupon.code);
      setCouponMessage("");
      syncCouponInAddress(coupon.code);
    } catch (error) {
      setAppliedCoupon(null);
      setCouponMessage(error instanceof Error ? error.message : "Não foi possível aplicar o cupom.");
      syncCouponInAddress();
    } finally {
      setCheckingCoupon(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponMessage("Cupom removido.");
    syncCouponInAddress();
  }

  function submitCustomerDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerName.trim() || customerName.trim().length > 160 || parseWhatsapp(customerPhone).error || !normalizeCustomerEmail(customerEmail)) {
      event.currentTarget.reportValidity();
      return;
    }
    if (!cart.length) return goToStep("model");
    goToStep("payment");
  }

  function currentIdempotencyKey() {
    const signature = JSON.stringify({ customerName, customerPhone, customerEmail, couponCode: appliedCoupon?.code ?? null, items: cart.map(({ variantId, size, quantity }) => ({ variantId, size, quantity })) });
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
      if (!customerName.trim() || customerName.trim().length > 160) {
        goToStep("details");
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
        customer: { name: customerName.trim(), whatsapp: customerPhone, email: customerEmail },
        items: cart.map(({ variantId, size: itemSize, quantity: itemQuantity }) => ({ variantId, size: itemSize, quantity: itemQuantity })),
        couponCode: appliedCoupon?.code,
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

      {step === "model" && cartUnits > 0 && <button type="button" className="campaign-cart-launcher" aria-label={`Abrir carrinho, ${cartUnits} ${cartUnits === 1 ? "peça" : "peças"}`} aria-haspopup="dialog" onClick={() => setDrawerOpen(true)}><span className="material-symbols-rounded" aria-hidden="true">shopping_cart</span><span className="campaign-cart-badge" aria-hidden="true">{cartUnits}</span></button>}
      <dialog ref={cartDialog} className="campaign-drawer-dialog" aria-labelledby="campaign-drawer-title" onClose={() => setDrawerOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setDrawerOpen(false); }}>
        <section className="campaign-drawer-panel">
          <header className="campaign-drawer-header"><h2 id="campaign-drawer-title">Seu carrinho <span>({cartUnits})</span></h2><button type="button" aria-label="Fechar carrinho" onClick={() => setDrawerOpen(false)}><span className="material-symbols-rounded" aria-hidden="true">close</span></button></header>
          <div className="campaign-drawer-body">
            {cart.length > 0 ? <><p className="campaign-drawer-feedback" role="status"><span className="material-symbols-rounded" aria-hidden="true">check_circle</span>{cartMessage || `${cartUnits} ${cartUnits === 1 ? "peça selecionada" : "peças selecionadas"}`}</p>{cart.map((item) => { const key = itemKey(item); const discount = (couponDiscountsByModel[item.modelName] ?? 0) * (couponAllocation.discountedQuantitiesByItem[key] ?? 0); return <article className="campaign-drawer-item" key={key}><div className="campaign-drawer-photo"><ArtThumbs campaign={campaign} label="Camisa selecionada" items={[item]} /></div><div className="campaign-drawer-copy"><strong>{item.modelName === "Comum" ? "Padrão" : item.modelName}</strong><b>{formatCents(item.quantity * item.unitPriceCents - discount)}</b><dl><div><dt>Cor:</dt><dd><i style={{ background: item.color.hex }} />{item.color.name}</dd></div><div><dt>Tamanho:</dt><dd>{item.size}</dd></div></dl><div className="campaign-drawer-quantity" aria-label={`Quantidade de ${item.modelName}, ${item.color.name}, ${item.size}`}><span>Quantidade:</span><button type="button" aria-label="Diminuir quantidade no carrinho" onClick={() => updateCartQuantity(key,item.quantity-1)}>−</button><output>{item.quantity}</output><button type="button" aria-label="Aumentar quantidade no carrinho" onClick={() => updateCartQuantity(key,item.quantity+1)}>+</button></div><button type="button" className="campaign-drawer-remove" onClick={() => setCart((current) => current.filter((line) => itemKey(line) !== key))}>Remover</button></div></article>; })}</> : <div className="campaign-drawer-empty"><span className="material-symbols-rounded" aria-hidden="true">shopping_cart</span><h3>Seu carrinho está vazio</h3><p>Escolha corte, cor e tamanho para adicionar sua primeira peça.</p></div>}
          </div>
          {cart.length > 0 ?                   <footer className="campaign-drawer-footer">
                    {appliedCoupon && <><div className="campaign-discount-row"><span>Subtotal</span><b>{formatCents(cartSubtotal)}</b></div>{couponEligible ? <div className="campaign-discount-row is-saving"><span>Cupom {appliedCoupon.code}{couponMaximumDiscountQuantity ? ` · ${couponAllocation.discountedUnits} peças com desconto` : ""}</span><b>− {formatCents(cartDiscount)}</b></div> : <div className="campaign-discount-row"><span>Cupom {appliedCoupon.code} · a partir de {couponMinimumQuantity} peças</span><b>Faltam {couponMissingUnits}</b></div>}</>}
                    <div><span>Total</span><strong>{formatCents(cartTotal)}</strong></div>
                    <button type="button" disabled={Boolean(appliedCoupon && !couponEligible)} onClick={() => { setDrawerOpen(false); goToStep("details"); }}>Revisar pedido</button>
                  </footer> : null}
          <button type="button" className="campaign-drawer-continue" onClick={() => setDrawerOpen(false)}>Continuar escolhendo</button>
        </section>
      </dialog>

      {step === "model" ? (
        <main className="campaign-builder">
          <section className="campaign-builder-heading">
            <h1>{campaign.title}</h1>
            <div className="campaign-progress-copy"><strong>1 de 3</strong><span>·</span><span>Monte seu pedido</span></div>
            <div className="campaign-progress" aria-hidden="true"><span /></div>
            <CampaignDeliveryInfo className="campaign-delivery-mobile" representative={campaign.representative} expectedOn={campaign.deliveryExpectedOn} note={campaign.deliveryNote} />
          </section>
          <form className="campaign-configurator" onSubmit={submitConfiguration}>
            <section className="campaign-art-stage">
              <div className="campaign-media-carousel">
                <div
                  className="campaign-art-viewer"
                  ref={galleryTrack}
                  role="region"
                  aria-label={`Galeria da camisa ${selectedColor.name}`}
                  tabIndex={0}
                  onScroll={syncGalleryIndex}
                  onPointerDown={startGalleryDrag}
                  onPointerMove={moveGalleryDrag}
                  onPointerUp={finishGalleryDrag}
                  onPointerCancel={finishGalleryDrag}
                  onPointerLeave={(event) => { if (galleryDrag.current.dragging) finishGalleryDrag(event); }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft") { event.preventDefault(); goToGalleryItem(galleryIndex - 1); }
                    if (event.key === "ArrowRight") { event.preventDefault(); goToGalleryItem(galleryIndex + 1); }
                  }}
                >
                  {selectedGalleryMedia.map((media, index) => {
                    const itemLabel = media.type === "mockup" ? "Mockup" : media.type === "video" ? "Vídeo" : `Foto ${selectedGalleryMedia.slice(0, index + 1).filter((item) => item.type === "image").length}`;
                    return (
                      <div className="campaign-media-slide" role="group" aria-label={`${index + 1} de ${selectedGalleryMedia.length}: ${itemLabel}`} key={media.type === "mockup" ? "mockup" : `${media.type}-${media.url}`}>
                        {media.type === "mockup" ? (
                          <ShirtMockupPreview
                            model={activeModel}
                            color={selectedColor}
                            art={art}
                            artwork={selectedArtwork}
                            side={previewSide}
                            label={`${selectedModel.name === "Comum" ? "Padrão" : selectedModel.name}, ${selectedColor.name}, ${previewSide === "front" ? "frente" : "costas"}`}
                          />
                        ) : media.type === "video" ? (
                          <video ref={galleryVideo} className="campaign-real-photo-main campaign-real-video-main" src={media.url} poster={media.posterUrl} controls muted playsInline preload="metadata" aria-label={`Vídeo real da camisa ${selectedColor.name}`} />
                        ) : (
                          <img className="campaign-real-photo-main" src={media.url} alt={`${itemLabel} da camisa ${selectedColor.name}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {mockupEnabled && (selectedArtwork.front && selectedArtwork.back || canShowBack && !selectedArtwork.front) && <div className={`campaign-side-switch${selectedMedia?.type === "mockup" ? "" : " is-hidden"}`} role="group" aria-label="Visualizar lado da camiseta" aria-hidden={selectedMedia?.type !== "mockup"}><button className={previewSide === "front" ? "is-active" : ""} type="button" disabled={!selectedArtwork.front || selectedMedia?.type !== "mockup"} aria-pressed={previewSide === "front"} onClick={() => setPreviewSide("front")}>Frente</button><button className={previewSide === "back" ? "is-active" : ""} type="button" disabled={!selectedArtwork.back || selectedMedia?.type !== "mockup"} aria-pressed={previewSide === "back"} onClick={() => setPreviewSide("back")}>Costas</button></div>}
                {selectedGalleryMedia.length > 1 && <><button className="campaign-gallery-arrow is-previous" type="button" aria-label="Ver conteúdo anterior" disabled={galleryIndex === 0} onClick={() => goToGalleryItem(galleryIndex - 1)}><span className="material-symbols-rounded" aria-hidden="true">chevron_left</span></button><button className="campaign-gallery-arrow is-next" type="button" aria-label="Ver próximo conteúdo" disabled={galleryIndex === selectedGalleryMedia.length - 1} onClick={() => goToGalleryItem(galleryIndex + 1)}><span className="material-symbols-rounded" aria-hidden="true">chevron_right</span></button><span className={`campaign-gallery-count${selectedMedia?.type === "mockup" && canShowBack ? " has-side-switch" : ""}`} aria-live="polite">{galleryIndex + 1} / {selectedGalleryMedia.length}</span></>}
              </div>
              {selectedGalleryMedia.length > 1 && <div className="campaign-gallery-dots" role="group" aria-label="Escolher conteúdo da galeria">{selectedGalleryMedia.map((media, index) => <button className={galleryIndex === index ? "is-active" : ""} type="button" aria-label={`Ir para ${media.type === "mockup" ? "o mockup" : media.type === "video" ? "o vídeo" : `a foto ${selectedGalleryMedia.slice(0, index + 1).filter((item) => item.type === "image").length}`}`} aria-pressed={galleryIndex === index} onClick={() => goToGalleryItem(index)} key={`dot-${media.type === "mockup" ? "mockup" : media.url}`} />)}</div>}
              <p className="campaign-art-note">{selectedMedia?.type === "video" ? `Vídeo da camisa ${selectedColor.name}. Reprodução automática sem som.` : selectedMedia?.type === "image" ? `Foto real da camisa ${selectedColor.name}.` : art.mode === "legacy_mockup" ? "Imagem preservada da campanha original." : `${selectedModel.name === "Comum" ? "Padrão" : selectedModel.name} · ${selectedColor.name} · ${previewSide === "front" ? "Frente" : "Costas"}`}</p>
              <CampaignDeliveryInfo className="campaign-delivery-desktop" representative={campaign.representative} expectedOn={campaign.deliveryExpectedOn} note={campaign.deliveryNote} />
            </section>
            <section className="campaign-choice-stage campaign-cut-stage">
              <h2>1. Escolha o corte</h2>
              <div className="campaign-cut-options" role="radiogroup" aria-label="Corte da camiseta">{availableModels.map((item) => {
                const originalPrice = Math.round(campaign.prices[item.name] * 100);
                const modelDiscount = configuredCouponDiscountsByModel[item.name] ?? 0;
                return <label className={activeModel === item.name ? "is-selected" : ""} key={item.name}><input type="radio" name="model" checked={activeModel === item.name} onChange={() => selectModel(item.name)} /><span className="campaign-cut-head"><strong>{item.name === "Comum" ? "Padrão" : item.name}</strong><span className="campaign-cut-check material-symbols-rounded" aria-hidden="true">check</span></span><small>{item.description}</small><span className={`campaign-cut-price${modelDiscount ? " is-discounted" : ""}`}>{modelDiscount > 0 && <del>{formatCents(originalPrice)}</del>}<b>{formatCents(originalPrice - modelDiscount)}</b>{modelDiscount > 0 && <em>{couponMinimumQuantity > 1 ? `a partir de ${couponMinimumQuantity} peças${couponMaximumDiscountQuantity ? ` · até ${couponMaximumDiscountQuantity} unidades` : ""}` : "com cupom"}</em>}</span></label>;
              })}</div>
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
            <section className="campaign-choice-stage campaign-coupon-stage" aria-labelledby="campaign-coupon-title">
              <div className="campaign-stage-heading"><h2 id="campaign-coupon-title">5. Cupom de desconto</h2><span>Opcional · 1 por pedido</span></div>
              {appliedCoupon ? <div className="campaign-coupon-applied"><span className="material-symbols-rounded" aria-hidden="true">sell</span><div><strong>{appliedCoupon.code}</strong><small>A partir de {couponMinimumQuantity} {couponMinimumQuantity === 1 ? "peça" : "peças"}{couponMaximumDiscountQuantity ? ` · desconto em até ${couponMaximumDiscountQuantity} peças` : ""} · {appliedCoupon.discounts.map((discount) => `${discount.modelName === "Comum" ? "Padrão" : discount.modelName}: − ${formatCents(discount.discountCents)}`).join(" · ")}{appliedCoupon.expiresAt ? ` · válido até ${new Date(appliedCoupon.expiresAt).toLocaleDateString("pt-BR")}` : ""}</small></div><button type="button" onClick={removeCoupon}>Remover</button></div> : <div className="campaign-coupon-input"><label><span className="sr-only">Código do cupom</span><input value={couponInput} onChange={(event) => { setCouponInput(event.target.value.toUpperCase()); setCouponMessage(""); }} placeholder="Digite seu cupom" autoCapitalize="characters" spellCheck={false} /></label><button type="button" disabled={checkingCoupon} onClick={() => void applyCoupon()}>{checkingCoupon ? "Verificando..." : "Aplicar"}</button></div>}
              {appliedCoupon ? <p className={`campaign-coupon-message${couponEligible ? " is-success" : " is-pending"}`} role="status" aria-live="polite">{couponEligible ? couponMaximumDiscountQuantity && cartUnits > couponMaximumDiscountQuantity ? `Desconto aplicado em ${couponAllocation.discountedUnits} das ${cartUnits} peças. As excedentes permanecem com o preço normal.` : "Quantidade mínima atingida. O desconto já foi aplicado ao carrinho." : `Adicione mais ${couponMissingUnits} ${couponMissingUnits === 1 ? "peça" : "peças"} para ativar o desconto.`}</p> : couponMessage && <p className="campaign-coupon-message" role="status" aria-live="polite">{couponMessage}</p>}
            </section>
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
            <section className="checkout-order-review" aria-labelledby="order-review-title"><h2 id="order-review-title">Seu pedido</h2><div className="checkout-product-row"><ArtThumbs campaign={campaign} label={`Camisa da campanha ${campaign.title}`} items={cart} /><div className="checkout-product-copy"><CartLines items={cart} discountsByModel={couponDiscountsByModel} discountedQuantitiesByItem={couponAllocation.discountedQuantitiesByItem} /><CampaignDeliveryInfo representative={campaign.representative} expectedOn={campaign.deliveryExpectedOn} note={campaign.deliveryNote} />{appliedCoupon && <div className="checkout-discount"><span>Cupom {appliedCoupon.code}{couponMaximumDiscountQuantity ? ` · ${couponAllocation.discountedUnits} peças` : ""}</span><strong>− {formatCents(cartDiscount)}</strong></div>}<div className="checkout-total"><span>{cartUnits} {cartUnits === 1 ? "peça" : "peças"} · Total</span><strong>{formatCents(cartTotal)}</strong></div></div></div><button className="checkout-edit" type="button" onClick={() => goToStep("model")}>Editar carrinho</button></section>
            <section className="checkout-customer-fields" aria-labelledby="customer-fields-title"><h2 id="customer-fields-title">Quem vai retirar?</h2><label><span className="sr-only">Nome completo</span><input type="text" name="name" autoComplete="name" placeholder="Nome completo" value={customerName} onChange={(event) => setCustomerName(event.target.value)} required maxLength={160} pattern={".*\\S.*"} title="Informe seu nome completo." /></label><label><span className="sr-only">WhatsApp com DDD</span><ContactInput kind="phone" name="phone" placeholder="WhatsApp com DDD" value={customerPhone} onChange={setCustomerPhone} /></label><label><span className="sr-only">E-mail</span><ContactInput kind="email" name="email" placeholder="E-mail para confirmação" value={customerEmail} onChange={setCustomerEmail} /></label><p className="checkout-privacy"><span className="material-symbols-rounded" aria-hidden="true">lock</span><span>Seus dados serão usados para processar e acompanhar o pedido. <a href={buildRoute("politica-privacidade")} target="_blank">Leia a política de privacidade.</a></span></p></section>
            <button className="checkout-payment-button" type="submit">Ir para pagamento<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
          </form>
        </main>
      ) : step === "payment" ? (
        <main className="campaign-payment">
          <section className="campaign-payment-heading"><h1>Pagamento seguro</h1><div className="campaign-progress-copy"><strong>3 de 3</strong><span>·</span><span>Pagamento</span></div><div className="campaign-progress campaign-progress--payment" aria-hidden="true"><span /></div></section>
          {!resumePayment && <section className="payment-order-summary" aria-label="Resumo do pedido"><ArtThumbs campaign={campaign} label={`Camisa da campanha ${campaign.title}`} items={cart} /><div className="payment-order-copy"><strong>{cartUnits} {cartUnits === 1 ? "peça" : "peças"} em {cart.length} {cart.length === 1 ? "combinação" : "combinações"}</strong><b>{formatCents(cartTotal)}</b><button type="button" onClick={() => goToStep("details")}>Revisar pedido</button></div></section>}
          <form className="payment-form" onSubmit={submitPayment}>
            {resumePayment && <p className="payment-resume-note"><span className="material-symbols-rounded" aria-hidden="true">replay</span>Retomando o pagamento do pedido <strong>#{resumePayment}</strong>.</p>}
            {resumePayment && <label className="payment-resume-contact">WhatsApp informado no pedido<ContactInput kind="phone" name="whatsapp" placeholder="WhatsApp com DDD" value={customerPhone} onChange={setCustomerPhone} /></label>}
            <div className="payment-provider-choice"><span className="material-symbols-rounded" aria-hidden="true">verified_user</span><div><h2>Checkout InfinitePay</h2><p>Você escolherá Pix ou cartão no ambiente seguro da InfinitePay.</p></div></div>
            {!resumePayment && <dl className="payment-breakdown"><div><dt>{cartUnits} {cartUnits === 1 ? "peça" : "peças"}</dt><dd>{formatCents(cartSubtotal)}</dd></div>{appliedCoupon && <div className="payment-breakdown-discount"><dt>Cupom {appliedCoupon.code}{couponMaximumDiscountQuantity ? ` · ${couponAllocation.discountedUnits} peças` : ""}</dt><dd>− {formatCents(cartDiscount)}</dd></div>}<div><dt>Taxa</dt><dd>R$ 0,00</dd></div><div className="payment-breakdown-total"><dt>Total</dt><dd>{formatCents(cartTotal)}</dd></div></dl>}
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
          <div className="received-content"><section className="received-order-card"><header><div><small>Número do pedido</small><h2>#{orderNumber}</h2></div><button type="button" onClick={copyOrderNumber}><span className="material-symbols-rounded" aria-hidden="true">content_copy</span>Copiar</button></header><div className="received-product-row"><ArtThumbs campaign={campaign} label={`Camisa da campanha ${campaign.title}`} items={cart} /><div className="received-product-copy"><CartLines items={cart} discountsByModel={couponDiscountsByModel} discountedQuantitiesByItem={couponAllocation.discountedQuantitiesByItem} /><dl><div><dt>Total</dt><dd>{formatCents(cartTotal)}</dd></div></dl></div></div><CampaignDeliveryInfo representative={campaign.representative} expectedOn={campaign.deliveryExpectedOn} note={campaign.deliveryNote} /></section><aside className="received-next-steps"><h2>Próximos passos</h2><ol><li className="is-complete"><span className="material-symbols-rounded" aria-hidden="true">check</span><div><strong>Pedido criado</strong><small>Seus dados e suas peças foram registrados.</small></div></li><li className="is-current"><span className="material-symbols-rounded" aria-hidden="true">payments</span><div><strong>Pagamento na InfinitePay</strong><small>Conclua pelo checkout seguro do provedor.</small></div></li><li><span className="material-symbols-rounded" aria-hidden="true">verified</span><div><strong>Confirmação automática</strong><small>A InfinitePay atualiza o pedido pela integração.</small></div></li><li><span className="material-symbols-rounded" aria-hidden="true">inventory_2</span><div><strong>Envio para produção</strong><small>Acontece somente depois da confirmação.</small></div></li></ol></aside></div>
          <div className="received-actions"><button className="received-copy-action" type="button" onClick={copyOrderNumber}>Copiar número do pedido<span className="material-symbols-rounded" aria-hidden="true">content_copy</span></button><a className="received-back-action" href={buildRoute("acompanhar-pedido", undefined, orderNumber)}>Acompanhar pedido</a><p className="received-copy-status" role="status" aria-live="polite">{orderCopied ? "Número do pedido copiado." : "Guarde este número para acompanhar seu pedido."}</p></div>
        </main>
      )}
    </div>
  );
}
