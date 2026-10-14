-- 장 마감 요약 (app/briefing.py build_close): 아침 브리핑과 같은 테이블, 종류로 나눈다
ALTER TABLE briefings ADD COLUMN kind text NOT NULL DEFAULT 'morning' CHECK (kind IN ('morning', 'close'));
ALTER TABLE briefings DROP CONSTRAINT briefings_user_id_brief_date_key;
ALTER TABLE briefings ADD UNIQUE (user_id, brief_date, kind);
