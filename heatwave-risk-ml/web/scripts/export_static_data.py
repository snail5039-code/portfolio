"""Vercel(서버리스, Python 미지원 환경)에서도 동작하도록
학습된 모델과 분석 데이터를 정적 JSON으로 내보낸다.

- 데이터 분석 탭: 고정된 학습 데이터라 요청마다 다시 계산할 필요가 없어
  analysis.py와 동일한 내용을 JSON으로 저장한다.
- 예측 탭: RandomForestRegressor를 트리 구조 그대로 JSON으로 저장하고,
  Next.js 쪽에서 web/src/lib/randomForest.ts로 동일하게 추론한다.

실행: .venv 활성화 후 `python web/scripts/export_static_data.py`
모델이나 학습 데이터를 다시 만들 때마다 재실행해서 JSON을 갱신해야 한다.
"""

import json
from pathlib import Path

import joblib
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = Path(__file__).resolve().parent.parent / "src" / "data"

TARGETS = [
    {
        "target": "전체 연령",
        "slug": "all-ages",
        "csv_path": ROOT_DIR / "data" / "processed" / "train_dataset.csv",
        "patient_column": "total_patients",
        "model_path": ROOT_DIR / "model" / "saved" / "heat_patient_model.pkl",
    },
    {
        "target": "65세 이상",
        "slug": "elderly",
        "csv_path": ROOT_DIR / "data" / "processed" / "train_dataset_elderly65_2022_2025.csv",
        "patient_column": "elderly_patients",
        "model_path": ROOT_DIR / "model" / "saved" / "heat_patient_elderly65_model.pkl",
    },
]


def export_preview(data, rows=5):
    preview_rows = []
    for _, row in data.head(rows).iterrows():
        formatted = {}
        for column, value in row.items():
            if isinstance(value, float):
                formatted[column] = round(value, 4)
            else:
                formatted[column] = value.item() if hasattr(value, "item") else value
        preview_rows.append(formatted)
    return {"columns": list(data.columns), "rows": preview_rows}


def export_tree(tree):
    return [
        {
            "feature": int(tree.feature[node]),
            "threshold": float(tree.threshold[node]),
            "left": int(tree.children_left[node]),
            "right": int(tree.children_right[node]),
            "value": float(tree.value[node][0][0]),
        }
        for node in range(tree.node_count)
    ]


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    for entry in TARGETS:
        data = pd.read_csv(entry["csv_path"])
        model_data = joblib.load(entry["model_path"])
        model = model_data["model"]
        columns = model_data["weather_columns"]

        time_series = [
            {"date": str(row["일시"]), "patients": int(row[entry["patient_column"]])}
            for _, row in data.iterrows()
        ]
        scatter = [
            {"temperature": float(row["최고기온(°C)"]), "patients": int(row[entry["patient_column"]])}
            for _, row in data.iterrows()
        ]
        importance = [
            {"feature": column.replace("평균 ", "").replace("합계 ", ""), "value": float(value)}
            for column, value in zip(columns, model.feature_importances_)
        ]

        analysis_path = DATA_DIR / f"analysis-{entry['slug']}.json"
        analysis_path.write_text(
            json.dumps({
                "target": entry["target"],
                "rowCount": int(len(data)),
                "weatherColumns": columns,
                "preview": export_preview(data),
                "timeSeries": time_series,
                "scatter": scatter,
                "importance": importance,
            }, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"저장: {analysis_path.relative_to(ROOT_DIR)} ({len(data)}행)")

        model_path = DATA_DIR / f"model-{entry['slug']}.json"
        model_path.write_text(
            json.dumps({
                "target": entry["target"],
                "weatherColumns": columns,
                "trees": [export_tree(estimator.tree_) for estimator in model.estimators_],
            }, ensure_ascii=False),
            encoding="utf-8",
        )
        total_nodes = sum(estimator.tree_.node_count for estimator in model.estimators_)
        print(f"저장: {model_path.relative_to(ROOT_DIR)} (트리 {len(model.estimators_)}개, 노드 {total_nodes}개)")


if __name__ == "__main__":
    main()
