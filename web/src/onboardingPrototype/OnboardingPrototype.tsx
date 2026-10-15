// PROTOTYPE, throwaway: four first-visit onboarding variants on the real app, switched by ?onboarding=A|B|C|D
// and the bar at the bottom (local runs only). Not for main: see the prototype skill.
import { useEffect, useState, type ReactNode } from "react";
import {
  leaguesBySport,
  withAllLeagues,
  withLeague,
  isLeagueOn,
  sportSwitch,
  withSport,
  type League,
  type SportGroup,
  type ViewerSettings,
} from "../settings/viewerSettings";
import "./onboardingPrototype.css";

// The recommended one first.
const variants = {
  E: "Card, then hints",
  A: "Welcome card only",
  D: "Quiet hints only",
  B: "Annotated overlay",
  C: "Three-step tour",
} as const;
type Variant = keyof typeof variants;

export function prototypeVariant(): Variant | null {
  const value = new URLSearchParams(window.location.search).get("onboarding");
  return value && value in variants ? (value as Variant) : null;
}

interface Props {
  leagues: readonly League[];
  settings: ViewerSettings;
  onChange: (settings: ViewerSettings) => void;
  /** Whether a game panel is open: the viewer has found the score cards. */
  gameOpen: boolean;
}

export function OnboardingPrototype(props: Props) {
  const [variant, setVariant] = useState<Variant>(
    () => prototypeVariant() ?? "A",
  );
  // Bumped to show the variant again from the start.
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  // The one question the bar is asking: only its options switch; the rest stay as the URL has them.
  const topic = topics[param<Topic>("topic", topics, "shape")];
  const options = topic.options;
  const optionKeys = Object.keys(options);
  const current =
    topic.param === "onboarding"
      ? variant
      : param(topic.param, topic.options, topic.fallback);
  const restart = () => {
    setVariant(prototypeVariant() ?? "A");
    setDone(false);
    setRun((r) => r + 1);
  };
  const go = (next: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set(topic.param, next);
    window.history.replaceState(null, "", url);
    restart();
  };
  const step = (by: number) =>
    go(
      optionKeys[
        (optionKeys.indexOf(current) + by + optionKeys.length) %
          optionKeys.length
      ],
    );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).closest(
          "input, textarea, [contenteditable]",
        )
      )
        return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const finish = () => setDone(true);
  const shown = { ...props, onDone: finish };
  return (
    <>
      {!done && variant === "A" && <WelcomeCard key={run} {...shown} />}
      {!done && variant === "B" && <AnnotatedOverlay key={run} {...shown} />}
      {!done && variant === "C" && <Tour key={run} {...shown} />}
      {!done && variant === "D" && <QuietHints key={run} {...shown} />}
      {!done && variant === "E" && <CardThenHints key={run} {...shown} />}
      <div className="proto-switcher">
        <span className="proto-switcher__question">{topic.title}</span>
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous option"
        >
          ←
        </button>
        <span>
          {optionKeys.indexOf(current) + 1}/{optionKeys.length}:{" "}
          {(options as Record<string, string>)[current]}
        </span>
        <button type="button" onClick={() => step(1)} aria-label="Next option">
          →
        </button>
        <button type="button" onClick={restart}>
          Replay
        </button>
      </div>
    </>
  );
}

interface VariantProps extends Props {
  onDone: () => void;
}

/* ---------- shared bits ---------- */

const pitch =
  "Live sporting events around the globe. See what's happening in real time and where!";

