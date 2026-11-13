# Checklist de validação manual das funções

Use esta lista para manipular o sistema como **Cliente** e **Camisaria** e decidir o que
precisa ser mantido, ajustado ou bloqueia o piloto.

## Como registrar

Em cada item marque `OK`, `Ajustar` ou `Bloqueia` e anote a evidência. `Bloqueia` significa
que não devemos abrir o piloto. Faça cancelamentos, alterações de fase e entregas primeiro
no banco de teste; em produção, use somente uma campanha de piloto identificada.

**Rodada:** __________  **Data:** __________  **Responsável:** __________
**Ambiente:** ☐ teste ☐ piloto  **Dispositivo/navegador:** __________________________

### Resultado informado — rodada PUB

| ID | Resultado informado | Tratamento |
|---|---|---|
| PUB-01 | OK | Aprovado |
| PUB-02 | Ajustar posicionamento ao clicar no menu | Correção aplicada; aguardando revalidação |
| PUB-03 | Ajustar texto de “Como funciona” e centralização mobile | Correção aplicada; aguardando revalidação |
| PUB-04 | OK | Aprovado |
| PUB-05 | Não informado | Pendente de teste |
| PUB-06 | OK | Aprovado |

## 1. Site público e navegação

| ID | Manipulação manual | Resultado esperado | Status / observação |
|---|---|---|---|
| PUB-01 | Abrir a página inicial no computador | Logo, menu, imagens e textos carregam sem sobreposição | ☐ OK ☐ Ajustar ☐ Bloqueia |
| PUB-02 | Clicar em cada item do menu | A página posiciona na seção correta | ☐ OK ☐ Ajustar ☐ Bloqueia |
| PUB-03 | Abrir o menu no celular e navegar | Menu abre, fecha e não cobre controles importantes | ☐ OK ☐ Ajustar ☐ Bloqueia |
| PUB-04 | Clicar em “Falar pelo WhatsApp” | Abre o número correto com a mensagem esperada | ☐ OK ☐ Ajustar ☐ Bloqueia |
| PUB-05 | Procurar campanhas ativas na página pública | Nenhuma campanha privada é listada publicamente | ☐ OK ☐ Ajustar ☐ Bloqueia |
| PUB-06 | Usar voltar/avançar e atualizar a página | A rota atual permanece funcional | ☐ OK ☐ Ajustar ☐ Bloqueia |

## 2. Acesso à campanha privada

| ID | Manipulação manual | Resultado esperado | Status / observação |
|---|---|---|---|
| CAM-01 | Digitar um código inexistente | Mensagem clara, sem abrir campanha fictícia | ☐ OK ☐ Ajustar ☐ Bloqueia |
| CAM-02 | Digitar código válido em minúsculas e com espaços | Código é normalizado e a campanha correta abre | ☐ OK ☐ Ajustar ☐ Bloqueia |
| CAM-03 | Abrir o link privado copiado pelo painel | Abre diretamente a campanha correta | ☐ OK ☐ Ajustar ☐ Bloqueia |
| CAM-04 | Ler o QR Code com outro celular | O QR leva ao mesmo link privado | ☐ OK ☐ Ajustar ☐ Bloqueia |
| CAM-05 | Tentar pedir em campanha encerrada/finalizada | O sistema impede o novo pedido e explica o motivo | ☐ OK ☐ Ajustar ☐ Bloqueia |
| CAM-06 | Abrir campanha com API indisponível | Exibe falha real e opção de tentar novamente, sem dados demo | ☐ OK ☐ Ajustar ☐ Bloqueia |

## 3. Montagem da camiseta

