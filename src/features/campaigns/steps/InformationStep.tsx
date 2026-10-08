import { ContactInput } from "../../../components/ContactInput";

import { suggestCode } from ".././editor-model";

import type { useCampaignEditor } from '../useCampaignEditor';
type Props=Pick<ReturnType<typeof useCampaignEditor>, 'campaignName' | 'setCampaignName' | 'representative' | 'setRepresentative' | 'representativePhone' | 'setRepresentativePhone' | 'deadline' | 'setDeadline' | 'deliveryExpectedOn' | 'setDeliveryExpectedOn' | 'deliveryNote' | 'setDeliveryNote' | 'receiverId' | 'setReceiverId' | 'receivers' | 'receiversError' | 'pickup' | 'setPickup' | 'subtitle' | 'setSubtitle' | 'campaignCodeInput' | 'setCampaignCodeInput' | 'editing'>;
export function InformationStep({campaignName, setCampaignName, representative, setRepresentative, representativePhone, setRepresentativePhone, deadline, setDeadline, deliveryExpectedOn, setDeliveryExpectedOn, deliveryNote, setDeliveryNote, receiverId, setReceiverId, receivers, receiversError, pickup, setPickup, subtitle, setSubtitle, campaignCodeInput, setCampaignCodeInput, editing}:Props) { return (<section className="campaign-step campaign-step--information" aria-labelledby="campaign-information-title">
                  <header><span className="kicker">Etapa 1 de 4</span><h4 id="campaign-information-title">Informações da campanha</h4><p>Comece pelo que identifica a turma e orienta a retirada.</p></header>
                  <div className="campaign-information-grid">
                    <label className="campaign-field campaign-field--wide"><span>Nome da campanha</span><input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Engenharia Civil — Turma 2026" minLength={5} required /></label>
                    <label className="campaign-field"><span>Representante da turma</span><input value={representative} onChange={(event) => setRepresentative(event.target.value)} placeholder="Nome do representante" minLength={3} required /></label>
                    <label className="campaign-field"><span>WhatsApp do representante</span><ContactInput kind="phone" value={representativePhone} onChange={setRepresentativePhone} placeholder="(98) 98888-1234" /></label>
                    <label className="campaign-field"><span>Prazo final dos pedidos</span><input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} required /></label>
                    <label className="campaign-field"><span>Entrega prevista (opcional)</span><input type="date" value={deliveryExpectedOn} onChange={(event) => setDeliveryExpectedOn(event.target.value)} /></label>
                    <label className="campaign-field"><span>Instruções de retirada</span><input value={pickup} onChange={(event) => setPickup(event.target.value)} maxLength={255} required /></label>
                    <label className="campaign-field campaign-field--wide campaign-receiver-field"><span>Recebedor do pagamento</span><select value={receiverId ?? ""} onChange={(event) => setReceiverId(event.target.value ? Number(event.target.value) : null)}><option value="">Conta padrão da camisaria</option>{receivers.filter((receiver) => receiver.active || receiver.id === receiverId).map((receiver) => <option key={receiver.id} value={receiver.id}>{receiver.name} · ${receiver.infinitepayHandle}{receiver.active ? "" : " (desativado)"}</option>)}</select><small>{receiversError || "O dinheiro dos pedidos desta campanha cai na conta InfinitePay escolhida. Cadastre recebedores na aba Conta."}</small></label>
                    <label className="campaign-field campaign-field--wide"><span>Observação sobre a entrega (opcional)</span><input value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} maxLength={255} /></label>
                  </div>
                  <details className="campaign-advanced-details">
                    <summary><span><strong>Opções avançadas</strong><small>Subtítulo e código de acesso</small></span><span className="material-symbols-rounded" aria-hidden="true">expand_more</span></summary>
                    <div>
                      <label className="campaign-field"><span>Subtítulo</span><input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="Campanha exclusiva para os alunos da turma" maxLength={255} /><small>Aparece abaixo do nome na página do aluno. Pode ficar vazio.</small></label>
                      <label className="campaign-field"><span>Código da campanha</span><input value={campaignCodeInput} onChange={(event) => setCampaignCodeInput(event.target.value.toUpperCase())} placeholder={suggestCode(campaignName)} autoCapitalize="characters" spellCheck={false} disabled={Boolean(editing)} /><small>{editing ? "O código não muda depois de criado." : <>Deixe vazio para gerar automaticamente <b>{suggestCode(campaignName)}</b>.</>}</small></label>
                    </div>
                  </details>
                </section>); }
