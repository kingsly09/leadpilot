# n8n workflows

`leadpilot-sales-alerts.json` is an export of the **LeadPilot — Sales Alerts** workflow, with the shared
secret, alert email address, Telegram chat ID and credentials removed.

To use it:

1. In n8n, **Workflows → Import from file** and choose `leadpilot-sales-alerts.json`.
2. In **Verify Secret**, replace `REPLACE_WITH_N8N_WEBHOOK_SECRET` with the same value as `N8N_WEBHOOK_SECRET` in LeadPilot.
3. In **Email Sales Team**, pick a Gmail credential and set the recipient.
4. In **Telegram Sales Team**, pick a Telegram credential and set your chat ID.
5. Publish the workflow and put its production webhook URL in LeadPilot's `N8N_WEBHOOK_URL`.
