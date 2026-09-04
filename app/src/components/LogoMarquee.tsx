import { Marquee } from "@/components/ui/marquee";

const logos = [
  { name: "M-Pesa", src: "/logos/mpesa.svg", wordmark: true },
  { name: "Minisend", src: "/logos/minisend.svg" },
  { name: "Stellar", src: "/logos/stellar.svg", invertOnDark: true },
  { name: "Solana", src: "/logos/solana.svg" },
  { name: "Celo", src: "/logos/celo.svg" },
  { name: "Base", src: "/logos/base.svg" },
];

export default function LogoMarquee() {
  return (
    <div className="mt-14">
      <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Rails groups already use
      </p>
      <Marquee
        pauseOnHover
        repeat={4}
        className="logo-marquee py-4 [--duration:32s] [--gap:3.5rem] [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]"
        aria-label="Partner and rail logos"
      >
        {logos.map((logo) => (
          <div
            key={logo.name}
            className="flex h-12 shrink-0 origin-center items-center gap-2.5 transition-transform duration-200 ease-out hover:z-10 hover:scale-125 motion-reduce:transition-none motion-reduce:hover:scale-100"
          >
            <img
              src={logo.src}
              alt={logo.wordmark ? logo.name : ""}
              className={logo.invertOnDark ? "h-8 w-auto dark:invert" : "h-8 w-auto"}
            />
            {!logo.wordmark && (
              <span className="text-sm font-semibold tracking-tight text-foreground">{logo.name}</span>
            )}
          </div>
        ))}
      </Marquee>
    </div>
  );
}
