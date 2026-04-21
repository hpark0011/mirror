---
paths:
  - "**/components/**/*form*.tsx"
  - "**/components/forms/**/*.tsx"
  - "**/lib/schemas/**"
  - "**/lib/schema/**"
---

# Form Handling Rules

## Stack

- React Hook Form for form state
- Zod for validation schemas
- zodResolver for integration

## Basic Pattern

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// 1. Define schema
const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
});

// 2. Infer type
type FormData = z.infer<typeof schema>;

// 3. Use form
function TicketForm({ onSubmit }: { onSubmit: (data: FormData) => void }) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
    },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Input {...form.register("title")} />
      {form.formState.errors.title && (
        <span>{form.formState.errors.title.message}</span>
      )}
      <Button type="submit">Save</Button>
    </form>
  );
}
```

## With shadcn/ui Form

```tsx
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@feel-good/ui/primitives/form";

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="title"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Title</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </form>
</Form>
```

## Schema Organization

- Feature (app-level): `features/<feature>/lib/schemas/<name>.schema.ts`
- Feature (cross-app): `packages/features/<feature>/lib/schemas/<name>.schema.ts`
- Derive types with `type FormData = z.infer<typeof schema>`

See `docs/conventions/file-organization-convention.md` for the full feature-module layout.
