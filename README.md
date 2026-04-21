# Support Agent

## Chapter 2 - Adding Intelligence

### Step 1 - Set up

1. Install the AI SDK and Workers AI Provider packages:
```bash
npm i ai workers-ai-provider
```
2. Add Workers AI bindings, if not already added
```jsonc
{
  "ai": {
		"binding": "AI"
	}
}
```

### Step 2 - Integrate Workers AI

1. Add system prompt
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

2. Import methods from the packages
```ts
import { createWorkersAI } from "workers-ai-provider";
import { generateText } from "ai";
```
3. Update `onEmail` handler
```ts
...
export class SupportAgent extends Agent<Env> {
	async onEmail(email: AgentEmail) {
		const raw = await email.getRaw();
		const parsed = await PostalMime.parse(raw);

		console.log('Subject:', parsed.subject);
		console.log('From:', parsed.from);
		console.log('Text body:', parsed.text);

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

		console.log('Generated response:', text);

		await this.replyToEmail(email, {
			fromName: 'FastFlare Home Services',
			body: text,
		});
	}
}
...
```

### Step 3 - Prevent loops

Update `onEmail` and the following:
```ts
async onEmail(email: AgentEmail) {
		const raw = await email.getRaw();
		const parsed = await PostalMime.parse(raw);

		if (isAutoReplyEmail(parsed.headers)) {
			console.log('Skipping auto-reply email');
			return;
		}

		...
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