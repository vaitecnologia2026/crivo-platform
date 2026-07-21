-- Motor v3.1: as faixas oficiais (Anexos D/E) usam limites decimais
-- (0–24.9 / 25–49.9 / 50–74.9 / 75–100). Widening seguro de INTEGER.
ALTER TABLE "methodology_bands" ALTER COLUMN "min" TYPE DOUBLE PRECISION;
ALTER TABLE "methodology_bands" ALTER COLUMN "max" TYPE DOUBLE PRECISION;
