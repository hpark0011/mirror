interface FormSuccessProps {
  title: string;
  message: string;
}

export function FormSuccess({
  title,
  message,
}: FormSuccessProps) {
  return (
    <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
      <h3 className="font-medium text-green-800 dark:text-green-200">
        {title}
      </h3>
      <p className="mt-1 text-sm text-green-700 dark:text-green-300">
        {message}
      </p>
    </div>
  );
}
