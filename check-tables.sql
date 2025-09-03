-- Script para verificar se as tabelas de user management existem
SELECT 
    tablename,
    schemaname 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('user_profile', 'user_workspace_access')
ORDER BY tablename;