import { campaignSizesInGroup, shirtColors, shirtModels, sizeGroupLabels } from "../../../data";
import type { SizeGroup } from '../../../data';

import { colorKey, validHexColor } from ".././editor-model";

import type { useCampaignEditor } from '../useCampaignEditor';
type Props=Pick<ReturnType<typeof useCampaignEditor>, 'variantsLocked' | 'selectedModels' | 'commonPrice' | 'oversizedPrice' | 'setCommonPrice' | 'setOversizedPrice' | 'toggleCampaignModel' | 'setProductConfiguration' | 'setColorModel' | 'setSizeModel' | 'productConfiguration' | 'editing' | 'couponEnabled' | 'setCouponEnabled' | 'setFormError' | 'couponCode' | 'setCouponCode' | 'selectedCampaignModels' | 'couponDiscounts' | 'setCouponDiscounts' | 'couponMinimumQuantity' | 'setCouponMinimumQuantity' | 'couponMaximumQuantity' | 'setCouponMaximumQuantity' | 'couponExpires' | 'setCouponExpires' | 'couponLimit' | 'setCouponLimit' | 'colorModel' | 'setColorError' | 'modelColors' | 'campaignColorOptions' | 'toggleCampaignColor' | 'customColorOpen' | 'setCustomColorOpen' | 'customColorName' | 'setCustomColorName' | 'addCustomCampaignColor' | 'customColorHex' | 'setCustomColorHex' | 'removeCustomCampaignColor' | 'sizeModel' | 'setSizeError' | 'modelSizes' | 'toggleSizeGroup' | 'toggleCampaignSize'>;
export function ProductsStep({variantsLocked, selectedModels, commonPrice, oversizedPrice, setCommonPrice, setOversizedPrice, toggleCampaignModel, setProductConfiguration, setColorModel, setSizeModel, productConfiguration, editing, couponEnabled, setCouponEnabled, setFormError, couponCode, setCouponCode, selectedCampaignModels, couponDiscounts, setCouponDiscounts, couponMinimumQuantity, setCouponMinimumQuantity, couponMaximumQuantity, setCouponMaximumQuantity, couponExpires, setCouponExpires, couponLimit, setCouponLimit, colorModel, setColorError, modelColors, campaignColorOptions, toggleCampaignColor, customColorOpen, setCustomColorOpen, customColorName, setCustomColorName, addCustomCampaignColor, customColorHex, setCustomColorHex, removeCustomCampaignColor, sizeModel, setSizeError, modelSizes, toggleSizeGroup, toggleCampaignSize}:Props) { return (<section className="campaign-step campaign-step--products" aria-labelledby="campaign-products-title">
                  <header><span className="kicker">Etapa 2 de 4</span><h4 id="campaign-products-title">Produtos da campanha</h4><p>Escolha os cortes e depois ajuste cores e tamanhos de cada um.</p></header>
            <fieldset className="campaign-model-pricing" disabled={variantsLocked}><legend>Cortes e preços</legend><div>
              {shirtModels.map((model) => {
                const selected = selectedModels[model.name];
                const price = model.name === "Comum" ? commonPrice : oversizedPrice;
                const setPrice = model.name === "Comum" ? setCommonPrice : setOversizedPrice;
                return <article className={selected ? "is-selected" : ""} key={model.name}>
                  <label className="campaign-model-toggle">
                    <input type="checkbox" checked={selected} onChange={() => toggleCampaignModel(model.name)} />
                    <span className="material-symbols-rounded" aria-hidden="true">{selected ? "check" : "add"}</span>
                    <span><strong>{model.name === "Comum" ? "Padrão" : model.name}</strong><small>{model.description}</small></span>
                  </label>
                  <div className="campaign-price-field"><b>R$</b><input aria-label={`Preço do corte ${model.name}`} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required={selected} disabled={!selected || variantsLocked} /></div>
                  {selected && <button className="campaign-product-configure" type="button" onClick={() => { setProductConfiguration(model.name); setColorModel(model.name); setSizeModel(model.name); }}>{productConfiguration === model.name ? "Configurando agora" : "Configurar cores e tamanhos"}<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>}
                </article>;
              })}
            </div><small>Marque somente os cortes que a campanha oferecerá. {editing && !variantsLocked ? "Trocar o preço vale para os próximos pedidos; os já registrados guardam o valor da compra." : "O preço vale para todos os tamanhos do corte, inclusive os baby look."}</small></fieldset>

            <fieldset className="campaign-coupon-setup"><legend>Cupom de desconto</legend>
              <label className="campaign-coupon-toggle"><input type="checkbox" checked={couponEnabled} onChange={(event) => { setCouponEnabled(event.target.checked); setFormError(""); }} /><span className="material-symbols-rounded" aria-hidden="true">{couponEnabled ? "check" : "add"}</span><span><strong>{couponEnabled ? "Cupom ativado" : "Adicionar cupom"}</strong><small>Opcional. Pode ser removido novamente ao editar a campanha.</small></span></label>
              {couponEnabled && <div className="campaign-coupon-admin-fields">
                <label className="campaign-field campaign-field--wide"><span>Código do cupom</span><input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="TURMA10" maxLength={32} autoCapitalize="characters" spellCheck={false} required /><small>O aluno pode digitá-lo na página ou abrir o link com o cupom aplicado.</small></label>
                {selectedCampaignModels.map((model) => <label className="campaign-field" key={`coupon-${model.code}`}><span>Desconto para {model.name === "Comum" ? "Padrão" : model.name}</span><div className="campaign-coupon-value"><b>R$</b><input inputMode="decimal" value={couponDiscounts[model.name]} onChange={(event) => setCouponDiscounts((current) => ({ ...current, [model.name]: event.target.value }))} required /></div><small>Valor descontado de cada peça deste corte.</small></label>)}
                <label className="campaign-field"><span>Quantidade mínima de peças</span><input type="number" min="1" max="200" step="1" inputMode="numeric" value={couponMinimumQuantity} onChange={(event) => setCouponMinimumQuantity(event.target.value)} required /><small>O desconto começa quando o carrinho atingir essa quantidade total.</small></label>
                <label className="campaign-field"><span>Máximo de peças com desconto</span><input type="number" min={couponMinimumQuantity || "1"} max="200" step="1" inputMode="numeric" value={couponMaximumQuantity} onChange={(event) => setCouponMaximumQuantity(event.target.value)} placeholder="Sem limite" /><small>Opcional. As peças excedentes permanecem com o preço normal.</small></label>
                <label className="campaign-field"><span>Validade até</span><input type="date" value={couponExpires} onChange={(event) => setCouponExpires(event.target.value)} /><small>Opcional. Sem data, vale enquanto estiver ativo.</small></label>
                <label className="campaign-field"><span>Limite de utilizações</span><input type="number" min="1" step="1" inputMode="numeric" value={couponLimit} onChange={(event) => setCouponLimit(event.target.value)} placeholder="Sem limite" /><small>Opcional. Conta pedidos ativos, não a quantidade de peças.</small></label>
              </div>}
            </fieldset>

            <fieldset className="campaign-color-setup" disabled={variantsLocked}><legend>Cores disponíveis por corte</legend>
              <p>O aluno verá somente as cores liberadas aqui. Use uma das cinco opções padrão ou cadastre uma cor pelo nome e código HEX.</p>
              <div className="campaign-color-tabs" role="group" aria-label="Corte para configurar as cores">
                {shirtModels.filter((item) => selectedModels[item.name]).map((item) => <button className={colorModel === item.name ? "is-active" : ""} type="button" aria-pressed={colorModel === item.name} onClick={() => { setColorModel(item.name); setColorError(""); }} key={item.name}>{item.name === "Comum" ? "Padrão" : item.name}<span>{modelColors[item.name].length}</span></button>)}
              </div>
              <div className="campaign-color-palette" aria-label={`Cores disponíveis para ${colorModel}`}>
                {campaignColorOptions.map((color) => {
                  const checked = modelColors[colorModel].includes(color.name);
                  return <label className={checked ? "is-selected" : ""} key={color.name}><input type="checkbox" checked={checked} onChange={() => toggleCampaignColor(colorModel, color.name)} /><i style={{ backgroundColor: color.hex }} /><span>{color.name}</span><span className="material-symbols-rounded" aria-hidden="true">check</span></label>;
                })}
              </div>
              <div className={`campaign-custom-color ${customColorOpen ? "is-open" : ""}`}>
                <button className="campaign-custom-color-heading" type="button" onClick={() => setCustomColorOpen((current) => !current)} aria-expanded={customColorOpen}><span className="material-symbols-rounded" aria-hidden="true">add_circle</span><span><strong>Adicionar cor personalizada</strong><small>Nome e código HEX para uma cor exclusiva.</small></span><span className="material-symbols-rounded" aria-hidden="true">expand_more</span></button>
                {customColorOpen && <div className="campaign-custom-color-fields">
                  <label><span>Nome da cor</span><input value={customColorName} onChange={(event) => { setCustomColorName(event.target.value); setColorError(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomCampaignColor(); } }} placeholder="Ex.: Lilás lavanda" maxLength={80} /></label>
                  <label><span>Código HEX</span><div className="campaign-custom-hex"><input type="color" aria-label="Selecionar cor personalizada" value={validHexColor(customColorHex) ? customColorHex : "#808080"} onChange={(event) => { setCustomColorHex(event.target.value.toUpperCase()); setColorError(""); }} /><input aria-label="Código HEX da cor personalizada" value={customColorHex} onChange={(event) => { setCustomColorHex(event.target.value.toUpperCase()); setColorError(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomCampaignColor(); } }} placeholder="#8B5CF6" maxLength={7} spellCheck={false} /></div></label>
                  <button type="button" onClick={addCustomCampaignColor}><span className="material-symbols-rounded" aria-hidden="true">add</span>Adicionar cor</button>
                </div>}
                {campaignColorOptions.some((color) => !shirtColors.some((standard) => colorKey(standard.name) === colorKey(color.name))) && (
                  <div className="campaign-custom-color-list" aria-label="Cores personalizadas desta campanha">
                    {campaignColorOptions.filter((color) => !shirtColors.some((standard) => colorKey(standard.name) === colorKey(color.name))).map((color) => <div key={color.name}><i style={{ backgroundColor: color.hex }} /><span><strong>{color.name}</strong><small>{color.hex.toUpperCase()}</small></span><button type="button" onClick={() => removeCustomCampaignColor(color.name)} aria-label={`Remover a cor personalizada ${color.name}`}><span className="material-symbols-rounded" aria-hidden="true">close</span></button></div>)}
                  </div>
                )}
              </div>
              <p className="campaign-color-summary"><span className="material-symbols-rounded" aria-hidden="true">palette</span><strong>{modelColors[colorModel].length}</strong> {modelColors[colorModel].length === 1 ? "cor liberada" : "cores liberadas"} para {colorModel === "Comum" ? "Padrão" : colorModel}.</p>
            </fieldset>

            <fieldset className="campaign-size-setup" disabled={variantsLocked}><legend>Tamanhos disponíveis por corte</legend>
              <p>{editing ? "Um tamanho que já tenha pedido não pode sair: o painel avisa qual pedido trava." : "Já vem pré-marcado. Desmarque só o que a turma não vai pedir."} Baby look (PB, MB e GB) fica disponível somente no corte Padrão.</p>
              <div className="campaign-size-tabs" role="group" aria-label="Corte para configurar os tamanhos">
                {shirtModels.filter((item) => selectedModels[item.name]).map((item) => <button className={sizeModel === item.name ? "is-active" : ""} type="button" aria-pressed={sizeModel === item.name} onClick={() => { setSizeModel(item.name); setSizeError(""); }} key={item.name}>{item.name === "Comum" ? "Padrão" : item.name}<span>{modelSizes[item.name].length}</span></button>)}
              </div>
              {(["standard", "baby_look"] as SizeGroup[]).map((group) => {
                const groupSizes = campaignSizesInGroup(sizeModel, group);
                if (groupSizes.length === 0) return null;
                const groupLabel = sizeModel === "Oversized" ? "Oversized" : sizeGroupLabels[group];
                const allSelected = groupSizes.every((size) => modelSizes[sizeModel].includes(size));
                return (
                  <div className="campaign-size-setup-group" key={group}>
                    <div className="campaign-size-setup-heading">
                      <span>{groupLabel}</span>
                      <button type="button" onClick={() => toggleSizeGroup(sizeModel, group)}>{allSelected ? "desmarcar todos" : "marcar todos"}</button>
                    </div>
                    <div className="campaign-size-palette" aria-label={`Tamanhos ${groupLabel} para ${sizeModel}`}>
                      {groupSizes.map((size) => {
                        const checked = modelSizes[sizeModel].includes(size);
                        return <label className={checked ? "is-selected" : ""} key={size}><input type="checkbox" checked={checked} onChange={() => toggleCampaignSize(sizeModel, size)} /><span>{size}</span></label>;
                      })}
                    </div>
                  </div>
                );
              })}
              <p className="campaign-size-summary"><span className="material-symbols-rounded" aria-hidden="true">straighten</span><strong>{modelSizes[sizeModel].length}</strong> {modelSizes[sizeModel].length === 1 ? "tamanho liberado" : "tamanhos liberados"} para {sizeModel === "Comum" ? "Padrão" : sizeModel}.</p>
            </fieldset>
                </section>); }