function Star() {
  return (
    <svg
      className="proto-star"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

/** Q4's options, read from the URL: which choices the card offers, and how My leagues picks. */
const choiceSets = {
  a: "Three; My leagues starts none on",
  b: "Two; × means everything",
  c: "Three; My leagues starts all on",
} as const;
type ChoiceSet = keyof typeof choiceSets;
const pickers = {
  leagues: "League chips",
  sports: "Sport chips only",
  both: "Sports, then their leagues",
} as const;
type Picker = keyof typeof pickers;

/** Step 2's options: how the tour explains the rail. */
const step2Styles = {
  legend: "One card listing every button",
  groups: "A label beside each group",
  buttons: "A label beside each button",
  arrows: "Labels set apart, with arrows to the buttons",
} as const;
type Step2Style = keyof typeof step2Styles;

/** How far left of the rail the arrowed labels stand, and how far apart they are, in px. */
const arrowGap = 90;
const arrowSpacing = 40;

/**
 * Step 2 with arrows: the labels in an evenly spaced column set back from the rail, each with a
 * curved arrow to its button, so close buttons (Leagues, Colours) get labels that don't touch.
 */
function ArrowLabels({ buttons }: { buttons: DOMRect[] }) {
  const lines = railLines.slice(0, buttons.length);
  const first = buttons[0];
  const last = buttons[lines.length - 1];
  // The column centred on the rail's buttons, but spaced out evenly.
  const middle = (first.top + last.bottom) / 2;
  const top = middle - ((lines.length - 1) * arrowSpacing) / 2;
  const labelRight = first.left - arrowGap;
  return (
    <>
      <svg className="proto-arrows" aria-hidden="true">
        <defs>
          <marker
            id="proto-arrowhead"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0 10 5 0 10z" />
          </marker>
        </defs>
        {lines.map((line, i) => {
          const button = buttons[i];
          const fromX = labelRight + 6;
          const fromY = top + i * arrowSpacing;
          const toX = button.left - 6;
          const toY = button.top + button.height / 2;
          const bend = (toX - fromX) / 2;
          return (
            <path
              key={line.label}
              d={`M${fromX} ${fromY} C${fromX + bend} ${fromY}, ${toX - bend} ${toY}, ${toX} ${toY}`}
              markerEnd="url(#proto-arrowhead)"
            />
          );
        })}
      </svg>
      {lines.map((line, i) => (
        <div
          key={line.label}
          className="proto-callout proto-callout--plain"
          style={{
            top: top + i * arrowSpacing,
            right: window.innerWidth - labelRight,
          }}
        >
          <span className="proto-callout__one">{line.text}</span>
        </div>
      ))}
    </>
  );
}

/** The rail's buttons, top to bottom, with what the tour says about each. */
const railLines = [
  { label: "Zoom in", text: "Zoom in" },
  { label: "Zoom out", text: "Zoom out" },
  { label: "Home", text: "Home: back to your part of the world" },
  { label: "Live games only", text: "Live games only" },
  { label: "Show Disrupted games", text: "Show games that were called off" },
  { label: "Leagues", text: "Leagues: Top Events or your own picks" },
  { label: "Colours", text: "Colours for each sport and league" },
];

/** The rail's own icon for a button, copied from the page. */
function RailIcon({ label }: { label: string }) {
  const svg = document.querySelector(
    `.rail__button[aria-label="${label}"] svg`,
  );
  return (
    <span
      className="proto-rail-icon"
      dangerouslySetInnerHTML={{ __html: svg?.outerHTML ?? "" }}
    />
  );
}

/** The rail-cue question's options: what leads the eye from the centred panel to the rail. */
const railCues = {
  beam: "A flowing arrow from the panel to the rail",
  pulse: "The rail ripples, the panel's edge points at it",
  sweep: "Each button lights up in turn with its line",
  cone: "A beam of light from the panel onto the rail",
} as const;
type RailCue = keyof typeof railCues;

/**
 * Step 2 on the rail-cue question: the panel in the middle, listing the rail's buttons, and the
 * cue the URL picks drawing the eye from it to the rail.
 */
function RailCue({
  rail,
  buttons,
  close,
  footer,
}: {
  rail: DOMRect;
  buttons: DOMRect[];
  close: ReactNode;
  footer: ReactNode;
}) {
  const cue = param<RailCue>("cue", railCues, "beam");
  const panel = useRect(".proto-cue-panel");
  // The sweep's lit button, round and round.
  const [lit, setLit] = useState(0);
  useEffect(() => {
    if (cue !== "sweep") return;
    const timer = setInterval(
      () => setLit((i) => (i + 1) % railLines.length),
      1100,
    );
    return () => clearInterval(timer);
  }, [cue]);
  const litButton = buttons[lit];
  // From the panel's right edge, at its middle, to the rail's left edge, at its middle.
  const from = panel && { x: panel.right + 8, y: panel.top + panel.height / 2 };
  const to = { x: rail.left - 14, y: rail.top + rail.height / 2 };
  const bend = from ? (to.x - from.x) / 2 : 0;
  return (
    <>
      {cue === "beam" && from && (
        <svg className="proto-arrows proto-cue-beam" aria-hidden="true">
          <defs>
            <marker
              id="proto-beamhead"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0 0 10 5 0 10z" />
            </marker>
          </defs>
          <path
            className="proto-cue-beam__glow"
            d={`M${from.x} ${from.y} C${from.x + bend} ${from.y - 60}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`}
          />
          <path
            className="proto-cue-beam__flow"
            d={`M${from.x} ${from.y} C${from.x + bend} ${from.y - 60}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`}
            markerEnd="url(#proto-beamhead)"
          />
        </svg>
      )}
      {cue === "pulse" && (
        <>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="proto-cue-ripple"
              style={{
                top: rail.top - 8,
                left: rail.left - 8,
                width: rail.width + 16,
                height: rail.height + 16,
                animationDelay: `${i * 0.6}s`,
              }}
            />
          ))}
        </>
      )}
      {cue === "sweep" && litButton && (
        <div
          className="proto-cue-lit"
          style={{
            top: litButton.top - 3,
            left: litButton.left - 3,
            width: litButton.width + 6,
            height: litButton.height + 6,
          }}
        />
      )}
      {cue === "cone" && panel && (
        <svg className="proto-arrows proto-cue-cone" aria-hidden="true">
          <defs>
            <linearGradient id="proto-cone" x1="0" x2="1" y1="0" y2="0">
              <stop
                offset="0%"
                stopColor="var(--palette-live-main)"
                stopOpacity="0.05"
              />
              <stop
                offset="100%"
                stopColor="var(--palette-live-main)"
                stopOpacity="0.35"
              />
            </linearGradient>
          </defs>
          <polygon
            points={`${panel.right},${panel.top + 24} ${rail.left - 4},${rail.top - 4} ${rail.left - 4},${rail.bottom + 4} ${panel.right},${panel.bottom - 24}`}
            fill="url(#proto-cone)"
          />
        </svg>
      )}
      <div
        className={`proto-card proto-card--centre proto-cue-panel proto-cue-panel--${cue}`}
      >
        {close}
        <h3>Your controls</h3>
        <ul className="proto-legend">
          {railLines.map((line, i) => (
            <li
              key={line.label}
              className={cue === "sweep" && i === lit ? "proto-lit" : ""}
            >
              <RailIcon label={line.label} /> {line.text}
            </li>
          ))}
        </ul>
        {cue === "pulse" && (
          <span className="proto-cue-chevrons" aria-hidden="true">
            ›››
          </span>
        )}
        {footer}
      </div>
    </>
  );
}

