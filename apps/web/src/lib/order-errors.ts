export const INSUFFICIENT_BALANCE_MESSAGE = "INSUFFICIENT_BALANCE";

export function isInsufficientBalanceError(message: string) {
  return (
    message === INSUFFICIENT_BALANCE_MESSAGE ||
    /insufficient balance/i.test(message) ||
    /недостаточно средств/i.test(message)
  );
}