| ID | Manipulação manual | Resultado esperado | Status / observação |
|---|---|---|---|
| PED-01 | Alternar Comum e Oversized | Preço, cores e tamanhos mudam conforme a configuração | ☐ OK ☐ Ajustar ☐ Bloqueia |
| PED-02 | Testar todas as cores liberadas | Cor selecionada fica evidente e o resumo é atualizado | ☐ OK ☐ Ajustar ☐ Bloqueia |
| PED-03 | Testar tamanhos tradicionais e baby look | Somente tamanhos liberados aparecem; baby look não aparece como corte | ☐ OK ☐ Ajustar ☐ Bloqueia |
| PED-04 | Aumentar e diminuir quantidade | Total e descrição acompanham a quantidade; nunca fica menor que 1 | ☐ OK ☐ Ajustar ☐ Bloqueia |
| PED-05 | Abrir “Qual o meu tamanho?” | Tabela/ajuda é legível e pode ser fechada | ☐ OK ☐ Ajustar ☐ Bloqueia |
| PED-06 | Alternar frente/costas quando houver duas artes | Imagens corretas aparecem; sem costas, o alternador não aparece | ☐ OK ☐ Ajustar ☐ Bloqueia |
| PED-07 | Voltar para editar a camiseta | Seleções anteriores permanecem e o total continua correto | ☐ OK ☐ Ajustar ☐ Bloqueia |

## 4. Identificação e criação do pedido

| ID | Manipulação manual | Resultado esperado | Status / observação |
|---|---|---|---|
| ORD-01 | Tentar continuar sem nome | Campo obrigatório é indicado sem perder o pedido | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ORD-02 | Digitar WhatsApp incompleto ou inválido | Sistema não registra e explica como corrigir | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ORD-03 | Deixar e-mail vazio | Pedido pode continuar, pois o e-mail é opcional | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ORD-04 | Digitar e-mail inválido | Campo informa o erro antes do registro | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ORD-05 | Revisar corte, cor, tamanho, quantidade e total | Resumo coincide exatamente com as seleções | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ORD-06 | Clicar duas vezes rapidamente em registrar | Apenas um pedido é criado | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ORD-07 | Atualizar a tela após registrar | Não cria pedido novo; número já gerado continua utilizável | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ORD-08 | Copiar o número do pedido | Clipboard recebe exatamente o número exibido | ☐ OK ☐ Ajustar ☐ Bloqueia |

## 5. Pagamento InfinitePay — pré-integração

| ID | Manipulação manual | Resultado esperado | Status / observação |
|---|---|---|---|
| PAY-01 | Alternar entre Pix e cartão | As duas opções ficam disponíveis e apenas uma fica selecionada | ☐ OK ☐ Ajustar ☐ Bloqueia |
| PAY-02 | Conferir o valor mostrado | Valor é idêntico ao total persistido do pedido | ☐ OK ☐ Ajustar ☐ Bloqueia |
| PAY-03 | Revisar textos de segurança | Informa checkout InfinitePay e não pede chave, cartão ou comprovante no site | ☐ OK ☐ Ajustar ☐ Bloqueia |
| PAY-04 | Registrar o pedido antes da integração externa | Pedido permanece pendente e nenhum pagamento é inventado | ☐ OK ☐ Ajustar ☐ Bloqueia |
| PAY-05 | Verificar painel da camisaria | Não existe ação para confirmar pagamento manualmente | ☐ OK ☐ Ajustar ☐ Bloqueia |
| PAY-06 | Verificar relatório | Pedido pendente não entra na produção nem na entrega | ☐ OK ☐ Ajustar ☐ Bloqueia |

## 6. Consulta do pedido pelo cliente

| ID | Manipulação manual | Resultado esperado | Status / observação |
|---|---|---|---|
| TRK-01 | Consultar com número correto e WhatsApp errado | Pedido não é revelado | ☐ OK ☐ Ajustar ☐ Bloqueia |
| TRK-02 | Consultar número inexistente | Mensagem neutra, sem expor outros dados | ☐ OK ☐ Ajustar ☐ Bloqueia |
| TRK-03 | Consultar pedido pendente | Mostra aguardando confirmação do pagamento | ☐ OK ☐ Ajustar ☐ Bloqueia |
| TRK-04 | Consultar pedido pago | Mostra pagamento confirmado | ☐ OK ☐ Ajustar ☐ Bloqueia |
| TRK-05 | Consultar durante a produção | Fase e próximos passos correspondem ao painel | ☐ OK ☐ Ajustar ☐ Bloqueia |
| TRK-06 | Consultar campanha pronta | Pedido aparece disponível para retirada | ☐ OK ☐ Ajustar ☐ Bloqueia |
| TRK-07 | Consultar pedido entregue | Mostra finalização e retirada registrada | ☐ OK ☐ Ajustar ☐ Bloqueia |
| TRK-08 | Consultar pedido cancelado | Mostra cancelamento e o motivo, sem seguir para produção | ☐ OK ☐ Ajustar ☐ Bloqueia |

