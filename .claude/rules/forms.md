---
paths:
  - "apps/greyboard/**/*form*.tsx"
  - "apps/greyboard/**/*form*.ts"
  - "apps/greyboard/features/ticket-form/**/*"
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

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

## Form Dialog Pattern

Use `useDialogAutoSave` hook for auto-saving drafts:

```tsx
import { useDialogAutoSave } from "@/hooks/use-dialog-auto-save";

const { savedData, clearSavedData } = useDialogAutoSave({
  key: STORAGE_KEYS.TASKS.TICKET_FORM_SUBTASKS,
  data: formData,
  enabled: isOpen,
});
```

## Keyboard Submit

Use `useKeyboardSubmit` for Cmd+Enter submission:

```tsx
import { useKeyboardSubmit } from "@/hooks/use-keyboard-submit";

useKeyboardSubmit({
  onSubmit: form.handleSubmit(onSubmit),
  enabled: isOpen,
});
```

## Schema Organization

- Feature schemas: `lib/schema/{feature}.schema.ts`
- Shared schemas: `lib/schema/shared.schema.ts`
