// scikit-learn RandomForestRegressor를 export_static_data.py로 내보낸 트리 JSON을 그대로 순회해
// 서버리스 환경에서도 Python 없이 같은 예측값을 계산한다.

export type TreeNode = {
  feature: number; // -2면 리프 노드
  threshold: number;
  left: number;
  right: number;
  value: number;
};

export type RandomForestModel = {
  target: string;
  weatherColumns: string[];
  trees: TreeNode[][];
};

function predictTree(tree: TreeNode[], features: number[]): number {
  let node = tree[0];
  while (node.feature !== -2) {
    node = features[node.feature] <= node.threshold ? tree[node.left] : tree[node.right];
  }
  return node.value;
}

export function predict(model: RandomForestModel, weather: Record<string, number>): number {
  const features = model.weatherColumns.map((column) => {
    const value = weather[column];
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new Error(`기상 변수 값이 없습니다: ${column}`);
    }
    return value;
  });

  const sum = model.trees.reduce((total, tree) => total + predictTree(tree, features), 0);
  return sum / model.trees.length;
}
