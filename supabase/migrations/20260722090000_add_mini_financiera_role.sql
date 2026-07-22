-- PASO 1 de 3 — correr ESTE archivo solo, en su propia ejecución en el
-- SQL Editor de Supabase, antes de correr los otros dos.
--
-- Agrega el valor 'mini_financiera' al enum app_role, igual que ya se
-- hizo antes con 'financiera' y 'cartera'. Postgres no permite usar un
-- valor de enum recién agregado en la misma transacción en la que se
-- agregó, por eso este paso va separado y debe ejecutarse (y confirmarse)
-- antes de correr 20260722100000_gestion_pago.sql y
-- 20260722110000_mini_financiera_rls.sql.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mini_financiera';
