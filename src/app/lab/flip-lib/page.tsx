"use client";

/**
 * /lab/flip-lib: the passport book on the StPageFlip engine (flip-lib).
 * Eight placeholder pages built from the shared <Stamp />, to exercise the cover opening,
 * page turning, input and the imperative handle. Final page designs come from the content agent.
 */
import { useRef, useState, type ReactNode } from "react";
import PassportBook, {
  usePassportPage,
  type BookState,
  type PassportBookLibHandle,
} from "@/components/passport/engine-lib";
import { Stamp, VerifiedSeal } from "@/components/stamp";
import { ThemeSwitcher, useDirectionTokens } from "@/components/theme";
import { SAMPLE_PASSPORT, SAMPLE_PROVINCIAL, slotsByIsland } from "@/lib/sample-data";
import { formatDate, strings, t } from "@/lib/strings";
import type { Island, StampSlot } from "@/lib/types";

/* Lab copy lives in src/lib/strings.ts (TEC-12). */
const L = strings.flipLibLab;
const STATE_LABEL: Record<BookState, string> = L.states;

const P = strings.passport;

/* ------------------------------------------------------------------ */
/* Placeholder cover and pages                                         */
/* ------------------------------------------------------------------ */

function Cover() {
  const tokens = useDirectionTokens();
  const foil = tokens.cover.material === "kraft" ? "" : "foil-text";
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-between px-[8%] py-[11%] text-center">
      <span className={`type-label !text-[clamp(10px,3.1cqw,13px)] ${foil}`}>{strings.country.republic}</span>
      <div className="flex flex-col items-center gap-[1.1em]">
        <VerifiedSeal size={74} withText={false} decorative />
        <span className={`font-display text-[clamp(30px,10.5cqw,46px)] leading-[0.98] ${foil}`}>
          {P.coverTitle.split(" ").map((word) => (
            <span key={word} className="block">
              {word}
            </span>
          ))}
        </span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className={`type-label !text-[clamp(10px,3.1cqw,13px)] ${foil}`}>
          {t(strings.province.of, { province: strings.province.name })}
        </span>
        <span className="type-label !text-[9px] opacity-60">{P.tapToOpen}</span>
      </div>
    </div>
  );
}

function BackCover() {
  const tokens = useDirectionTokens();
  const foil = tokens.cover.material === "kraft" ? "" : "foil-text";
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end gap-3 px-[12%] py-[12%] text-center">
      <p className={`text-[11px] leading-relaxed opacity-80 ${foil}`}>{L.backLine}</p>
      <span className="type-label !text-[9px] opacity-60">{strings.sample.tag}</span>
    </div>
  );
}

function Endpaper() {
  return (
    <div className="absolute inset-0 flex items-end justify-start p-[9%]">
      <span className="type-label text-paper-muted opacity-70">{L.endpaper}</span>
    </div>
  );
}

function PageShell({ head, children }: { head: ReactNode; children: ReactNode }) {
  const info = usePassportPage();
  const left = info?.side === "left";
  return (
    <div className={`absolute inset-0 flex flex-col py-[6.5%] ${left ? "pl-[7%] pr-[10%]" : "pl-[10%] pr-[7%]"}`}>
      <header className="flex items-baseline justify-between gap-3 border-b border-[color:var(--paper-edge)] pb-[3.5%]">
        {head}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
      <footer className={`flex items-center justify-between ${left ? "flex-row-reverse" : ""}`}>
        <span className="sample-tag !border-[color:var(--paper-edge)] !text-paper-muted">{strings.sample.tag}</span>
        <span className="font-mono text-[11px] tracking-[0.12em] text-paper-muted">
          {String((info?.index ?? 0) + 1).padStart(2, "0")}
        </span>
      </footer>
    </div>
  );
}

function HolderPage() {
  const info = usePassportPage();
  const w = info?.width || 320;
  const h = SAMPLE_PASSPORT.holder;
  const rows: [string, string][] = [
    [P.holder, h.name],
    [P.passportNo, h.passportNo],
    [P.memberSince, formatDate(h.memberSince)],
    [strings.country.regionLabel, strings.province.name],
  ];
  return (
    <PageShell head={<h3 className="type-label text-paper-muted">{strings.country.republic}</h3>}>
      <div className="flex h-full flex-col justify-center gap-[7%]">
        <p className="font-display text-[clamp(28px,11cqw,44px)] leading-[0.98] text-paper-ink">{strings.app.name}</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="type-label !text-[9px] text-paper-muted">{label}</dt>
              <dd className="mt-0.5 truncate text-[14px] text-paper-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex justify-end">
          <Stamp stamp={SAMPLE_PROVINCIAL.stamp} variant="empty" size={Math.round(w * 0.3)} decorative />
        </div>
      </div>
    </PageShell>
  );
}

