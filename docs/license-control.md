# Controle de licença

Este recurso suspende novas operações de forma reversível, sem apagar arquivos,
banco, pedidos ou pagamentos. Ele não é uma backdoor: a instalação valida comandos
Ed25519 assinados e mantém um histórico auditável.

## 1. Gerar as chaves

Execute em uma máquina sob controle do fornecedor e escolha um diretório fora do
projeto e fora da host do cliente:

```powershell
npm.cmd run license:keygen -- --out-dir C:\segredos\camisaria-license
```

O comando cria:

- `license-private.pem`: segredo do fornecedor; nunca enviar ao cliente;
- `license-public-base64.txt`: valor público que será configurado na aplicação.

Faça backup criptografado da chave privada. Se ela for perdida, não será possível
emitir novos comandos para instalações que confiam nela.

## 2. Configurar a instalação do cliente

Defina variáveis no ambiente do backend:

```dotenv
LICENSE_CONTROL_ENABLED=true
LICENSE_INSTALLATION_ID=cliente-exemplo-producao
LICENSE_PUBLIC_KEY_BASE64=<conteudo de license-public-base64.txt>
```

Use um identificador único e estável por instalação. Aplique as migrações e reinicie
o backend. O estado inicial é `active`.

## 3. Emitir uma suspensão

Gere um token curto fora da host do cliente:

```powershell
npm.cmd run license:token -- suspend --installation cliente-exemplo-producao --private-key C:\segredos\camisaria-license\license-private.pem --expires 15m --reason "Suspensao contratual autorizada"
```

Abra `https://dominio-do-cliente/controle-licenca`, cole o token e confirme. O token
só vale para a instalação indicada, expira no prazo escolhido e só pode ser usado uma
vez.

## 4. Reativar

Emita outro comando, agora com a ação `activate`:

```powershell
npm.cmd run license:token -- activate --installation cliente-exemplo-producao --private-key C:\segredos\camisaria-license\license-private.pem --expires 15m
```

Cole o novo token na mesma URL. A reativação preserva integralmente os dados.

## Comportamento durante a suspensão

- páginas públicas retornam uma página de indisponibilidade com HTTP 503;
- novas mutações da API retornam HTTP 423;
- login e acesso administrativo de leitura continuam disponíveis;
- healthcheck, webhook/reconciliação e ações de fechamento como cancelamento,
  entrega e reembolso continuam disponíveis;
- nenhum pedido, pagamento ou registro histórico é removido.

O estado atual também aparece em `/api/health`. A URL de controle usa `noindex`, mas
o endereço não é o segredo: a segurança está na assinatura da chave privada.

## Limitação importante

Como o código e o processo executam na infraestrutura do cliente, uma pessoa com root
e acesso ao código-fonte pode alterar ou remover o verificador. Este mecanismo oferece
controle contratual proporcional e auditável, não DRM inviolável. Se resistência a
esse tipo de alteração for indispensável, uma capacidade essencial precisa permanecer
hospedada pelo fornecedor.
