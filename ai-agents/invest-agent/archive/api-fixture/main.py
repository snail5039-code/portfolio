import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.account import router as account_router
from app.routers.agent_role_status import router as agent_role_status_router
from app.routers.agents import router as agents_router
from app.routers.approvals import router as approvals_router
from app.routers.audit_logs import router as audit_logs_router
from app.routers.backtest_summary import router as backtest_summary_router
from app.routers.company_detail import router as company_detail_router
from app.routers.dashboard import router as dashboard_router
from app.routers.data_connections import router as data_connections_router
from app.routers.decision_review import router as decision_review_router
from app.routers.evidence_packets import router as evidence_packets_router
from app.routers.health import router as health_router
from app.routers.notification_settings import router as notification_settings_router
from app.routers.policy_settings import router as policy_settings_router
from app.routers.portfolio_change_compare import router as portfolio_change_compare_router
from app.routers.portfolio_health import router as portfolio_health_router
from app.routers.rebalance_plan import router as rebalance_plan_router
from app.routers.risk_alerts import router as risk_alerts_router
from app.routers.stress_test import router as stress_test_router
from app.routers.tax_fee_impact import router as tax_fee_impact_router
from app.routers.trade_history import router as trade_history_router
from app.routers.weekly_report import router as weekly_report_router
from app.store.approvals import ApprovalStore
from app.store.notification_settings import NotificationSettingsStore
from app.store.policy_settings import PolicySettingsStore

# The Vite dev server proxies /api to this app, so the browser normally makes
# same-origin requests and never sends a CORS preflight. These settings stay as
# a second boundary for direct local calls: one loopback origin, an explicit
# method allowlist (GET plus POST for the approve/reject demo actions), and an
# explicit header allowlist.
LOCAL_WEB_ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173"]
ALLOWED_REQUEST_HEADERS = ["Accept", "Accept-Language", "Content-Type"]

# Where the real running app persists approval decisions across restarts.
# Tests never see this path — every test's bare `create_app()` gets the
# ApprovalStore default (`:memory:`) instead, so test runs stay isolated from
# both each other and from a developer's real approvals.db. The Playwright
# e2e config (apps/web/playwright.config.ts) starts its own instance of this
# app with APPROVALS_DB_PATH=":memory:" for the same reason.
DEFAULT_APPROVALS_DB_PATH = os.environ.get(
    "APPROVALS_DB_PATH", str(Path(__file__).resolve().parent.parent / "data" / "approvals.db")
)
DEFAULT_POLICY_SETTINGS_DB_PATH = os.environ.get(
    "POLICY_SETTINGS_DB_PATH", str(Path(__file__).resolve().parent.parent / "data" / "policy_settings.db")
)
DEFAULT_NOTIFICATION_SETTINGS_DB_PATH = os.environ.get(
    "NOTIFICATION_SETTINGS_DB_PATH", str(Path(__file__).resolve().parent.parent / "data" / "notification_settings.db")
)


def create_app(
    approval_db_path: str = ":memory:",
    policy_settings_db_path: str = ":memory:",
    notification_settings_db_path: str = ":memory:",
) -> FastAPI:
    app = FastAPI(
        title="Financial AI Agent Local Fixture API",
        version="0.1.0",
        description="Local-only fixture API. It does not connect to financial services.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=LOCAL_WEB_ORIGINS,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=ALLOWED_REQUEST_HEADERS,
    )
    for db_path in (approval_db_path, policy_settings_db_path, notification_settings_db_path):
        if db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    # One store per app instance (not a module-level singleton) so tests that
    # each call create_app() get independent, isolated demo state.
    app.state.approval_store = ApprovalStore(approval_db_path)
    app.state.policy_settings_store = PolicySettingsStore(policy_settings_db_path)
    app.state.notification_settings_store = NotificationSettingsStore(notification_settings_db_path)

    app.include_router(health_router)
    app.include_router(dashboard_router)
    app.include_router(account_router)
    app.include_router(agents_router)
    app.include_router(approvals_router)
    app.include_router(risk_alerts_router)
    app.include_router(trade_history_router)
    app.include_router(portfolio_health_router)
    app.include_router(evidence_packets_router)
    app.include_router(audit_logs_router)
    app.include_router(decision_review_router)
    app.include_router(agent_role_status_router)
    app.include_router(weekly_report_router)
    app.include_router(tax_fee_impact_router)
    app.include_router(portfolio_change_compare_router)
    app.include_router(rebalance_plan_router)
    app.include_router(backtest_summary_router)
    app.include_router(company_detail_router)
    app.include_router(data_connections_router)
    app.include_router(notification_settings_router)
    app.include_router(policy_settings_router)
    app.include_router(stress_test_router)
    return app


app = create_app(
    approval_db_path=DEFAULT_APPROVALS_DB_PATH,
    policy_settings_db_path=DEFAULT_POLICY_SETTINGS_DB_PATH,
    notification_settings_db_path=DEFAULT_NOTIFICATION_SETTINGS_DB_PATH,
)
