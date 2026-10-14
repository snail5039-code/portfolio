import type { ReactElement } from "react";
import type { FixtureState } from "../lib/useFixture";

/**
 * Returns the loading or error screen while a fixture is unavailable, or null
 * once the envelope is ready. Keeping it in one place means a failed load can
 * never fall through to a screen rendering stale or partial data.
 */
export function renderFixtureFallback<TData>(
  state: FixtureState<TData>,
  screenName: string
): ReactElement | null {
  if (state.error) {
    return (
      <div className="error-screen" role="alert">
        <div>
          <h1>{screenName} 데이터를 불러오지 못했습니다</h1>
          <p>{state.error}</p>
          <p>
            로컬 FastAPI 백엔드를 <code>apps/api</code>에서 실행한 뒤 다시 시도하세요. 이 화면은 로컬
            fixture만 사용하며 실제 계좌·주문·외부 API와 연결되지 않습니다.
          </p>
          <button type="button" onClick={state.retry}>다시 시도</button>
        </div>
      </div>
    );
  }

  if (!state.envelope) {
    return <div className="loading-screen">로컬 fixture를 불러오는 중</div>;
  }

  return null;
}
