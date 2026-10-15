CREATE TABLE IF NOT EXISTS team_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    team_id UUID NOT NULL
        REFERENCES teams(id) ON DELETE CASCADE,

    invited_by UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member'
        CHECK (role IN ('admin', 'member')),

    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_team
    ON team_invitations(team_id);

CREATE INDEX IF NOT EXISTS idx_team_invitations_email
    ON team_invitations(LOWER(email));

CREATE INDEX IF NOT EXISTS idx_team_invitations_pending
    ON team_invitations(expires_at)
    WHERE accepted_at IS NULL;