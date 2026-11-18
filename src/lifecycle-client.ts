export type ResetAttempt = { requestId: string; revision: string };
export type LifecycleResult = {
  code?: string;
  message?: string;
  reset?: boolean;
  deleted?: boolean;
  requiresSignIn?: boolean;
};
export async function sendLifecycle(
  kind: 'reset' | 'delete',
  token: string,
  password: string,
  confirmation: string,
  attempt?: ResetAttempt,
  transport: typeof fetch = fetch,
) {
  const response = await transport(kind === 'reset' ? '/api/account/reset' : '/api/account', {
    method: kind === 'reset' ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password, confirmation, ...(kind === 'reset' ? attempt : {}) }),
  });
  const result: LifecycleResult = await response.json();
  const complete =
    response.ok &&
    (kind === 'reset'
      ? result.code === 'RESET_COMPLETE' && result.reset === true && result.requiresSignIn === true
      : result.deleted === true);
  return { complete, uncertain: response.status >= 500 || (response.ok && !complete), result };
}
