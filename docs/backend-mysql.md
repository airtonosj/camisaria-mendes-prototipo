# Backend MySQL — primeira fundação

O front-end continua funcionando como demonstração enquanto esta API é ligada às telas. A base usa Node.js para a API e MySQL 8 para persistência.

## Decisões do domínio

- O estado operacional pertence à **campanha**, nunca ao produto ou à variante.
- Uma campanha só avança ou retorna uma etapa por operação.
- Todo retorno exige motivo e gera uma linha em `campaign_phase_history`.
- Modelo, cor e preço formam uma variante disponível dentro de uma campanha.
- O preço é copiado para `order_items` no momento da compra, preservando o histórico.
- Somente pedidos com `payment_status = 'paid'` aparecem nos relatórios oficiais.
- Redirecionamento do navegador não confirma pagamento; a futura integração deverá confirmar pela API/webhook assinado do provedor.
- `Idempotency-Key` impede que uma tentativa repetida crie dois pedidos.

## Preparar o banco

1. Copie `.env.example` para `.env` e informe as credenciais do MySQL local.
2. Execute `npm run db:create` para criar o banco `camisaria_mendes` com `utf8mb4`.
3. Execute `npm run db:migrate` para aplicar os arquivos de `database/migrations`.
4. Em desenvolvimento, execute `npm run db:seed` para cadastrar as duas campanhas locais sem criar pedidos ou pagamentos falsos.

O comando usa as credenciais do `.env` e dispensa a instalação do cliente MySQL. Como alternativa, com o cliente instalado:

```powershell
mysql -h 127.0.0.1 -u camisaria -p camisaria_mendes < database/migrations/001_initial_schema.sql
```

## Executar a API

```powershell
npm install
npm run api:dev
```

Verificação:

```powershell
Invoke-RestMethod http://127.0.0.1:3333/api/health
```

## Rotas iniciais

| Método | Rota | Finalidade |
| --- | --- | --- |
| `GET` | `/api/health` | Verificar API e banco |
| `GET` | `/api/campaigns/:codigo` | Carregar campanha, modelos e cores |
| `POST` | `/api/orders` | Registrar pedido ainda pendente de pagamento |
| `GET` | `/api/orders/:numero?whatsapp=...` | Acompanhar um pedido com os dados da compra |
| `GET/POST` | `/api/admin/campaigns` | Listar ou criar campanhas persistentes |
| `PATCH` | `/api/admin/campaigns/:codigo/phase` | Avançar ou retornar a campanha |
| `GET` | `/api/admin/campaigns/:codigo/orders` | Listar os pedidos de uma campanha |
| `PATCH` | `/api/admin/orders/:numero/delivery` | Registrar a situação da entrega |
| `GET` | `/api/admin/reports/production` | Consolidado de peças pagas |
| `GET` | `/api/admin/reports/delivery` | Checklist de pedidos pagos |

As rotas administrativas exigem `X-Admin-Token`. Essa chave é uma proteção inicial de desenvolvimento e deverá ser substituída pelo login com sessão antes da publicação.

Exemplo de criação idempotente de pedido:

```json
{
  "campaignCode": "MENDES-ADS-26",
  "customer": {
    "name": "Ana Souza",
    "whatsapp": "5598999990000",
    "email": "ana@example.com"
  },
  "items": [
    { "variantId": 1, "size": "M", "quantity": 1 }
  ]
}
```

Envie também o cabeçalho `Idempotency-Key` com um UUID gerado no navegador.