/** The questions the prototype asks, one at a time (?topic=), each switching one URL parameter. */
const topics = {
  shape: {
    title: "Overall shape",
    param: "onboarding",
    options: variants as Record<string, string>,
    fallback: "A",
  },
  tour: {
    title: "The three-step tour, step by step",
    param: "onboarding",
    options: { C: "Three-step tour" } as Record<string, string>,
    fallback: "C",
  },
  step2: {
    title: "Step 2: how the rail is explained",
    param: "step2",
    options: step2Styles as Record<string, string>,
    fallback: "legend",
  },
  cue: {
    title: "Step 2: what draws the eye to the rail",
    param: "cue",
    options: railCues as Record<string, string>,
    fallback: "beam",
  },
  step3: {
    title: "Step 3: click a score card",
    param: "step3",
    options: { centred: "Centred panel, arrow to a card" } as Record<
      string,
      string
    >,
    fallback: "centred",
  },
  choices: {
    title: "Which choices the card offers",
    param: "choices",
    options: choiceSets as Record<string, string>,
    fallback: "a",
  },
  picker: {
    title: "How My leagues picks",
    param: "picker",
    options: pickers as Record<string, string>,
    fallback: "both",
  },
};
type Topic = keyof typeof topics;

function param<T extends string>(
  name: string,
  options: Record<T, unknown>,
  fallback: T,
): T {
  const value = new URLSearchParams(window.location.search).get(name);
  return value && value in options ? (value as T) : fallback;
}

