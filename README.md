# Chatwoot-Botpress Bridge

Bridge server to connect Chatwoot with Botpress Messaging API.

## Setup on Railway

1. Go to [Railway.app](https://railway.app)
2. Sign up / Login with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Upload this code or connect your repo
5. Railway will auto-detect Node.js and deploy

## Environment Variables (Optional)

You can set these in Railway dashboard instead of hardcoding:

```
CHATWOOT_BASE_URL=https://chat.engosoft.com
CHATWOOT_ACCOUNT_ID=2
CHATWOOT_API_TOKEN=your_token
BOTPRESS_WEBHOOK_URL=https://webhook.botpress.cloud/xxx
BOTPRESS_PAT=bp_pat_xxx
```

## Endpoints

- `POST /chatwoot/webhook` - Receives messages from Chatwoot
- `POST /botpress/webhook` - Receives responses from Botpress
- `GET /` - Health check

## Configuration

After deploying on Railway, you'll get a URL like:
`https://your-app.railway.app`

### In Chatwoot:
- Go to Settings → Integrations → Webhooks
- Add webhook: `https://your-app.railway.app/chatwoot/webhook`
- Select events: `message_created`

### In Botpress:
- Go to Messaging API integration settings
- Set Response Endpoint URL: `https://your-app.railway.app/botpress/webhook`
