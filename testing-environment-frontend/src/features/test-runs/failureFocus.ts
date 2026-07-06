export function getFailureFocusTimeRange(createdAt?: string) {
  if (!createdAt) {
    return undefined;
  }
  const center = new Date(createdAt).getTime();
  return {
    from: center - 30_000,
    to: center + 30_000,
  };
}
