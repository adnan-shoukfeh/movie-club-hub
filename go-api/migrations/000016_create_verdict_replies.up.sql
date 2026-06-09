CREATE TABLE verdict_replies (
    id         bigserial PRIMARY KEY,
    verdict_id bigint NOT NULL REFERENCES verdicts(id) ON DELETE CASCADE,
    user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT verdict_replies_body_not_blank CHECK (length(btrim(body)) > 0),
    CONSTRAINT verdict_replies_body_length CHECK (char_length(body) <= 1000)
);

CREATE INDEX verdict_replies_verdict_idx ON verdict_replies (verdict_id, created_at);
CREATE INDEX verdict_replies_user_idx ON verdict_replies (user_id);
