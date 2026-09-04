import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { toTitleCase } from "@/lib/utils";

const columns = [
  {
    title: toTitleCase("Product"),
    links: [
      { label: toTitleCase("Browse Groups"), to: "/communities" },
      { label: toTitleCase("Launch a Group"), to: "/create/purpose" },
      { label: toTitleCase("How It Works"), to: "/#how-it-works" },
      { label: toTitleCase("Features"), to: "/#features" },
      { label: toTitleCase("FAQ"), to: "/#faq" },
    ],
  },
  {
    title: toTitleCase("For Groups"),
    links: [
      { label: "Chamas", to: "/create?type=savings" },
      { label: "SACCOs", to: "/create?type=sacco" },
      { label: toTitleCase("Cooperatives"), to: "/create?type=cooperative" },
      { label: toTitleCase("Who It's For"), to: "/#who-its-for" },
    ],
  },
  {
    title: toTitleCase("Company"),
    links: [
      { label: toTitleCase("Evaluate a Group"), to: "/evaluate" },
      { label: "GitHub", href: "https://github.com/Build-Africa-DAO/baraza-protocol" },
      { label: toTitleCase("Sign In"), to: "/profile" },
    ],
  },
] as const;

export default function Footer() {
  return (
    <footer className="bg-background">
      <div className="page-shell py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link to="/" className="inline-flex" aria-label="Baraza Protocol home">
              <BrandLogo size="md" showIcon={false} lockup="protocol" className="mb-4" />
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Group money for chamas, SACCOs, and cooperatives. Collect dues, vote, and release funds
              where every member can see the trail. Join with a phone number — no seed phrases.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-foreground">
                {column.title}
              </h4>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {"href" in link ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.to}
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Baraza Protocol. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">Kenya, Uganda, Tanzania, Rwanda</p>
        </div>
      </div>
    </footer>
  );
}
