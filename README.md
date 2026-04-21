# Email Agent Workshop

Workshop: Build an AI email agent with [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/) and [Email Routing](https://developers.cloudflare.com/email-routing/).

## Chapters

- [Chapter 1 - Email Triggers a Persistent Agent](https://github.com/harshil1712/email-agent-workshop-code/tree/chapter-1)
- [Chapter 2 - AI = Understanding](https://github.com/harshil1712/email-agent-workshop-code/tree/chapter-2)
- -> **[Chapter 3 - Persistence = Memory](https://github.com/harshil1712/email-agent-workshop-code/tree/chapter-3)** (this branch)

---

# Chapter 3 - Persistence = Memory

The agent remembers conversations across every email.

## What you'll learn

- Every Agent instance has its own [SQLite database](https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/#sql-storage) via `this.sql`
- How to store and retrieve conversation history to give the LLM full context
- The difference between `this.sql` (structured data) and `this.state` (lightweight working context)

## Steps

### Step 1 - Create tables in `onStart()`

[`onStart()`](https://developers.cloudflare.com/agents/api-reference/lifecycle-methods/#onstart) runs on cold start and after hibernation, so create tables with `IF NOT EXISTS`:

```ts
async onStart() {
  console.log('SupportAgent started');
  this.sql`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    role TEXT,
    content TEXT,
    timestamp INTEGER DEFAULT (unixepoch())
  )`;
  this.sql`CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    service_type TEXT,
    status TEXT DEFAULT 'requested',
    scheduled_date TEXT,
    notes TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  )`;
}
```

### Step 2 - Store and retrieve messages

Update the `onEmail` handler to log messages and pass history to the LLM:

1. Log the incoming email as a `user` message:

```ts
this.sql`INSERT INTO messages (id, role, content)
  VALUES (${crypto.randomUUID()}, 'user', ${parsed.text || ''})`;
```

2. Fetch the last 10 messages to use as conversation history:

```ts
const history = [...this.sql`
  SELECT role, content FROM messages
  ORDER BY timestamp DESC
  LIMIT 10
`].reverse();
```

3. Pass the history to `generateText()`:

```ts
const { text } = await generateText({
  model: workersai('@cf/meta/llama-3.1-8b-instruct'),
  system: SYSTEM_PROMPT,
  messages: history.map((row) => ({
    role: row.role as 'user' | 'assistant',
    content: row.content as string,
  })),
});
```

4. Log the AI reply as an `assistant` message before sending it:

```ts
this.sql`INSERT INTO messages (id, role, content)
  VALUES (${crypto.randomUUID()}, 'assistant', ${text})`;

await this.replyToEmail(email, {
  fromName: 'FastFlare Home Services',
  body: text,
});
```

### Step 3 - Test locally

1. Start the development server:

```bash
npm run dev
```

2. Send an initial booking request:

```bash
curl --request POST 'http://localhost:8787/cdn-cgi/handler/email' \
  --url-query 'from=alice@abc.com' \
  --url-query 'to=support@example.com' \
  --data-raw 'From: "Alice" <alice@abc.com>
To: support@example.com
Subject: Cleaning booking
Content-Type: text/plain; charset="utf-8"
Message-ID: <test-email-003@localhost>

Hi, I would like to book a house cleaning for next Friday.'
```

3. Send a follow-up that references the previous email:

```bash
curl --request POST 'http://localhost:8787/cdn-cgi/handler/email' \
  --url-query 'from=alice@abc.com' \
  --url-query 'to=support@example.com' \
  --data-raw 'From: "Alice" <alice@abc.com>
To: support@example.com
Subject: Re: Cleaning booking
Content-Type: text/plain; charset="utf-8"
Message-ID: <test-email-004@localhost>

Can you add the plumbing too?'
```

The agent now remembers the cleaning booking from the first email and responds to the follow-up in context.

## What we learned

- Agents SDK comes with a per-instance SQLite database (`this.sql`)
- Use `this.sql` for structured data that grows — messages, jobs, records
- Use `this.state` for small working values that need to survive hibernation (e.g. customer name, active job ID)
- If you'd put an array into `this.state` — use `this.sql` instead
