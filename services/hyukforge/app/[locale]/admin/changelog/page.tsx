import { ChangelogForm } from "@/components/admin/ChangelogForm";
import { listAllChangelog, listProductChoices } from "@/lib/queries/admin-content";

/**
 * 개발 기록. 목록과 작성을 한 화면에 둔다 —
 * 항목이 한 줄짜리라 페이지를 나누면 오히려 번거롭다.
 */
export default async function AdminChangelog() {
  const [entries, products] = await Promise.all([
    listAllChangelog(),
    listProductChoices(),
  ]);

  return <ChangelogForm entries={entries} products={products} />;
}
