import { AppError, NotFoundError } from "@dior/shared";

export function isNotFoundError(err: unknown): boolean {
  if (err instanceof NotFoundError) return true;
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "NotFoundError"
  );
}

export function getAppErrorMessage(err: unknown): string | null {
  if (err instanceof AppError) return err.message;
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    "statusCode" in err &&
    typeof (err as AppError).statusCode === "number"
  ) {
    return String((err as AppError).message);
  }
  return null;
}
