import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toTitleCase } from "@/lib/utils";

export default function CTASection() {
  return (
    <section className="py-20">
      <div className="page-shell">
        <div className="audience-band rounded-2xl bg-primary px-6 py-10 text-foreground sm:px-12 sm:py-14">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
                Start the group
              </p>
              <h2 className="mt-4 max-w-2xl font-display text-3xl font-black leading-tight md:text-5xl">
                {toTitleCase("Put the Next Contribution Where Every Member Can See It.")}
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 opacity-85 sm:text-base">
                Launch a chama, SACCO, or cooperative in minutes. Members join with a phone number and
                pay into a record they can inspect.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link to="/create/purpose">
                    Launch a Group
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/communities">Browse Groups</Link>
                </Button>
              </div>
            </div>

            <figure className="relative mx-auto w-[min(100%,28rem)] origin-center rotate-[5deg] overflow-hidden rounded-lg lg:mx-0 lg:w-full">
              <img
                src="/cta/group.jpg"
                alt="Illustrated chama collecting dues and inspecting a shared record together"
                width={1024}
                height={768}
                className="aspect-[4/3] w-full rounded-lg object-cover"
              />
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
