import { shirtModels } from "../../../data";

import { ShirtMockupPreview } from "../../../components/ShirtMockupPreview";

import { colorKey, variantArtKey } from ".././editor-model";

import type { useCampaignEditor } from '../useCampaignEditor';
type Props=Pick<ReturnType<typeof useCampaignEditor>, 'mockupEnabled' | 'realPhotosEnabled' | 'chooseImagePresentation' | 'artMode' | 'setArtMode' | 'setArtScope' | 'setArtPreviewSide' | 'setArtError' | 'artScope' | 'selectedModels' | 'modelColors' | 'campaignColorOptions' | 'variantArts' | 'previewModel' | 'previewColor' | 'selectArtworkVariant' | 'previewArtwork' | 'artPreviewSide' | 'previewArt' | 'startArtworkDrag' | 'setAdvancedArtOpen' | 'advancedArtOpen' | 'activeTransform' | 'setCurrentTransform' | 'resetCurrentTransform' | 'front' | 'back' | 'existingArt' | 'currentVariantArt' | 'chooseArt' | 'chooseVariantArt' | 'removeVariantSide' | 'removeBackArt' | 'restoreVariantInheritance' | 'activeVariantCombinations' | 'activeRealPhotoColors' | 'realPhotosByColor' | 'realVideosByColor' | 'removeRealPhoto' | 'chooseRealPhotos' | 'removeRealVideo' | 'chooseRealVideo'>;
export function ImagesStep({mockupEnabled, realPhotosEnabled, chooseImagePresentation, artMode, setArtMode, setArtScope, setArtPreviewSide, setArtError, artScope, selectedModels, modelColors, campaignColorOptions, variantArts, previewModel, previewColor, selectArtworkVariant, previewArtwork, artPreviewSide, previewArt, startArtworkDrag, setAdvancedArtOpen, advancedArtOpen, activeTransform, setCurrentTransform, resetCurrentTransform, front, back, existingArt, currentVariantArt, chooseArt, chooseVariantArt, removeVariantSide, removeBackArt, restoreVariantInheritance, activeVariantCombinations, activeRealPhotoColors, realPhotosByColor, realVideosByColor, removeRealPhoto, chooseRealPhotos, removeRealVideo, chooseRealVideo}:Props) { return (<section className="campaign-step campaign-step--images" aria-labelledby="campaign-images-title">
                  <header><span className="kicker">Etapa 3 de 4</span><h4 id="campaign-images-title">Imagens da campanha</h4><p>Escolha como a camisa será apresentada e prepare a arte.</p></header>
            <fieldset className="campaign-image-presentation"><legend>Como deseja apresentar as camisas?</legend>
              <div role="group" aria-label="Forma de apresentação das camisas">
                <button className={mockupEnabled && !realPhotosEnabled ? "is-active" : ""} type="button" onClick={() => chooseImagePresentation("mockup")}><span className="material-symbols-rounded" aria-hidden="true">checkroom</span><span><strong>Mockup</strong><small>Monte a estampa sobre a camisa.</small></span></button>
                <button className={!mockupEnabled && realPhotosEnabled ? "is-active" : ""} type="button" onClick={() => chooseImagePresentation("photos")}><span className="material-symbols-rounded" aria-hidden="true">photo_camera</span><span><strong>Fotos reais</strong><small>Galeria e vídeo por cor.</small></span></button>
                <button className={mockupEnabled && realPhotosEnabled ? "is-active" : ""} type="button" onClick={() => chooseImagePresentation("both")}><span className="material-symbols-rounded" aria-hidden="true">collections</span><span><strong>Ambos</strong><small>Mockup, fotos e vídeo juntos.</small></span></button>
              </div>
            </fieldset>

            {mockupEnabled && <fieldset className="campaign-artwork"><legend>Arte e mockup da campanha</legend>
              <div className="campaign-art-mode" role="group" aria-label="Modo de apresentação das camisas">
                <button className={artMode === "overlay" ? "is-active" : ""} type="button" onClick={() => { setArtMode("overlay"); setArtScope("base"); setArtPreviewSide("front"); setArtError(""); }}><span className="material-symbols-rounded" aria-hidden="true">layers</span><strong>Montar no site</strong><small>Ajuste a estampa sobre a camisa.</small></button>
                <button className={artMode === "variant_mockup" ? "is-active" : ""} type="button" onClick={() => { setArtMode("variant_mockup"); setArtScope("variant"); setArtPreviewSide("front"); setArtError(""); }}><span className="material-symbols-rounded" aria-hidden="true">photo_library</span><strong>Mockup individual</strong><small>Envie a peça pronta por corte e cor.</small></button>
              </div>

              {artMode === "legacy_mockup" ? (
                <div className="campaign-artwork-guidance"><span className="material-symbols-rounded" aria-hidden="true">history</span><div><strong>Campanha no formato antigo</strong><p>A imagem completa atual foi preservada. Escolha um dos modos acima somente se quiser converter a campanha.</p></div></div>
              ) : (
                <>
                  <div className="campaign-artwork-guidance"><span className="material-symbols-rounded" aria-hidden="true">info</span><div><strong>{artMode === "overlay" ? "Arte ajustável sobre o mockup" : "Um mockup para cada camisa"}</strong><p>{artMode === "overlay" ? <>Use <b>PNG ou WEBP transparente</b>, até <b>2 MB</b>. A arte-base vale para todas as camisas, mas cada corte/cor pode receber outra arte e outro ajuste.</> : <>Use <b>PNG, JPG ou WEBP</b>, até <b>2 MB</b>. Cada combinação precisa ter pelo menos frente ou costas.</>}</p></div></div>

                  {artMode === "overlay" && (
                    <div className="campaign-art-scope" role="group" aria-label="Escopo da edição">
                      <button className={artScope === "base" ? "is-active" : ""} type="button" onClick={() => { setArtScope("base"); setArtPreviewSide("front"); }}>Arte-base</button>
                      <button className={artScope === "variant" ? "is-active" : ""} type="button" onClick={() => setArtScope("variant")}>Personalizar uma camisa</button>
                    </div>
                  )}

                  {(artMode === "variant_mockup" || artScope === "variant") && (
                    <div className="campaign-art-variants">
                      {shirtModels.filter((model) => selectedModels[model.name]).map((model) => (
                        <section key={model.name}><strong>{model.name === "Comum" ? "Padrão" : model.name}</strong><div>{modelColors[model.name].map((colorName) => {
                          const colorOption = campaignColorOptions.find((item) => colorKey(item.name) === colorKey(colorName));
                          const saved = variantArts[variantArtKey(model.name, colorName)]?.[artMode];
                          const complete = artMode === "overlay" || saved?.front.source === "custom" || saved?.back.source === "custom";
                          const selected = previewModel === model.name && previewColor.name === colorName;
                          return <button className={`${selected ? "is-active" : ""} ${complete ? "is-complete" : "is-pending"}`} type="button" onClick={() => selectArtworkVariant(model.name, colorName)} key={colorName}><i style={{ backgroundColor: colorOption?.hex }} /><span>{colorName}</span><small>{complete ? "pronta" : "pendente"}</small></button>;
                        })}</div></section>
                      ))}
                    </div>
                  )}

                  <div className="campaign-art-editor-grid">
                  {(artMode === "overlay" || previewArtwork.front || previewArtwork.back) && (
                    <section className="campaign-artwork-composer-preview" aria-label="Prévia da camisa">
                      <header><div><strong>{artMode === "overlay" ? "Editor da arte" : "Prévia do mockup"}</strong><small>{artScope === "base" ? "Arte-base" : `${previewModel === "Comum" ? "Padrão" : previewModel} · ${previewColor.name}`}</small></div><div role="group" aria-label="Lado da prévia"><button className={artPreviewSide === "front" ? "is-active" : ""} type="button" disabled={artMode !== "overlay" && !previewArtwork.front} onClick={() => setArtPreviewSide("front")}>Frente</button><button className={artPreviewSide === "back" ? "is-active" : ""} type="button" disabled={artMode !== "overlay" && !previewArtwork.back} onClick={() => setArtPreviewSide("back")}>Costas</button></div></header>
                      <div className="campaign-art-canvas"><ShirtMockupPreview model={previewModel} color={previewColor} art={previewArt} artwork={previewArtwork} side={artPreviewSide} interactive={artMode === "overlay"} onPointerDown={startArtworkDrag} label={`Prévia ${previewModel === "Comum" ? "Padrão" : previewModel}, ${previewColor.name}, ${artPreviewSide === "front" ? "frente" : "costas"}`} /></div>
                      {artMode === "overlay" && previewArtwork[artPreviewSide] && <button className="campaign-art-advanced-toggle" type="button" onClick={() => setAdvancedArtOpen((current) => !current)} aria-expanded={advancedArtOpen}><span className="material-symbols-rounded" aria-hidden="true">tune</span>{advancedArtOpen ? "Ocultar ajustes avançados" : "Ajustar posição e tamanho"}</button>}
                      {artMode === "overlay" && previewArtwork[artPreviewSide] && advancedArtOpen && (
                        <div className="campaign-art-controls">
                          <label><span>Posição horizontal</span><input type="range" min="-100" max="100" step="1" value={activeTransform.x} onChange={(event) => setCurrentTransform({ ...activeTransform, x: Number(event.target.value) })} /><output>{Math.round(activeTransform.x)}%</output></label>
                          <label><span>Posição vertical</span><input type="range" min="-100" max="100" step="1" value={activeTransform.y} onChange={(event) => setCurrentTransform({ ...activeTransform, y: Number(event.target.value) })} /><output>{Math.round(activeTransform.y)}%</output></label>
                          <label><span>Tamanho</span><input type="range" min="10" max="300" step="1" value={activeTransform.scale * 100} onChange={(event) => setCurrentTransform({ ...activeTransform, scale: Number(event.target.value) / 100 })} /><output>{Math.round(activeTransform.scale * 100)}%</output></label>
                          <label><span>Rotação</span><input type="range" min="-180" max="180" step="1" value={activeTransform.rotation} onChange={(event) => setCurrentTransform({ ...activeTransform, rotation: Number(event.target.value) })} /><output>{Math.round(activeTransform.rotation)}°</output></label>
                          <button type="button" onClick={resetCurrentTransform}><span className="material-symbols-rounded" aria-hidden="true">restart_alt</span>Restaurar posição</button>
                        </div>
                      )}
                      <p>{artMode === "overlay" ? "Arraste a arte diretamente na camisa ou use os controles." : "Esta imagem será mostrada exatamente como foi enviada."}</p>
                    </section>
                  )}

                  <div className="campaign-artwork-uploads">
                    {(["front", "back"] as const).map((side) => {
                      const baseScope = artMode === "overlay" && artScope === "base";
                      const baseDraft = side === "front" ? front : back;
                      const baseExisting = side === "front" ? existingArt.front : existingArt.back;
                      const variantDraft = currentVariantArt[side];
                      const image = baseScope ? baseDraft.preview || baseExisting : variantDraft.preview || variantDraft.url || previewArtwork[side]?.url || "";
                      const required = baseScope && side === "front";
                      return (
                        <div className="campaign-art-upload-slot" key={side}>
                          <label className={required ? "campaign-artwork-main" : "campaign-artwork-optional"}>
                            <span>{side === "front" ? "Frente" : "Costas"}<b>{required ? "obrigatória" : "opcional"}</b></span>
                            <div>{image ? <img src={image} alt={`Prévia de ${side === "front" ? "frente" : "costas"}`} /> : <span className="campaign-artwork-empty"><span className="material-symbols-rounded" aria-hidden="true">add_photo_alternate</span>Selecionar arquivo</span>}<span className="material-symbols-rounded" aria-hidden="true">upload</span></div>
                            <input type="file" accept={artMode === "variant_mockup" ? "image/png,image/jpeg,image/webp" : "image/png,image/webp"} aria-label={`Enviar ${side === "front" ? "frente" : "costas"}`} onChange={(event) => baseScope ? chooseArt(event, side) : chooseVariantArt(event, side)} />
                            <small>{baseScope ? (baseDraft.preview ? "Nova arte selecionada" : baseExisting ? "Arte atual. Clique para trocar" : "Clique para selecionar") : variantDraft.source === "custom" ? "Imagem personalizada" : artMode === "overlay" && variantDraft.source === "inherit" ? "Herdando a arte-base" : "Nenhuma imagem"}</small>
                          </label>
                          {!baseScope && variantDraft.source === "custom" && <button className="campaign-artwork-remove" type="button" onClick={() => removeVariantSide(side)}><span className="material-symbols-rounded" aria-hidden="true">delete</span>Remover {side === "front" ? "frente" : "costas"}</button>}
                        </div>
                      );
                    })}
                  </div>
                  </div>
                  {artMode === "overlay" && artScope === "base" && (back.preview || existingArt.back) && <button className="campaign-artwork-remove" type="button" onClick={removeBackArt}><span className="material-symbols-rounded" aria-hidden="true">delete</span>Remover a arte-base de costas</button>}
                  {artMode === "overlay" && artScope === "variant" && <button className="campaign-art-inherit" type="button" onClick={restoreVariantInheritance}><span className="material-symbols-rounded" aria-hidden="true">link</span>Restaurar herança da arte-base</button>}
                  {artMode === "variant_mockup" && <p className="campaign-artwork-status"><span className="material-symbols-rounded" aria-hidden="true">checklist</span>{activeVariantCombinations.filter((item) => { const saved = variantArts[item.key]?.variant_mockup; return saved?.front.source === "custom" || saved?.back.source === "custom"; }).length} de {activeVariantCombinations.length} combinações preenchidas.</p>}
                </>
              )}
            </fieldset>}

            {realPhotosEnabled && <fieldset className="campaign-real-photos"><legend>Fotos reais por cor</legend>
              <div className="campaign-artwork-guidance"><span className="material-symbols-rounded" aria-hidden="true">photo_camera</span><div><strong>Galeria opcional da camisa pronta</strong><p>Envie até <b>seis fotos por cor</b> em PNG, JPG ou WEBP, com no máximo <b>2 MB cada</b>. Você também pode incluir <b>um MP4 de até 15 segundos e 10 MB</b>; cada cor continua exigindo pelo menos uma foto.</p></div></div>
              <div className="campaign-real-photo-grid">
                {activeRealPhotoColors.map((color) => {
                  const photos = realPhotosByColor[colorKey(color.name)] ?? [];
                  const video = realVideosByColor[colorKey(color.name)];
                  return <article className="campaign-real-photo-card" key={color.name}>
                    <header><span><i style={{ backgroundColor: color.hex }} /><strong>{color.name}</strong></span><small>{photos.length}/6</small></header>
                    {photos.length > 0 ? <div className="campaign-real-photo-list">{photos.map((photo, index) => <figure key={`${photo.preview || photo.url}-${index}`}><img src={photo.preview || photo.url || ""} alt={`Foto real ${index + 1} da camisa ${color.name}`} /><button type="button" onClick={() => removeRealPhoto(color.name, index)} aria-label={`Remover foto ${index + 1} da cor ${color.name}`}><span className="material-symbols-rounded" aria-hidden="true">close</span></button></figure>)}</div> : <p>Envie pelo menos uma foto para habilitar a galeria desta cor.</p>}
                    {photos.length < 6 && <label><span className="material-symbols-rounded" aria-hidden="true">add_photo_alternate</span>Adicionar fotos<input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => chooseRealPhotos(event, color.name)} aria-label={`Adicionar fotos reais da cor ${color.name}`} /></label>}
                    {video ? <div className="campaign-real-video-draft">
                      <div className="campaign-real-video-preview">
                        <video src={video.preview} poster={video.posterPreview || undefined} controls={video.status === "ready"} playsInline preload="metadata" />
                        {video.status !== "ready" && <span className="material-symbols-rounded" aria-hidden="true">movie</span>}
                      </div>
                      <div className="campaign-real-video-status">
                        <strong>{video.status === "processing" ? "Processando vídeo..." : video.status === "uploading" ? `Enviando ${video.progress}%` : video.status === "ready" ? `${video.durationSeconds.toFixed(1)} s · ${(video.bytes / 1024 / 1024).toFixed(1)} MB` : "Falha no vídeo"}</strong>
                        {(video.status === "processing" || video.status === "uploading") && <progress max="100" value={video.progress} aria-label={`Progresso do vídeo da cor ${color.name}`} />}
                      </div>
                      <button type="button" className="campaign-real-video-remove" onClick={() => removeRealVideo(color.name)}>{video.status === "processing" || video.status === "uploading" ? "Cancelar envio" : "Remover vídeo"}</button>
                    </div> : <label className="campaign-real-video-add"><span className="material-symbols-rounded" aria-hidden="true">video_call</span>Adicionar vídeo MP4<input type="file" accept="video/mp4,.mp4" onChange={(event) => chooseRealVideo(event, color.name)} aria-label={`Adicionar vídeo da cor ${color.name}`} /></label>}
                  </article>;
                })}
              </div>
            </fieldset>}
                </section>); }
