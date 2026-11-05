import { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const Base = ({ size = 20, children, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
)

export const TruckIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 6h11v10H3z" />
    <path d="M14 9h4l3 3v4h-7" />
    <circle cx="7" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
  </Base>
)

export const PhoneIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </Base>
)

export const ReceiptIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </Base>
)

export const LayersIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="m12 3 9 5-9 5-9-5z" />
    <path d="m3 13 9 5 9-5" />
  </Base>
)

export const ShieldIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
    <path d="m9 12 2 2 4-4" />
  </Base>
)

export const ClockIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Base>
)

export const ArrowRightIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
)

export const CheckIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="m5 12 5 5 9-10" />
  </Base>
)

export const SearchIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Base>
)

export const UserIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Base>
)

export const CartIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 4h2l2.4 11h10.2L20 8H6.2" />
    <circle cx="9" cy="19.5" r="1.4" />
    <circle cx="17" cy="19.5" r="1.4" />
  </Base>
)

export const MailIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 6h18v12H3z" />
    <path d="m3 7 9 6 9-6" />
  </Base>
)

export const PinIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12" />
    <circle cx="12" cy="9" r="2.5" />
  </Base>
)

export const PalletIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M5 4h14v10H5z" />
    <path d="M12 4v10M5 9h14" />
    <path d="M3 17h18M5 17v3M12 17v3M19 17v3" />
  </Base>
)

export const CraneIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 21V4h2v17M4 21h8" />
    <path d="M8 5h12l-3 3H8" />
    <path d="M17 8v5" />
    <path d="M15 13h4v3h-4z" />
  </Base>
)

export const HeadsetIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <path d="M4 14h3v5H5a1 1 0 0 1-1-1zM20 14h-3v5h2a1 1 0 0 0 1-1z" />
    <path d="M17 19c0 1.5-2 2-5 2" />
  </Base>
)

export const FactoryIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 21V10l6 3V10l6 3V6h6v15z" />
    <path d="M7 17h2M12 17h2M17 17h2" />
  </Base>
)

export const MenuIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
)
