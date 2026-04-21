# Email Agent Workshop

Workshop: Build an AI email agent with [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/) and [Email Routing](https://developers.cloudflare.com/email-routing/).

## What you'll build

An AI Inbox Agent for **FastFlare Home Services** — a small business offering cleaning, plumbing, and landscaping. The owner currently manages a chaotic inbox of booking requests, status inquiries, follow-ups, and emergency calls.

By the end of this workshop, they'll have an agent that:

- Receives email via [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/)
- Understands intent using an LLM
- Maintains conversation history across threads
- Queries a built-in SQL database

Not an auto-responder — a programmable, edge-native team member.

## The Conceptual Arc

Five concepts, each building on the previous one. **This repo covers the first three:**

1. **Email triggers a persistent agent** — Email wakes up a persistent entity
2. **AI = Understanding** — That entity reads and interprets your email
3. **Persistence = Memory** — That entity remembers you
4. *Tools = Action — That entity acts on your behalf (coming soon)*
5. *Scheduling = Proactivity — That entity acts on its own (coming soon)*

## Architecture

```
          Email arrives (SMTP)
                 │
                 ▼
      ┌─────────────────────┐
      │   Email Routing     │  Cloudflare Email Routing
      └─────────────────────┘
                 │
                 ▼
      ┌─────────────────────┐
      │   email() handler   │  Worker entry point
      │   + Resolver        │  Routes by sender → agent instance
      └─────────────────────┘
                 │
                 ▼
      ┌─────────────────────┐
      │   SupportAgent      │  Durable Object (Agent)
      │  ┌───────────────┐  │
      │  │  onEmail()    │  │  Handles the email
      │  │  this.sql     │  │  Per-instance SQLite
      │  │  this.state   │  │  Working context
      │  └───────────────┘  │
      └─────────────────────┘
```

**Key concepts:**
- An **Agent** is a [Durable Object](https://developers.cloudflare.com/durable-objects/) — it hibernates when idle, wakes on demand, and has its own SQLite storage
- The **resolver** determines which agent instance handles each email — our custom resolver routes by sender so each customer gets their own isolated agent
- One class (`SupportAgent`), many instances — one per customer

## Prerequisites

- Cloudflare account (free tier works) with a registered domain
- Node.js installed
- A code editor
- Terminal / command line

## Project Setup

Clone this repo and install dependencies:

```bash
git clone https://github.com/harshil1712/email-agent-workshop-code.git
cd email-agent-workshop-code
npm install
```

> This project was scaffolded from the [`cloudflare/agents-starter`](https://github.com/cloudflare/agents-starter) template.

### Project structure

```
email-agent-workshop/
├── src/
│   └── index.ts       ← All our code goes here
├── wrangler.jsonc     ← Worker + agent configuration
├── package.json
└── tsconfig.json
```

## Chapters

- -> **[Chapter 1 - Email Triggers a Persistent Agent](https://github.com/harshil1712/email-agent-workshop-code/tree/chapter-1)** (this branch)
- [Chapter 2 - AI = Understanding](https://github.com/harshil1712/email-agent-workshop-code/tree/chapter-2)
- [Chapter 3 - Persistence = Memory](https://github.com/harshil1712/email-agent-workshop-code/tree/chapter-3)

## Resources

- [Slides](TODO)
- [Cloudflare Agents SDK docs](https://developers.cloudflare.com/agents/)
- [Cloudflare Email Routing docs](https://developers.cloudflare.com/email-routing/)

---

# Getting Started — Chapter 1

Email doesn't trigger a function — it wakes up a persistent entity.

## What you'll learn

- An Agent is a [Durable Object](https://developers.cloudflare.com/durable-objects/) that hibernates when idle and wakes on demand
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

1. Import [`postal-mime`](https://github.com/postalsys/postal-mime) and the `AgentEmail` interface, and `routeAgentEmail` from `agents`:

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
