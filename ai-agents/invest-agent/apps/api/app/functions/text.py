"""공시 본문을 검색용 조각으로 나누기."""

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100


def split_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """size 글자 안팎으로 자르고, 앞 조각과 overlap 글자만큼 겹친다 (문장이 잘려도 앞뒤 맥락이 남게).
    가능하면 마침표나 띄어쓰기에서 자른다."""
    text = " ".join(text.split())
    chunks, start = [], 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            # 문장 끝(". ")을 먼저 찾고, 없으면 띄어쓰기, 그것도 없으면 그냥 자른다
            cut = text.rfind(". ", start + size // 2, end)
            if cut < 0:
                cut = text.rfind(" ", start + size // 2, end)
            end = cut + 1 if cut > 0 else end
        chunks.append(text[start:end].strip())
        if end == len(text):
            break
        start = max(end - overlap, start + 1)
    return [chunk for chunk in chunks if chunk]
