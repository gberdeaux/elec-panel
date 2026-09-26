/** Icônes d'interface (trait 1,75 px, grille 24) et pictogrammes des porte-étiquettes. */
import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function make(paths: ReactNode) {
  return function Icon({ size = 18, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
      >
        {paths}
      </svg>
    );
  };
}

export const IconDashboard = make(
  <>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </>,
);
export const IconHome = make(
  <>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9v11h14V9" />
    <path d="M10 20v-6h4v6" />
  </>,
);
export const IconPanel = make(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <path d="M3 9h18M3 15h18" />
    <path d="M7 5.5v1.5M10 5.5v1.5M7 11.5v1.5M10 11.5v1.5M13 11.5v1.5M7 17.5v1.5" />
  </>,
);
export const IconShield = make(
  <>
    <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z" />
    <path d="m8.8 12.2 2.2 2.2 4.3-4.6" />
  </>,
);
export const IconBox = make(
  <>
    <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" />
    <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
  </>,
);
export const IconSparkles = make(
  <>
    <path d="M10 3.5 11.6 8 16 9.6l-4.4 1.6L10 15.7l-1.6-4.5L4 9.6 8.4 8 10 3.5Z" />
    <path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z" />
  </>,
);
export const IconPlus = make(<path d="M12 5v14M5 12h14" />);
export const IconUndo = make(
  <>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </>,
);
export const IconRedo = make(
  <>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </>,
);
export const IconMore = make(
  <>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </>,
);
export const IconClose = make(<path d="M6 6l12 12M18 6 6 18" />);
export const IconMenu = make(<path d="M4 7h16M4 12h16M4 17h16" />);
export const IconChevronRight = make(<path d="m9 6 6 6-6 6" />);
export const IconArrowRight = make(<path d="M5 12h14M13 6l6 6-6 6" />);
export const IconWand = make(
  <>
    <path d="m4 20 11-11" />
    <path d="m14 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2ZM19 11l.6 1.4L21 13l-1.4.6L19 15l-.6-1.4L17 13l1.4-.6L19 11Z" />
  </>,
);
export const IconCopy = make(
  <>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </>,
);
export const IconDownload = make(
  <>
    <path d="M12 4v11M7 10l5 5 5-5" />
    <path d="M5 20h14" />
  </>,
);
export const IconUpload = make(
  <>
    <path d="M12 20V9M7 14l5-5 5 5" />
    <path d="M5 4h14" />
  </>,
);
export const IconTrash = make(
  <>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
  </>,
);
export const IconDuplicate = make(
  <>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a1 1 0 0 1 1-1h9" />
  </>,
);
export const IconSearch = make(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </>,
);
export const IconExternal = make(
  <>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </>,
);
export const IconAlert = make(
  <>
    <path d="M12 4 2.8 19.5h18.4L12 4Z" />
    <path d="M12 10v4.5M12 17.2v.3" />
  </>,
);
export const IconTag = make(
  <>
    <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" />
    <circle cx="8" cy="8" r="1.6" />
  </>,
);
export const IconCheck = make(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const IconInfo = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.8v.2" />
  </>,
);
export const IconBook = make(
  <>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19v14H5.5A1.5 1.5 0 0 0 4 19.5v-14Z" />
    <path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H19" />
  </>,
);
export const IconBolt = make(<path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />);
export const IconEye = make(
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
export const IconSun = make(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </>,
);
export const IconMoon = make(<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />);
export const IconSend = make(
  <>
    <path d="M4 12 20 4l-5 16-3-7-8-1Z" />
  </>,
);
export const IconStop = make(<rect x="6" y="6" width="12" height="12" rx="2" />);
export const IconCamera = make(
  <>
    <path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" />
    <circle cx="12" cy="13" r="3.5" />
  </>,
);
export const IconGrip = make(
  <>
    <circle cx="9" cy="6" r="1" />
    <circle cx="15" cy="6" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="9" cy="18" r="1" />
    <circle cx="15" cy="18" r="1" />
  </>,
);

/* ---------- Pictogrammes des porte-étiquettes (grille 12, trait 1) ---------- */

const PICTOS: Record<string, ReactNode> = {
  eclairage: (
    <>
      <path d="M4.2 7.2a3 3 0 1 1 3.6 0V8.5H4.2V7.2Z" />
      <path d="M4.6 10h2.8" />
    </>
  ),
  prises: (
    <>
      <circle cx="6" cy="6" r="4.2" />
      <circle cx="4.4" cy="6" r=".6" fill="currentColor" />
      <circle cx="7.6" cy="6" r=".6" fill="currentColor" />
    </>
  ),
  prises_cuisine: (
    <>
      <circle cx="6" cy="6.5" r="3.6" />
      <circle cx="4.7" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="7.3" cy="6.5" r=".5" fill="currentColor" />
      <path d="M3 1.8h6" />
    </>
  ),
  volets: (
    <>
      <rect x="2" y="2" width="8" height="8" />
      <path d="M2 4h8M2 6h8M2 8h8" />
    </>
  ),
  chauffage: (
    <>
      <path d="M2.5 3v7M5 3v7M7 3v7M9.5 3v7" />
      <path d="M1.5 9.5h9" />
    </>
  ),
  chauffe_eau: (
    <>
      <rect x="3.2" y="1.5" width="5.6" height="9" rx="2" />
      <path d="M6 4.5c-.9 1.2-1.3 1.9-1.3 2.5a1.3 1.3 0 0 0 2.6 0c0-.6-.4-1.3-1.3-2.5Z" />
    </>
  ),
  plaque: (
    <>
      <rect x="1.5" y="1.5" width="9" height="9" rx="1" />
      <circle cx="4.2" cy="4.2" r="1.4" />
      <circle cx="7.8" cy="7.8" r="1.4" />
    </>
  ),
  four: (
    <>
      <rect x="1.5" y="1.5" width="9" height="9" rx="1" />
      <rect x="3" y="4.5" width="6" height="4.5" />
      <path d="M3 3h1M5 3h1" />
    </>
  ),
  lave_linge: (
    <>
      <rect x="2" y="1.5" width="8" height="9" rx="1" />
      <circle cx="6" cy="6.8" r="2.4" />
      <path d="M3.5 3h1" />
    </>
  ),
  seche_linge: (
    <>
      <rect x="2" y="1.5" width="8" height="9" rx="1" />
      <circle cx="6" cy="6.8" r="2.4" />
      <path d="M5 6.2c.6.4 1.4.4 2 0" />
    </>
  ),
  lave_vaisselle: (
    <>
      <rect x="2" y="1.5" width="8" height="9" rx="1" />
      <path d="M2 4h8M4 6.5l1 1.5M6 6.5v2M8 6.5 7 8" />
    </>
  ),
  congelateur: (
    <>
      <path d="M6 1.5v9M2.1 3.8l7.8 4.4M9.9 3.8 2.1 8.2" />
      <path d="M4.8 2.3 6 3.4l1.2-1.1M4.8 9.7 6 8.6l1.2 1.1" />
    </>
  ),
  micro_ondes: (
    <>
      <rect x="1.5" y="2.5" width="9" height="7" rx="1" />
      <rect x="3" y="4" width="4.5" height="4" />
      <path d="M9 4.5v.1M9 6.5v.1" />
    </>
  ),
  vmc: (
    <>
      <circle cx="6" cy="6" r="4.3" />
      <path d="M6 6c0-2 1.4-3 2.4-2.2M6 6c-1.9.6-3.3-.2-2.9-1.4M6 6c1 1.8.5 3.3-.8 3.2" />
    </>
  ),
  irve_prise: (
    <>
      <path d="M2 7.5 3 4.5h6L10 7.5v2H2v-2Z" />
      <circle cx="3.8" cy="9.5" r=".9" />
      <circle cx="8.2" cy="9.5" r=".9" />
    </>
  ),
  irve_borne: (
    <>
      <rect x="3" y="1.5" width="5" height="9" rx="1" />
      <path d="M5.8 3.5 4.6 6h1.8l-1.2 2.5" />
      <path d="M8 5h1.5v4" />
    </>
  ),
  pac_clim: (
    <>
      <rect x="1.5" y="2.5" width="9" height="7" rx="1" />
      <circle cx="4.5" cy="6" r="1.8" />
      <path d="M7.5 4.5h1.5M7.5 6h1.5M7.5 7.5h1.5" />
    </>
  ),
  exterieur: (
    <>
      <path d="M6 1.5 2 7h2.5L3 10.5h6L7.5 7H10L6 1.5Z" />
    </>
  ),
  informatique: (
    <>
      <rect x="1.5" y="2" width="9" height="6" rx=".8" />
      <path d="M4 10h4M6 8v2" />
    </>
  ),
  autre: (
    <>
      <circle cx="6" cy="6" r="4.3" />
      <path d="M6 3.8v2.6M6 8.2v.1" />
    </>
  ),
  rcd: (
    <>
      <path d="M1.5 6c1.2-3 2.3-3 3.5 0s2.3 3 3.5 0 1.3-3 2 0" />
    </>
  ),
  spd: <path d="M6.6 1.5 3 7h2.6L5 10.5 9 5H6.4l.2-3.5Z" />,
  contactor: (
    <>
      <circle cx="6" cy="6" r="4.3" />
      <path d="M6 3v3l2 1.4" />
    </>
  ),
  generic: <rect x="2.5" y="2.5" width="7" height="7" rx="1" />,
  teleruptor: (
    <>
      <path d="M6 1.5v9M4 3.5 6 1.5l2 2M4 8.5l2 2 2-2" />
    </>
  ),
  chaudiere: (
    <>
      <rect x="2.5" y="1.5" width="7" height="9" rx="1" />
      <path d="M6 4.2c-1 1.3-1.4 2-1.4 2.7a1.4 1.4 0 0 0 2.8 0c0-.7-.4-1.4-1.4-2.7Z" />
      <path d="M4 9h4" />
    </>
  ),
  sdb: (
    <>
      <path d="M1.5 6.5h9v1.5a2.5 2.5 0 0 1-2.5 2.5H4A2.5 2.5 0 0 1 1.5 8V6.5Z" />
      <path d="M3 6.5V3a1.5 1.5 0 0 1 3 0" />
      <path d="M3.5 10.5l-.5 1M8.5 10.5l.5 1" />
    </>
  ),
  garage: (
    <>
      <path d="M1.5 5 6 1.8 10.5 5v5.5h-9V5Z" />
      <path d="M3.3 10.5V6.5h5.4v4M3.3 8h5.4M3.3 9.3h5.4" />
    </>
  ),
  tv: (
    <>
      <rect x="1.5" y="2" width="9" height="6.2" rx=".8" />
      <path d="M4 10.3h4M6 8.2v2.1" />
    </>
  ),
  eau: <path d="M6 1.8C4 4.5 3 6 3 7.3a3 3 0 0 0 6 0C9 6 8 4.5 6 1.8Z" />,
  poele: (
    <>
      <path d="M6 1.5c.3 1.6 2.5 2.6 2.5 5a2.5 2.5 0 0 1-5 0c0-1.2.6-1.9 1.2-2.5.1 1 .6 1.5 1.1 1.6C5.5 4.3 5.6 2.8 6 1.5Z" />
      <path d="M3 10.5h6" />
    </>
  ),
  portail: (
    <>
      <path d="M1.5 10.5V3M10.5 10.5V3M1.5 4.5h9M1.5 9h9M4.5 4.5V9M7.5 4.5V9" />
    </>
  ),
  piscine: (
    <>
      <path d="M1.5 7.5c1 0 1-.8 2.25-.8s1.25.8 2.25.8 1-.8 2.25-.8 1.25.8 2.25.8M1.5 10c1 0 1-.8 2.25-.8S5 10 6 10s1-.8 2.25-.8S9.5 10 10.5 10" />
      <path d="M4 6.2V2.5a1 1 0 0 1 2 0M8 6.2V2.5" />
    </>
  ),
  alarme: (
    <>
      <path d="M3 8.5V5.5a3 3 0 0 1 6 0v3l1 1.2H2L3 8.5Z" />
      <path d="M5 10.7a1 1 0 0 0 2 0" />
    </>
  ),
  reserve: <path d="M3 6h6" />,
};

/** Pictogrammes proposés pour les étiquettes, avec leur nom. */
export const PICTO_CHOICES: { key: string; label: string }[] = [
  { key: "eclairage", label: "Éclairage" },
  { key: "prises", label: "Prises" },
  { key: "prises_cuisine", label: "Prises cuisine" },
  { key: "volets", label: "Volets" },
  { key: "chauffage", label: "Radiateurs" },
  { key: "chauffe_eau", label: "Chauffe-eau" },
  { key: "plaque", label: "Plaque" },
  { key: "four", label: "Four" },
  { key: "lave_linge", label: "Lave-linge" },
  { key: "seche_linge", label: "Sèche-linge" },
  { key: "lave_vaisselle", label: "Lave-vaisselle" },
  { key: "congelateur", label: "Congélateur" },
  { key: "micro_ondes", label: "Micro-ondes" },
  { key: "vmc", label: "VMC" },
  { key: "irve_prise", label: "Voiture" },
  { key: "irve_borne", label: "Borne VE" },
  { key: "pac_clim", label: "PAC / clim" },
  { key: "chaudiere", label: "Chaudière" },
  { key: "poele", label: "Poêle" },
  { key: "eau", label: "Eau / adoucisseur" },
  { key: "sdb", label: "Salle de bain" },
  { key: "tv", label: "TV / multimédia" },
  { key: "informatique", label: "Informatique" },
  { key: "garage", label: "Garage" },
  { key: "portail", label: "Portail" },
  { key: "exterieur", label: "Extérieur" },
  { key: "piscine", label: "Piscine" },
  { key: "alarme", label: "Alarme" },
  { key: "teleruptor", label: "Télérupteur" },
  { key: "contactor", label: "Contacteur" },
  { key: "rcd", label: "Différentiel" },
  { key: "spd", label: "Parafoudre" },
  { key: "autre", label: "Autre" },
  { key: "reserve", label: "Réserve" },
];

export const pictoNode = (kind: string) => PICTOS[kind] ?? PICTOS.generic;

export function Picto({ kind, size = 12 }: { kind: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {pictoNode(kind)}
    </svg>
  );
}