/** The card's choices, as Q4's options say, then the picker inline if asked for. */
function FirstChoice({
  leagues,
  settings,
  onChange,
  onChosen,
}: Props & { onChosen: () => void }) {
  // On the picker question, the card opens straight on My leagues' picker.
  const [picking, setPicking] = useState(
    () => new URLSearchParams(window.location.search).get("topic") === "picker",
  );
  const set = param<ChoiceSet>("choices", choiceSets, "a");
  const picker = param<Picker>("picker", pickers, "both");
  if (picking) {
    const groups = leaguesBySport(leagues);
    const anyOn = leagues.some((league) => isLeagueOn(settings, league.name));
    const leagueChip = (league: League) => (
      <button
        key={league.name}
        type="button"
        className="rail-chip"
        aria-pressed={isLeagueOn(settings, league.name)}
        onClick={() =>
          onChange(
            withLeague(
              settings,
              league.name,
              !isLeagueOn(settings, league.name),
            ),
          )
        }
      >
        {league.name}
      </button>
    );
    const sportChip = (group: SportGroup) => {
      const state = sportSwitch(settings, group);
      return (
        <button
          key={group.sport}
          type="button"
          className={`rail-chip proto-sport-chip proto-sport-chip--${state}`}
          aria-pressed={state === "on"}
          onClick={() => onChange(withSport(settings, group, state !== "on"))}
        >
          {state === "mixed" ? "– " : ""}
          {group.sport}
        </button>
      );
    };
    return (
      <div className="proto-picker">
        <p className="proto-muted">
          {set === "c"
            ? "Everything is on: switch off what you don't follow."
            : picker === "sports"
              ? "Pick the sports you follow."
              : "Pick what you follow."}{" "}
          You can change this any time in Leagues on the rail.
        </p>
        {picker === "sports" && (
          <div className="proto-chips proto-sport">{groups.map(sportChip)}</div>
        )}
        {picker === "leagues" &&
          groups.map((group) => (
            <div key={group.sport} className="proto-sport">
              <span className="proto-sport__name">{group.sport}</span>
              <div className="proto-chips">{group.leagues.map(leagueChip)}</div>
            </div>
          ))}
        {picker === "both" &&
          groups.map((group) => (
            <div key={group.sport} className="proto-sport proto-sport--both">
              {sportChip(group)}
              {group.leagues.length > 1 && (
                <div className="proto-chips proto-chips--under">
                  {group.leagues.map(leagueChip)}
                </div>
              )}
            </div>
          ))}
        <button
          type="button"
          className="proto-primary"
          disabled={!anyOn}
          onClick={onChosen}
        >
          Show these
        </button>
      </div>
    );
  }
  return (
    <div className="proto-choices">
      <button
        type="button"
        className="proto-choice"
        onClick={() => {
          onChange({ ...settings, topEventsOnly: true });
          onChosen();
        }}
      >
        <Star />
        <strong>Top Events</strong>
        <span>The biggest games right now, in every sport</span>
      </button>
      <button
        type="button"
        className="proto-choice"
        onClick={() => {
          onChange({
            ...withAllLeagues(settings, leagues, set === "c"),
            topEventsOnly: false,
          });
          setPicking(true);
        }}
      >
        <strong>My leagues</strong>
        <span>Pick the sports and leagues you follow</span>
      </button>
      {set !== "b" && (
        <button
          type="button"
          className="proto-choice proto-choice--quiet"
          onClick={() => {
            onChange({
              ...withAllLeagues(settings, leagues, true),
              topEventsOnly: false,
            });
            onChosen();
          }}
        >
          <strong>Everything</strong>
          <span>Every league ScoreMap shows</span>
        </button>
      )}
      {set === "b" && (
        <p className="proto-muted proto-small">
          Or close this to see every league.
        </p>
      )}
    </div>
  );
}

