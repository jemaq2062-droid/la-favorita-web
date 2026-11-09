-- Vocabulario de ejemplo. Los terminos dudosos se guardan con review y NO se autoconvierten.
BEGIN;
INSERT INTO catalog_aliases(alias_key,alias_text,canonical_term,status,requires_review,note) VALUES
 ('boligrafo','boligrafo','lapicero','approved',FALSE,'Sinónimo común en Perú'),
 ('boligrafos','boligrafos','lapiceros','approved',FALSE,'Plural'),
 ('lapisero','lapisero','lapicero','approved',FALSE,'Falta ortografica frecuente'),
 ('lapiseros','lapiseros','lapiceros','approved',FALSE,'Plural con falta ortografica'),
 ('lapicera','lapicera','lapicero','approved',FALSE,'Nombre regional'),
 ('lapiceras','lapiceras','lapiceros','approved',FALSE,'Plural regional'),
 ('papelote','papelote','papelografo','approved',FALSE,'Nombre popular'),
 ('papelotes','papelotes','papelografos','approved',FALSE,'Plural'),
 ('hoja bond','hoja bond','papel bond','approved',FALSE,'Equivalencia de denominacion'),
 ('goma en barra','goma en barra','pegamento en barra','approved',FALSE,'Presentacion equivalente'),
 ('fomi','fomi','goma eva','approved',FALSE,'Nombre comercial frecuente'),
 ('foamy','foamy','goma eva','approved',FALSE,'Nombre comercial frecuente'),
 ('corros pun escarchado','corros pun escarchado','corospum escarchado','review',TRUE,'Ambiguo: verificar el material exacto'),
 ('corrospum escarchado','corrospum escarchado','corospum escarchado','review',TRUE,'Requiere verificar con el cliente'),
 ('corospun escarchado','corospun escarchado','corospum escarchado','review',TRUE,'Requiere verificar con el cliente')
ON CONFLICT(alias_key) DO NOTHING;
COMMIT;
