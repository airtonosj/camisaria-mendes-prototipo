import { ReviewStep } from './steps/ReviewStep';
import { ImagesStep } from './steps/ImagesStep';
import { ProductsStep } from './steps/ProductsStep';
import { InformationStep } from './steps/InformationStep';

import { phaseOrder, phaseMeta, formatCents } from "../admin/model";
import type { PanelData } from '../admin/model';
import { suggestCode, campaignFormSteps } from "./editor-model";

import { CampaignSharePanel } from "./CampaignSharePanel";

import { useCampaignEditor } from './useCampaignEditor';
export function Campaigns({data}:{data:PanelData}) {
 const { campaignAlert, clearCampaignAlert, creating, startCampaign, editing, closeForm, loadingDetail, submitCampaign, handleCampaignInvalid, formStep, informationComplete, productsComplete, imagesComplete, goToCampaignStep, variantsLocked, campaignName, setCampaignName, representative, setRepresentative, representativePhone, setRepresentativePhone, deadline, setDeadline, deliveryExpectedOn, setDeliveryExpectedOn, deliveryNote, setDeliveryNote, receiverId, setReceiverId, receivers, receiversError, pickup, setPickup, subtitle, setSubtitle, campaignCodeInput, setCampaignCodeInput, selectedModels, commonPrice, oversizedPrice, setCommonPrice, setOversizedPrice, toggleCampaignModel, setProductConfiguration, setColorModel, setSizeModel, productConfiguration, couponEnabled, setCouponEnabled, setFormError, couponCode, setCouponCode, selectedCampaignModels, couponDiscounts, setCouponDiscounts, couponMinimumQuantity, setCouponMinimumQuantity, couponMaximumQuantity, setCouponMaximumQuantity, couponExpires, setCouponExpires, couponLimit, setCouponLimit, colorModel, setColorError, modelColors, campaignColorOptions, toggleCampaignColor, customColorOpen, setCustomColorOpen, customColorName, setCustomColorName, addCustomCampaignColor, customColorHex, setCustomColorHex, removeCustomCampaignColor, sizeModel, setSizeError, modelSizes, toggleSizeGroup, toggleCampaignSize, mockupEnabled, realPhotosEnabled, chooseImagePresentation, artMode, setArtMode, setArtScope, setArtPreviewSide, setArtError, artScope, variantArts, previewModel, previewColor, selectArtworkVariant, previewArtwork, artPreviewSide, previewArt, startArtworkDrag, setAdvancedArtOpen, advancedArtOpen, activeTransform, setCurrentTransform, resetCurrentTransform, front, back, existingArt, currentVariantArt, chooseArt, chooseVariantArt, removeVariantSide, removeBackArt, restoreVariantInheritance, activeVariantCombinations, activeRealPhotoColors, realPhotosByColor, realVideosByColor, removeRealPhoto, chooseRealPhotos, removeRealVideo, chooseRealVideo, summaryColorCount, summarySizeCount, saveCampaignDraft, draftFeedback, goToPreviousCampaignStep, goToNextCampaignStep, submitting, videoUploadInProgress, notice, shared, campaigns, setShared, phaseFilter, setPhaseFilter, filtered, deleteConfirmation, deleteError, setDeleteConfirmation, setDeleteError, deleting, confirmDeleteCampaign, startEdit, setNotice }=useCampaignEditor(data);
 return (
    <div className="admin-content admin-campaigns-page">
      {campaignAlert && <div className="campaign-validation-toast" role="alert" aria-live="assertive">
        <span className="material-symbols-rounded" aria-hidden="true">error</span>
        <p>{campaignAlert}</p>
        <button type="button" onClick={clearCampaignAlert} aria-label="Fechar aviso"><span className="material-symbols-rounded" aria-hidden="true">close</span></button>
      </div>}
      {!creating && <div className="section-actions">
        <div><span className="kicker">Gestão</span><h2>Campanhas da camisaria</h2><p>Crie o acesso privado e acompanhe cada turma até a entrega.</p></div>
        <button className="primary-action" type="button" onClick={startCampaign}>Nova campanha<span className="material-symbols-rounded" aria-hidden="true">add</span></button>
      </div>}

      {creating && (
        <section className="campaign-create-panel campaign-create-panel--wizard" aria-labelledby="campaign-create-title">
          <header>
            <div>
              <span className="kicker">{editing ? "Editar campanha" : "Nova campanha"}</span>
              <h3 id="campaign-create-title">{editing ? `Ajustar ${editing.code}` : "Configure a campanha"}</h3>
              <p>{editing ? "O link e o código já entregues à turma continuam valendo." : "Preencha uma etapa de cada vez. Você poderá revisar tudo antes de publicar."}</p>
            </div>
            <button type="button" onClick={closeForm} aria-label="Fechar formulário"><span className="material-symbols-rounded" aria-hidden="true">close</span></button>
          </header>
          {loadingDetail ? (
            <p className="admin-loading" aria-live="polite"><span className="material-symbols-rounded" aria-hidden="true">progress_activity</span>Carregando a campanha...</p>
          ) : (
          <form onSubmit={submitCampaign} onInvalid={handleCampaignInvalid}>
            <nav className="campaign-wizard-steps" aria-label="Etapas da campanha">
              {campaignFormSteps.map((step, index) => {
                const activeIndex = campaignFormSteps.findIndex((item) => item.id === formStep);
                const stepComplete = step.id === "information" ? informationComplete : step.id === "products" ? productsComplete : step.id === "images" ? imagesComplete : false;
                const complete = index < activeIndex && stepComplete;
                return <button className={`${formStep === step.id ? "is-active" : ""} ${complete ? "is-complete" : ""}`} type="button" onClick={() => goToCampaignStep(step.id)} aria-current={formStep === step.id ? "step" : undefined} key={step.id}>
                  <span>{complete && formStep !== step.id ? <span className="material-symbols-rounded" aria-hidden="true">check</span> : index + 1}</span>
                  <span><strong>{step.label}</strong><small>{formStep === step.id ? "Em andamento" : complete ? "Concluído" : step.description}</small></span>
                </button>;
              })}
            </nav>
            {variantsLocked && editing && (
              <p className="campaign-locked-note" role="status">
                <span className="material-symbols-rounded" aria-hidden="true">lock</span>
                <span>Esta campanha está em <b>{phaseMeta[editing.phase].short}</b>. Preço, cores e tamanhos ficam travados a partir daqui, porque mudá-los com pedido pago no meio desalinha a produção e a cobrança. Título, prazo, retirada, representante e arte continuam editáveis.</span>
              </p>
            )}
            <div className={`campaign-wizard-layout ${formStep === "images" ? "is-images-step" : ""}`}>
              <main className="campaign-wizard-stage">
                {formStep === "information" && <InformationStep campaignName={campaignName} setCampaignName={setCampaignName} representative={representative} setRepresentative={setRepresentative} representativePhone={representativePhone} setRepresentativePhone={setRepresentativePhone} deadline={deadline} setDeadline={setDeadline} deliveryExpectedOn={deliveryExpectedOn} setDeliveryExpectedOn={setDeliveryExpectedOn} deliveryNote={deliveryNote} setDeliveryNote={setDeliveryNote} receiverId={receiverId} setReceiverId={setReceiverId} receivers={receivers} receiversError={receiversError} pickup={pickup} setPickup={setPickup} subtitle={subtitle} setSubtitle={setSubtitle} campaignCodeInput={campaignCodeInput} setCampaignCodeInput={setCampaignCodeInput} editing={editing} />}

                {formStep === "products" && <ProductsStep variantsLocked={variantsLocked} selectedModels={selectedModels} commonPrice={commonPrice} oversizedPrice={oversizedPrice} setCommonPrice={setCommonPrice} setOversizedPrice={setOversizedPrice} toggleCampaignModel={toggleCampaignModel} setProductConfiguration={setProductConfiguration} setColorModel={setColorModel} setSizeModel={setSizeModel} productConfiguration={productConfiguration} editing={editing} couponEnabled={couponEnabled} setCouponEnabled={setCouponEnabled} setFormError={setFormError} couponCode={couponCode} setCouponCode={setCouponCode} selectedCampaignModels={selectedCampaignModels} couponDiscounts={couponDiscounts} setCouponDiscounts={setCouponDiscounts} couponMinimumQuantity={couponMinimumQuantity} setCouponMinimumQuantity={setCouponMinimumQuantity} couponMaximumQuantity={couponMaximumQuantity} setCouponMaximumQuantity={setCouponMaximumQuantity} couponExpires={couponExpires} setCouponExpires={setCouponExpires} couponLimit={couponLimit} setCouponLimit={setCouponLimit} colorModel={colorModel} setColorError={setColorError} modelColors={modelColors} campaignColorOptions={campaignColorOptions} toggleCampaignColor={toggleCampaignColor} customColorOpen={customColorOpen} setCustomColorOpen={setCustomColorOpen} customColorName={customColorName} setCustomColorName={setCustomColorName} addCustomCampaignColor={addCustomCampaignColor} customColorHex={customColorHex} setCustomColorHex={setCustomColorHex} removeCustomCampaignColor={removeCustomCampaignColor} sizeModel={sizeModel} setSizeError={setSizeError} modelSizes={modelSizes} toggleSizeGroup={toggleSizeGroup} toggleCampaignSize={toggleCampaignSize} />}

                {formStep === "images" && <ImagesStep mockupEnabled={mockupEnabled} realPhotosEnabled={realPhotosEnabled} chooseImagePresentation={chooseImagePresentation} artMode={artMode} setArtMode={setArtMode} setArtScope={setArtScope} setArtPreviewSide={setArtPreviewSide} setArtError={setArtError} artScope={artScope} selectedModels={selectedModels} modelColors={modelColors} campaignColorOptions={campaignColorOptions} variantArts={variantArts} previewModel={previewModel} previewColor={previewColor} selectArtworkVariant={selectArtworkVariant} previewArtwork={previewArtwork} artPreviewSide={artPreviewSide} previewArt={previewArt} startArtworkDrag={startArtworkDrag} setAdvancedArtOpen={setAdvancedArtOpen} advancedArtOpen={advancedArtOpen} activeTransform={activeTransform} setCurrentTransform={setCurrentTransform} resetCurrentTransform={resetCurrentTransform} front={front} back={back} existingArt={existingArt} currentVariantArt={currentVariantArt} chooseArt={chooseArt} chooseVariantArt={chooseVariantArt} removeVariantSide={removeVariantSide} removeBackArt={removeBackArt} restoreVariantInheritance={restoreVariantInheritance} activeVariantCombinations={activeVariantCombinations} activeRealPhotoColors={activeRealPhotoColors} realPhotosByColor={realPhotosByColor} realVideosByColor={realVideosByColor} removeRealPhoto={removeRealPhoto} chooseRealPhotos={chooseRealPhotos} removeRealVideo={removeRealVideo} chooseRealVideo={chooseRealVideo} />}

                {formStep === "review" && <ReviewStep deliveryExpectedOn={deliveryExpectedOn} deliveryNote={deliveryNote} campaignName={campaignName} representative={representative} deadline={deadline} receiverId={receiverId} receivers={receivers} goToCampaignStep={goToCampaignStep} selectedCampaignModels={selectedCampaignModels} summaryColorCount={summaryColorCount} summarySizeCount={summarySizeCount} couponEnabled={couponEnabled} couponCode={couponCode} couponMinimumQuantity={couponMinimumQuantity} couponMaximumQuantity={couponMaximumQuantity} couponDiscounts={couponDiscounts} mockupEnabled={mockupEnabled} realPhotosEnabled={realPhotosEnabled} editing={editing} />}
              </main>

              <aside className="campaign-summary-card" aria-label="Resumo da campanha">
                <header><span className="material-symbols-rounded" aria-hidden="true">summarize</span><strong>Resumo da campanha</strong></header>
                <div className="campaign-summary-name"><small>Nome</small><strong>{campaignName || "Nova campanha"}</strong><span>{campaignCodeInput || (campaignName ? suggestCode(campaignName) : "Código automático")}</span></div>
                <dl>
                  <div><dt><span className="material-symbols-rounded" aria-hidden="true">checkroom</span>Cortes</dt><dd>{selectedCampaignModels.length || "—"}</dd></div>
                  <div><dt><span className="material-symbols-rounded" aria-hidden="true">palette</span>Cores</dt><dd>{summaryColorCount || "—"}</dd></div>
                  <div><dt><span className="material-symbols-rounded" aria-hidden="true">straighten</span>Tamanhos</dt><dd>{summarySizeCount || "—"}</dd></div>
                  <div><dt><span className="material-symbols-rounded" aria-hidden="true">sell</span>Cupom</dt><dd>{couponEnabled ? couponCode || "Ativo" : "—"}</dd></div>
                  <div><dt><span className="material-symbols-rounded" aria-hidden="true">image</span>Imagens</dt><dd>{mockupEnabled && realPhotosEnabled ? "Ambos" : mockupEnabled ? "Mockup" : realPhotosEnabled ? "Fotos" : "—"}</dd></div>
                </dl>
                <div className="campaign-summary-status"><span className={`material-symbols-rounded ${informationComplete && productsComplete && imagesComplete ? "is-ready" : ""}`} aria-hidden="true">{informationComplete && productsComplete && imagesComplete ? "check_circle" : "pending"}</span><span><strong>{informationComplete && productsComplete && imagesComplete ? "Configuração completa" : "Campanha em preparação"}</strong><small>{formStep === "review" ? "Pronta para a confirmação final" : `Etapa ${campaignFormSteps.findIndex((step) => step.id === formStep) + 1} de 4`}</small></span></div>
                <button type="button" onClick={saveCampaignDraft}><span className="material-symbols-rounded" aria-hidden="true">save</span>Salvar rascunho</button>
                {draftFeedback && <p role="status">{draftFeedback}</p>}
              </aside>
            </div>

            <footer className="campaign-create-actions campaign-wizard-actions">
              <button className="campaign-action-cancel" type="button" onClick={closeForm}>Cancelar</button>
              <div>
                {formStep !== "information" && <button className="outline-action" type="button" onClick={goToPreviousCampaignStep}><span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>Voltar</button>}
                {formStep !== "review" ? <button key="continue" className="primary-action" type="button" onClick={goToNextCampaignStep}>Continuar<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button> : <button key="publish" className="primary-action" type="submit" disabled={submitting || videoUploadInProgress || (!mockupEnabled && !realPhotosEnabled)} title={videoUploadInProgress ? "Aguarde ou cancele o envio do vídeo." : !mockupEnabled && !realPhotosEnabled ? "Ative o mockup ou as fotos reais para salvar a campanha." : undefined}>
                  {submitting ? (editing ? "Salvando..." : "Publicando...") : (editing ? "Salvar alterações" : "Publicar campanha")}
                  <span className="material-symbols-rounded" aria-hidden="true">{editing ? "check" : "rocket_launch"}</span>
                </button>}
              </div>
            </footer>
          </form>
          )}
        </section>
      )}

      {!creating && notice && <p className="campaign-notice" role="status"><span className="material-symbols-rounded" aria-hidden="true">check_circle</span>{notice}</p>}

      {!creating && shared && <CampaignSharePanel key={shared.code} campaign={campaigns.find(campaign => campaign.code === shared.code) ?? shared} onClose={() => setShared(null)} />}

      {!creating && <section className="campaign-management" aria-label="Campanhas cadastradas">
        <div className="campaign-management-toolbar">
          <div className="campaign-filters" role="group" aria-label="Filtrar campanhas">
            <button className={phaseFilter === "all" ? "is-active" : ""} type="button" onClick={() => setPhaseFilter("all")}>Todas<span>{campaigns.length}</span></button>
            {phaseOrder.map((phase) => {
              const count = campaigns.filter((campaign) => campaign.phase === phase).length;
              if (count === 0 && phaseFilter !== phase) return null;
              return <button className={phaseFilter === phase ? "is-active" : ""} type="button" onClick={() => setPhaseFilter(phase)} key={phase}>{phaseMeta[phase].label}<span>{count}</span></button>;
            })}
          </div>
          <span>{filtered.length} {filtered.length === 1 ? "campanha" : "campanhas"}</span>
        </div>

        <div className="campaign-admin-grid">
          {filtered.map((campaign) => (
            <article className="campaign-admin-card" key={campaign.code}>
              <div className="campaign-admin-card-image"><img src={campaign.artFront} alt={`Arte da campanha ${campaign.title}`} /><span className={`campaign-state campaign-state--${phaseMeta[campaign.phase].tone}`}>{phaseMeta[campaign.phase].label}</span></div>
              <div className="campaign-admin-card-body">
                <small>{campaign.code}</small><h3>{campaign.title}</h3><p><span className="material-symbols-rounded" aria-hidden="true">person</span>{campaign.representative}</p>{campaign.receiver && <p className="campaign-admin-card-receiver"><span className="material-symbols-rounded" aria-hidden="true">wallet</span>{campaign.receiver.name} · ${campaign.receiver.infinitepayHandle}</p>}
                <dl><div><dt>Pedidos</dt><dd>{campaign.orderCount}</dd></div><div><dt>Vendas</dt><dd>{formatCents(campaign.paidTotalCents)}</dd></div><div><dt>Prazo</dt><dd>{campaign.deadlineLabel.replace("Pedidos até ", "")}</dd></div></dl>
                {deleteConfirmation?.code === campaign.code ? (
                  <div className="campaign-delete-confirmation" role="alert">
                    <strong>Excluir esta campanha?</strong>
                    <span>Esta ação é definitiva e remove também suas configurações de cortes e cores.</span>
                    {deleteError && <p>{deleteError}</p>}
                    <div><button type="button" onClick={() => { setDeleteConfirmation(null); setDeleteError(""); }} disabled={deleting}>Cancelar</button><button type="button" onClick={confirmDeleteCampaign} disabled={deleting}>{deleting ? "Excluindo..." : "Excluir definitivamente"}</button></div>
                  </div>
                ) : (
                  <div className="campaign-admin-card-actions">
                    <button className="campaign-card-action campaign-card-action--edit" type="button" onClick={() => startEdit(campaign)}><span className="material-symbols-rounded" aria-hidden="true">edit</span><span>Editar</span></button>
                    <button className="campaign-card-action campaign-card-action--share" type="button" onClick={() => { closeForm(); setNotice(""); setShared(campaign); window.scrollTo({ top: 0, behavior: "smooth" }); }}><span>Ver e compartilhar</span><span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
                    <button className="campaign-card-action campaign-card-action--delete" type="button" disabled={!campaign.canDelete} title={campaign.canDelete ? "Excluir esta campanha" : "Campanhas com pedidos não podem ser excluídas"} onClick={() => { setDeleteConfirmation(campaign); setDeleteError(""); setNotice(""); }}><span className="material-symbols-rounded" aria-hidden="true">delete</span><span>{campaign.canDelete ? "Excluir campanha" : "Exclusão bloqueada: há pedidos"}</span></button>
                  </div>
                )}
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <section className="simple-state">
              <span className="material-symbols-rounded" aria-hidden="true">filter_alt_off</span>
              <h3>Nenhuma campanha nesse filtro</h3>
              <p>Escolha outra fase para ver as campanhas cadastradas.</p>
            </section>
          )}
        </div>
      </section>}
    </div>
  );
}
