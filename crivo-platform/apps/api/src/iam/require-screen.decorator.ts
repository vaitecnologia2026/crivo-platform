import { SetMetadata } from '@nestjs/common';

export const SCREEN_KEY = 'required_screen';

/**
 * Marca o controller/rota como pertencente a uma TELA do portal (ex.:
 * @RequireScreen('parecer')). Avaliado pelo ScreenAccessGuard: se o usuário
 * tem restrição de telas (User.screenAccess) e esta tela não está liberada,
 * a API bloqueia (defesa em profundidade — espelha o filtro da nav).
 *
 * Use só em controllers 1:1 com uma tela dedicada (parecer, library, pocket…),
 * NÃO em controllers compartilhados por várias telas (ex.: icd alimenta também
 * o Dashboard) — senão bloquearia acesso legítimo.
 */
export const RequireScreen = (route: string) => SetMetadata(SCREEN_KEY, route);
