# Email Agent Workshop

Workshop: Build an AI email agent with [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/) and [Email Routing](https://developers.cloudflare.com/email-routing/).

## Chapters

- [Chapter 1 - Email Triggers a Persistent Agent](https://github.com/harshil1712/email-agent-workshop-code/tree/chapter-1)
- -> **[Chapter 2 - AI = Understanding](https://github.com/harshil1712/email-agent-workshop-code/tree/chapter-2)** (this branch)
- [Chapter 3 - Persistence = Memory](https://github.com/harshil1712/email-agent-workshop-code/tree/chapter-3)

---

# Chapter 2 - AI = Understanding

The agent reads, interprets, and responds intelligently.

## What you'll learn

- An LLM reads the email and understands intent — no keyword matching required
- The Parse → Call LLM → Reply flow
- How to prevent mail loops using `isAutoReplyEmail()`

## Steps

### Step 1 - Install dependencies

```bash
npm install ai workers-ai-provider
```

- [`ai`](https://sdk.vercel.ai/) — Vercel AI SDK for calling language models
- [`workers-ai-provider`](https://www.npmjs.com/package/workers-ai-provider) — Workers AI provider for the Vercel AI SDK

### Step 2 - Add a system prompt

Define the agent's persona, knowledge, and guardrails:

```ts
const SYSTEM_PROMPT = `You are the inbox agent for FastFlare Home Services,
a home services company offering cleaning, plumbing, and landscaping.

Your job is to:
- Read the customer's email and understand what they need
- Respond professionally and helpfully
- If they want to book a service, acknowledge it and confirm you'll arrange it
- If they ask about pricing or availability, provide what you know
- If you can't help, let them know a human will follow up

Available services: cleaning ($150), plumbing ($200 callout), landscaping ($300)
Business hours: Mon-Fri 8am-6pm
Emergency plumbing: available 24/7, $350 callout`;
```

### Step 3 - Integrate [Workers AI](https://developers.cloudflare.com/workers-ai/)

1. Import `createWorkersAI` and `generateText`:

```ts
import { createWorkersAI } from 'workers-ai-provider';
import { generateText } from 'ai';
```

2. Also import `isAutoReplyEmail` alongside `AgentEmail`:

```ts
import { isAutoReplyEmail, type AgentEmail } from 'agents/email';
```

3. Update the `onEmail` handler to guard against mail loops, call the LLM, and reply:

```ts
async onEmail(email: AgentEmail) {
  const raw = await email.getRaw();
  const parsed = await PostalMime.parse(raw);

  if (isAutoReplyEmail(parsed.headers)) {
    console.log('Skipping auto-reply email');
    return;
  }

  const workersai = createWorkersAI({ binding: this.env.AI });
  const { text } = await generateText({
    model: workersai('@cf/zai-org/glm-4.7-flash'),
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: parsed.text || 'No text content',
      },
    ],
  });

  await this.replyToEmail(email, {
    fromName: 'FastFlare Home Services',
    body: text,
  });
}
```

> `isAutoReplyEmail()` checks for RFC 3834 headers (`Auto-Submitted`, `X-Auto-Response-Suppress`, `Precedence`). Always add this guard — mail loops are a real danger in production.

### Step 4 - Test locally

1. Start the development server:

```bash
npm run dev
```

2. Send a test email:

```bash
curl --request POST 'http://localhost:8787/cdn-cgi/handler/email' \
  --url-query 'from=alice@abc.com' \
  --url-query 'to=support@example.com' \
  --data-raw 'From: "Alice" <alice@abc.com>
To: support@example.com
Subject: Booking enquiry
Content-Type: text/plain; charset="utf-8"
Message-ID: <test-email-002@localhost>

Hi, I would like to book a house cleaning for next Friday. What are your rates?'
```

Expected console output:

```
Subject: Booking enquiry
From: { address: 'alice@abc.com', name: 'Alice' }
Text body: Hi, I would like to book a house cleaning for next Friday. What are your rates?
Generated response: Hi Alice, thank you for reaching out to FastFlare Home Services! ...
```

## What we learned

- Each customer gets their own Support Agent instance
- Workers AI adds intelligence — intent-based, not keyword-based
- New scenarios are handled without code changes
