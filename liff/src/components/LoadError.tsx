interface Props {
  message?: string;
  onRetry: () => void;
}

export function LoadError({
  message = "載入失敗，請稍後再試",
  onRetry,
}: Props) {
  return (
    <div className="load-error">
      <div className="error-box">{message}</div>
      <button type="button" className="btn btn-outline" onClick={onRetry}>
        重試
      </button>
    </div>
  );
}

export function apiErrorMessage(
  err: unknown,
  fallback = "載入失敗，請稍後再試"
): string {
  return err instanceof Error ? err.message : fallback;
}