## 7. Login, sessão e conta da Camisaria

| ID | Manipulação manual | Resultado esperado | Status / observação |
|---|---|---|---|
| AUT-01 | Entrar com senha errada | Acesso recusado sem revelar detalhes da conta | ☐ OK ☐ Ajustar ☐ Bloqueia |
| AUT-02 | Entrar com a conta da Camisaria | Painel carrega somente dados persistidos | ☐ OK ☐ Ajustar ☐ Bloqueia |
| AUT-03 | Atualizar a página autenticada | Sessão permanece válida | ☐ OK ☐ Ajustar ☐ Bloqueia |
| AUT-04 | Sair e usar o botão voltar | Painel protegido não reaparece autenticado | ☐ OK ☐ Ajustar ☐ Bloqueia |
| AUT-05 | Alterar conta com senha atual errada | Alteração é recusada | ☐ OK ☐ Ajustar ☐ Bloqueia |
| AUT-06 | Informar nova senha e confirmação diferentes | Formulário impede a alteração | ☐ OK ☐ Ajustar ☐ Bloqueia |
| AUT-07 | Trocar e-mail/nome sem trocar senha | Dados são atualizados e a sessão continua válida | ☐ OK ☐ Ajustar ☐ Bloqueia |
| AUT-08 | Trocar a senha corretamente | Senha antiga deixa de funcionar | ☐ OK ☐ Ajustar ☐ Bloqueia |
| AUT-09 | Solicitar recuperação de senha | E-mail chega; sem SMTP, a indisponibilidade é explícita | ☐ OK ☐ Ajustar ☐ Bloqueia |
| AUT-10 | Usar o mesmo link de redefinição duas vezes | Segunda utilização é recusada | ☐ OK ☐ Ajustar ☐ Bloqueia |

## 8. Gestão de campanhas

| ID | Manipulação manual | Resultado esperado | Status / observação |
|---|---|---|---|
| ADM-01 | Criar campanha sem preencher obrigatórios | Formulário aponta os campos necessários | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ADM-02 | Tentar repetir um código existente | Criação é recusada sem alterar a campanha existente | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ADM-03 | Enviar arquivo que não seja imagem | Upload é recusado | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ADM-04 | Enviar imagem menor ou maior que o permitido | Mensagem informa dimensão/tamanho aceito | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ADM-05 | Desmarcar todas as cores ou tamanhos de um corte | Sistema exige pelo menos uma opção válida | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ADM-06 | Criar campanha completa | Código, link, QR, variantes, tamanhos e preços ficam corretos | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ADM-07 | Editar campanha sem trocar a arte | Dados salvam e a arte atual permanece | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ADM-08 | Tentar alterar o código divulgado | Código permanece imutável | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ADM-09 | Alterar preço e criar novo pedido | Novo pedido usa o preço novo; pedido antigo mantém o preço original | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ADM-10 | Remover tamanho que já possui pedido | Operação é bloqueada e informa o conflito | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ADM-11 | Copiar código/link e abrir QR | Os três acessos apontam para a mesma campanha | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ADM-12 | Enviar MP4 válido por cor | Progresso, capa, duração, tamanho e remoção aparecem no painel | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ADM-13 | Enviar MP4 falso, maior que 10 MB ou acima de 15 s | Upload é recusado sem deixar `.part` | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ADM-14 | Abrir galeria no Chrome, Android e Safari/iPhone | Vídeo fica após a primeira foto, sem autoplay, com seek e tela cheia | ☐ OK ☐ Ajustar ☐ Bloqueia |
| ADM-15 | Trocar cor, modelo ou miniatura durante o vídeo | Reprodução anterior é pausada | ☐ OK ☐ Ajustar ☐ Bloqueia |

