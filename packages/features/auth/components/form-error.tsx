interface FormErrorProps {
  message: string | null;
}

export function FormError({ message }: FormErrorProps) {
  if (!message) return null;
  return (
    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
      {message}
    </div>
  );
}
