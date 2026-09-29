# Validação da reorganização

Referência: `95a005788b7d53282529b23c44d9c000c7768c63`, árvore inicialmente limpa. Trabalho local, sem commit, push ou deploy. Nenhuma compra ou mensagem real foi realizada.

## Implementação por entrega

| Entrega | Resultado local |
|---|---|
| 1 — Referência/documentação | README e AGENTS curtos; estado, arquitetura e inventário; documentos anteriores arquivados; 16 capturas de referência |
| 2 — Proteção/CI | Helpers de servidor, banco e InfinitePay falso; retirada independente; Node test, lint React hooks, Playwright; workflow Node 22/MySQL 8 sem deploy |
| 3 — Frontend | Painel de composição; conta, visão geral, pedidos, relatórios, compartilhamento e editor separados; quatro etapas do editor e reducer; checkout e utilitários extraídos; navegação sem dependência circular de App |
| 4 — API | HTTP separado de serviços e repositórios; serviços conservam a transação; inicialização e workers centralizados; importação dos serviços termina sem abrir portas/timers |
| 5 — Contratos | Contratos TypeScript compartilhados e JSDoc; cálculo de desconto único; validação das respostas críticas; regras de entrada preservadas no servidor |
| 6 — SMTP | Nodemailer mantém a interface; TLS obrigatório e certificado validado; classificação conservadora das falhas incertas; política de reenvio das filas preservada |
| 7 — Desempenho | Rotas/seções sob demanda; PDF continua dinâmico; WebP com originais preservados; fonte reduzida; CSS separado na mesma ordem |
| 8 — Operação | Dois modos de migração; credenciais de migração separadas; versão no build/health; logs sem corpos/contatos/tokens; ensaio de restauração isolado |

## Falhas encontradas e corrigidas

- **Concorrência do último uso de cupom:** duas transações obtinham 201. A consulta de uso podia ler um snapshot anterior ao bloqueio. A leitura com bloqueio agora enxerga usos confirmados; a regressão exige um 201 e um 409. Essa é uma alteração pontual de SQL motivada por evidência, além das extrações.
- **Retomada do pagamento:** o telefone começava vazio e não havia campo no passo de pagamento. A retomada agora solicita o WhatsApp cadastrado; o servidor continua validando a identidade do pedido.
- **Revisão do editor:** reutilizar o botão Continuar como submit podia publicar ao avançar. Botões com identidades distintas mantêm a confirmação explícita.
- **Acesso direto ao login:** assets relativos falhavam em `/acesso-camisaria/`. O build usa a raiz da origem, compatível com o Node Web App que serve site, API e uploads juntos. Hospedagem sob subdiretório não é o alvo desta configuração.
- **Smoke inicial:** falhou antes da refatoração aguardando a reconciliação de evento. A janela curta de espera foi ampliada. No fechamento de 29/09 foi identificada e removida a disputa entre a preparação da última tentativa e o worker ativo; as asserções comerciais permanecem.

## Verificações

O fechamento usa `npm.cmd run check:release`: tipos, lint, testes unitários, integração, build/verificação dos artefatos e jornadas desktop/celular. O registro de fechamento em `estado-atual.md` indica o resultado confirmado da execução final.

Cobertura adicional:

- Idempotência; confirmação pelo provedor; divergência de valor; cancelamento/reembolso; sessão expirada e troca de senha.
- Cupons com mínimo, teto e múltiplos cortes; desempate da distribuição; indisponível, expirado, esgotado e disputa do último uso.
- Fila de retirada: elegibilidade, prévia sem envio, confirmação concorrente, histórico, reinício e resultado incerto.
- Migração 024 interrompida após cada uma de suas oito etapas; repetição e preservação dos registros.
- Inicialização com migração automática e com verificação explícita de schema; recusa de pendências.
- SMTP local: autenticação e destinatário recusados, timeout, desconexão durante/após DATA, aceitação seguida de desconexão, acentos e Message-ID estável. Timeout com etapa ambígua permanece incerto.
- Backup/restauração: 24 migrações, 5 campanhas, 10 pedidos, 1 pagamento, 1 reembolso e 8 arquivos restaurados. Evidência em `qa-evidence/structure/restore.json`. Destinos são banco novo `_restore_test` e diretório temporário independente.

## Desempenho

| Item | Antes | Depois | Redução |
|---|---:|---:|---:|
| Imagens estáticas referenciadas | 20.069.729 B | 1.712.910 B | 91,47% |
| Fonte de ícones | 966.176 B | 47.492 B | 95,08% |
| JavaScript inicial gzip | bundle principal ~131,41 KB | conjunto inicial ~72 KB | superior a 40% |

O número anterior de JS é apenas o bundle principal registrado pelo build. O posterior soma o script inicial e todos os modulepreloads do HTML; a comparação é conservadora e os compressores podem produzir pequena diferença. Os módulos administrativos não são solicitados na jornada pública. CSS gzip passou de ~39,46 para ~39,51 KB com o campo de retomada: a separação preservou seletores e ordem, sem remoção especulativa de regras.

Reprodução: `node ops/measure-build.mjs`; `node ops/optimize-images.mjs`; `python ops/subset-icons.py` com fonttools e brotli. Depois de acrescentar ícones, regenere a fonte antes de publicar. Resultados em `qa-evidence/structure/{performance,images,icons}.json`.

## Comparação visual

Capturas antes/depois: página pública, campanha, visão geral e login em 390, 768, 1440 e 1920 px, com 900 px de altura de viewport. Mesmas dimensões de página em todos os pares. Comparação por pixel com tolerância de 30 por canal: zero pixels acima do limiar nos pares públicos/campanha/login; menos de 0,1% no painel, cuja data mudou entre capturas. Pares desktop/celular inspecionados visualmente, sem alteração de composição identificada. Métrica em `qa-evidence/structure/visual-comparison.json`.

Essas capturas usam dados demonstrativos isolados para comparação estável. As jornadas automatizadas usam a API real e dados fictícios persistidos. A nova retomada tem capturas próprias desktop/celular; não existe referência anterior funcional desse campo.

## Limitações e operação pendente

- GitHub Actions configurado, ainda não executado remotamente: não houve push autorizado.
- Execução local em Node 24.18/MySQL 8.0.46; CI configurada para Node 22. A confirmação nessa versão depende da execução da CI.
- SMTP e InfinitePay testados com provedores locais falsos. Homologação comercial real e entrega efetiva de e-mail não são demonstradas por estes testes.
- Versão publicada não foi consultada. Nenhuma migração, permissão ou dado de produção foi alterado.
- Comparação visual cobre as telas e larguras registradas, não toda combinação possível de mídia e conteúdo.
- A política de reenvio das filas não foi ampliada; aceitação pelo SMTP não comprova entrega ao destinatário.
- O editor mantém um hook de coordenação extenso, agora independente das quatro telas e com reducer. Novas extrações podem ser feitas por responsabilidade concreta em futuras tarefas.

Referências de implementação: [Playwright webServer](https://playwright.dev/docs/test-webserver) e [Nodemailer SMTP](https://nodemailer.com/smtp).


Fechamento de 29/09/2026: tipos, lint, 20 testes unitários, cinco integrações, build e 14 jornadas aprovados. O teste de collation recebeu preparação independente e passou também isoladamente. Referência completa do artefato em [estado atual](estado-atual.md).
