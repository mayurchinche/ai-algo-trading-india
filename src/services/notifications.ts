// Foreground-only product: external messaging is deliberately unavailable.
export async function notify(..._args: unknown[]): Promise<never> {
  throw new Error('External messaging is disabled. Strong signals appear only inside the visible app.');
}
