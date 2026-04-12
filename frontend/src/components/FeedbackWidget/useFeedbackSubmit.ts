import { useState } from 'react';
import { SessionLogger } from './SessionLogger';

export type FeedbackType = 'bug' | 'feature';

export interface FeedbackPayload {
  title: string;
  description: string;
  type: FeedbackType;
  screenshotBase64?: string;
}

export type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

export interface SubmitError {
  kind: 'rate_limit' | 'rejected' | 'network' | 'unknown';
  retryAfterSeconds?: number;
}

export interface SubmitResult {
  issueNumber: number;
  issueUrl: string;
}

export interface UseFeedbackSubmit {
  status: SubmitStatus;
  result: SubmitResult | null;
  error: SubmitError | null;
  submit: (payload: FeedbackPayload) => Promise<void>;
  reset: () => void;
}

export function useFeedbackSubmit(): UseFeedbackSubmit {
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<SubmitError | null>(null);

  async function submit(payload: FeedbackPayload): Promise<void> {
    // Read env var lazily so tests can override it via process.env
    const workerUrl = process.env.EXPO_PUBLIC_FEEDBACK_WORKER_URL ?? '';
    if (!workerUrl) {
      // Worker URL not configured — silently no-op in production builds
      console.warn('[FeedbackWidget] EXPO_PUBLIC_FEEDBACK_WORKER_URL is not set — feedback disabled');
      return;
    }

    setStatus('submitting');
    setError(null);
    setResult(null);

    const body = {
      appId: 'gaming_app',
      title: payload.title,
      description: payload.description,
      type: payload.type,
      ...(payload.screenshotBase64 ? { screenshotBase64: payload.screenshotBase64 } : {}),
      sessionLogs: SessionLogger.getLogs() || undefined,
    };

    let response: Response;
    try {
      response = await fetch(`${workerUrl}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      setStatus('error');
      setError({ kind: 'network' });
      return;
    }

    if (response.status === 201) {
      const data = (await response.json()) as SubmitResult;
      setResult(data);
      setStatus('success');
      return;
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      setStatus('error');
      setError({
        kind: 'rate_limit',
        retryAfterSeconds: retryAfter ? parseInt(retryAfter, 10) : 60,
      });
      return;
    }

    if (response.status === 422) {
      setStatus('error');
      setError({ kind: 'rejected' });
      return;
    }

    setStatus('error');
    setError({ kind: 'unknown' });
  }

  function reset(): void {
    setStatus('idle');
    setResult(null);
    setError(null);
  }

  return { status, result, error, submit, reset };
}
