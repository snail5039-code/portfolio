import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Heatwise | 온열질환 위험 예측",
  description: "기상 예보 기반 온열질환자 수 및 외출 시간대 위험 안내",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
