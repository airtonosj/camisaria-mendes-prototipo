# Estado atual

## Referência

- Base: `95a005788b7d53282529b23c44d9c000c7768c63`; árvore inicialmente limpa.
- Implementação registrada em `35be302`, após autorização específica. A correção do relatório de entrega em `3158dcb` permanece no histórico; sua correção complementar de collation e testes integra `35be302`. Push e deploy não realizados por este chat.
- Schema: migrações 001–024 preservadas.
- Produção: versão não verificada nesta reorganização.
- Hospedagem principal: Hostinger Node.js Web App.

## Continuidade

As oito áreas do plano foram implementadas localmente. Consulte [validação](refatoracao-validacao.md), [inventário](inventario.md) e [arquitetura](arquitetura.md) para alterações, evidências e limites. A verificação consolidada local de 29/09 passou, incluindo a correção do relatório de entrega. Resultados e limites estão registrados abaixo.

## Próxima ação

Após os commits locais autorizados, o próximo passo é push especificamente autorizado e acompanhamento da CI. Qualquer nova alteração de código exige as verificações correspondentes. Publicação exige identificar a versão anterior, backup e validar o artefato conforme o [checklist](checklist-release.md). Documentos em `historico/` não comprovam o estado publicado.

## Verificação em 28/09/2026

- Primeira execução completa de `check:release`: aprovada, com 20 testes unitários, quatro suítes de integração, build e 12 jornadas desktop/celular.
- Após o ajuste visual do campo WhatsApp na retomada: tipos, lint, 20 testes unitários, quatro integrações e build aprovados novamente.
- A repetição das jornadas completas foi interrompida pela preparação concorrente do mesmo ambiente E2E. O usuário confirmou outro chat ativo no relatório de entrega. Seus processos foram preservados.
- Checkout, retomada e consulta foram então verificados em banco próprio `camisaria_resume_final_e2e_test` e portas 4286/4287: duas jornadas aprovadas. Capturas desktop/celular inspecionadas com o campo alinhado ao padrão visual.
- `git diff --check`: sem erros de whitespace. Métricas atualizadas em `qa-evidence/structure/performance.json`.
- GitHub Actions/Node 22 e produção continuam sem verificação. Não houve commit, push ou deploy.
## Fechamento consolidado em 29/09/2026

- `npm.cmd run check:release`: aprovado, sem outra suíte simultânea. Tipos, lint, 20 testes unitários, cinco integrações, build/verificação dos artefatos e 14 jornadas desktop/celular.
- O primeiro ensaio identificou uma disputa no próprio smoke: ele alterava o contador de tentativas enquanto o worker podia estar processando o evento. A preparação agora espera a tentativa terminar e o evento voltar à fila antes de configurar a última tentativa. O limite e as regras do worker não mudaram.
- O novo teste de collation da entrega agora recria seu banco antes de usar a tabela temporária. Após esse ajuste, passou isoladamente, seguido de lint; não depende de smoke anterior.
- A regressão de relatório verifica confirmação persistida, histórico único e estado após recarregar a página, inclusive quando a atualização do relatório falha.
- Artefato local: commit `3158dcb2b413653cb20e4b7d4969011db9c0ab40`, `dirty=true`, build `2026-09-29T17:23:05.058Z`. Identifica a origem e alterações locais, não uma versão publicada.
- JavaScript inicial gzip: 71.959 B; redução conservadora de 45,24%. Evidência atualizada em `qa-evidence/structure/performance.json`.
- CI/Node 22 e produção permanecem não verificados. Este chat não realizou commit, push, deploy, compra ou envio real.
## Preparação para revisão

Revisão por módulos e divisão proposta registradas em [revisão para commit](revisao-para-commit.md). O manifesto inclui os arquivos novos e hashes do conteúdo local. Índice preservado; commits e push ainda dependem de autorização específica.


## Registro dos commits autorizados

Implementação: `35be302`. Documentação e evidências acompanham o commit seguinte. A verificação dos arquivos novos preparados apontou espaços finais e linhas vazias extras em sete arquivos; corrigidos sem alteração de comportamento. Os resultados funcionais anteriores permanecem registrados acima. Nenhum push ou deploy foi executado.
