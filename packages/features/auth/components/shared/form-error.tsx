import { type AuthError } from "../../types";

interface FormErrorProps {
  error: AuthError | null;
  id?: string;
}

export function FormError({ error, id }: FormErrorProps) {
  if (!error) return null;

  return (
    <div
      id={id}
      role="alert"
      aria-live="polite"
      data-testid="auth.form-error"
      className="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
    >
      {error.message}
    </div>
  );
}
