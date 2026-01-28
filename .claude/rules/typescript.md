---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Rules

## Type Imports

Always use inline type imports:

```typescript
// ✅ Correct
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { type Board, type Ticket } from "@/types/board.types";

// ❌ Wrong
import React from "react"; // then React.KeyboardEvent
import type { Board } from "@/types/board.types"; // separate type import
```

## Explicit Types

- No implicit `any` - always provide explicit types
- Type all function parameters and return values
- Type event handlers explicitly

```typescript
// ✅ Correct
const handleClick = (event: MouseEvent<HTMLButtonElement>) => { ... };
function processTickets(tickets: Ticket[]): ProcessedTicket[] { ... }

// ❌ Wrong
const handleClick = (event) => { ... };
function processTickets(tickets) { ... }
```

## Type Organization

- Feature-specific types: `features/{feature}/types.ts`
- Shared types: `types/{domain}.types.ts`
- Schema-derived types: `type FormData = z.infer<typeof schema>`

## Generics

Use descriptive generic names for complex types:

```typescript
// ✅ Clear intent
function createStore<TState, TActions>(config: StoreConfig<TState, TActions>)

// ❌ Cryptic
function createStore<S, A>(config: StoreConfig<S, A>)
```

## Zod Schemas

Prefer Zod for runtime validation with TypeScript inference:

```typescript
const ticketSchema = z.object({
  title: z.string().min(1, "Required"),
  priority: z.enum(["low", "medium", "high"]),
});
type Ticket = z.infer<typeof ticketSchema>;
```
