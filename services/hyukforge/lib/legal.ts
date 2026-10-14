/**
 * 개인정보처리방침과 이용약관.
 *
 * 왜 messages/*.json 이 아닌가
 *   화면 문구가 아니라 문서다. 10개 언어로 기계번역하면 뜻이 어긋난 조항이
 *   법적 효력을 갖는 자리에 놓인다. 그래서 한국어를 기준본으로 두고
 *   영어 번역만 함께 낸다. 나머지 언어는 영어로 폴백하고,
 *   화면 위에 "한국어본이 기준"이라고 밝힌다.
 *
 * 내용은 실제 동작에 맞춰 적었다. 지어낸 조항이 없어야 한다 —
 * 없는 기능을 있다고 쓰면 그게 곧 위반이다.
 * 기능이 생기거나 사라지면 이 파일부터 고친다.
 *
 * 고칠 때는 EFFECTIVE 도 함께 올린다.
 */

export const LEGAL_DOCS = ["privacy", "terms"] as const;
export type LegalDocId = (typeof LEGAL_DOCS)[number];

/** 기준본. 나머지 언어는 이걸로 폴백한다. */
export const AUTHORITATIVE_LOCALE = "ko";

export type LegalSection = {
  heading: string;
  /** 문단. 앞에 "· " 를 붙이면 목록 항목으로 그린다. */
  body: string[];
};

export type LegalDoc = {
  title: string;
  effective: string;
  sections: LegalSection[];
};

const PRIVACY_KO: LegalDoc = {
  title: "개인정보처리방침",
  effective: "2026-08-19",
  sections: [
    {
      heading: "1. 무엇을 수집하는가",
      body: [
        "로그인할 때 받는 것",
        "· Google 로그인 — 이메일 주소, 계정 이름, 프로필 사진 주소, Google 계정 식별자",
        "· 이메일 링크 로그인 — 이메일 주소",
        "직접 입력하는 것",
        "· 닉네임 (선택). 정하지 않으면 게시판에 무작위 별칭으로 표시됩니다.",
        "· 게시판에 쓴 글과 댓글, 공감",
        "쓰는 동안 자동으로 남는 것",
        "· 다운로드 기록 — 어떤 제품의 어떤 버전을 언제, 어떤 언어 화면에서 받았는지",
        "· 접속 기록 — 아래 위탁사(Vercel·Supabase)의 서버 로그",
      ],
    },
    {
      heading: "2. 무엇에 쓰는가",
      body: [
        "· 로그인 상태 유지",
        "· 받은 제품 목록을 내 서랍에 보여주기",
        "· 게시판 운영 — 글쓴이 표시, 도배 제동",
        "· 제품별 다운로드 수 집계. 이 숫자는 개인을 식별하지 않는 합계로만 공개됩니다.",
        "광고나 마케팅에 쓰지 않습니다. 프로필을 만들어 분석하지 않습니다.",
      ],
    },
    {
      heading: "3. 비밀번호는 받지 않습니다",
      body: [
        "이 사이트는 비밀번호를 만들지도, 받지도, 저장하지도 않습니다.",
        "Google 로그인과 이메일 일회용 링크만 씁니다.",
      ],
    },
    {
      heading: "4. 누구에게 넘기는가",
      body: [
        "제3자에게 팔거나 넘기지 않습니다. 다만 서비스를 돌리기 위해 아래에 처리를 맡깁니다.",
        "· Supabase — 로그인과 데이터베이스. 데이터는 서울 리전에 있습니다.",
        "· Vercel — 사이트 호스팅",
        "· Google — 소셜 로그인 (Google 로그인을 쓸 때만)",
        "· GitHub — 설치파일 배포. 받기를 누르면 GitHub 주소로 이동하며, 그 시점부터 GitHub 의 방침이 함께 적용됩니다.",
        "수사기관의 적법한 요청이 있으면 법이 정한 범위에서 제공할 수 있습니다.",
      ],
    },
    {
      heading: "5. 얼마나 보관하는가",
      body: [
        "계정이 살아 있는 동안 보관하고, 삭제를 요청하시면 지체 없이 지웁니다.",
        "계정을 지우면 프로필·닉네임·다운로드 기록·게시글·댓글·공감이 함께 삭제됩니다.",
        "위탁사의 서버 로그는 각 사의 정책에 따라 일정 기간 남을 수 있습니다.",
      ],
    },
    {
      heading: "6. 열람·정정·삭제",
      body: [
        "언제든 아래 주소로 요청하시면 처리합니다.",
        "· 내가 받은 기록은 내 서랍에서 바로 볼 수 있습니다.",
        "· 닉네임은 내 서랍에서 직접 고치거나 지울 수 있습니다.",
        "· 글과 댓글은 본인이 직접 지울 수 있습니다.",
        "· 계정 삭제는 내 서랍에서 직접 할 수 있습니다. 지우면 되돌릴 수 없습니다.",
      ],
    },
    {
      heading: "7. 쿠키",
      body: [
        "· 로그인 세션 쿠키 — 로그인 상태를 유지합니다. 로그아웃하면 지워집니다.",
        "· 언어 쿠키(NEXT_LOCALE) — 고른 언어를 기억합니다.",
        "광고나 추적을 위한 쿠키는 쓰지 않습니다. 외부 분석 도구도 붙이지 않았습니다.",
      ],
    },
    {
      heading: "8. 안전하게 지키기 위해 한 것",
      body: [
        "· 모든 통신은 HTTPS 로만 오갑니다.",
        "· 데이터베이스의 모든 표에 행 단위 접근 제어(RLS)를 걸어, 남의 기록은 조회 자체가 되지 않습니다.",
        "· 게시판에는 닉네임만 공개되고 계정 이름(실명)과 이메일은 공개되지 않습니다.",
        "· 비밀번호를 보관하지 않으므로 유출될 비밀번호가 없습니다.",
      ],
    },
    {
      heading: "9. 만 14세 미만",
      body: [
        "만 14세 미만 어린이의 가입을 받지 않습니다.",
        "확인되면 계정과 관련 기록을 지웁니다.",
      ],
    },
    {
      heading: "10. 책임자와 문의",
      body: [
        "개인정보 보호책임자 — 박의혁",
        "snail5039@gmail.com",
        "1인이 운영하는 사이트라 답변까지 며칠 걸릴 수 있습니다.",
      ],
    },
    {
      heading: "11. 바뀔 때",
      body: [
        "내용이 바뀌면 시행일을 올리고 공지에 알립니다.",
        "중요한 변경은 최소 7일 전에 알립니다.",
      ],
    },
  ],
};

