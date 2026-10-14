import type { FixtureEnvelope } from "../types/dashboard";

/**
 * Minimal client for the local fixture backend.
 *
 * Only same-origin paths under `/api/` are reachable. The Vite dev server
 * proxies them to the local FastAPI app, so no request ever leaves the machine
 * and no external host can be addressed through this module.
 */

const LOCAL_API_PREFIX = "/api/";
const REQUEST_TIMEOUT_MS = 8000;

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** FastAPI's error body shape: `{"detail": "..."}`. */
async function readErrorDetail(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.clone().json();
    if (body && typeof body === "object" && typeof (body as { detail?: unknown }).detail === "string") {
      return (body as { detail: string }).detail;
    }
  } catch {
    // Not JSON, or no body. Fall through to a generic message.
  }
  return null;
}

async function request<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  if (!path.startsWith(LOCAL_API_PREFIX)) {
    throw new ApiError(`로컬 백엔드 경로가 아닙니다: ${path}`);
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch {
    throw new ApiError("로컬 백엔드에 연결하지 못했습니다. FastAPI 서버가 실행 중인지 확인하세요.");
  }

  if (!response.ok) {
    // A meaningful domain error (unknown id, already-decided order, a KIS
    // 모의투자 order that FastAPI itself rejected with a 502) carries its own
    // `detail` — surface that whenever present, regardless of status code.
    const detail = await readErrorDetail(response);
    if (detail) {
      throw new ApiError(detail, response.status);
    }
    // No JSON `detail` body at all usually means the dev server turned a
    // refused connection to the backend into a bare 5xx of its own (the
    // backend process isn't running), not a real response from our own app.
    if (response.status >= 500) {
      throw new ApiError(
        `로컬 백엔드가 응답하지 못했습니다. FastAPI 서버가 실행 중인지 확인하세요. (HTTP ${response.status})`,
        response.status
      );
    }
    throw new ApiError(`로컬 백엔드가 요청을 처리하지 못했습니다. (HTTP ${response.status})`, response.status);
  }

  try {
    return (await response.json()) as TResponse;
  } catch {
    throw new ApiError("로컬 백엔드 응답을 JSON으로 해석하지 못했습니다.");
  }
}

/**
 * Refuses any payload that does not declare itself as a mock, paper-only,
 * unexecuted fixture with an expected `externalConnections` count. A response
 * that fails this check is not rendered at all, so a screen can never present
 * non-mock data as if it were part of the mockup.
 *
 * `allowedExternalConnections` defaults to "must be exactly 0" for every
 * screen. Three call sites pass `[0, 1]` instead, each for one narrow, named
 * reason: `getCompanyDetail` (filings can honestly be 1 — a live OpenDART
 * call), `getDashboard`/`getApprovals`/`approveOrder` (holdings or an order
 * can honestly be 1 — a live KIS 모의투자 call). See `FixtureEnvelope` in
 * `../types/dashboard`. Nowhere else should ever need a value other than the
 * default; that's what keeps this check meaningful.
 */
function assertFixtureEnvelope<TData>(
  payload: FixtureEnvelope<TData>,
  allowedExternalConnections: readonly number[] = [0]
): FixtureEnvelope<TData> {
  const isSafeFixture =
    payload?.isMock === true &&
    payload?.paperOnly === true &&
    payload?.executed === false &&
    allowedExternalConnections.includes(payload?.externalConnections);

  if (!isSafeFixture) {
    throw new ApiError("응답의 모의 데이터 안전 표시가 확인되지 않아 화면에 사용하지 않습니다.");
  }

  return payload;
}

export async function getFixture<TData>(
  path: string,
  allowedExternalConnections?: readonly number[]
): Promise<FixtureEnvelope<TData>> {
  return assertFixtureEnvelope(await request<FixtureEnvelope<TData>>(path), allowedExternalConnections);
}

/**
 * POSTs a local demo action (e.g. approve/reject) with no request body and
 * returns the resulting fixture envelope. Same safety check as `getFixture` —
 * a response that doesn't declare itself a mock is never used.
 */
export async function postFixtureAction<TData>(
  path: string,
  allowedExternalConnections?: readonly number[]
): Promise<FixtureEnvelope<TData>> {
  return assertFixtureEnvelope(
    await request<FixtureEnvelope<TData>>(path, { method: "POST" }),
    allowedExternalConnections
  );
}

/**
 * POSTs a local demo action with a JSON body (e.g. "가상 정책 적용") and
 * returns the resulting fixture envelope. Same safety check as `getFixture`.
 */
export async function postFixture<TData>(path: string, body: unknown): Promise<FixtureEnvelope<TData>> {
  return assertFixtureEnvelope(
    await request<FixtureEnvelope<TData>>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}
