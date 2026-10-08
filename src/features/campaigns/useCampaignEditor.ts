import { normalizeCouponText } from "../../../shared/domain.mjs";
import { useCampaignDraft } from './useCampaignDraft';
import { ChangeEvent, FormEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { localWhatsapp } from "../../phone";

import { parseWhatsapp } from "../../../shared/contact.mjs";
import { assetUrl, createCampaignInApi, deleteCampaignInApi, fetchCampaignDetail, fetchPaymentReceivers, updateCampaignInApi, uploadCampaignArt, uploadCampaignVideo } from "../../api";
import type { ApiPaymentReceiver, CampaignArtworkConfig, CampaignRealPhotoConfig, CampaignRealVideoConfig, UpdateCampaignPayload } from '../../api';
import { defaultCampaignColors, defaultCampaignSizes, campaignSizesInGroup, shirtColors, shirtModels, sortSizes } from "../../data";
import type { ShirtColorName, ShirtColorOption, ShirtModelName, SizeCode, SizeGroup } from "../../data";
import type { ArtworkTransform, VariantArtwork } from "../../data";

import { formatDeadline, parseCampaignPrice, priceInput, dateInput, defaultPickupInstructions, errorMessage } from "../admin/model";
import type { PanelCampaign, PanelData } from "../admin/model";
import { defaultModelColorNames, defaultModelSizes, colorKey, mergeCampaignColors, validHexColor, campaignFormSteps, campaignDraftKey, defaultTransform, variantArtKey, emptyArtSide, emptyVariantArt, storedArtworkUrl, inspectCampaignVideo } from "./editor-model";
import type { CampaignFormStep, ArtSideDraft, VariantArtDraft } from './editor-model';

export function useCampaignEditor(data:PanelData) {
  const { campaigns, mode, reload } = data;
  const { loadDraft, resetDraft, phaseFilter, setPhaseFilter, creating, setCreating, shared, setShared, notice, setNotice, deleteConfirmation, setDeleteConfirmation, deleting, setDeleting, deleteError, setDeleteError, editing, setEditing, loadingDetail, setLoadingDetail, existingArt, setExistingArt, campaignName, setCampaignName, campaignCodeInput, setCampaignCodeInput, subtitle, setSubtitle, pickup, setPickup, representative, setRepresentative, representativePhone, setRepresentativePhone, deadline, setDeadline, deliveryExpectedOn, setDeliveryExpectedOn, deliveryNote, setDeliveryNote, receiverId, setReceiverId, commonPrice, setCommonPrice, oversizedPrice, setOversizedPrice, couponEnabled, setCouponEnabled, couponCode, setCouponCode, couponDiscounts, setCouponDiscounts, couponExpires, setCouponExpires, couponLimit, setCouponLimit, couponMinimumQuantity, setCouponMinimumQuantity, couponMaximumQuantity, setCouponMaximumQuantity, selectedModels, setSelectedModels, front, setFront, back, setBack, artMode, setArtMode, mockupEnabled, setMockupEnabled, realPhotosEnabled, setRealPhotosEnabled, artScope, setArtScope, baseTransforms, setBaseTransforms, variantArts, setVariantArts, realPhotosByColor, setRealPhotosByColor, realVideosByColor, setRealVideosByColor, artVariant, setArtVariant, artPreviewSide, setArtPreviewSide, artError, setArtError, colorModel, setColorModel, campaignColorOptions, setCampaignColorOptions, modelColors, setModelColors, customColorName, setCustomColorName, customColorHex, setCustomColorHex, colorError, setColorError, sizeModel, setSizeModel, modelSizes, setModelSizes, sizeError, setSizeError, submitting, setSubmitting, formError, setFormError, formStep, setFormStep, productConfiguration, setProductConfiguration, customColorOpen, setCustomColorOpen, advancedArtOpen, setAdvancedArtOpen, draftFeedback, setDraftFeedback } = useCampaignDraft();

  /** Fora de `null`, o formulário está editando a campanha deste código. */

  const videoUploadControllers = useRef<Record<string, AbortController>>({});

  // Contas que podem receber o pagamento da campanha. Sem sessão no servidor a lista
  // fica vazia e a campanha segue na conta padrão.
  const [receivers, setReceivers] = useState<ApiPaymentReceiver[]>([]);
  const [receiversError, setReceiversError] = useState("");
  useEffect(() => {
    if (!creating || mode !== "live") return;
    let active = true;
    fetchPaymentReceivers()
      .then((list) => { if (active) { setReceivers(list); setReceiversError(""); } })
      .catch((loadError) => { if (active) setReceiversError(errorMessage(loadError, "Não foi possível carregar os recebedores.")); });
    return () => { active = false; };
  }, [creating, mode]);

  const filtered = phaseFilter === "all" ? campaigns : campaigns.filter((campaign) => campaign.phase === phaseFilter);

  /**
   * Preço, cores e tamanhos ficam travados assim que a campanha sai de "recebendo
   * pedidos": alterá-los com pedido pago no meio desalinharia produção e cobrança. Os
   * campos continuam visíveis, desabilitados, com o motivo à vista.
   */
  const variantsLocked = editing !== null && editing.phase !== "receiving_orders";
  const previewModel = selectedModels[artVariant.model]
    ? artVariant.model
    : shirtModels.find((item) => selectedModels[item.name])?.name ?? "Comum";
  const previewColorName = modelColors[previewModel].includes(artVariant.color) ? artVariant.color : modelColors[previewModel][0];
  const previewColor = campaignColorOptions.find((option) => colorKey(option.name) === colorKey(previewColorName ?? ""))
    ?? defaultCampaignColors[previewModel][0];
  const previewKey = variantArtKey(previewModel, previewColor.name);
  const currentVariantArt = variantArts[previewKey]?.[artMode === "legacy_mockup" ? "overlay" : artMode] ?? emptyVariantArt(artMode);
  const resolveDraftSide = (side: "front" | "back") => {
    const draft = currentVariantArt[side];
    if (artMode === "variant_mockup") {
      const url = draft.preview || draft.url;
      return draft.source === "custom" && url ? { url, transform: { ...defaultTransform } } : null;
    }
    const baseUrl = side === "front" ? front.preview || existingArt.front : back.preview || existingArt.back;
    if (draft.source === "none") return null;
    const url = draft.source === "custom" ? draft.preview || draft.url : baseUrl;
    if (!url) return null;
    return { url, transform: draft.transformOverride ? draft.transform : baseTransforms[side] };
  };
  const basePreviewArtwork: VariantArtwork = {
    front: front.preview || existingArt.front ? { url: front.preview || existingArt.front, transform: baseTransforms.front } : null,
    back: back.preview || existingArt.back ? { url: back.preview || existingArt.back, transform: baseTransforms.back } : null,
  };
  const previewArtwork: VariantArtwork = artMode === "overlay" && artScope === "base"
    ? basePreviewArtwork
    : { front: resolveDraftSide("front"), back: resolveDraftSide("back") };
  const previewArt = {
    front: front.preview || existingArt.front,
    back: back.preview || existingArt.back || null,
    mode: artMode,
    frontTransform: baseTransforms.front,
    backTransform: baseTransforms.back,
  } as const;
  const activeTransform = artMode === "overlay"
    ? artScope === "base"
      ? baseTransforms[artPreviewSide]
      : currentVariantArt[artPreviewSide].transformOverride
        ? currentVariantArt[artPreviewSide].transform
        : baseTransforms[artPreviewSide]
    : defaultTransform;
  const activeVariantCombinations = shirtModels.flatMap((model) => selectedModels[model.name]
    ? modelColors[model.name].map((colorName) => ({ model: model.name, colorName, key: variantArtKey(model.name, colorName) }))
    : []);
  const activeRealPhotoColors = campaignColorOptions.filter((option) => shirtModels.some((model) =>
    selectedModels[model.name] && modelColors[model.name].some((name) => colorKey(name) === colorKey(option.name)),
  ));
  const videoUploadInProgress = activeRealPhotoColors.some((color) => {
    const video = realVideosByColor[colorKey(color.name)];
    return video?.status === "processing" || video?.status === "uploading";
  });
  const campaignAlert = formError || artError || colorError || sizeError;
  const selectedCampaignModels = shirtModels.filter((model) => selectedModels[model.name]);
  const summaryColorCount = new Set(selectedCampaignModels.flatMap((model) => modelColors[model.name].map(colorKey))).size;
  const summarySizeCount = selectedCampaignModels.reduce((total, model) => total + modelSizes[model.name].length, 0);
  const informationComplete = campaignName.trim().length >= 5
    && representative.trim().length >= 3
    && !parseWhatsapp(representativePhone).error
    && Boolean(deadline)
    && Boolean(pickup.trim());
  const couponComplete = !couponEnabled || (
    /^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(normalizeCouponText(couponCode))
    && selectedCampaignModels.every((model) => {
      const discount = parseCampaignPrice(couponDiscounts[model.name]);
      const price = parseCampaignPrice(model.name === "Comum" ? commonPrice : oversizedPrice);
      return discount > 0 && discount < price;
    })
    && (!couponLimit || /^\d+$/.test(couponLimit) && Number(couponLimit) > 0)
    && /^\d+$/.test(couponMinimumQuantity) && Number(couponMinimumQuantity) >= 1 && Number(couponMinimumQuantity) <= 200
    && (!couponMaximumQuantity || /^\d+$/.test(couponMaximumQuantity)
      && Number(couponMaximumQuantity) >= Number(couponMinimumQuantity)
      && Number(couponMaximumQuantity) <= 200)
  );
  const productsComplete = couponComplete && selectedCampaignModels.length > 0 && selectedCampaignModels.every((model) => (
    parseCampaignPrice(model.name === "Comum" ? commonPrice : oversizedPrice) > 0
    && modelColors[model.name].length > 0
    && modelSizes[model.name].length > 0
  ));
  const variantMockupsComplete = activeVariantCombinations.every((item) => {
    const saved = variantArts[item.key]?.variant_mockup;
    return saved?.front.source === "custom" || saved?.back.source === "custom";
  });
  const mockupComplete = !mockupEnabled
    || artMode === "legacy_mockup"
    || (artMode === "overlay" ? Boolean(front.file || existingArt.front) : variantMockupsComplete);
  const realPhotosComplete = !realPhotosEnabled || activeRealPhotoColors.every((color) => (
    (realPhotosByColor[colorKey(color.name)]?.length ?? 0) > 0
  ));
  const imagesComplete = (mockupEnabled || realPhotosEnabled) && mockupComplete && realPhotosComplete && !videoUploadInProgress;

  useEffect(() => {
    if (!campaignAlert) return;
    const timeout = window.setTimeout(() => {
      setFormError("");
      setArtError("");
      setColorError("");
      setSizeError("");
    }, 6500);
    return () => window.clearTimeout(timeout);
  }, [campaignAlert, setFormError, setArtError, setColorError, setSizeError]);

  function clearCampaignAlert() {
    setFormError("");
    setArtError("");
    setColorError("");
    setSizeError("");
  }

  function handleCampaignInvalid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const field = event.target as HTMLInputElement;
    if (event.currentTarget.querySelector(":invalid") !== field) return;
    const label = field.closest("label")?.querySelector(":scope > span")?.textContent?.trim()
      || field.getAttribute("aria-label")
      || "o campo obrigatório";
    setFormError(field.validity.valueMissing ? `Preencha ${label}.` : `Revise ${label}.`);
    window.setTimeout(() => field.focus({ preventScroll: true }), 0);
  }

  function resetForm() {
    Object.values(realPhotosByColor).flat().forEach((photo) => { if (photo.preview) URL.revokeObjectURL(photo.preview); });
    Object.values(videoUploadControllers.current).forEach((controller) => controller.abort());
    videoUploadControllers.current = {};
    Object.values(realVideosByColor).forEach((video) => {
      if (video.preview.startsWith("blob:")) URL.revokeObjectURL(video.preview);
      if (video.posterPreview.startsWith("blob:")) URL.revokeObjectURL(video.posterPreview);
    });
    resetDraft({
      campaignName: "",
      campaignCodeInput: "",
      subtitle: "",
      pickup: defaultPickupInstructions,
      representative: "",
      representativePhone: "",
      deadline: "",
      deliveryExpectedOn: "",
      deliveryNote: "",
      receiverId: null,
      couponEnabled: false,
      couponCode: "",
      couponDiscounts: { Comum: "10,00", Oversized: "10,00" },
      couponExpires: "",
      couponLimit: "",
      couponMinimumQuantity: "1",
      couponMaximumQuantity: "",
      front: { file: null, preview: "" },
      back: { file: null, preview: "" },
      artMode: "overlay",
      mockupEnabled: false,
      realPhotosEnabled: false,
      artScope: "base",
      baseTransforms: { front: { ...defaultTransform }, back: { ...defaultTransform } },
      variantArts: {},
      realPhotosByColor: {},
      realVideosByColor: {},
      artVariant: { model: "Comum", color: defaultCampaignColors.Comum[0].name },
      artPreviewSide: "front",
      existingArt: { front: "", back: "" },
      artError: "",
      campaignColorOptions: mergeCampaignColors(shirtColors),
      customColorName: "",
      customColorHex: "#808080",
      colorError: "",
      colorModel: "Comum",
      sizeError: "",
      sizeModel: "Comum",
      selectedModels: { Comum: true, Oversized: true },
      formError: "",
      formStep: "information",
      productConfiguration: null,
      customColorOpen: false,
      advancedArtOpen: false,
      draftFeedback: "",
    });
  }

  function restoreCampaignDraft() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(campaignDraftKey) ?? "null") as null | {
        campaignName?: string;
        campaignCodeInput?: string;
        subtitle?: string;
        pickup?: string;
        representative?: string;
        representativePhone?: string;
        deadline?: string;
        deliveryExpectedOn?: string;
        deliveryNote?: string;
        receiverId?: number | null;
        commonPrice?: string;
        oversizedPrice?: string;
        couponEnabled?: boolean;
        couponCode?: string;
        couponDiscounts?: Record<ShirtModelName, string>;
        couponExpires?: string;
        couponLimit?: string;
        couponMinimumQuantity?: string;
        couponMaximumQuantity?: string;
        selectedModels?: Record<ShirtModelName, boolean>;
        modelColors?: Record<ShirtModelName, ShirtColorName[]>;
        modelSizes?: Record<ShirtModelName, SizeCode[]>;
        campaignColorOptions?: ShirtColorOption[];
      };
      if (!saved) return;
      if (saved.campaignName) setCampaignName(saved.campaignName);
      loadDraft({ campaignCodeInput: saved.campaignCodeInput ?? "", subtitle: saved.subtitle ?? "" });
      if (saved.pickup) setPickup(saved.pickup);
      setRepresentative(saved.representative ?? "");
      setRepresentativePhone(saved.representativePhone ?? "");
      setDeadline(saved.deadline ?? "");
      setDeliveryExpectedOn(saved.deliveryExpectedOn ?? "");
      setDeliveryNote(saved.deliveryNote ?? "");
      setReceiverId(typeof saved.receiverId === "number" ? saved.receiverId : null);
      if (saved.commonPrice) setCommonPrice(saved.commonPrice);
      if (saved.oversizedPrice) setOversizedPrice(saved.oversizedPrice);
      setCouponEnabled(Boolean(saved.couponEnabled));
      setCouponCode(saved.couponCode ?? "");
      if (saved.couponDiscounts) setCouponDiscounts(saved.couponDiscounts);
      setCouponExpires(saved.couponExpires ?? "");
      setCouponLimit(saved.couponLimit ?? "");
      setCouponMinimumQuantity(saved.couponMinimumQuantity ?? "1");
      setCouponMaximumQuantity(saved.couponMaximumQuantity ?? "");
      if (saved.selectedModels) setSelectedModels(saved.selectedModels);
      if (saved.modelColors) setModelColors(saved.modelColors);
      if (saved.modelSizes) setModelSizes(saved.modelSizes);
      if (saved.campaignColorOptions) setCampaignColorOptions(mergeCampaignColors(shirtColors, saved.campaignColorOptions));
      setDraftFeedback("Rascunho recuperado desta sessão. Os arquivos de imagem e vídeo precisam ser selecionados novamente.");
    } catch {
      sessionStorage.removeItem(campaignDraftKey);
    }
  }

  function saveCampaignDraft() {
    if (editing) {
      setDraftFeedback("As alterações continuam nesta tela até você salvar a campanha.");
      return;
    }
    sessionStorage.setItem(campaignDraftKey, JSON.stringify({
      campaignName,
      campaignCodeInput,
      subtitle,
      pickup,
      representative,
      representativePhone,
      deadline,
      deliveryExpectedOn,
      deliveryNote,
      receiverId,
      commonPrice,
      oversizedPrice,
      couponEnabled,
      couponCode,
      couponDiscounts,
      couponExpires,
      couponLimit,
      couponMinimumQuantity,
      couponMaximumQuantity,
      selectedModels,
      modelColors,
      modelSizes,
      campaignColorOptions,
    }));
    setDraftFeedback("Rascunho salvo nesta sessão. Imagens e vídeos continuam apenas nesta tela.");
  }

  function closeForm() {
    Object.values(videoUploadControllers.current).forEach((controller) => controller.abort());
    videoUploadControllers.current = {};
    setCreating(false);
    setEditing(null);
    setLoadingDetail(false);
    clearCampaignAlert();
  }

  function startCampaign() {
    setShared(null);
    setNotice("");
    setEditing(null);
    setCreating(true);
    resetForm();
    setCommonPrice("59,90");
    setOversizedPrice("69,90");
    setModelColors(defaultModelColorNames());
    setModelSizes(defaultModelSizes());
    restoreCampaignDraft();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Abre o mesmo formulário já preenchido com o que a campanha tem hoje. */
  async function startEdit(campaign: PanelCampaign) {
    setShared(null);
    setNotice("");
    setCreating(true);
    setEditing({ code: campaign.code, phase: campaign.phase, hadBackArt: false, artRenderMode: "legacy_mockup" });
    setLoadingDetail(true);
    resetForm();
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const detail = await fetchCampaignDetail(campaign.code);
      setEditing({ code: detail.code, phase: campaign.phase, hadBackArt: Boolean(detail.artBackUrl), artRenderMode: detail.artRenderMode });
      setArtMode(detail.artRenderMode);
      setMockupEnabled(detail.presentationConfig?.mockupEnabled ?? true);
      setRealPhotosEnabled(detail.presentationConfig?.realPhotosEnabled ?? Boolean(detail.realPhotos?.length));
      setArtScope(detail.artRenderMode === "variant_mockup" ? "variant" : "base");
      setCampaignName(detail.title);
      setCampaignCodeInput(detail.code);
      setSubtitle(detail.subtitle ?? "");
      setPickup(detail.pickupInstructions);
      setRepresentative(detail.representativeName);
      setRepresentativePhone(localWhatsapp(detail.representativeWhatsapp));
      setDeadline(dateInput(detail.deadlineAt));
      setDeliveryExpectedOn(detail.deliveryExpectedOn ?? "");
      setDeliveryNote(detail.deliveryNote ?? "");
      setReceiverId(detail.receiver?.id ?? null);
      setExistingArt({ front: assetUrl(detail.artFrontUrl) ?? "", back: assetUrl(detail.artBackUrl) ?? "" });
      setBaseTransforms({
        front: detail.artworkConfig?.base.front?.transform ?? { ...defaultTransform },
        back: detail.artworkConfig?.base.back?.transform ?? { ...defaultTransform },
      });
      const priceOf = (model: ShirtModelName) => detail.variants.find((variant) => variant.model.name === model)?.unitPriceCents;
      setCommonPrice(priceInput(priceOf("Comum")) || "59,90");
      setOversizedPrice(priceInput(priceOf("Oversized")) || "69,90");
      setCouponEnabled(Boolean(detail.activeCoupon));
      setCouponCode(detail.activeCoupon?.code ?? "");
      setCouponDiscounts({
        Comum: priceInput(detail.activeCoupon?.discounts.find((discount) => discount.modelName === "Comum")?.discountCents) || "10,00",
        Oversized: priceInput(detail.activeCoupon?.discounts.find((discount) => discount.modelName === "Oversized")?.discountCents) || "10,00",
      });
      setCouponExpires(detail.activeCoupon?.expiresAt ? dateInput(detail.activeCoupon.expiresAt) : "");
      setCouponLimit(detail.activeCoupon?.usageLimit ? String(detail.activeCoupon.usageLimit) : "");
      setCouponMinimumQuantity(String(detail.activeCoupon?.minimumQuantity ?? 1));
      setCouponMaximumQuantity(detail.activeCoupon?.maximumDiscountQuantity ? String(detail.activeCoupon.maximumDiscountQuantity) : "");
      const colorsFromCampaign = detail.variants.map((variant) => ({ name: variant.color.name, hex: variant.color.hex }));
      setCampaignColorOptions(mergeCampaignColors(shirtColors, colorsFromCampaign));
      setRealPhotosByColor(Object.fromEntries((detail.realPhotos ?? []).map((gallery) => [
        colorKey(gallery.colorName),
        gallery.urls.map((url) => ({ file: null, preview: "", url: assetUrl(url) })),
      ])));
      setRealVideosByColor(Object.fromEntries((detail.realVideos ?? []).map((video) => [
        colorKey(video.colorName),
        {
          preview: assetUrl(video.url) ?? "",
          url: assetUrl(video.url),
          posterPreview: assetUrl(video.posterUrl ?? null) ?? "",
          posterUrl: assetUrl(video.posterUrl ?? null),
          durationSeconds: video.durationSeconds ?? 0,
          bytes: video.bytes,
          progress: 100,
          status: "ready" as const,
        },
      ])));
      const colorsOf = (model: ShirtModelName) => detail.variants
        .filter((variant) => variant.model.name === model)
        .map((variant) => variant.color.name);
      setModelColors({ Comum: colorsOf("Comum"), Oversized: colorsOf("Oversized") });
      const loadedVariantArts: Record<string, Partial<Record<"overlay" | "variant_mockup", VariantArtDraft>>> = {};
      detail.variants.forEach((variant) => {
        const model = variant.model.name as ShirtModelName;
        const key = variantArtKey(model, variant.color.name);
        const byMode: Partial<Record<"overlay" | "variant_mockup", VariantArtDraft>> = {};
        (["overlay", "variant_mockup"] as const).forEach((modeName) => {
          const saved = variant.artworkConfigs?.[modeName];
          if (!saved) return;
          const loadSide = (side: "front" | "back"): ArtSideDraft => ({
            file: null,
            preview: "",
            url: assetUrl(saved[side].url ?? null),
            source: saved[side].source,
            transformOverride: Boolean(saved[side].transformOverride),
            transform: saved[side].transform ?? { ...defaultTransform },
          });
          byMode[modeName] = { front: loadSide("front"), back: loadSide("back") };
        });
        loadedVariantArts[key] = byMode;
      });
      setVariantArts(loadedVariantArts);
      const sizesOf = (model: ShirtModelName) => sortSizes(
        detail.sizes
          .filter((size) => size.model.name === model)
          .map((size) => size.code as SizeCode)
          .filter((size) => defaultCampaignSizes[model].includes(size)),
      );
      setModelSizes({ Comum: sizesOf("Comum"), Oversized: sizesOf("Oversized") });
      const availableModels = new Set(detail.variants.map((variant) => variant.model.name as ShirtModelName));
      const nextSelectedModels = { Comum: availableModels.has("Comum"), Oversized: availableModels.has("Oversized") };
      setSelectedModels(nextSelectedModels);
      const firstAvailableModel = shirtModels.find((model) => nextSelectedModels[model.name])?.name ?? "Comum";
      setColorModel(firstAvailableModel);
      setSizeModel(firstAvailableModel);
      setArtVariant({ model: firstAvailableModel, color: colorsOf(firstAvailableModel)[0] ?? "" });
    } catch (detailError) {
      setFormError(errorMessage(detailError, "Não foi possível carregar a campanha para edição."));
    } finally {
      setLoadingDetail(false);
    }
  }

  async function confirmDeleteCampaign() {
    if (!deleteConfirmation) return;
    if (mode !== "live") {
      setDeleteError("Sem sessão no servidor, a campanha não pode ser excluída.");
      return;
    }
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteCampaignInApi(deleteConfirmation.code);
      const deletedCode = deleteConfirmation.code;
      setDeleteConfirmation(null);
      setNotice(`Campanha ${deletedCode} excluída.`);
      if (editing?.code === deletedCode) closeForm();
      if (shared?.code === deletedCode) setShared(null);
      reload();
    } catch (deleteFailure) {
      setDeleteError(errorMessage(deleteFailure, "Não foi possível excluir a campanha."));
    } finally {
      setDeleting(false);
    }
  }

  function toggleCampaignModel(model: ShirtModelName) {
    const currentlySelected = selectedModels[model];
    const selectedCount = shirtModels.filter((item) => selectedModels[item.name]).length;
    if (currentlySelected && selectedCount === 1) {
      setFormError("A campanha precisa manter pelo menos um corte disponível.");
      return;
    }

    const nextSelected = !currentlySelected;
    setSelectedModels((current) => ({ ...current, [model]: nextSelected }));
    setFormError("");

    if (nextSelected) {
      setModelColors((current) => current[model].length > 0
        ? current
        : { ...current, [model]: defaultCampaignColors[model].map((color) => color.name) });
      setModelSizes((current) => current[model].length > 0
        ? current
        : { ...current, [model]: [...defaultCampaignSizes[model]] });
      setColorModel(model);
      setSizeModel(model);
      return;
    }

    const remainingModel = shirtModels.find((item) => item.name !== model && selectedModels[item.name])?.name;
    if (remainingModel) {
      if (colorModel === model) setColorModel(remainingModel);
      if (sizeModel === model) setSizeModel(remainingModel);
    }
  }

  function toggleCampaignColor(model: ShirtModelName, color: ShirtColorName) {
    setModelColors((current) => {
      const selected = current[model];
      const next = selected.includes(color) ? selected.filter((item) => item !== color) : [...selected, color];
      return { ...current, [model]: next };
    });
    setColorError("");
  }

  function addCustomCampaignColor() {
    const name = customColorName.trim().replace(/\s+/g, " ");
    const hex = customColorHex.trim().toUpperCase();
    if (name.length < 2 || name.length > 80) {
      setColorError("Informe um nome de cor entre 2 e 80 caracteres.");
      return;
    }
    if (!validHexColor(hex)) {
      setColorError("Informe o código HEX completo no formato #RRGGBB.");
      return;
    }
    const existing = campaignColorOptions.find((color) => colorKey(color.name) === colorKey(name));
    if (existing && existing.hex.toUpperCase() !== hex) {
      setColorError(`${existing.name} já está cadastrada como ${existing.hex.toUpperCase()}. Use outro nome para ${hex}.`);
      return;
    }
    if (modelColors[colorModel].length >= 12 && !modelColors[colorModel].some((color) => colorKey(color) === colorKey(name))) {
      setColorError(`O corte ${colorModel} já atingiu o limite de 12 cores.`);
      return;
    }
    if (!existing) setCampaignColorOptions((current) => [...current, { name, hex }]);
    const selectedName = existing?.name ?? name;
    setModelColors((current) => current[colorModel].includes(selectedName)
      ? current
      : { ...current, [colorModel]: [...current[colorModel], selectedName] });
    setCustomColorName("");
    setCustomColorHex("#808080");
    setColorError("");
  }

  function removeCustomCampaignColor(name: string) {
    if (shirtColors.some((color) => colorKey(color.name) === colorKey(name))) return;
    setCampaignColorOptions((current) => current.filter((color) => colorKey(color.name) !== colorKey(name)));
    setModelColors((current) => ({
      Comum: current.Comum.filter((color) => colorKey(color) !== colorKey(name)),
      Oversized: current.Oversized.filter((color) => colorKey(color) !== colorKey(name)),
    }));
    setColorError("");
  }

  function toggleCampaignSize(model: ShirtModelName, size: SizeCode) {
    setModelSizes((current) => {
      const selected = current[model];
      const next = selected.includes(size) ? selected.filter((item) => item !== size) : sortSizes([...selected, size]);
      return { ...current, [model]: next };
    });
    setSizeError("");
  }

  function toggleSizeGroup(model: ShirtModelName, group: SizeGroup) {
    const groupSizes = campaignSizesInGroup(model, group);
    setModelSizes((current) => {
      const selected = current[model];
      const allSelected = groupSizes.every((size) => selected.includes(size));
      const next = allSelected
        ? selected.filter((size) => !groupSizes.includes(size))
        : sortSizes([...new Set([...selected, ...groupSizes])]);
      return { ...current, [model]: next };
    });
    setSizeError("");
  }

  function chooseArt(event: ChangeEvent<HTMLInputElement>, side: "front" | "back") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/webp"].includes(file.type)) {
      setArtError("Formato inválido. Envie a arte em PNG ou WEBP com fundo transparente.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setArtError("A imagem ultrapassa 2 MB. Comprima o arquivo antes de enviar.");
      return;
    }
    const preview = new Image();
    const url = URL.createObjectURL(file);
    preview.onerror = () => { URL.revokeObjectURL(url); setArtError("O arquivo não contém uma imagem válida."); };
    preview.onload = () => {
      if (preview.width < 500 || preview.height < 300) {
        URL.revokeObjectURL(url);
        setArtError("A arte precisa ter pelo menos 500 × 300 pixels.");
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 96;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context?.drawImage(preview, 0, 0, canvas.width, canvas.height);
      const pixels = context?.getImageData(0, 0, canvas.width, canvas.height).data;
      let hasTransparentPixel = false;
      if (pixels) {
        for (let index = 3; index < pixels.length; index += 4) {
          if (pixels[index] < 250) {
            hasTransparentPixel = true;
            break;
          }
        }
      }
      if (!hasTransparentPixel) {
        URL.revokeObjectURL(url);
        setArtError("A arte precisa ter fundo transparente para aparecer corretamente em todas as cores.");
        return;
      }
      const setter = side === "front" ? setFront : setBack;
      const previous = side === "front" ? front : back;
      if (previous.preview) URL.revokeObjectURL(previous.preview);
      setter({ file, preview: url });
      setArtError("");
    };
    preview.src = url;
  }

  function chooseRealPhotos(event: ChangeEvent<HTMLInputElement>, colorName: string) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!files.length) return;
    const key = colorKey(colorName);
    const currentCount = realPhotosByColor[key]?.length ?? 0;
    if (currentCount + files.length > 6) {
      setArtError(`Cada cor aceita até seis fotos reais. ${colorName} já possui ${currentCount}.`);
      return;
    }
    const invalid = files.find((file) => !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024);
    if (invalid) {
      setArtError("As fotos reais devem ser PNG, JPG ou WEBP, com no máximo 2 MB cada.");
      return;
    }
    const additions = files.map((file) => ({ file, preview: URL.createObjectURL(file), url: null }));
    setRealPhotosByColor((current) => ({ ...current, [key]: [...(current[key] ?? []), ...additions] }));
    setArtError("");
  }

  function removeRealPhoto(colorName: string, index: number) {
    const key = colorKey(colorName);
    const removed = realPhotosByColor[key]?.[index];
    if (removed?.preview) URL.revokeObjectURL(removed.preview);
    setRealPhotosByColor((current) => ({ ...current, [key]: (current[key] ?? []).filter((_, photoIndex) => photoIndex !== index) }));
    setArtError("");
  }

  async function chooseRealVideo(event: ChangeEvent<HTMLInputElement>, colorName: string) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "video/mp4" || !/\.mp4$/i.test(file.name)) {
      setArtError("O vídeo deve ser um arquivo MP4 compatível com o navegador.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setArtError("O vídeo deve ter no máximo 10 MB.");
      return;
    }

    const key = colorKey(colorName);
    videoUploadControllers.current[key]?.abort();
    const previous = realVideosByColor[key];
    if (previous?.preview.startsWith("blob:")) URL.revokeObjectURL(previous.preview);
    if (previous?.posterPreview.startsWith("blob:")) URL.revokeObjectURL(previous.posterPreview);
    const preview = URL.createObjectURL(file);
    const controller = new AbortController();
    videoUploadControllers.current[key] = controller;
    setRealVideosByColor((current) => ({
      ...current,
      [key]: { preview, url: null, posterPreview: "", posterUrl: null, durationSeconds: 0, bytes: file.size, progress: 0, status: "processing" },
    }));
    setArtError("");

    try {
      const inspected = await inspectCampaignVideo(file, preview);
      if (controller.signal.aborted || videoUploadControllers.current[key] !== controller) return;
      const posterPreview = inspected.posterFile ? URL.createObjectURL(inspected.posterFile) : "";
      setRealVideosByColor((current) => ({
        ...current,
        [key]: { ...current[key], posterPreview, durationSeconds: inspected.durationSeconds, status: "uploading" },
      }));
      const uploaded = await uploadCampaignVideo(file, {
        signal: controller.signal,
        onProgress: (sent, total) => setRealVideosByColor((current) => current[key]
          ? { ...current, [key]: { ...current[key], progress: total ? Math.min(100, Math.round(sent / total * 100)) : 0 } }
          : current),
      });
      let posterUrl: string | null = null;
      if (inspected.posterFile) {
        try { posterUrl = await uploadCampaignArt(inspected.posterFile); } catch { /* fallback escuro sem capa */ }
      }
      if (controller.signal.aborted || videoUploadControllers.current[key] !== controller) return;
      delete videoUploadControllers.current[key];
      if (posterPreview) URL.revokeObjectURL(posterPreview);
      setRealVideosByColor((current) => ({
        ...current,
        [key]: {
          preview: assetUrl(uploaded.url) ?? uploaded.url,
          url: uploaded.url,
          posterPreview: assetUrl(posterUrl) ?? "",
          posterUrl,
          durationSeconds: inspected.durationSeconds,
          bytes: uploaded.bytes,
          progress: 100,
          status: "ready",
        },
      }));
    } catch (error) {
      if (videoUploadControllers.current[key] !== controller) return;
      delete videoUploadControllers.current[key];
      const message = error instanceof Error ? error.message : "Não foi possível preparar o vídeo.";
      setRealVideosByColor((current) => current[key] ? {
        ...current,
        [key]: { ...current[key], status: "error", error: message },
      } : current);
      setArtError(message);
    }
  }

  function removeRealVideo(colorName: string) {
    const key = colorKey(colorName);
    videoUploadControllers.current[key]?.abort();
    delete videoUploadControllers.current[key];
    const video = realVideosByColor[key];
    if (video?.preview.startsWith("blob:")) URL.revokeObjectURL(video.preview);
    if (video?.posterPreview.startsWith("blob:")) URL.revokeObjectURL(video.posterPreview);
    setRealVideosByColor((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setArtError("");
  }

  function removeBackArt() {
    if (back.preview) URL.revokeObjectURL(back.preview);
    setBack({ file: null, preview: "" });
    setExistingArt((current) => ({ ...current, back: "" }));
    setArtError("");
  }

  function updateVariantSide(side: "front" | "back", updater: (current: ArtSideDraft) => ArtSideDraft) {
    if (artMode === "legacy_mockup") return;
    const modeName = artMode;
    setVariantArts((current) => {
      const byMode = current[previewKey] ?? {};
      const draft = byMode[modeName] ?? emptyVariantArt(modeName);
      return { ...current, [previewKey]: { ...byMode, [modeName]: { ...draft, [side]: updater(draft[side]) } } };
    });
  }

  function chooseVariantArt(event: ChangeEvent<HTMLInputElement>, side: "front" | "back") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || artMode === "legacy_mockup") return;
    const allowed = artMode === "overlay" ? ["image/png", "image/webp"] : ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setArtError(artMode === "overlay" ? "Envie PNG ou WEBP transparente." : "Envie o mockup em PNG, JPG ou WEBP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setArtError("A imagem ultrapassa 2 MB. Comprima o arquivo antes de enviar.");
      return;
    }
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onerror = () => { URL.revokeObjectURL(url); setArtError("O arquivo não contém uma imagem válida."); };
    image.onload = () => {
      if (image.width < 500 || image.height < 300) {
        URL.revokeObjectURL(url);
        setArtError("A imagem precisa ter pelo menos 500 × 300 pixels.");
        return;
      }
      if (artMode === "overlay") {
        const canvas = document.createElement("canvas");
        canvas.width = 96;
        canvas.height = 96;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context?.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = context?.getImageData(0, 0, canvas.width, canvas.height).data;
        const transparent = pixels ? Array.from({ length: Math.floor(pixels.length / 4) }, (_, index) => pixels[index * 4 + 3]).some((alpha) => alpha < 250) : false;
        if (!transparent) {
          URL.revokeObjectURL(url);
          setArtError("A arte personalizada precisa ter fundo transparente.");
          return;
        }
      }
      if (currentVariantArt[side].preview) URL.revokeObjectURL(currentVariantArt[side].preview);
      updateVariantSide(side, (current) => {
        return { ...current, file, preview: url, source: "custom", transformOverride: artMode === "overlay" };
      });
      setArtError("");
    };
    image.src = url;
  }

  function removeVariantSide(side: "front" | "back") {
    if (currentVariantArt[side].preview) URL.revokeObjectURL(currentVariantArt[side].preview);
    updateVariantSide(side, () => emptyArtSide(artMode === "overlay" && side === "front" ? "inherit" : "none"));
    setArtError("");
  }

  function restoreVariantInheritance() {
    if (artMode !== "overlay") return;
    setVariantArts((current) => {
      const byMode = current[previewKey] ?? {};
      return { ...current, [previewKey]: { ...byMode, overlay: emptyVariantArt("overlay") } };
    });
    setArtError("");
  }

  function selectArtworkVariant(model: ShirtModelName, color: string) {
    setArtVariant({ model, color });
    setArtScope("variant");
    if (artMode === "variant_mockup") {
      const saved = variantArts[variantArtKey(model, color)]?.variant_mockup;
      if (saved?.front.source !== "custom" && saved?.back.source === "custom") setArtPreviewSide("back");
      else setArtPreviewSide("front");
    }
    setArtError("");
  }

  function setCurrentTransform(next: ArtworkTransform) {
    if (artMode !== "overlay") return;
    const normalized = {
      x: Math.max(-100, Math.min(100, next.x)),
      y: Math.max(-100, Math.min(100, next.y)),
      scale: Math.max(0.1, Math.min(3, next.scale)),
      rotation: Math.max(-180, Math.min(180, next.rotation)),
    };
    if (artScope === "base") {
      setBaseTransforms((current) => ({ ...current, [artPreviewSide]: normalized }));
    } else {
      updateVariantSide(artPreviewSide, (current) => ({ ...current, transform: normalized, transformOverride: true }));
    }
  }

  function resetCurrentTransform() {
    if (artMode !== "overlay") return;
    if (artScope === "base") setCurrentTransform({ ...defaultTransform });
    else updateVariantSide(artPreviewSide, (current) => ({ ...current, transform: { ...defaultTransform }, transformOverride: false }));
  }

  function startArtworkDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (artMode !== "overlay" || !previewArtwork[artPreviewSide]) return;
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const start = { x: event.clientX, y: event.clientY };
    const initial = artScope === "base"
      ? baseTransforms[artPreviewSide]
      : currentVariantArt[artPreviewSide].transformOverride
        ? currentVariantArt[artPreviewSide].transform
        : baseTransforms[artPreviewSide];
    const move = (moveEvent: PointerEvent) => {
      const rect = target.getBoundingClientRect();
      setCurrentTransform({
        ...initial,
        x: initial.x + ((moveEvent.clientX - start.x) / Math.max(rect.width, 1)) * 100,
        y: initial.y + ((moveEvent.clientY - start.y) / Math.max(rect.height, 1)) * 100,
      });
    };
    const finish = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", finish);
      target.removeEventListener("pointercancel", finish);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", finish);
    target.addEventListener("pointercancel", finish);
  }

  async function buildArtworkConfig(): Promise<CampaignArtworkConfig> {
    if (artMode === "legacy_mockup") throw new Error("Campanhas legadas só enviam configuração após escolher um novo modo.");
    const baseFrontUrl = front.file ? await uploadCampaignArt(front.file) : storedArtworkUrl(existingArt.front);
    const baseBackUrl = back.file ? await uploadCampaignArt(back.file) : storedArtworkUrl(existingArt.back);
    if (artMode === "overlay" && !baseFrontUrl) throw new Error("Envie a arte-base de frente.");
    const combinations = shirtModels.flatMap((model) => selectedModels[model.name]
      ? modelColors[model.name].map((colorName) => ({ model, colorName }))
      : []);
    const variants = await Promise.all(combinations.map(async ({ model, colorName }) => {
      const key = variantArtKey(model.name, colorName);
      const draft = variantArts[key]?.[artMode] ?? emptyVariantArt(artMode);
      const saveSide = async (side: "front" | "back") => {
        const value = draft[side];
        const url = value.file ? await uploadCampaignArt(value.file) : storedArtworkUrl(value.url);
        return {
          source: value.source,
          url: value.source === "custom" ? url : null,
          transformOverride: value.transformOverride,
          transform: value.transform,
        };
      };
      const frontSide = await saveSide("front");
      const backSide = await saveSide("back");
      if (artMode === "variant_mockup" && frontSide.source !== "custom" && backSide.source !== "custom") {
        throw new Error(`Envie frente ou costas para ${model.name === "Comum" ? "Padrão" : model.name} · ${colorName}.`);
      }
      return { modelCode: model.code, colorName, front: frontSide, back: backSide };
    }));
    return {
      mode: artMode,
      base: artMode === "overlay" ? {
        front: { url: baseFrontUrl!, transform: baseTransforms.front },
        back: baseBackUrl ? { url: baseBackUrl, transform: baseTransforms.back } : null,
      } : { front: null, back: null },
      variants,
    };
  }

  async function buildRealPhotos(): Promise<CampaignRealPhotoConfig[]> {
    return Promise.all(activeRealPhotoColors.map(async (color) => ({
      colorName: color.name,
      urls: await Promise.all((realPhotosByColor[colorKey(color.name)] ?? []).map(async (photo) => {
        if (photo.file) return uploadCampaignArt(photo.file);
        const stored = storedArtworkUrl(photo.url);
        if (!stored) throw new Error(`Uma foto real de ${color.name} não está disponível. Remova-a e envie novamente.`);
        return stored;
      })),
    })));
  }

  function buildRealVideos(): CampaignRealVideoConfig[] {
    return activeRealPhotoColors.flatMap((color) => {
      const video = realVideosByColor[colorKey(color.name)];
      if (!video) return [];
      if (video.status !== "ready") throw new Error(`Aguarde a conclusão do vídeo da cor ${color.name}.`);
      const url = storedArtworkUrl(video.url);
      const posterUrl = storedArtworkUrl(video.posterUrl);
      if (!url) throw new Error(`O vídeo da cor ${color.name} não está disponível. Remova-o e envie novamente.`);
      return [{ colorName: color.name, url, posterUrl, durationSeconds: video.durationSeconds, bytes: video.bytes }];
    });
  }

  function campaignModels() {
    return shirtModels.filter((model) => selectedModels[model.name]).map((model) => ({
      modelCode: model.code,
      unitPriceCents: Math.round(parseCampaignPrice(model.name === "Comum" ? commonPrice : oversizedPrice) * 100),
      colors: modelColors[model.name].map((name) => {
        const color = campaignColorOptions.find((option) => colorKey(option.name) === colorKey(name));
        return { name, hex: color?.hex.toUpperCase() ?? "" };
      }),
      sizes: modelSizes[model.name].filter((size) => defaultCampaignSizes[model.name].includes(size)),
    }));
  }

  function campaignCoupon() {
    if (!couponEnabled) return null;
    return {
      code: normalizeCouponText(couponCode),
      discounts: selectedCampaignModels.map((model) => ({
        modelCode: model.code,
        discountCents: Math.round(parseCampaignPrice(couponDiscounts[model.name]) * 100),
      })),
      expiresAt: couponExpires ? new Date(`${couponExpires}T23:59:59`).toISOString() : null,
      usageLimit: couponLimit ? Number(couponLimit) : null,
      minimumQuantity: Number(couponMinimumQuantity || 1),
      maximumDiscountQuantity: couponMaximumQuantity ? Number(couponMaximumQuantity) : null,
    };
  }

  function focusCampaignPanel() {
    window.setTimeout(() => document.getElementById("campaign-create-title")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function validateInformationStep() {
    if (campaignName.trim().length < 5) {
      setFormError("Informe um nome de campanha com pelo menos 5 caracteres.");
      setFormStep("information");
      focusCampaignPanel();
      return false;
    }
    if (representative.trim().length < 3) {
      setFormError("Informe o nome do representante da turma.");
      setFormStep("information");
      focusCampaignPanel();
      return false;
    }
    if (parseWhatsapp(representativePhone).error) {
      setFormError(parseWhatsapp(representativePhone).error!);
      setFormStep("information");
      focusCampaignPanel();
      return false;
    }
    if (!deadline) {
      setFormError("Informe o prazo final dos pedidos.");
      setFormStep("information");
      focusCampaignPanel();
      return false;
    }
    if (!pickup.trim()) {
      setFormError("Informe como será feita a retirada dos pedidos.");
      setFormStep("information");
      focusCampaignPanel();
      return false;
    }
    return true;
  }

  function validateProductsStep() {
    if (selectedCampaignModels.length === 0) {
      setFormError("Selecione pelo menos um corte para a campanha.");
      setFormStep("products");
      focusCampaignPanel();
      return false;
    }
    if (couponEnabled) {
      const normalizedCoupon = normalizeCouponText(couponCode);
      if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(normalizedCoupon)) {
        setFormError("Informe um cupom de 3 a 32 caracteres, usando letras, números, hífen ou sublinhado.");
        setFormStep("products");
        focusCampaignPanel();
        return false;
      }
      const invalidDiscount = selectedCampaignModels.find((model) => {
        const discount = parseCampaignPrice(couponDiscounts[model.name]);
        const price = parseCampaignPrice(model.name === "Comum" ? commonPrice : oversizedPrice);
        return discount <= 0 || discount >= price;
      });
      if (invalidDiscount) {
        setFormError(`O desconto de ${invalidDiscount.name === "Comum" ? "Padrão" : invalidDiscount.name} deve ser maior que zero e menor que o preço do corte.`);
        setFormStep("products");
        focusCampaignPanel();
        return false;
      }
      if (couponLimit && (!/^\d+$/.test(couponLimit) || Number(couponLimit) < 1)) {
        setFormError("O limite de utilizações do cupom precisa ser um número inteiro maior que zero.");
        setFormStep("products");
        focusCampaignPanel();
        return false;
      }
      if (!/^\d+$/.test(couponMinimumQuantity) || Number(couponMinimumQuantity) < 1 || Number(couponMinimumQuantity) > 200) {
        setFormError("A quantidade mínima do cupom precisa ser um número inteiro entre 1 e 200.");
        setFormStep("products");
        focusCampaignPanel();
        return false;
      }
      if (couponMaximumQuantity && (
        !/^\d+$/.test(couponMaximumQuantity)
        || Number(couponMaximumQuantity) < Number(couponMinimumQuantity)
        || Number(couponMaximumQuantity) > 200
      )) {
        setFormError("A quantidade máxima com desconto precisa ser igual ou maior que a mínima e ter no máximo 200 peças.");
        setFormStep("products");
        focusCampaignPanel();
        return false;
      }
    }
    if (variantsLocked) return true;
    const modelWithoutPrice = selectedCampaignModels.find((model) => parseCampaignPrice(model.name === "Comum" ? commonPrice : oversizedPrice) <= 0);
    if (modelWithoutPrice) {
      setFormError(`Informe o preço do corte ${modelWithoutPrice.name === "Comum" ? "Padrão" : modelWithoutPrice.name}.`);
      setFormStep("products");
      setProductConfiguration(modelWithoutPrice.name);
      focusCampaignPanel();
      return false;
    }
    const modelWithoutColor = selectedCampaignModels.find((model) => modelColors[model.name].length === 0);
    if (modelWithoutColor) {
      setColorModel(modelWithoutColor.name);
      setProductConfiguration(modelWithoutColor.name);
      setColorError(`Selecione pelo menos uma cor para o corte ${modelWithoutColor.name === "Comum" ? "Padrão" : modelWithoutColor.name}.`);
      setFormStep("products");
      focusCampaignPanel();
      return false;
    }
    const modelWithoutSize = selectedCampaignModels.find((model) => modelSizes[model.name].length === 0);
    if (modelWithoutSize) {
      setSizeModel(modelWithoutSize.name);
      setProductConfiguration(modelWithoutSize.name);
      setSizeError(`Selecione pelo menos um tamanho para o corte ${modelWithoutSize.name === "Comum" ? "Padrão" : modelWithoutSize.name}.`);
      setFormStep("products");
      focusCampaignPanel();
      return false;
    }
    return true;
  }

  function validateImagesStep() {
    if (!mockupEnabled && !realPhotosEnabled) {
      setFormError("Escolha Mockup, Fotos reais ou Ambos.");
      setFormStep("images");
      focusCampaignPanel();
      return false;
    }
    if (videoUploadInProgress) {
      setArtError("Aguarde a conclusão do vídeo ou cancele o envio antes de continuar.");
      setFormStep("images");
      focusCampaignPanel();
      return false;
    }
    if (mockupEnabled && artMode === "overlay" && !front.file && !existingArt.front) {
      setArtError(editing?.artRenderMode === "legacy_mockup"
        ? "Para converter esta campanha antiga, envie uma nova arte-base transparente de frente."
        : "Envie a arte-base de frente antes de continuar.");
      setFormStep("images");
      focusCampaignPanel();
      return false;
    }
    if (mockupEnabled && artMode === "variant_mockup" && !variantMockupsComplete) {
      setArtError("Preencha pelo menos frente ou costas para cada combinação de corte e cor.");
      setFormStep("images");
      focusCampaignPanel();
      return false;
    }
    if (realPhotosEnabled) {
      const colorWithoutPhoto = activeRealPhotoColors.find((color) => !(realPhotosByColor[colorKey(color.name)]?.length));
      if (colorWithoutPhoto) {
        setArtError(`Envie pelo menos uma foto real para a cor ${colorWithoutPhoto.name}.`);
        setFormStep("images");
        focusCampaignPanel();
        return false;
      }
    }
    return true;
  }

  function goToCampaignStep(next: CampaignFormStep) {
    clearCampaignAlert();
    const currentIndex = campaignFormSteps.findIndex((step) => step.id === formStep);
    const nextIndex = campaignFormSteps.findIndex((step) => step.id === next);
    if (nextIndex > currentIndex) {
      if (currentIndex < 1 && !validateInformationStep()) return;
      if (nextIndex > 1 && !validateProductsStep()) return;
      if (nextIndex > 2 && !validateImagesStep()) return;
    }
    setFormStep(next);
    setDraftFeedback("");
    focusCampaignPanel();
  }

  function goToPreviousCampaignStep() {
    const currentIndex = campaignFormSteps.findIndex((step) => step.id === formStep);
    if (currentIndex > 0) goToCampaignStep(campaignFormSteps[currentIndex - 1].id);
  }

  function goToNextCampaignStep() {
    const currentIndex = campaignFormSteps.findIndex((step) => step.id === formStep);
    if (currentIndex < campaignFormSteps.length - 1) goToCampaignStep(campaignFormSteps[currentIndex + 1].id);
  }

  function chooseImagePresentation(modeName: "mockup" | "photos" | "both") {
    setMockupEnabled(modeName !== "photos");
    setRealPhotosEnabled(modeName !== "mockup");
    setFormError("");
    setArtError("");
  }

  async function submitCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearCampaignAlert();
    if (!validateInformationStep() || !validateProductsStep() || !validateImagesStep()) return;
    if (!mockupEnabled && !realPhotosEnabled) {
      setFormError("Ative o mockup, as fotos reais ou ambos.");
      return;
    }
    if (mockupEnabled && !editing && artMode === "overlay" && !front.file) {
      setArtError("Envie a arte-base de frente antes de criar o acesso.");
      return;
    }
    if (mockupEnabled && editing?.artRenderMode === "legacy_mockup" && artMode === "overlay" && !front.file) {
      setArtError("Para converter esta campanha antiga, envie uma nova arte-base transparente de frente.");
      return;
    }
    if (realPhotosEnabled) {
      const colorWithoutPhoto = activeRealPhotoColors.find((color) => !(realPhotosByColor[colorKey(color.name)]?.length));
      if (colorWithoutPhoto) {
        const modelsUsingColor = shirtModels
          .filter((model) => selectedModels[model.name]
            && modelColors[model.name].some((name) => colorKey(name) === colorKey(colorWithoutPhoto.name)))
          .map((model) => model.name === "Comum" ? "Padrão" : model.name);
        const modelLabel = modelsUsingColor.length === 1
          ? `no modelo ${modelsUsingColor[0]}`
          : `nos modelos ${modelsUsingColor.slice(0, -1).join(", ")} e ${modelsUsingColor.at(-1)}`;
        setArtError(`Envie pelo menos uma foto real para a cor ${colorWithoutPhoto.name} ${modelLabel}.`);
        return;
      }
    }
    if (!variantsLocked) {
      const selectedCampaignModels = shirtModels.filter((item) => selectedModels[item.name]);
      if (selectedCampaignModels.length === 0) {
        setFormError("Selecione pelo menos um corte para a campanha.");
        return;
      }
      const modelWithoutColor = selectedCampaignModels.find((item) => modelColors[item.name].length === 0);
      if (modelWithoutColor) {
        setColorModel(modelWithoutColor.name);
        setColorError(`Selecione pelo menos uma cor para o corte ${modelWithoutColor.name}.`);
        return;
      }
      const modelWithoutSize = selectedCampaignModels.find((item) => modelSizes[item.name].length === 0);
      if (modelWithoutSize) {
        setSizeModel(modelWithoutSize.name);
        setSizeError(`Selecione pelo menos um tamanho para o corte ${modelWithoutSize.name}.`);
        return;
      }
    }
    if (mode !== "live") {
      setFormError("Sem sessão no servidor, a campanha não pode ser gravada. Entre novamente para continuar.");
      return;
    }

    setSubmitting(true);
    try {
      const artworkConfig = mockupEnabled && artMode !== "legacy_mockup" ? await buildArtworkConfig() : undefined;
      const realPhotos = realPhotosEnabled ? await buildRealPhotos() : undefined;
      const realVideos = realPhotosEnabled ? buildRealVideos() : undefined;
      const presentationConfig = { mockupEnabled, realPhotosEnabled };
      if (editing) {
        const payload: UpdateCampaignPayload = {
          title: campaignName,
          subtitle: subtitle.trim() || null,
          deadlineAt: new Date(`${deadline}T23:59:59`).toISOString(),
          pickupInstructions: pickup,
          deliveryExpectedOn: deliveryExpectedOn || null,
          deliveryNote: deliveryNote.trim() || null,
          representative: { name: representative, whatsapp: representativePhone },
          presentationConfig,
          coupon: campaignCoupon(),
          receiverId,
        };
        if (artworkConfig) payload.artworkConfig = artworkConfig;
        if (realPhotos) payload.realPhotos = realPhotos;
        if (realVideos) payload.realVideos = realVideos;
        if (!variantsLocked) payload.models = campaignModels();

        await updateCampaignInApi(editing.code, payload);
        closeForm();
        reload();
        setNotice(`Campanha ${editing.code} atualizada.`);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const created = await createCampaignInApi({
        code: campaignCodeInput.trim() || undefined,
        title: campaignName,
        subtitle: subtitle.trim() || undefined,
        deadlineAt: new Date(`${deadline}T23:59:59`).toISOString(),
        pickupInstructions: pickup,
          deliveryExpectedOn: deliveryExpectedOn || null,
          deliveryNote: deliveryNote.trim() || null,
        representative: { name: representative, whatsapp: representativePhone },
        presentationConfig,
        artworkConfig,
        realPhotos,
        realVideos,
        coupon: campaignCoupon(),
        receiverId,
        models: campaignModels(),
      });
      sessionStorage.removeItem(campaignDraftKey);
      closeForm();
      reload();
      setShared({
        code: created.code,
        title: campaignName,
        phase: "receiving_orders",
        deadlineLabel: formatDeadline(new Date(`${deadline}T23:59:59`).toISOString()),
        representative,
        artFront: front.preview || previewArtwork.front?.url || previewArtwork.back?.url || shirtModels[0].image,
        orderCount: 0,
        paidTotalCents: 0,
        canDelete: true,
        activeCoupon: couponEnabled ? {
          ...campaignCoupon()!,
          discounts: selectedCampaignModels.map((model) => ({
            modelCode: model.code,
            modelName: model.name,
            discountCents: Math.round(parseCampaignPrice(couponDiscounts[model.name]) * 100),
          })),
        } : null,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setFormError(errorMessage(submitError, editing ? "Não foi possível salvar a campanha." : "Não foi possível criar a campanha."));
    } finally {
      setSubmitting(false);
    }
  }


 return { campaignAlert, clearCampaignAlert, creating, startCampaign, editing, closeForm, loadingDetail, submitCampaign, handleCampaignInvalid, formStep, informationComplete, productsComplete, imagesComplete, goToCampaignStep, variantsLocked, campaignName, setCampaignName, representative, setRepresentative, representativePhone, setRepresentativePhone, deadline, setDeadline, deliveryExpectedOn, setDeliveryExpectedOn, deliveryNote, setDeliveryNote, receiverId, setReceiverId, receivers, receiversError, pickup, setPickup, subtitle, setSubtitle, campaignCodeInput, setCampaignCodeInput, selectedModels, commonPrice, oversizedPrice, setCommonPrice, setOversizedPrice, toggleCampaignModel, setProductConfiguration, setColorModel, setSizeModel, productConfiguration, couponEnabled, setCouponEnabled, setFormError, couponCode, setCouponCode, selectedCampaignModels, couponDiscounts, setCouponDiscounts, couponMinimumQuantity, setCouponMinimumQuantity, couponMaximumQuantity, setCouponMaximumQuantity, couponExpires, setCouponExpires, couponLimit, setCouponLimit, colorModel, setColorError, modelColors, campaignColorOptions, toggleCampaignColor, customColorOpen, setCustomColorOpen, customColorName, setCustomColorName, addCustomCampaignColor, customColorHex, setCustomColorHex, removeCustomCampaignColor, sizeModel, setSizeError, modelSizes, toggleSizeGroup, toggleCampaignSize, mockupEnabled, realPhotosEnabled, chooseImagePresentation, artMode, setArtMode, setArtScope, setArtPreviewSide, setArtError, artScope, variantArts, previewModel, previewColor, selectArtworkVariant, previewArtwork, artPreviewSide, previewArt, startArtworkDrag, setAdvancedArtOpen, advancedArtOpen, activeTransform, setCurrentTransform, resetCurrentTransform, front, back, existingArt, currentVariantArt, chooseArt, chooseVariantArt, removeVariantSide, removeBackArt, restoreVariantInheritance, activeVariantCombinations, activeRealPhotoColors, realPhotosByColor, realVideosByColor, removeRealPhoto, chooseRealPhotos, removeRealVideo, chooseRealVideo, summaryColorCount, summarySizeCount, saveCampaignDraft, draftFeedback, goToPreviousCampaignStep, goToNextCampaignStep, submitting, videoUploadInProgress, notice, shared, campaigns, setShared, phaseFilter, setPhaseFilter, filtered, deleteConfirmation, deleteError, setDeleteConfirmation, setDeleteError, deleting, confirmDeleteCampaign, startEdit, setNotice };
}