const TERMS_KO: LegalDoc = {
  title: "이용약관",
  effective: "2026-08-19",
  sections: [
    {
      heading: "1. 이 약관이 다루는 것",
      body: [
        "HyukForge(hyukforge.vercel.app)에서 소프트웨어를 내려받고 게시판을 쓰는 데 적용됩니다.",
        "여기서 배포하는 각 제품은 그 제품의 서비스와 약관을 따로 가집니다. 이 약관은 이 사이트에만 적용됩니다.",
      ],
    },
    {
      heading: "2. 계정",
      body: [
        "· Google 로그인 또는 이메일 링크로 가입합니다. 비밀번호는 만들지 않습니다.",
        "· 한 사람이 여러 계정을 만들어 공감이나 게시글 수를 부풀리지 않습니다.",
        "· 닉네임은 2~20자이며 다른 사람과 겹칠 수 없습니다. 남을 사칭하는 이름은 관리자가 바꿉니다.",
      ],
    },
    {
      heading: "3. 제공하는 것",
      body: [
        "· 지금 올라온 제품은 전부 무료입니다. 결제 정보를 받지 않습니다.",
        "· 설치파일은 이 사이트가 아니라 GitHub Releases 에 있습니다. 받기를 누르면 그리로 이동합니다.",
        "· 소프트웨어의 사용 조건은 각 제품 저장소가 정한 바를 따릅니다. 별도 라이선스가 지정되지 않은 제품도 있으며, 그 경우 저작권은 제작자에게 있습니다.",
        "· 1인이 만들고 고치는 사이트입니다. 예고 없이 기능이 바뀌거나 잠시 멈출 수 있습니다.",
      ],
    },
    {
      heading: "4. 게시판에서 하지 말아야 할 것",
      body: [
        "· 남을 비방하거나 괴롭히는 글",
        "· 법을 어기는 내용, 타인의 저작권·개인정보를 침해하는 내용",
        "· 광고와 도배. 자동으로 반복 게시하는 행위",
        "· 다른 사람인 척하는 행위",
        "· 서비스의 취약점을 악용하거나 정상 운영을 방해하는 행위",
      ],
    },
    {
      heading: "5. 쓴 글의 권리",
      body: [
        "· 글과 댓글의 저작권은 쓴 사람에게 있습니다.",
        "· 다만 이 사이트가 그 글을 보여주고 보관하는 데 필요한 범위에서 쓰는 것에 동의하는 것으로 봅니다.",
        "· 4항을 어긴 글은 알리고 숨기거나 지울 수 있습니다. 급한 경우 먼저 숨기고 알립니다.",
        "· 본인이 쓴 글과 댓글은 언제든 직접 지울 수 있습니다.",
      ],
    },
    {
      heading: "6. 보증하지 않는 것",
      body: [
        "여기서 배포하는 소프트웨어는 무료로 있는 그대로 제공됩니다. 특정 목적에 맞는다거나 오류가 없다고 보증하지 않습니다.",
        "설치 전에 중요한 자료는 백업하시기를 권합니다.",
        "다만 고의나 중대한 과실로 생긴 손해까지 면책되는 것은 아닙니다. 관련 법이 정한 책임은 그대로 집니다.",
      ],
    },
    {
      heading: "7. 이용 제한",
      body: [
        "4항을 반복해서 어기면 글 작성을 막거나 계정 이용을 정지할 수 있습니다.",
        "그 전에 무엇이 문제인지 알립니다. 오해라면 아래 주소로 알려주세요.",
      ],
    },
    {
      heading: "8. 약관이 바뀔 때",
      body: [
        "바뀌면 시행일을 올리고 공지에 알립니다. 중요한 변경은 최소 7일 전에 알립니다.",
        "바뀐 약관에 동의하지 않으시면 이용을 그만두시면 됩니다.",
      ],
    },
    {
      heading: "9. 준거법",
      body: [
        "대한민국 법을 따릅니다.",
        "분쟁이 생기면 먼저 아래 주소로 이야기해 주세요. 소송은 민사소송법이 정한 법원에 제기합니다.",
      ],
    },
    {
      heading: "10. 문의",
      body: ["박의혁 · snail5039@gmail.com"],
    },
  ],
};

