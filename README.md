# Support Agent

## Chapter 3 - Persistent Memory

### Step 1 - Create tables

1. Add the `onStart()` method
```ts
async onStart() {
	console.log('SupportAgent started');
}
```
2. Create tables
```ts
this.sql`CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, role TEXT, content TEXT, timestamp INTEGER DEFAULT (unixepoch())
)`;
this.sql`CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, service_type TEXT, status TEXT DEFAULT 'requested', scheduled_date TEXT, notes TEXT, created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch())
)`;
```

### Step 2 - Store and retrieve messages

1. Add system prompt
```ts
async onEmail(email: AgentEmail) {
  ...

  // 1. Log the incoming email
  this.sql`INSERT INTO messages (id, role, content) VALUES (${crypto.randomUUID()}, 'user', ${parsed.text ?? ""})`;

  // 2. Fetch history and pass it to the LLM
  const recentMessages = this.sql<{ role: string; content: string }>`
    SELECT role, content FROM messages ORDER BY timestamp DESC LIMIT 10
  `.reverse(); // DESC→ASC: LLM expects oldest-first

  const { text } = await generateText({
    model: openai("gpt-4o"),
    system: SYSTEM_PROMPT,
    messages: recentMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
  });

  // 3. Log the reply and send it
  this.sql`INSERT INTO messages (id, role, content) VALUES (${crypto.randomUUID()}, 'assistant', ${text})`;
  await this.replyToEmail(email, { fromName: "FastFlare Home Services", body: text });
}
```

### Step 3 - Test locally

1. Start the development server
```bash
npm run dev
```

2. Execute the following cURL command for local testing:
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

Output:
```txt
Subject: Help with my order
From: { address: 'alice@abc.com', name: 'Alice' }
Text body: Hi there, I need help with my recent order #12345.

Generated response: Hi there! Thanks for reaching out. I'd be happy to help you with order #12345.

Could you please let me know what specifically you need assistance with? For example, are you asking about the status of your booking, checking if it has been confirmed, or do you have questions about the service (like cleaning, plumbing, or landscaping)?
```