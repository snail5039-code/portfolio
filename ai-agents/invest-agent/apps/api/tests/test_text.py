from app.functions.text import split_text


def test_short_text_is_one_chunk() -> None:
    assert split_text("  짧은   글  ") == ["짧은 글"]
    assert split_text("") == []


def test_long_text_is_split_with_overlap_and_size_limit() -> None:
    sentence = "반도체 수요가 늘었다. "
    text = sentence * 200
    chunks = split_text(text, size=100, overlap=20)
    assert all(len(chunk) <= 100 for chunk in chunks)
    assert all(chunk.endswith("다.") for chunk in chunks[:-1])  # 문장 끝에서 자른다
    # 겹치는 부분이 있어서 이어 붙이면 원문보다 길고, 원문 글자는 모두 들어 있다
    assert sum(len(chunk) for chunk in chunks) > len(text.strip())
    assert chunks[0].startswith("반도체") and text.strip().endswith(chunks[-1][-10:])


def test_text_without_spaces_still_splits() -> None:
    chunks = split_text("가" * 250, size=100, overlap=10)
    assert [len(chunk) for chunk in chunks] == [100, 100, 70]