const PRIVACY_EN: LegalDoc = {
  title: "Privacy Policy",
  effective: "2026-08-19",
  sections: [
    {
      heading: "1. What is collected",
      body: [
        "When you sign in",
        "· Google sign-in — email address, account name, profile picture URL, Google account identifier",
        "· Email link sign-in — email address",
        "What you enter yourself",
        "· A nickname (optional). Without one you appear on the board under a random tag.",
        "· Posts, comments and upvotes on the board",
        "What is recorded as you use the site",
        "· Download records — which product and version, when, and in which interface language",
        "· Access logs kept by the processors listed below (Vercel, Supabase)",
      ],
    },
    {
      heading: "2. What it is used for",
      body: [
        "· Keeping you signed in",
        "· Showing what you downloaded, on your shelf",
        "· Running the board — showing an author name, slowing down flooding",
        "· Counting downloads per product. Only the aggregate is published; it does not identify anyone.",
        "None of it is used for advertising or marketing, and no profiling is done.",
      ],
    },
    {
      heading: "3. No passwords",
      body: [
        "This site never creates, receives or stores a password.",
        "Only Google sign-in and one-time email links are used.",
      ],
    },
    {
      heading: "4. Who else sees it",
      body: [
        "Nothing is sold or handed to third parties. These processors are used to run the service:",
        "· Supabase — authentication and database. Data is held in the Seoul region.",
        "· Vercel — site hosting",
        "· Google — social sign-in (only if you use it)",
        "· GitHub — installer distribution. Pressing download sends you to GitHub, and GitHub's policy applies from that point.",
        "Lawful requests from authorities may be answered within the limits the law sets.",
      ],
    },
    {
      heading: "5. How long it is kept",
      body: [
        "For as long as the account exists, and deleted without delay once you ask.",
        "Deleting the account also deletes the profile, nickname, download records, posts, comments and upvotes.",
        "Processor server logs may persist for a period set by each provider.",
      ],
    },
    {
      heading: "6. Access, correction, deletion",
      body: [
        "Write to the address below at any time.",
        "· Your download history is visible on your shelf.",
        "· Your nickname can be changed or cleared on your shelf.",
        "· Your posts and comments can be deleted by you.",
        "· You can delete your account yourself, on your shelf. It cannot be undone.",
      ],
    },
    {
      heading: "7. Cookies",
      body: [
        "· Session cookie — keeps you signed in. Cleared when you sign out.",
        "· Language cookie (NEXT_LOCALE) — remembers the language you picked.",
        "No advertising or tracking cookies, and no third-party analytics.",
      ],
    },
    {
      heading: "8. How it is protected",
      body: [
        "· All traffic is HTTPS only.",
        "· Every table has row-level security, so other people's records cannot even be queried.",
        "· Only a nickname is public on the board — never the account name or email address.",
        "· No password is stored, so there is no password to leak.",
      ],
    },
    {
      heading: "9. Children under 14",
      body: [
        "Accounts are not accepted from children under 14.",
        "Any such account and its records will be deleted.",
      ],
    },
    {
      heading: "10. Who is responsible",
      body: [
        "Data protection officer — Park Uihyuk",
        "snail5039@gmail.com",
        "This is a one-person site, so a reply may take a few days.",
      ],
    },
    {
      heading: "11. Changes",
      body: [
        "If this changes, the effective date moves and a notice goes up.",
        "Significant changes are announced at least 7 days ahead.",
      ],
    },
  ],
};

