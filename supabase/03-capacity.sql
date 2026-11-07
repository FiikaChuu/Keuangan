-- Run periodically in SQL Editor. Includes heap, TOAST and indexes, not just JSON payload.
select pg_size_pretty(pg_database_size(current_database())) as database_size;
select relname, pg_size_pretty(pg_total_relation_size(relid)) as total_with_indexes,
  n_live_tup as estimated_rows from pg_stat_user_tables order by pg_total_relation_size(relid) desc;
select count(*) as transactions,
  round(pg_total_relation_size('public.transactions')::numeric / greatest(count(*),1)) as measured_bytes_per_transaction,
  floor(400::numeric*1024*1024 / greatest(pg_total_relation_size('public.transactions')::numeric / greatest(count(*),1),1)) as rough_rows_in_400_mib
from public.transactions;
-- The 400 MiB illustration reserves 100 MiB for Auth, wallet data and maintenance.
-- Measure after realistic usage: notes, indexes, WAL/service quotas and table bloat vary.
