# PayPal Context Plugin (APIMatic)

Optional development aid: APIMatic’s PayPal Context Plugin adds PayPal-specific skills and lookup context in Cursor. No separate APIMatic API credentials are required.

## Install

```bash
npx context-plugins install paypal --targets cursor -y
```

Default location: `~/.cursor/plugins/local/paypal`. Restart the editor after install.

## Distinction from the npm SDK

Installing `@paypal/paypal-server-sdk` or reading public REST docs does not install this plugin. The plugin is the `context-plugins install paypal` package and its bundled TypeScript skills (integrate, calling endpoints, error handling, models).

## Payment features aligned with plugin guidance

| Topic | Implementation |
|---|---|
| Orders v2 | `createOrder`, `getOrder`, `captureOrder` via `@paypal/paypal-server-sdk` |
| Interrupted checkout | Reconcile live order status before marking payment failed |
| Capture retries | Idempotent capture request id; duplicate webhooks ignored |

See `src/features/payments/payment.service.ts` and `src/server/paypal/`.

## Related

- [Sponsor integrations](./sponsor-tools.md)
- [Demo walkthrough](./demo-walkthrough.md)
