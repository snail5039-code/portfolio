export const LANGUAGES = [
    { name: "English", code: "en" },
    { name: "한국어", code: "ko" },
    { name: "日本語", code: "ja" },
];

export const languageNameByCode = (code) => {
    const found = LANGUAGES.find((l) => l.code === code);
    return found?.name ?? "한국어";
};