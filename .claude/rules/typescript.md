---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Rules

## Type Imports

Always use inline type imports (not separate `import type` statements):

```typescript
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { type Board, type Ticket } from "@/types/board.types";
```

## Type Organization

- Feature-specific types: `features/{feature}/types.ts`
- Shared types: `types/{domain}.types.ts`
- Schema-derived types: `type FormData = z.infer<typeof schema>`
