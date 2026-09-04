import type { CSSProperties } from "react";

const frames = [
  { src: "/gallery/gallery-dues.jpg", alt: "Members gathered around a laptop", rotate: "-7deg", lift: "0.45rem" },
  { src: "/gallery/gallery-plan.jpg", alt: "A group planning together on a glass wall", rotate: "5deg", lift: "-0.7rem" },
  { src: "/gallery/gallery-ledger.jpg", alt: "Treasurer reviewing a shared ledger on a screen", rotate: "-3deg", lift: "0.1rem" },
  { src: "/gallery/gallery-vote.jpg", alt: "Two members checking a vote on a phone", rotate: "6deg", lift: "-0.4rem" },
  { src: "/gallery/gallery-group.jpg", alt: "Members laughing together at a desk", rotate: "-4.5deg", lift: "0.55rem" },
];

export default function PolaroidGallery() {
  return (
    <div className="mt-14 overflow-x-auto pb-6 sm:mt-16 sm:overflow-visible">
      <ul className="mx-auto flex w-max items-end justify-center px-6 sm:w-full sm:px-0">
        {frames.map((frame, index) => (
          <li
            key={frame.src}
            className="relative w-[11.5rem] shrink-0 hover:z-20 sm:w-[20%] sm:max-w-[17rem] lg:max-w-[18.5rem]"
            style={{
              zIndex: index === 2 ? 6 : index % 2 === 1 ? 4 : 2,
              marginLeft: index === 0 ? 0 : "-1.75rem",
            }}
          >
            <figure
              className="origin-center bg-white p-[0.5rem] shadow-[0_14px_32px_hsl(0_0%_0%/0.18)] transition-transform duration-300 ease-out hover:z-20 hover:scale-[1.05] dark:shadow-[0_18px_40px_hsl(0_0%_0%/0.6)] sm:p-[0.6rem] [transform:rotate(var(--r))_translateY(var(--y))] hover:[transform:rotate(0deg)_translateY(-0.55rem)_scale(1.05)]"
              style={
                {
                  "--r": frame.rotate,
                  "--y": frame.lift,
                } as CSSProperties
              }
            >
              <img
                src={frame.src}
                alt={frame.alt}
                width={360}
                height={360}
                className="aspect-square w-full object-cover"
              />
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}
