import { useState } from "react";
import { toTitleCase } from "@/lib/utils";

const faqs = [
  {
    question: toTitleCase("Do I Need a Crypto Wallet?"),
    answer:
      "No. Members join with a phone number, not a seed phrase and not a browser wallet. Baraza is built so a chama treasurer can send a link and let people in the same way they already collect dues: by phone. The group record is shared. Nobody has to babysit keys, recover a lost phrase, or explain a seed to someone who only wanted to pay this month’s contribution.",
  },
  {
    question: toTitleCase("How Do Members Pay?"),
    answer:
      "Paid groups collect dues in local currency. In Kenya that includes M-Pesa. On the join screen you see three lines before you pay: your dues, the 2.0% platform fee, and the 0.5% carrier fee capped at KES 200. The amount charged is the server total, not a figure typed into the page. If the group is not charging activation, join is free and those fee lines do not apply.",
  },
  {
    question: toTitleCase("Is There a Fixed Launch Fee?"),
    answer:
      "No. There is no hardcoded KES 6,500 to create or join. Create and join use the activation amount the group is actually charging. A treasurer can set that to whatever the chama or SACCO needs, including zero. When activation is zero, members join without paying. When it is not, they pay the live total shown on the join screen.",
  },
  {
    question: toTitleCase("Can a SACCO Use This?"),
    answer:
      "Yes. A SACCO can launch on Baraza, with one extra gate that a chama does not have. Before the group goes live, the launch flow asks for a license number and a public certificate URL. That check sits in front of the same dues, vote, and release tools every other group uses, so members still pay in, vote on spending, and see the same balance.",
  },
  {
    question: toTitleCase("Who Can Spend the Money?"),
    answer:
      "Nobody spends from a private chat or a treasurer-only float. A spending request becomes a proposal. Active members vote, and the group sees quorum and the outcome before any payout is allowed. Funds release only after the group’s own approval rules pass, and the trail stays on the dashboard for every member — not in a screenshot half the chama never saw.",
  },
  {
    question: toTitleCase("How Do I Start?"),
    answer:
      "Launch a group: name it, pick the type, set dues, quorum, and the vote window. Members see those rules before they join. Share the link, collect the first contribution, and run spending through a vote. If you are joining rather than starting, browse groups that are already collecting and pay in with your phone.",
  },
];

export default function FaqSection() {
  const [openQuestion, setOpenQuestion] = useState<string | null>(faqs[0].question);

  return (
    <section className="scroll-mt-20 py-20" id="faq">
      <div className="page-shell">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Questions
        </p>
        <h2 className="mx-auto mt-3 text-center font-display text-3xl font-black leading-tight text-foreground md:text-4xl">
          {toTitleCase("Talk to Us. We Always Listen.")}
        </h2>
        <div className="mx-auto mt-10 max-w-5xl divide-y divide-border border-t border-border">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group py-5"
              open={openQuestion === faq.question}
              onToggle={(event) => {
                if (event.currentTarget.open) {
                  setOpenQuestion(faq.question);
                } else if (openQuestion === faq.question) {
                  setOpenQuestion(null);
                }
              }}
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left font-display text-lg font-bold text-foreground">
                {faq.question}
                <span className="mt-1 shrink-0 text-primary transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-base leading-8 text-muted-foreground">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