const TERMS_EN: LegalDoc = {
  title: "Terms of Use",
  effective: "2026-08-19",
  sections: [
    {
      heading: "1. What these terms cover",
      body: [
        "Downloading software and using the board on HyukForge (hyukforge.vercel.app).",
        "Each product distributed here runs its own service under its own terms. These terms cover this site only.",
      ],
    },
    {
      heading: "2. Accounts",
      body: [
        "· Sign up with Google or an email link. No password is created.",
        "· Do not run several accounts to inflate upvotes or post counts.",
        "· Nicknames are 2–20 characters and must be unique. Names that impersonate someone will be changed.",
      ],
    },
    {
      heading: "3. What is provided",
      body: [
        "· Everything published here is free. No payment details are collected.",
        "· Installers live on GitHub Releases, not on this site. Pressing download sends you there.",
        "· Terms of use for the software itself follow each product's repository. Some products carry no separate licence, in which case copyright stays with the author.",
        "· One person builds and fixes this site. Features may change or briefly stop without notice.",
      ],
    },
    {
      heading: "4. What not to do on the board",
      body: [
        "· Abuse or harassment",
        "· Anything unlawful, or that infringes copyright or someone's personal data",
        "· Advertising and flooding, including automated repeat posting",
        "· Pretending to be someone else",
        "· Exploiting weaknesses in the service or disrupting its operation",
      ],
    },
    {
      heading: "5. Rights in what you write",
      body: [
        "· You keep the copyright in your posts and comments.",
        "· You do agree to this site using them as far as it needs to display and store them.",
        "· Posts breaking section 4 may be hidden or removed, with notice. Urgent cases are hidden first, then explained.",
        "· You can delete your own posts and comments at any time.",
      ],
    },
    {
      heading: "6. What is not warranted",
      body: [
        "Software here is provided free and as is. There is no warranty that it fits a particular purpose or is free of faults.",
        "Back up anything important before installing.",
        "This does not exclude liability for intent or gross negligence. Responsibilities set by applicable law still stand.",
      ],
    },
    {
      heading: "7. Restrictions",
      body: [
        "Repeatedly breaking section 4 may lead to posting being blocked or the account suspended.",
        "You will be told what the problem is first. If it is a misunderstanding, write to the address below.",
      ],
    },
    {
      heading: "8. Changes to these terms",
      body: [
        "If they change, the effective date moves and a notice goes up. Significant changes are announced at least 7 days ahead.",
        "If you do not agree with the new terms, you can simply stop using the site.",
      ],
    },
    {
      heading: "9. Governing law",
      body: [
        "The laws of the Republic of Korea apply.",
        "If something goes wrong, please write first. Any action goes to the court designated by Korean civil procedure.",
      ],
    },
    {
      heading: "10. Contact",
      body: ["Park Uihyuk · snail5039@gmail.com"],
    },
  ],
};

const DOCS: Record<LegalDocId, Record<"ko" | "en", LegalDoc>> = {
  privacy: { ko: PRIVACY_KO, en: PRIVACY_EN },
  terms: { ko: TERMS_KO, en: TERMS_EN },
};

export function isLegalDoc(v: string): v is LegalDocId {
  return (LEGAL_DOCS as readonly string[]).includes(v);
}

/** 한국어면 기준본, 나머지는 영어 번역을 준다. */
export function getLegalDoc(doc: LegalDocId, locale: string): LegalDoc {
  return locale === AUTHORITATIVE_LOCALE ? DOCS[doc].ko : DOCS[doc].en;
}
