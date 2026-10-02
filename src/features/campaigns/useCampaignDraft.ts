import { useReducer, useMemo } from 'react';

import type { CampaignPhaseCode } from '../../api';
import { defaultCampaignColors, shirtColors } from "../../data";
import type { ShirtColorName, ShirtColorOption, ShirtModelName, SizeCode } from '../../data';
import type { ArtworkTransform } from '../../data';

import { defaultPickupInstructions } from "../admin/model";
import type { PanelCampaign } from '../admin/model';
import { defaultModelColorNames, defaultModelSizes, mergeCampaignColors, defaultTransform } from "./editor-model";
import type { ArtDraft, RealPhotoDraft, RealVideoDraft, EditableArtMode, CampaignFormStep, VariantArtDraft } from './editor-model';

function initialDraft() {
  const phaseFilter: "all" | CampaignPhaseCode = "all";
  const creating = false;
  const shared: PanelCampaign | null = null;
  const notice = "";
  const deleteConfirmation: PanelCampaign | null = null;
  const deleting = false;
  const deleteError = "";
  const editing: { code: string; phase: CampaignPhaseCode; hadBackArt: boolean; artRenderMode: EditableArtMode } | null = null;
  const loadingDetail = false;
  const existingArt: { front: string; back: string } = { front: "", back: "" };
  const campaignName = "";
  const campaignCodeInput = "";
  const subtitle = "";
  const pickup = defaultPickupInstructions;
  const representative = "";
  const representativePhone = "";
  const deadline = "";
  const receiverId: number | null = null;
  const commonPrice = "59,90";
  const oversizedPrice = "69,90";
  const couponEnabled = false;
  const couponCode = "";
  const couponDiscounts: Record<ShirtModelName, string> = { Comum: "10,00", Oversized: "10,00" };
  const couponExpires = "";
  const couponLimit = "";
  const couponMinimumQuantity = "1";
  const couponMaximumQuantity = "";
  const selectedModels: Record<ShirtModelName, boolean> = { Comum: true, Oversized: true };
  const front: ArtDraft = { file: null, preview: "" };
  const back: ArtDraft = { file: null, preview: "" };
  const artMode: EditableArtMode = "overlay";
  const mockupEnabled = false;
  const realPhotosEnabled = false;
  const artScope: "base" | "variant" = "base";
  const baseTransforms: { front: ArtworkTransform; back: ArtworkTransform } = { front: { ...defaultTransform }, back: { ...defaultTransform } };
  const variantArts: Record<string, Partial<Record<"overlay" | "variant_mockup", VariantArtDraft>>> = {};
  const realPhotosByColor: Record<string, RealPhotoDraft[]> = {};
  const realVideosByColor: Record<string, RealVideoDraft> = {};
  const artVariant: { model: ShirtModelName; color: string } = { model: "Comum", color: defaultCampaignColors.Comum[0].name };
  const artPreviewSide: "front" | "back" = "front";
  const artError = "";
  const colorModel: ShirtModelName = "Comum";
  const campaignColorOptions: ShirtColorOption[] = (() => mergeCampaignColors(shirtColors))();
  const modelColors: Record<ShirtModelName, ShirtColorName[]> = defaultModelColorNames();
  const customColorName = "";
  const customColorHex = "#808080";
  const colorError = "";
  const sizeModel: ShirtModelName = "Comum";
  const modelSizes: Record<ShirtModelName, SizeCode[]> = defaultModelSizes();
  const sizeError = "";
  const submitting = false;
  const formError = "";
  const formStep: CampaignFormStep = "information";
  const productConfiguration: ShirtModelName | null = null;
  const customColorOpen = false;
  const advancedArtOpen = false;
  const draftFeedback = "";
 return { phaseFilter: phaseFilter as "all" | CampaignPhaseCode, creating, shared: shared as PanelCampaign | null, notice, deleteConfirmation: deleteConfirmation as PanelCampaign | null, deleting, deleteError, editing: editing as { code: string; phase: CampaignPhaseCode; hadBackArt: boolean; artRenderMode: EditableArtMode } | null, loadingDetail, existingArt: existingArt as { front: string; back: string }, campaignName, campaignCodeInput, subtitle, pickup, representative, representativePhone, deadline, receiverId: receiverId as number | null, commonPrice, oversizedPrice, couponEnabled, couponCode, couponDiscounts: couponDiscounts as Record<ShirtModelName, string>, couponExpires, couponLimit, couponMinimumQuantity, couponMaximumQuantity, selectedModels: selectedModels as Record<ShirtModelName, boolean>, front: front as ArtDraft, back: back as ArtDraft, artMode: artMode as EditableArtMode, mockupEnabled, realPhotosEnabled, artScope: artScope as "base" | "variant", baseTransforms: baseTransforms as { front: ArtworkTransform; back: ArtworkTransform }, variantArts: variantArts as Record<string, Partial<Record<"overlay" | "variant_mockup", VariantArtDraft>>>, realPhotosByColor: realPhotosByColor as Record<string, RealPhotoDraft[]>, realVideosByColor: realVideosByColor as Record<string, RealVideoDraft>, artVariant: artVariant as { model: ShirtModelName; color: string }, artPreviewSide: artPreviewSide as "front" | "back", artError, colorModel: colorModel as ShirtModelName, campaignColorOptions: campaignColorOptions as ShirtColorOption[], modelColors: modelColors as Record<ShirtModelName, ShirtColorName[]>, customColorName, customColorHex, colorError, sizeModel: sizeModel as ShirtModelName, modelSizes: modelSizes as Record<ShirtModelName, SizeCode[]>, sizeError, submitting, formError, formStep: formStep as CampaignFormStep, productConfiguration: productConfiguration as ShirtModelName | null, customColorOpen, advancedArtOpen, draftFeedback };
}
export type CampaignDraft = ReturnType<typeof initialDraft>;
type FieldAction = { [K in keyof CampaignDraft]: {type:'set';key:K;value: React.SetStateAction<CampaignDraft[K]>} }[keyof CampaignDraft];
export type DraftAction = FieldAction | {type:'load';value:Partial<CampaignDraft>} | {type:'reset';value:Partial<CampaignDraft>};
export function campaignDraftReducer(state:CampaignDraft,action:DraftAction):CampaignDraft {
 if(action.type==='reset') return {...state,...action.value};
 if(action.type==='load') return {...state,...action.value};
 const next=typeof action.value==='function' ? (action.value as (previous:CampaignDraft[keyof CampaignDraft])=>CampaignDraft[keyof CampaignDraft])(state[action.key]) : action.value;
 return {...state,[action.key]:next};
}
export function useCampaignDraft() {
 const [draft,dispatch]=useReducer(campaignDraftReducer,undefined,initialDraft);
 const actions=useMemo(()=>({
  setPhaseFilter: (value:React.SetStateAction<CampaignDraft['phaseFilter']>)=>dispatch({type:'set',key:'phaseFilter',value}),
  setCreating: (value:React.SetStateAction<CampaignDraft['creating']>)=>dispatch({type:'set',key:'creating',value}),
  setShared: (value:React.SetStateAction<CampaignDraft['shared']>)=>dispatch({type:'set',key:'shared',value}),
  setNotice: (value:React.SetStateAction<CampaignDraft['notice']>)=>dispatch({type:'set',key:'notice',value}),
  setDeleteConfirmation: (value:React.SetStateAction<CampaignDraft['deleteConfirmation']>)=>dispatch({type:'set',key:'deleteConfirmation',value}),
  setDeleting: (value:React.SetStateAction<CampaignDraft['deleting']>)=>dispatch({type:'set',key:'deleting',value}),
  setDeleteError: (value:React.SetStateAction<CampaignDraft['deleteError']>)=>dispatch({type:'set',key:'deleteError',value}),
  setEditing: (value:React.SetStateAction<CampaignDraft['editing']>)=>dispatch({type:'set',key:'editing',value}),
  setLoadingDetail: (value:React.SetStateAction<CampaignDraft['loadingDetail']>)=>dispatch({type:'set',key:'loadingDetail',value}),
  setExistingArt: (value:React.SetStateAction<CampaignDraft['existingArt']>)=>dispatch({type:'set',key:'existingArt',value}),
  setCampaignName: (value:React.SetStateAction<CampaignDraft['campaignName']>)=>dispatch({type:'set',key:'campaignName',value}),
  setCampaignCodeInput: (value:React.SetStateAction<CampaignDraft['campaignCodeInput']>)=>dispatch({type:'set',key:'campaignCodeInput',value}),
  setSubtitle: (value:React.SetStateAction<CampaignDraft['subtitle']>)=>dispatch({type:'set',key:'subtitle',value}),
  setPickup: (value:React.SetStateAction<CampaignDraft['pickup']>)=>dispatch({type:'set',key:'pickup',value}),
  setRepresentative: (value:React.SetStateAction<CampaignDraft['representative']>)=>dispatch({type:'set',key:'representative',value}),
  setRepresentativePhone: (value:React.SetStateAction<CampaignDraft['representativePhone']>)=>dispatch({type:'set',key:'representativePhone',value}),
  setDeadline: (value:React.SetStateAction<CampaignDraft['deadline']>)=>dispatch({type:'set',key:'deadline',value}),
  setReceiverId: (value:React.SetStateAction<CampaignDraft['receiverId']>)=>dispatch({type:'set',key:'receiverId',value}),
  setCommonPrice: (value:React.SetStateAction<CampaignDraft['commonPrice']>)=>dispatch({type:'set',key:'commonPrice',value}),
  setOversizedPrice: (value:React.SetStateAction<CampaignDraft['oversizedPrice']>)=>dispatch({type:'set',key:'oversizedPrice',value}),
  setCouponEnabled: (value:React.SetStateAction<CampaignDraft['couponEnabled']>)=>dispatch({type:'set',key:'couponEnabled',value}),
  setCouponCode: (value:React.SetStateAction<CampaignDraft['couponCode']>)=>dispatch({type:'set',key:'couponCode',value}),
  setCouponDiscounts: (value:React.SetStateAction<CampaignDraft['couponDiscounts']>)=>dispatch({type:'set',key:'couponDiscounts',value}),
  setCouponExpires: (value:React.SetStateAction<CampaignDraft['couponExpires']>)=>dispatch({type:'set',key:'couponExpires',value}),
  setCouponLimit: (value:React.SetStateAction<CampaignDraft['couponLimit']>)=>dispatch({type:'set',key:'couponLimit',value}),
  setCouponMinimumQuantity: (value:React.SetStateAction<CampaignDraft['couponMinimumQuantity']>)=>dispatch({type:'set',key:'couponMinimumQuantity',value}),
  setCouponMaximumQuantity: (value:React.SetStateAction<CampaignDraft['couponMaximumQuantity']>)=>dispatch({type:'set',key:'couponMaximumQuantity',value}),
  setSelectedModels: (value:React.SetStateAction<CampaignDraft['selectedModels']>)=>dispatch({type:'set',key:'selectedModels',value}),
  setFront: (value:React.SetStateAction<CampaignDraft['front']>)=>dispatch({type:'set',key:'front',value}),
  setBack: (value:React.SetStateAction<CampaignDraft['back']>)=>dispatch({type:'set',key:'back',value}),
  setArtMode: (value:React.SetStateAction<CampaignDraft['artMode']>)=>dispatch({type:'set',key:'artMode',value}),
  setMockupEnabled: (value:React.SetStateAction<CampaignDraft['mockupEnabled']>)=>dispatch({type:'set',key:'mockupEnabled',value}),
  setRealPhotosEnabled: (value:React.SetStateAction<CampaignDraft['realPhotosEnabled']>)=>dispatch({type:'set',key:'realPhotosEnabled',value}),
  setArtScope: (value:React.SetStateAction<CampaignDraft['artScope']>)=>dispatch({type:'set',key:'artScope',value}),
  setBaseTransforms: (value:React.SetStateAction<CampaignDraft['baseTransforms']>)=>dispatch({type:'set',key:'baseTransforms',value}),
  setVariantArts: (value:React.SetStateAction<CampaignDraft['variantArts']>)=>dispatch({type:'set',key:'variantArts',value}),
  setRealPhotosByColor: (value:React.SetStateAction<CampaignDraft['realPhotosByColor']>)=>dispatch({type:'set',key:'realPhotosByColor',value}),
  setRealVideosByColor: (value:React.SetStateAction<CampaignDraft['realVideosByColor']>)=>dispatch({type:'set',key:'realVideosByColor',value}),
  setArtVariant: (value:React.SetStateAction<CampaignDraft['artVariant']>)=>dispatch({type:'set',key:'artVariant',value}),
  setArtPreviewSide: (value:React.SetStateAction<CampaignDraft['artPreviewSide']>)=>dispatch({type:'set',key:'artPreviewSide',value}),
  setArtError: (value:React.SetStateAction<CampaignDraft['artError']>)=>dispatch({type:'set',key:'artError',value}),
  setColorModel: (value:React.SetStateAction<CampaignDraft['colorModel']>)=>dispatch({type:'set',key:'colorModel',value}),
  setCampaignColorOptions: (value:React.SetStateAction<CampaignDraft['campaignColorOptions']>)=>dispatch({type:'set',key:'campaignColorOptions',value}),
  setModelColors: (value:React.SetStateAction<CampaignDraft['modelColors']>)=>dispatch({type:'set',key:'modelColors',value}),
  setCustomColorName: (value:React.SetStateAction<CampaignDraft['customColorName']>)=>dispatch({type:'set',key:'customColorName',value}),
  setCustomColorHex: (value:React.SetStateAction<CampaignDraft['customColorHex']>)=>dispatch({type:'set',key:'customColorHex',value}),
  setColorError: (value:React.SetStateAction<CampaignDraft['colorError']>)=>dispatch({type:'set',key:'colorError',value}),
  setSizeModel: (value:React.SetStateAction<CampaignDraft['sizeModel']>)=>dispatch({type:'set',key:'sizeModel',value}),
  setModelSizes: (value:React.SetStateAction<CampaignDraft['modelSizes']>)=>dispatch({type:'set',key:'modelSizes',value}),
  setSizeError: (value:React.SetStateAction<CampaignDraft['sizeError']>)=>dispatch({type:'set',key:'sizeError',value}),
  setSubmitting: (value:React.SetStateAction<CampaignDraft['submitting']>)=>dispatch({type:'set',key:'submitting',value}),
  setFormError: (value:React.SetStateAction<CampaignDraft['formError']>)=>dispatch({type:'set',key:'formError',value}),
  setFormStep: (value:React.SetStateAction<CampaignDraft['formStep']>)=>dispatch({type:'set',key:'formStep',value}),
  setProductConfiguration: (value:React.SetStateAction<CampaignDraft['productConfiguration']>)=>dispatch({type:'set',key:'productConfiguration',value}),
  setCustomColorOpen: (value:React.SetStateAction<CampaignDraft['customColorOpen']>)=>dispatch({type:'set',key:'customColorOpen',value}),
  setAdvancedArtOpen: (value:React.SetStateAction<CampaignDraft['advancedArtOpen']>)=>dispatch({type:'set',key:'advancedArtOpen',value}),
  setDraftFeedback: (value:React.SetStateAction<CampaignDraft['draftFeedback']>)=>dispatch({type:'set',key:'draftFeedback',value}),
  loadDraft:(value:Partial<CampaignDraft>)=>dispatch({type:'load',value}),
  resetDraft:(value:Partial<CampaignDraft>)=>dispatch({type:'reset',value}),
 }),[]);
 return {...draft,...actions};
}
