# Auditoria do formulario de criacao de campanhas

Data: 2026-08-13

## Escopo

Fluxo observado no painel de demonstracao: Campanhas > Nova campanha, incluindo o estado inicial e a expansao da configuracao de mockup.

## Evidencias

1. `01-campaign-list.png` - entrada do fluxo pela lista de campanhas.
2. `02-form-top.png` - inicio do formulario e dados gerais.
3. `03-form-configuration.png` - configuracao de cores e tamanhos.
4. `04-form-display-options.png` - escolha de exibicao e acao final.
5. `05-form-artwork-expanded.png` - editor de arte expandido.

## Diagnostico

- O formulario e uma pagina unica muito longa, inserida acima da lista de campanhas.
- Dados basicos, produtos, cores, tamanhos, imagens e publicacao usam peso visual semelhante.
- Cores e tamanhos repetem a troca de contexto entre Padrao e Oversized.
- O cadastro de cor personalizada fica sempre aberto, embora seja uma acao ocasional.
- A escolha obrigatoria de imagens aparece somente perto do fim; ate la, a acao principal permanece desabilitada.
- Ao ativar mockup, abre-se um segundo formulario complexo dentro do primeiro.
- Labels e textos auxiliares parecem pequenos e com contraste discreto em varios pontos.

## Direcao recomendada

Transformar a criacao em quatro etapas:

1. Informacoes - nome, representante, WhatsApp, prazo e retirada. Gerar o codigo automaticamente e deixar subtitulo/codigo em Opcoes avancadas.
2. Produtos - cortes e precos em cards. Cada card mostra um resumo como `5 cores - 8 tamanhos` e abre a configuracao detalhada sob demanda.
3. Imagens - escolher primeiro entre Mockup, Fotos reais ou ambos. O editor de arte deve abrir em uma area dedicada, com preview grande e controles ao lado.
4. Revisao - resumo visual da campanha, alertas de pendencias e acao `Criar campanha e gerar acesso`.

## Prioridades

1. Adotar o fluxo por etapas e remover a lista de campanhas de baixo do formulario.
2. Ocultar configuracoes ocasionais por divulgacao progressiva.
3. Consolidar cores e tamanhos dentro de cada corte.
4. Criar uma revisao final visual antes da publicacao.
5. Aumentar tamanho/contraste de labels e garantir estados de foco, erro e navegacao por teclado.

## Limites

As observacoes visuais foram feitas em desktop no ambiente local. Contraste numerico, leitura por tecnologia assistiva, ordem de foco, validacao completa, comportamento mobile e persistencia no backend ainda exigem testes especificos.
