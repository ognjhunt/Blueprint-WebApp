# Blueprint Firestore Document Field Reference

## AI assistant welcome messages

| Field name | Type | Description |
| --- | --- | --- |
| `aiAssistantWelcomeMessages` | object | Mapping of persona identifiers to the default welcome message text generated after deep research completes for a location. |
| `aiAssistantWelcomeMessagesUpdatedAt` | Firestore timestamp | Server timestamp recorded when welcome messages are generated or refreshed. |

### Persona keys stored in `aiAssistantWelcomeMessages`

- `targetCustomer`
- `casualVisitor`
- `vipMember`
- `staffMember`
- `partnerPress`

Each value is a short 1–2 sentence greeting tailored to the persona, encouraging guests to ask the Blueprint assistant for help.
