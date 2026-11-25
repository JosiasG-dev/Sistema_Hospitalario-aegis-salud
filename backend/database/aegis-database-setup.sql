-- Configure the MySQL database and a least-privilege application account.
-- Replace the password placeholder before running this file.
-- Laravel migrations create and evolve the application tables:
-- php artisan migrate --seed

CREATE DATABASE IF NOT EXISTS aegis_salud
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'aegis_app'@'localhost'
  IDENTIFIED BY 'REPLACE_WITH_A_LONG_UNIQUE_PASSWORD';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP
  ON aegis_salud.* TO 'aegis_app'@'localhost';

FLUSH PRIVILEGES;
