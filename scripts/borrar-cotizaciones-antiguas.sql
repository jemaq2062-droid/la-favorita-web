-- SOLO si activaste SAVE_QUOTE_HISTORY=true y estableciste una politica de retencion.
DELETE FROM quote_requests WHERE created_at < now() - INTERVAL '30 days';
