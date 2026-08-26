-- Remplace les anciennes icônes emoji des onglets/raccourcis (portal_tabs.icon) par les
-- identifiants d'icônes vectorielles (lucide-react) désormais utilisés côté web.
-- Idempotent : ne touche ni aux images (data:/http(s):) ni aux valeurs déjà migrées.

UPDATE "portal_tabs" SET "icon" = 'newspaper'      WHERE "icon" = '📰';
UPDATE "portal_tabs" SET "icon" = 'bell'           WHERE "icon" = '🔔';
UPDATE "portal_tabs" SET "icon" = 'play-circle'    WHERE "icon" = '▶️';
UPDATE "portal_tabs" SET "icon" = 'x'              WHERE "icon" = '✖️';
UPDATE "portal_tabs" SET "icon" = 'users'          WHERE "icon" = '📘';
UPDATE "portal_tabs" SET "icon" = 'briefcase'      WHERE "icon" = '💼';
UPDATE "portal_tabs" SET "icon" = 'folder'         WHERE "icon" = '📁';
UPDATE "portal_tabs" SET "icon" = 'mail'           WHERE "icon" = '✉️';
UPDATE "portal_tabs" SET "icon" = 'clipboard-list' WHERE "icon" = '📋';
UPDATE "portal_tabs" SET "icon" = 'notebook-pen'   WHERE "icon" = '📝';
UPDATE "portal_tabs" SET "icon" = 'bar-chart'      WHERE "icon" = '📊';
UPDATE "portal_tabs" SET "icon" = 'git-branch'     WHERE "icon" = '🐙';
UPDATE "portal_tabs" SET "icon" = 'triangle'       WHERE "icon" = '▲';
UPDATE "portal_tabs" SET "icon" = 'cloud'          WHERE "icon" = '☁️';
UPDATE "portal_tabs" SET "icon" = 'sheet'          WHERE "icon" = '📗';
UPDATE "portal_tabs" SET "icon" = 'link'           WHERE "icon" = '🔗';

-- Toute autre valeur restante qui n'est ni une image, ni déjà un identifiant connu
-- (emoji personnalisé tapé librement par un admin, symbole, etc.) retombe sur l'icône
-- par défaut : le rendu ne doit jamais afficher de caractère brut non reconnu.
UPDATE "portal_tabs"
SET "icon" = 'link'
WHERE "icon" IS NOT NULL
  AND "icon" NOT LIKE 'data:image/%'
  AND "icon" NOT LIKE 'http://%'
  AND "icon" NOT LIKE 'https://%'
  AND "icon" NOT IN (
    'newspaper', 'bell', 'play-circle', 'x', 'users', 'briefcase', 'folder',
    'mail', 'clipboard-list', 'notebook-pen', 'bar-chart', 'git-branch',
    'triangle', 'cloud', 'sheet', 'link'
  );