## 9. Pedidos, fases e cancelamento

| ID | Manipulação manual | Resultado esperado | Status / observação |
|---|---|---|---|
| OPR-01 | Buscar por aluno ou número | Lista mostra somente os pedidos correspondentes | ☐ OK ☐ Ajustar ☐ Bloqueia |
| OPR-02 | Filtrar por situação de pagamento | Quantidades e linhas respeitam o filtro | ☐ OK ☐ Ajustar ☐ Bloqueia |
| OPR-03 | Abrir pedido pendente | Situação aparece somente para consulta, sem botão “confirmar” | ☐ OK ☐ Ajustar ☐ Bloqueia |
| OPR-04 | Chamar a antiga rota administrativa de pagamento | API responde rota inexistente e preserva o estado pendente | ☐ OK ☐ Ajustar ☐ Bloqueia |
| OPR-05 | Cancelar pedido pendente sem motivo | Botão de confirmação permanece bloqueado | ☐ OK ☐ Ajustar ☐ Bloqueia |
| OPR-06 | Cancelar pedido pendente com motivo | Sai da operação, permanece no histórico e aparece ao cliente | ☐ OK ☐ Ajustar ☐ Bloqueia |
| OPR-07 | Tentar cancelar pedido pago | Sistema exige reembolso antes do cancelamento | ☐ OK ☐ Ajustar ☐ Bloqueia |
| OPR-08 | Avançar uma fase por vez | Recebimento → encerrada → produção → pronta → finalizada | ☐ OK ☐ Ajustar ☐ Bloqueia |
| OPR-09 | Tentar pular uma fase | Alteração é recusada | ☐ OK ☐ Ajustar ☐ Bloqueia |
| OPR-10 | Voltar uma fase sem motivo | Retorno não é confirmado | ☐ OK ☐ Ajustar ☐ Bloqueia |
| OPR-11 | Voltar uma fase com motivo | Retorno ocorre e o histórico registra usuário e motivo | ☐ OK ☐ Ajustar ☐ Bloqueia |
| OPR-12 | Marcar entrega antes de a campanha ficar pronta | Operação é bloqueada | ☐ OK ☐ Ajustar ☐ Bloqueia |
| OPR-13 | Marcar entrega quando pronta | Pedido aparece entregue no painel e para o cliente | ☐ OK ☐ Ajustar ☐ Bloqueia |

## 10. Relatórios e exportação

| ID | Manipulação manual | Resultado esperado | Status / observação |
|---|---|---|---|
| REL-01 | Conferir relatório com pendentes e cancelados | Somente pedidos pagos e ativos são somados | ☐ OK ☐ Ajustar ☐ Bloqueia |
| REL-02 | Somar manualmente corte, cor e tamanho | Totais coincidem com os pedidos pagos | ☐ OK ☐ Ajustar ☐ Bloqueia |
| REL-03 | Filtrar uma campanha | Nenhum pedido de outra campanha aparece | ☐ OK ☐ Ajustar ☐ Bloqueia |
| REL-04 | Abrir checklist de entrega | Exibe apenas pedidos aptos ao fluxo de entrega | ☐ OK ☐ Ajustar ☐ Bloqueia |
| REL-05 | Buscar aluno/pedido no checklist | Resultado corresponde à busca | ☐ OK ☐ Ajustar ☐ Bloqueia |
| REL-06 | Exportar produção em CSV | Arquivo abre com acentos, colunas e totais corretos | ☐ OK ☐ Ajustar ☐ Bloqueia |
| REL-07 | Exportar entrega em CSV | Arquivo respeita filtros e não executa fórmulas do conteúdo | ☐ OK ☐ Ajustar ☐ Bloqueia |
| REL-08 | Imprimir relatório | Cabeçalho, tabela e quebras ficam legíveis em A4 | ☐ OK ☐ Ajustar ☐ Bloqueia |

## 11. Responsividade e compatibilidade

