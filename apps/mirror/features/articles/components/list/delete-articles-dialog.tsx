import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@feel-good/ui/primitives/alert-dialog";

type DeleteArticlesDialogProps = {
  count: number;
  onConfirm: () => void;
};

export function DeleteArticlesDialog(
  { count, onConfirm }: DeleteArticlesDialogProps,
) {
  const label = count === 1 ? "article" : "articles";

  return (
    <AlertDialogContent
      size="sm"
      className="data-[size=sm]:max-w-md"
    >
      <AlertDialogHeader className="mx-12 mb-4 mt-3">
        <AlertDialogTitle className="text-lg">Delete {label}</AlertDialogTitle>
        <AlertDialogDescription>
          This will permanently delete {count}{" "}
          {label}. This action cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel variant="outline" className="dark:bg-dialog">
          Cancel
        </AlertDialogCancel>
        <AlertDialogAction variant="destructive" onClick={onConfirm}>
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