/** Where an element on the page is, followed as it moves (score cards move with the globe). */
function useRect(
  selector: string,
  pick?: (elements: Element[]) => Element | undefined,
): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    const look = () => {
      const all = [...document.querySelectorAll(selector)];
      const element = pick ? pick(all) : all[0];
      setRect(element ? element.getBoundingClientRect() : null);
    };
    look();
    const timer = setInterval(look, 200);
    return () => clearInterval(timer);
  }, [selector, pick]);
  return rect;
}

/** The score card nearest the middle of the screen. */
const middleCard = (elements: Element[]) => {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  let best: Element | undefined;
  let bestD = Infinity;
  for (const element of elements) {
    const r = element.getBoundingClientRect();
    if (r.width === 0) continue;
    const d = Math.hypot(r.x + r.width / 2 - cx, r.y + r.height / 2 - cy);
    if (d < bestD) {
      bestD = d;
      best = element;
    }
  }
  return best;
};

/** The rail's three groups, as one rect each. */
function useRailGroups() {
  const zoom = useRect(".rail__group", (all) => all[0]);
  const toggles = useRect(".rail__group", (all) => all[1]);
  const menus = useRect(".rail__group", (all) => all[2]);
  return { zoom, toggles, menus };
}

/** A callout to the left of a rect, with an arrow pointing at it. */
function Callout({
  at,
  side = "left",
  children,
}: {
  at: DOMRect | null;
  side?: "left" | "below";
  children: ReactNode;
}) {
  if (!at) return null;
  const style =
    side === "left"
      ? { top: at.top + at.height / 2, right: window.innerWidth - at.left + 14 }
      : { top: at.bottom + 14, left: at.left + at.width / 2 };
  return (
    <div className={`proto-callout proto-callout--${side}`} style={style}>
      {children}
    </div>
  );
}

/* ---------- A: Welcome card ---------- */

/**
 * One card in the middle, over a dimmed globe: what ScoreMap is, the first choice, and a three-line
 * "how it works". Choosing closes it. One click, or two-plus with My leagues.
 */
