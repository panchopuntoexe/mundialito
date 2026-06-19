import type { IconType } from "react-icons";
import {
  FaBolt,
  FaBullseye,
  FaCalendarDays,
  FaChair,
  FaClapperboard,
  FaCrown,
  FaFire,
  FaFutbol,
  FaGem,
  FaHeart,
  FaMedal,
  FaPencil,
  FaRankingStar,
  FaSeedling,
  FaShirt,
  FaStar,
  FaTrophy,
  FaUserPlus,
  FaUserShield,
  FaWandMagicSparkles,
} from "react-icons/fa6";
import type { AchievementType } from "@/lib/scoring/achievements";
import type { LevelKey } from "@/lib/scoring/levels";

/**
 * Íconos de la app (Font Awesome 6 Free vía react-icons). Los niveles y las
 * insignias se definen en lib/scoring como datos puros (serializables entre
 * Server y Client Components); acá se mapea cada clave a su componente SVG.
 * Los íconos heredan tamaño (1em) y color (currentColor) del contenedor.
 */

const LEVEL_ICONS: Record<LevelKey, IconType> = {
  suplente: FaChair,
  promesa: FaSeedling,
  titular: FaShirt,
  goleador: FaFutbol,
  crack: FaStar,
  figura: FaWandMagicSparkles,
  leyenda: FaCrown,
  capitan: FaUserShield,
  campeon: FaMedal,
  idolo: FaHeart,
  cesped: FaTrophy,
  inmortal: FaRankingStar,
};

const BADGE_ICONS: Record<AchievementType, IconType> = {
  first_prediction: FaPencil,
  tournament_opener: FaClapperboard,
  first_win: FaBullseye,
  sharpshooter: FaGem,
  hot_streak: FaFire,
  streak_3: FaCalendarDays,
  streak_legend: FaBolt,
  centurion: FaMedal,
  ambassador: FaUserPlus,
};

export function LevelIcon({
  level,
  className,
}: {
  level: LevelKey;
  className?: string;
}) {
  const Icon = LEVEL_ICONS[level];
  return <Icon aria-hidden className={className} />;
}

export function BadgeIcon({
  type,
  className,
}: {
  type: AchievementType;
  className?: string;
}) {
  const Icon = BADGE_ICONS[type];
  return <Icon aria-hidden className={className} />;
}
