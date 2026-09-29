# Revisão para commit — reorganização estrutural

## Referência e escopo

HEAD revisado: `3158dcb2b413653cb20e4b7d4969011db9c0ab40`.
A correção do relatório de entrega já consta desse histórico. A reorganização permanece no diretório de trabalho, incluindo arquivos novos ainda não rastreados. O índice Git não foi alterado nesta preparação.

O manifesto `manifesto-revisao.json` identifica cada arquivo pendente por caminho, tamanho, SHA-256 e grupo proposto. Exclui este documento e o próprio manifesto para evitar referência circular. Os hashes identificam o conteúdo local exato; qualquer edição posterior exige regenerar o manifesto e revisar o impacto na validação.

## Divisão proposta

### 1. `refactor: modularize application and validate operational contracts`

142 arquivos, aproximadamente 2,92 MB: aplicação, contratos, assets otimizados, ferramentas, dependências, configuração e testes. Inclui `.env.example`, sem credenciais reais.

Manter esse conjunto junto: os módulos extraídos importam os contratos novos; os componentes importam WebP e a fonte reduzida; os scripts do package.json dependem dos novos testes e ferramentas; os testes importam os serviços extraídos. Separar apenas por pasta deixaria referências ausentes.

A divisão em oito entregas serviu para implementação e verificação. O estado final não preserva oito snapshots independentes. Criá-los agora exigiria reconstrução e teste de versões intermediárias; não se deve apresentar agrupamentos por pasta como commits independentes já validados.

### 2. `docs: record architecture validation and release procedures`

54 arquivos, aproximadamente 13,16 MB, mais este documento e o manifesto: README, AGENTS, arquitetura, continuidade, procedimentos, histórico e evidências. A maior parte do volume são capturas PNG antes/depois. Manter as evidências vinculadas à reorganização; não incluem uploads de clientes.

Esse commit vem imediatamente após o primeiro. Os dois formam a unidade de revisão proposta. Não publicar apenas parte do conjunto.

## Ordem de revisão do código

| Área | Conferência realizada | Evidência associada |
|---|---|---|
| HTTP e ciclo de vida | CORS antes do despacho; exceções de licença/saúde; workers com parada e espera | smoke, importação dos serviços e teste de worker |
| Persistência | Consultas nos repositórios; transações coordenadas pelos serviços; migrações antigas sem diff | integrações e recuperação da 024 |
| Pagamentos e SMTP | Confirmação pelo provedor; filas preservadas; classificação conservadora de envio incerto | smoke e testes SMTP locais |
| Frontend | Navegação sem ciclo com App; páginas/seções carregadas sob demanda; proteção de dados demo | tipos, lint, build e jornadas |
| Entrega e checkout | Estado confirmado de entrega permanece após atualização falhar; nome obrigatório e retomada com telefone | jornadas desktop/celular |
| Operação | Migração opcional na inicialização; credenciais separadas; identificação do build | testes de inicialização e ensaio de restauração |
| Arquivos publicáveis | Inventário inclui arquivos novos; nenhum caminho de ambiente real, backup, upload ou chave privada | manifesto de arquivos |

A revisão por caminhos não é uma auditoria exaustiva de segredos nem comprovação de produção. O aceite funcional é limitado aos cenários documentados em `refatoracao-validacao.md`.

## Verificações disponíveis

- Em 29/09: `npm.cmd run check:release` aprovado: tipos, lint, 20 unitários, cinco integrações, build e 14 jornadas.
- Após tornar a preparação do teste de collation independente: teste isolado e lint aprovados.
- Nesta preparação: revisão dos diffs operacionais e dependências, inventário de arquivos novos, migrações sem alteração e `git diff --check`.
- Nenhum código executável foi alterado nesta preparação; não foi repetida a suíte sem mudança que justificasse isso.

## Antes de executar commits autorizados

1. Confirmar HEAD e comparar os hashes do manifesto com os arquivos atuais.
2. Incluir arquivos por lista explícita do grupo; verificar o diff preparado, inclusive arquivos novos. Não usar inclusão indiscriminada de temporários.
3. Criar o primeiro commit e então o segundo com os documentos e evidências. Confirmar o estado final do diretório de trabalho.
4. Push exige autorização específica; CI ainda não executou no GitHub/Node 22. Deploy exige o checklist operacional, versão anterior e backup quando aplicável.

Limitação: o commit de implementação é grande. Para as próximas mudanças, concluir e registrar cada entrega antes de iniciar outra, evitando acumular novamente extrações, otimizações e alterações operacionais no mesmo diretório de trabalho.

## Execução autorizada

O usuário autorizou os dois commits e a inclusão da correção do outro agente. Implementação criada em `35be302`; a correção inicial de relatório já estava em `3158dcb`. A correção complementar de collation e suas regressões entrou no primeiro commit. A divisão acima é o registro da preparação anterior aos commits.