function IslandPage({ island, slots }: { island: Island; slots: StampSlot[] }) {
  const info = usePassportPage();
  const w = info?.width || 320;
  const size = Math.round(w * (slots.length > 2 ? 0.37 : 0.42));
  const held = slots.filter((s) => s.stamp).length;
  return (
    <PageShell
      head={
        <>
          <h3 className="font-display text-[clamp(20px,7.4cqw,30px)] leading-none text-paper-ink">{island.name}</h3>
          <span className="type-label !text-[9px] text-paper-muted">
            {t(P.stampsOnIsland, { n: held, total: slots.length })}
          </span>
        </>
      }
    >
      <div className="grid h-full grid-cols-2 place-items-center content-center gap-y-[5%]">
        {slots.map((slot, i) => (
          <div key={slot.id} className={slots.length === 3 && i === 2 ? "col-span-2" : ""}>
            {slot.stamp ? <Stamp stamp={slot.stamp} size={size} /> : <Stamp slot={slot} size={size} />}
          </div>
        ))}
      </div>
    </PageShell>
  );
}

function ProvincialPage() {
  const info = usePassportPage();
  const w = info?.width || 320;
  return (
    <PageShell head={<h3 className="type-label text-paper-muted">{P.provincialPage}</h3>}>
      <div className="grid h-full place-items-center">
        <Stamp stamp={SAMPLE_PROVINCIAL.stamp} size={Math.round(w * 0.66)} />
      </div>
    </PageShell>
  );
}

function NotesPage() {
  return (
    <PageShell head={<h3 className="type-label text-paper-muted">{L.notes}</h3>}>
      <div className="flex h-full flex-col justify-evenly py-[6%]">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="block h-px bg-[color:var(--paper-edge)]" />
        ))}
      </div>
    </PageShell>
  );
}

const PAGES: ReactNode[] = [
  <HolderPage key="holder" />,
  ...slotsByIsland(SAMPLE_PASSPORT).map(({ island, slots }) => (
    <IslandPage key={island.id} island={island} slots={slots} />
  )),
  <ProvincialPage key="provincial" />,
  <NotesPage key="notes" />,
];

/* ------------------------------------------------------------------ */
/* Lab page                                                            */
/* ------------------------------------------------------------------ */

type SpreadChoice = "auto" | "single" | "double";

function Btn({ children, onClick, disabled }: { children: ReactNode; onClick(): void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="type-label rounded-chip border border-line-strong bg-elev px-3.5 py-2.5 text-fg transition-opacity disabled:opacity-35"
    >
      {children}
    </button>
  );
}

export default function FlipLibLabPage() {
  const book = useRef<PassportBookLibHandle>(null);
  const [state, setState] = useState<BookState>("closed");
  const [page, setPage] = useState(0);
  const [spread, setSpread] = useState<SpreadChoice>("auto");

  const open = state === "open";

  return (
    <main className="scene-bg min-h-dvh overflow-x-clip pb-16">
      <header className="sticky top-0 z-30 border-b border-line bg-[color:color-mix(in_srgb,var(--bg)_86%,transparent)] px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-[980px] items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display truncate text-[20px] leading-none text-fg">{L.title}</h1>
            <p className="mt-1.5 flex items-center gap-2">
              <span className="sample-tag">{strings.sample.tag}</span>
              <span className="type-label !text-[9px] text-subtle">{L.engine}</span>
            </p>
          </div>
          <ThemeSwitcher variant="compact" />
        </div>
      </header>

      <PassportBook
        ref={book}
        cover={<Cover />}
        backCover={<BackCover />}
        insideCover={<Endpaper />}
        pages={PAGES}
        spread={spread}
        onFlip={setPage}
        onStateChange={setState}
      />

      <section className="mx-auto max-w-[430px] px-4">
        <div className="flex items-center justify-between gap-3">
          <p className="type-label text-muted" data-testid="book-state">
            {STATE_LABEL[state]}
          </p>
          <p className="type-label text-muted" data-testid="book-page">
            {t(P.pageOf, { page: page + 1, total: PAGES.length })}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Btn onClick={() => (open ? book.current?.close() : book.current?.open())}>{open ? P.close : P.open}</Btn>
          <Btn onClick={() => book.current?.prev()} disabled={!open}>
            {P.prevPage}
          </Btn>
          <Btn onClick={() => book.current?.next()} disabled={!open}>
            {P.nextPage}
          </Btn>
          <Btn onClick={() => book.current?.flipTo(0)} disabled={!open}>
            {L.first}
          </Btn>
          <Btn onClick={() => book.current?.flipTo(PAGES.length - 1)} disabled={!open}>
            {L.last}
          </Btn>
          <Btn onClick={() => book.current?.peek()} disabled={!open}>
            {L.hint}
          </Btn>
          <Btn onClick={() => book.current?.turnOver()} disabled={state !== "closed"}>
            {L.turnOver}
          </Btn>
        </div>

        <div className="mt-4 flex items-center gap-2" role="radiogroup" aria-label={L.spread}>
          <span className="type-label text-subtle">{L.spread}</span>
          {(
            [
              ["auto", L.spreadAuto],
              ["single", L.spreadSingle],
              ["double", L.spreadDouble],
            ] as [SpreadChoice, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={spread === value}
              onClick={() => setSpread(value)}
              className={`type-label rounded-chip px-3 py-2 ${spread === value ? "bg-accent text-accent-fg" : "border border-line text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mt-5 text-[13px] leading-relaxed text-muted">{L.intro}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-subtle">{P.swipeHint}.</p>
        <footer className="mt-8 text-[12px] leading-relaxed text-subtle">
          <p>{strings.sample.notice}</p>
          <p>{strings.sample.noDonations}</p>
        </footer>
      </section>
    </main>
  );
}
