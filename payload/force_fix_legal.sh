#!/bin/bash
psql "postgresql://postgres:wPwAMQTJwB1WTBXF@db.gdmvxijcxzcuassezrwy.supabase.co:5432/postgres" <<EOF
TRUNCATE legal_sections CASCADE;
UPDATE legal SET title='Mentions Légales', last_updated='02/05/2026';
EOF
