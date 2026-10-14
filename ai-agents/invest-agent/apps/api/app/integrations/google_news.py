"""Google 뉴스 RSS 검색 (무료, 키 없음). 제목·언론사·발행 시각·링크만 쓴다. 본문은 가져오지 않는다 (AGENTS.md 5장).

https://news.google.com/rss/search?q=검색어&hl=ko&gl=KR&ceid=KR:ko
공식 API가 아니라서 형식이 예고 없이 바뀔 수 있다. 실패하면 빈 목록이 아니라 예외를 던지고, 부르는 쪽이 저장된 뉴스만 쓴다.
ponytail: 종목 이름이 제목에 들어간 기사만 남기는 단순 필터. 정확도가 모자라면 네이버 검색 API(키 필요)로 바꾼다
"""

import re
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

import httpx

URL = "https://news.google.com/rss/search"
TIMEOUT_SECONDS = 10


def mentions(title: str, name: str, longer: tuple[str, ...] = ()) -> bool:
    """제목이 이 종목을 말하는지: 이름을 더 긴 다른 종목 이름(예: 현대건설 ⊂ HD현대건설기계)에서 뺀 뒤에도 남고,
    이름 바로 앞이 글자가 아니어야 한다 ("HD현대건설…"은 다른 회사). 이름 뒤 조사("현대건설이")는 괜찮다"""
    for other in longer:
        title = title.replace(other, " ")
    return re.search(rf"(?<![0-9A-Za-z가-힣]){re.escape(name)}", title) is not None


def parse(xml_text: str, name: str, longer: tuple[str, ...] = ()) -> list[dict]:
    """RSS → [{title, press, url, published_at}]. 이 종목을 말하지 않는 기사는 뺀다 (mentions)"""
    items = []
    for item in ET.fromstring(xml_text).iter("item"):
        title, press = (item.findtext("title") or "").strip(), (item.findtext("source") or "").strip() or None
        if press and title.endswith(f" - {press}"):
            title = title[: -len(f" - {press}")].strip()  # 제목 끝의 " - 언론사"를 뗀다
        url, published = (item.findtext("link") or "").strip(), item.findtext("pubDate")
        # 증권사 이름은 "○○ 목표가 … - NH투자증권"처럼 다른 회사 리포트의 작성자로 자주 나온다. 그런 기사는 뺀다
        if mentions(title, name, longer) and not title.endswith(f" - {name}") and url and published:
            items.append({"title": title, "press": press, "url": url, "published_at": parsedate_to_datetime(published)})
    return items


def search(name: str, days: int, longer: tuple[str, ...] = ()) -> list[dict]:
    response = httpx.get(URL, params={"q": f'"{name}" when:{days}d', "hl": "ko", "gl": "KR", "ceid": "KR:ko"},
                         timeout=TIMEOUT_SECONDS, follow_redirects=True)
    response.raise_for_status()
    return parse(response.text, name, longer)
