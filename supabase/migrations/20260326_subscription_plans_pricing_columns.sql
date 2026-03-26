-- Montants d'affichage exacts (AED entiers) pour l'app / Stripe côté métadonnées
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS price_aed_annual numeric,
  ADD COLUMN IF NOT EXISTS price_aed_monthly_billing numeric;

COMMENT ON COLUMN subscription_plans.price_aed_monthly IS
  'Équivalent mensuel si abonnement annuel (AED/mo affiché onglet Annual), ou fallback legacy.';
COMMENT ON COLUMN subscription_plans.price_aed_monthly_billing IS
  'Prix facturé chaque mois si l''utilisateur choisit la facturation mensuelle (AED/mo).';
COMMENT ON COLUMN subscription_plans.price_aed_annual IS
  'Total facturé une fois par an pour l''abonnement annuel (AED).';

-- Grille alignée produit (à ajuster si les tarifs changent)
UPDATE subscription_plans
SET
  price_aed_monthly_billing = 179,
  price_aed_annual = 1788,
  price_aed_monthly = 149
WHERE slug = 'starter';

UPDATE subscription_plans
SET
  price_aed_monthly_billing = 299,
  price_aed_annual = 2988,
  price_aed_monthly = 249
WHERE slug = 'growth';

UPDATE subscription_plans
SET
  price_aed_monthly_billing = 449,
  price_aed_annual = 4488,
  price_aed_monthly = 374
WHERE slug = 'agency';