| ID | Manipulação manual | Resultado esperado | Status / observação |
|---|---|---|---|
| UX-01 | Repetir pedido em Android/Chrome | Fluxo completo sem corte ou teclado cobrindo ações | ☐ OK ☐ Ajustar ☐ Bloqueia |
| UX-02 | Repetir pedido em iPhone/Safari | Fluxo completo, inclusive copiar chave e abrir WhatsApp | ☐ OK ☐ Ajustar ☐ Bloqueia |
| UX-03 | Usar painel em tela pequena | Navegação inferior e tabelas continuam utilizáveis | ☐ OK ☐ Ajustar ☐ Bloqueia |
| UX-04 | Aumentar zoom para 200% | Conteúdo permanece legível e operável | ☐ OK ☐ Ajustar ☐ Bloqueia |
| UX-05 | Navegar somente por teclado | Foco visível e ordem coerente | ☐ OK ☐ Ajustar ☐ Bloqueia |
| UX-06 | Simular conexão lenta/interrompida | Botões não duplicam ações e erros permitem nova tentativa | ☐ OK ☐ Ajustar ☐ Bloqueia |

## 12. Infraestrutura e recuperação

| ID | Manipulação manual | Resultado esperado | Status / observação |
|---|---|---|---|
| INF-01 | Abrir `/api/health` | Banco, schema e storage aparecem prontos | ☐ OK ☐ Ajustar ☐ Bloqueia |
| INF-02 | Reiniciar a API | Serviço volta sozinho e o health fica verde | ☐ OK ☐ Ajustar ☐ Bloqueia |
| INF-03 | Reiniciar após enviar uma arte | Arte continua disponível, provando persistência do upload | ☐ OK ☐ Ajustar ☐ Bloqueia |
| INF-04 | Executar backup | Snapshot contém `database.sql`, uploads e manifesto | ☐ OK ☐ Ajustar ☐ Bloqueia |
| INF-05 | Restaurar snapshot em banco separado | Contagens e consultas coincidem com a origem | ☐ OK ☐ Ajustar ☐ Bloqueia |
| INF-06 | Consultar logs da API e backup | Não há senha/token; erros têm contexto suficiente | ☐ OK ☐ Ajustar ☐ Bloqueia |
| INF-07 | Acessar domínio HTTP | Redireciona para HTTPS | ☐ OK ☐ Ajustar ☐ Bloqueia |
| INF-08 | Parar a API temporariamente | Site não inventa dados e o painel informa indisponibilidade | ☐ OK ☐ Ajustar ☐ Bloqueia |

## 13. Decisões que podem gerar alteração

Marque a necessidade antes de implementar. Estes itens não bloqueiam automaticamente o
piloto técnico, mas definem o próximo ciclo.

| Decisão | Não precisa | Precisa alterar | Observação |
|---|---|---|---|
| Mais de um usuário da Camisaria com permissões diferentes | ☐ | ☐ | |
| Painel específico para representante de turma | ☐ | ☐ | |
| Edição manual de dados de um pedido já criado | ☐ | ☐ | |
| Registro visual de reembolso no painel | ☐ | ☐ | |
| Reabrir ou corrigir entrega marcada por engano | ☐ | ☐ | |
| Notificação automática ao aluno por e-mail/WhatsApp | ☐ | ☐ | |
| Estoque de peças ou limite por tamanho/cor | ☐ | ☐ | |
| Cupom, desconto, entrada ou parcelamento | ☐ | ☐ | |
| Múltiplos pontos de retirada | ☐ | ☐ | |
| Nota fiscal ou integração contábil | ☐ | ☐ | |
| Dashboard financeiro além dos pedidos confirmados | ☐ | ☐ | |
| Extensões além do checkout InfinitePay | ☐ | ☐ | Integração base é obrigatória antes da produção |

## Fechamento da rodada

**Total OK:** ______  **Ajustes:** ______  **Bloqueadores:** ______

### Alterações solicitadas, por prioridade

1. ____________________________________________________________________________
2. ____________________________________________________________________________
3. ____________________________________________________________________________
4. ____________________________________________________________________________
5. ____________________________________________________________________________

### Decisão

- [ ] Aprovado para nova rodada de testes.
- [ ] Aprovado para piloto manual.
- [ ] Reprovado até corrigir os bloqueadores registrados.
