# Support Agent

## Steps

### Step 1 - Configuration

Add Email binding
```jsonc
{
  "send_email": [
    {
      "name": "EMAIL",
      "remote": true
    }
  ],
}
```

### Step 2 - Handle Incoming Emails

1. Import `postal-mime`, and the `AgentEmail` interface
```ts
import { type AgentEmail } from "agents/email";
import PostalMime from "postal-mime";
```
2. Add `onEmail` handler
```ts
export class SupportAgent extends Agent<Env>{
  async onEmail(email:AgentEmail) {
    ...
  }
}
```
3. Add Email Handler with custom reolver
```ts
export default {
  async email(message, env) {
    await routeAgentEmail(message, env, {
      resolver: async (email) => ({
        agentName: "SupportAgent",
        agentId: email.from,
      }),
    });
  },
  ...
} satisfies ExportedHandler<Env>
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
From: alice@abc.com
To: support@example.com
Subject: Help with my order
Body: Hi there, I need help with my recent order #12345.
```