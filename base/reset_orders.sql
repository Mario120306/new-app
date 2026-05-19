-- Reset Orders Database
-- Supprime toutes les commandes, détails de commandes et historiques

-- Désactiver les vérifications de clés étrangères temporairement
SET FOREIGN_KEY_CHECKS=0;

-- Vider les tables de commandes
TRUNCATE TABLE ps_orders;
TRUNCATE TABLE ps_order_detail;
TRUNCATE TABLE ps_order_history;
TRUNCATE TABLE ps_order_carrier;
TRUNCATE TABLE ps_order_payment;
TRUNCATE TABLE ps_order_invoice;
TRUNCATE TABLE ps_order_invoice_payment;
TRUNCATE TABLE ps_order_return;
TRUNCATE TABLE ps_order_return_detail;
TRUNCATE TABLE ps_order_return_state;

-- Réactiver les vérifications de clés étrangères
SET FOREIGN_KEY_CHECKS=1;

-- Réinitialiser les auto-incréments (optionnel)
ALTER TABLE ps_orders AUTO_INCREMENT = 1;
ALTER TABLE ps_order_detail AUTO_INCREMENT = 1;
ALTER TABLE ps_order_history AUTO_INCREMENT = 1;
ALTER TABLE ps_order_carrier AUTO_INCREMENT = 1;
ALTER TABLE ps_order_payment AUTO_INCREMENT = 1;
ALTER TABLE ps_order_invoice AUTO_INCREMENT = 1;
ALTER TABLE ps_order_return AUTO_INCREMENT = 1;

-- Confirmation
SELECT 'Tables de commandes réinitialisées avec succès!' as Status;