function WelcomeCard({
  howTo = true,
  ...props
}: VariantProps & { howTo?: boolean }) {
  return (
    <div className="proto-scrim">
      <div
        className="proto-card proto-card--welcome"
        role="dialog"
        aria-label="Welcome to ScoreMap"
      >
        <button
          type="button"
          className="proto-close"
          aria-label="Close"
          onClick={props.onDone}
        >
          ×
        </button>
        <h2>Welcome to ScoreMap</h2>
        <p className="proto-muted">{pitch}</p>
        <h3>What would you like to see?</h3>
        <FirstChoice {...props} onChosen={props.onDone} />
        {howTo && (
          <ul className="proto-howto">
            <li>
              <span className="proto-howto__icon">▣</span> Click a{" "}
              <strong>score card</strong> for the game: last score, line, where
              to watch.
            </li>
            <li>
              <span className="proto-howto__icon">⇕</span> The{" "}
              <strong>buttons on the right</strong> zoom, take you home, filter
              games and pick colours.
            </li>
            <li>
              <span className="proto-howto__icon">✥</span> Drag to spin the
              globe, scroll to zoom.
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------- B: Annotated overlay ---------- */

/**
 * The whole screen as a labelled diagram, all at once: arrows to each rail group and to a score card,
 * and the first choice in a box on the left. Choosing (or any click on the dim) closes it.
 */
function AnnotatedOverlay(props: VariantProps) {
  const rail = useRailGroups();
  const card = useRect(".score-card", middleCard);
  return (
    <div className="proto-scrim proto-scrim--light" onClick={props.onDone}>
      <div
        className="proto-card proto-card--side"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Welcome to ScoreMap</h2>
        <p className="proto-muted">{pitch}</p>
        <h3>Start with</h3>
        <FirstChoice {...props} onChosen={props.onDone} />
        <p className="proto-muted proto-small">
          Click anywhere to start exploring.
        </p>
      </div>
      <Callout at={rail.zoom}>
        <strong>Zoom and Home</strong>
        <span>Home brings you back to your part of the world</span>
      </Callout>
      <Callout at={rail.toggles}>
        <strong>Live only · Disrupted</strong>
        <span>
          Hide games not being played right now, or show called-off ones
        </span>
      </Callout>
      <Callout at={rail.menus}>
        <strong>Leagues · Colours</strong>
        <span>Choose what shows, and colour each sport your way</span>
      </Callout>
      {card && (
        <>
          <div
            className="proto-ring"
            style={{
              top: card.top - 6,
              left: card.left - 6,
              width: card.width + 12,
              height: card.height + 12,
            }}
          />
          <Callout at={card} side="below">
            <strong>Click a score card</strong>
            <span>to open the game</span>
          </Callout>
        </>
      )}
    </div>
  );
}

/* ---------- C: Three-step tour ---------- */

/** Three short steps with a spotlight: choice, the rail, a score card. Skip at every step. */
function Tour(props: VariantProps) {
  const topicNow = new URLSearchParams(window.location.search).get("topic");
  // On a step's own question, the tour opens on that step.
  const cueMode = topicNow === "cue";
  const [step, setStep] = useState(
    topicNow === "step3" ? 2 : topicNow === "step2" || cueMode ? 1 : 0,
  );
  // On the rail-cue question, the centred panel explains the rail itself, with no labels beside it.
  const step2: Step2Style | "none" = cueMode
    ? "none"
    : param<Step2Style>("step2", step2Styles, "legend");
  const zoomGroup = useRect(".rail__group", (all) => all[0]);
  const toggleGroup = useRect(".rail__group", (all) => all[1]);
  const menuGroup = useRect(".rail__group", (all) => all[2]);
  const buttonRects =
    useRect(".rail__button", (all) => all[0]) &&
    [...document.querySelectorAll(".rail__button")].map((element) =>
      element.getBoundingClientRect(),
    );
  const railRect = useRect(".rail");
  const next = () => (step === 2 ? props.onDone() : setStep(step + 1));
  // Step 3 lights its own card (see ScoreCardStep).
  const spot = step === 1 ? railRect : null;
  // Opening a game on step 3 is the tour's last step done: it ends there.
  useEffect(() => {
    if (step === 2 && props.gameOpen) props.onDone();
  }, [step, props]);
  // Q9: no step can be closed; each moves on with its own button (Next, Done) or a choice.
  const close = null;
  const footer = (
    <div className="proto-tour__footer">
      <span className="proto-dots" />
      {step > 0 && (
        <button type="button" className="proto-primary" onClick={next}>
          {step === 2 ? "Done" : "Next"}
        </button>
      )}
    </div>
  );
  return (
    <div className="proto-tour">
      {spot ? (
        <div
          className="proto-spot"
          style={{
            top: spot.top - 8,
            left: spot.left - 8,
            width: spot.width + 16,
            height: spot.height + 16,
          }}
        />
      ) : step === 2 ? null : (
        // Q5: dimmed only lightly, so the live pins show behind the welcome.
        <div className="proto-scrim proto-scrim--faint" />
      )}
      {step === 0 && (
        // Q5, Q9: no dots, Skip or ×: the only way on is a choice.
        <div className="proto-card proto-card--welcome">
          <h2>Welcome to ScoreMap</h2>
          <p className="proto-muted">{pitch}</p>
          <h3>What would you like to see?</h3>
          <FirstChoice {...props} onChosen={() => setStep(1)} />
        </div>
      )}
      {step === 1 && railRect && step2 === "legend" && (
        <div
          className="proto-card proto-card--tip"
          style={{
            top: railRect.top,
            right: window.innerWidth - railRect.left + 20,
          }}
        >
          {close}
          <h3>Your controls</h3>
          <ul className="proto-legend">
            {railLines.map((line) => (
              <li key={line.label}>
                <RailIcon label={line.label} /> {line.text}
              </li>
            ))}
          </ul>
          {footer}
        </div>
      )}
      {step === 1 && railRect && step2 === "groups" && (
        <>
          <Callout at={zoomGroup}>
            <strong>Zoom and Home</strong>
            <span>Home brings you back to your part of the world</span>
          </Callout>
          <Callout at={toggleGroup}>
            <strong>Live only · Called-off games</strong>
            <span>
              Hide games not being played now, or show called-off ones
            </span>
          </Callout>
          <Callout at={menuGroup}>
            <strong>Leagues · Colours</strong>
            <span>Choose what shows, and colour each sport your way</span>
          </Callout>
        </>
      )}
      {step === 1 && railRect && step2 === "arrows" && buttonRects && (
        <ArrowLabels buttons={buttonRects} />
      )}
      {step === 1 &&
        railRect &&
        step2 === "buttons" &&
        (buttonRects ?? []).map((rect, i) =>
          railLines[i] ? (
            <Callout key={railLines[i].label} at={rect}>
              <span className="proto-callout__one">{railLines[i].text}</span>
            </Callout>
          ) : null,
        )}
      {step === 1 && railRect && cueMode && (
        <RailCue
          rail={railRect}
          buttons={buttonRects || []}
          close={close}
          footer={footer}
        />
      )}
      {step === 1 && railRect && step2 !== "legend" && !cueMode && (
        <div
          // Centred, where the eye already is after step 1, pointing it right to the rail.
          className="proto-card proto-card--small proto-card--centre"
        >
          {close}
          <h3>Your controls</h3>
          <p className="proto-muted">
            Everything you can change is on the right →
          </p>
          {footer}
        </div>
      )}
      {step === 2 && <ScoreCardStep close={close} footer={footer} />}
    </div>
  );
}

/* ---------- Step 3: click a score card ---------- */

type Point = { x: number; y: number };

/** The point on a box's edge facing another point: its left, right, top or bottom middle. */
function edgeToward(box: DOMRect, toward: Point, gap: number): Point {
  const dx = toward.x - (box.left + box.width / 2);
  const dy = toward.y - (box.top + box.height / 2);
  if (Math.abs(dx) / box.width > Math.abs(dy) / box.height) {
    return dx > 0
      ? { x: box.right + gap, y: box.top + box.height / 2 }
      : { x: box.left - gap, y: box.top + box.height / 2 };
  }
  return dy > 0
    ? { x: box.left + box.width / 2, y: box.bottom + gap }
    : { x: box.left + box.width / 2, y: box.top - gap };
}

const middleOf = (box: DOMRect): Point => ({
  x: box.left + box.width / 2,
  y: box.top + box.height / 2,
});

/** Step 2's flowing arrow, from one point to another, bowed a little. */
function FlowArrow({ from, to }: { from: Point; to: Point }) {
  const bow = 50;
  const path = `M${from.x} ${from.y} Q${(from.x + to.x) / 2} ${(from.y + to.y) / 2 - bow}, ${to.x} ${to.y}`;
  return (
    <svg className="proto-arrows proto-cue-beam" aria-hidden="true">
      <defs>
        <marker
          id="proto-flowhead"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0 0 10 5 0 10z" />
        </marker>
      </defs>
      <path className="proto-cue-beam__glow" d={path} />
      <path
        className="proto-cue-beam__flow"
        d={path}
        markerEnd="url(#proto-flowhead)"
      />
    </svg>
  );
}

/** The score card nearest the middle that step 3's panel leaves in view, with room round it. */
const uncoveredCard = (elements: Element[]) => {
  const panel = document
    .querySelector(".proto-step3-panel")
    ?.getBoundingClientRect();
  const clear = (r: DOMRect) =>
    !panel ||
    r.right < panel.left - 40 ||
    r.left > panel.right + 40 ||
    r.bottom < panel.top - 40 ||
    r.top > panel.bottom + 40;
  return middleCard(
    elements.filter((element) => clear(element.getBoundingClientRect())),
  );
};

/**
 * Step 3 as steps 1 and 2 are: a centred panel with × and Done. Q8: nothing moves, the globe or the
 * panel. The flowing arrow points to the score card nearest the middle that the panel leaves in
 * view, lit by the spotlight, and clicking it opens the game and ends the tour. With no such card,
 * the panel shows an example card instead.
 */
function ScoreCardStep({
  close,
  footer,
}: {
  close: ReactNode;
  footer: ReactNode;
}) {
  const panel = useRect(".proto-step3-panel");
  const card = useRect(".score-card", uncoveredCard);
  return (
    <>
      {card ? (
        <div
          className="proto-spot"
          style={{
            top: card.top - 8,
            left: card.left - 8,
            width: card.width + 16,
            height: card.height + 16,
          }}
        />
      ) : (
        <div className="proto-scrim proto-scrim--faint proto-scrim--through" />
      )}
      {card && panel && (
        <FlowArrow
          from={edgeToward(panel, middleOf(card), 8)}
          // At the card's side, level with its teams: its bottom is where its trail runs down to the pin.
          to={{
            x:
              middleOf(card).x < middleOf(panel).x
                ? card.right + 12
                : card.left - 12,
            y: middleOf(card).y,
          }}
        />
      )}
      <div className="proto-card proto-card--centre proto-cue-panel proto-step3-panel">
        {close}
        <h3>Click a score card</h3>
        <p className="proto-muted">
          {card
            ? "Try this one: it opens a panel with details for the event, venue, last score, where to watch, and more"
            : "Each game shows as a score card like this one. Click one to open the game: the last score, the betting line and where to watch."}
        </p>
        {!card && (
          <div className="proto-example" aria-label="An example score card">
            <span className="proto-example__tag">Example</span>
            <div className="proto-example__header">Q3 4:12</div>
            <div className="proto-example__team">
              <span>BOS</span>
              <b>88</b>
            </div>
            <div className="proto-example__team">
              <span>NYK</span>
              <b>84</b>
            </div>
          </div>
        )}
        {footer}
      </div>
    </>
  );
}

/* ---------- D: Quiet hints ---------- */

/**
 * Nothing in the way: a slim welcome bar at the top left with the first choice as chips, and small
 * hints by the rail and on a score card, each gone once used (or with the bar's ×).
 */
function QuietHints({
  withBar = true,
  ...props
}: VariantProps & { withBar?: boolean }) {
  const [chosen, setChosen] = useState(!withBar);
  const [railSeen, setRailSeen] = useState(false);
  const rail = useRect(".rail__group", (all) => all[2]);
  const card = useRect(".score-card", middleCard);
  const { leagues, settings, onChange, gameOpen, onDone } = props;
  // Any press on the rail counts as having found it.
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest(".rail")) setRailSeen(true);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);
  useEffect(() => {
    if (chosen && railSeen && gameOpen) onDone();
  }, [chosen, railSeen, gameOpen, onDone]);
  return (
    <>
      {!chosen && (
        <div className="proto-bar" role="status">
          <span>
            <strong>Welcome to ScoreMap.</strong> {pitch} Show:
          </span>
          <button
            type="button"
            className="rail-chip"
            onClick={() => {
              onChange({ ...settings, topEventsOnly: true });
              setChosen(true);
            }}
          >
            ★ Top Events
          </button>
          <button
            type="button"
            className="rail-chip"
            aria-pressed
            onClick={() => {
              onChange({
                ...withAllLeagues(settings, leagues, true),
                topEventsOnly: false,
              });
              setChosen(true);
            }}
          >
            Every league
          </button>
          <span className="proto-muted proto-small">
            or pick yours in Leagues →
          </span>
          <button
            type="button"
            className="proto-close proto-close--inline"
            aria-label="Close"
            onClick={onDone}
          >
            ×
          </button>
        </div>
      )}
      {!railSeen && rail && (
        <div
          className="proto-hint"
          style={{
            top: rail.top + rail.height / 2 - 12,
            right: window.innerWidth - rail.left + 10,
          }}
        >
          Choose leagues and colours here →
        </div>
      )}
      {!gameOpen && card && (
        <div
          className="proto-hint proto-hint--card"
          style={{ top: card.top - 30, left: card.left + card.width / 2 }}
        >
          Click for the game ↓
        </div>
      )}
    </>
  );
}

/* ---------- E: Card, then hints ---------- */

/**
 * A's card with only the welcome and the first choice; once chosen (or closed), D's quiet tags by the
 * rail and on a score card, each gone once used.
 */
function CardThenHints(props: VariantProps) {
  const [carded, setCarded] = useState(false);
  return carded ? (
    <QuietHints {...props} withBar={false} />
  ) : (
    <WelcomeCard {...props} howTo={false} onDone={() => setCarded(true)} />
  );
}
