-- SolveANeed privilege audit. Run against any environment (read-only).
\pset footer off
\echo '== Functions in public: security definer, search_path, who can EXECUTE'
select p.proname as function,
       pg_get_function_identity_arguments(p.oid) as args,
       case when p.prosecdef then 'DEFINER' else 'invoker' end as security,
       coalesce(array_to_string(p.proconfig, ','), '!! none') as config,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by security desc, function;

\echo '== Tables: RLS status and client privileges'
select c.relname as table,
       c.relrowsecurity as rls,
       c.relforcerowsecurity as forced,
       (select string_agg(distinct privilege_type, ',') from information_schema.role_table_grants g
         where g.table_schema='public' and g.table_name=c.relname and g.grantee='anon') as anon_table_privs,
       (select string_agg(distinct privilege_type, ',') from information_schema.role_table_grants g
         where g.table_schema='public' and g.table_name=c.relname and g.grantee='authenticated') as auth_table_privs,
       (select string_agg(distinct privilege_type||'('||column_name||')', ', ' order by privilege_type||'('||column_name||')') from information_schema.column_privileges cp
         where cp.table_schema='public' and cp.table_name=c.relname and cp.grantee='authenticated'
           and privilege_type in ('INSERT','UPDATE')
           and not exists (select 1 from information_schema.role_table_grants g where g.table_schema='public'
                           and g.table_name=c.relname and g.grantee='authenticated' and g.privilege_type=cp.privilege_type)) as auth_column_writes
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','v')
order by c.relkind, c.relname;

\echo '== Views and their security_invoker setting'
select c.relname as view, coalesce(array_to_string(c.reloptions, ','), 'definer (owner rights)') as options
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v';

\echo '== RLS-enabled tables with NO policies (deny-all for clients)'
select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relrowsecurity
  and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname);

\echo '== Tables WITHOUT RLS (must be empty)'
select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;
