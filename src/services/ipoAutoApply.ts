export const IPO_EXECUTION_UNAVAILABLE = 'IPO application unavailable: a verified authenticated broker integration and explicit order confirmation are required. Apply through your broker.';
export async function autoApplyForIPO(_ipo: unknown): Promise<never> {
  throw new Error(IPO_EXECUTION_UNAVAILABLE);
}
