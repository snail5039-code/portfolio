import { Fragment } from "react";

const URL_RE = /(https?:\/\/[^\s]+)/g;

/**
 * 소개글 문단 렌더링.
 *
 * DB 의 description 은 마크다운이 아니라 그냥 텍스트다. 문단은 빈 줄(\n\n)로
 * 나뉘고, 문단 안의 한 줄바꿈(\n)은 <br/> 로, http(s) 로 시작하는 주소는
 * 그대로 클릭 가능한 링크로 바꾼다.
 */
export function RichParagraph({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <p>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {linkify(line)}
        </Fragment>
      ))}
    </p>
  );
}

function linkify(line: string) {
  // 캡처 그룹 하나짜리 정규식으로 split 하면 홀수 인덱스가 항상 매치된 주소다.
  return line.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-amber hover:underline"
      >
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
