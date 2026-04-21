# Email Agent Workshop

Workshop: Build an AI email agent with Cloudflare Agents SDK and Email Routing.

## Chapters

- -> **[Chapter 1 - Email Triggers a Persistent Agent](https://github.com/harshil1712/email-agent-workshop-code/tree/chapter-1)** (this branch)
- [Chapter 2 - AI = Understanding](https://github.com/harshil1712/email-agent-workshop-code/tree/chapter-2)
- [Chapter 3 - Persistence = Memory](https://github.com/harshil1712/email-agent-workshop-code/tree/chapter-3)

---

# Chapter 1 - Email Triggers a Persistent Agent

Email doesn't trigger a function — it wakes up a persistent entity.

## What you'll learn

- An Agent is a Durable Object that hibernates when idle and wakes on demand
- The resolver pattern determines which agent instance handles each email
- Custom sender-based routing gives each customer their own agent instance

## Steps

### Step 1 - Configuration

Add the `send_email` binding to `wrangler.jsonc`:

```jsonc
"send_email": [
  {
    "name": "EMAIL",
    "remote": true
  }
]
```

### Step 2 - Handle Incoming Emails

1. Import `postal-mime` and the `AgentEmail` interface, and `routeAgentEmail` from `agents`:

```ts
import { Agent, routeAgentEmail, routeAgentRequest } from 'agents';
import { type AgentEmail } from 'agents/email';
import PostalMime from 'postal-mime';
```

2. Add an `onEmail` handler to the `SupportAgent` class:

```ts
async onEmail(email: AgentEmail) {
  const raw = await email.getRaw();
  const parsed = await PostalMime.parse(raw);

  console.log('Subject:', parsed.subject);
  console.log('From:', parsed.from);
  console.log('Text body:', parsed.text);
}
```

3. Add an `email` handler to the default export with a custom resolver that routes by sender address — so each customer gets their own agent instance:

```ts
export default {
  async email(message, env) {
    await routeAgentEmail(message, env, {
      resolver: async (email) => ({
        agentName: 'SupportAgent',
        agentId: email.from,
      }),
    });
  },
  async fetch(request: Request, env: Env) {
    return (await routeAgentRequest(request, env)) || new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
```

### Step 3 - Test locally

1. Start the development server:

```bash
npm run dev
```

2. Send a test email via the local email endpoint:

```bash
curl --request POST 'http://localhost:8787/cdn-cgi/handler/email' \
  --url-query 'from=alice@abc.com' \
  --url-query 'to=support@example.com' \
  --data-raw 'From: "Alice" <alice@abc.com>
To: support@example.com
Subject: Help with my order
Content-Type: text/plain; charset="utf-8"
Message-ID: <test-email-001@localhost>

Hi there, I need help with my recent order #12345.'
```

Expected console output:

```
Subject: Help with my order
From: { address: 'alice@abc.com', name: 'Alice' }
Text body: Hi there, I need help with my recent order #12345.
```

## What we learned

- The resolver decides which agent instance wakes up
- A custom resolver routes by sender — `alice@abc.com` always hits instance `alice@abc.com`
- A single inbound address can serve many isolated per-customer agents
