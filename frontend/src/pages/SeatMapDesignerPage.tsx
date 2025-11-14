// frontend/src/pages/SeatMapDesignerPage.tsx
import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

type LayoutType = "theatre" | "cabaret" | "mixed" | "blank";

interface LayoutOption {
  id: LayoutType;
  title: string;
  subtitle: string;
  description: string;
}

const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: "theatre",
    title: "Theatre",
    subtitle: "Sections & Rows",
    description:
      "Traditional rows of seats facing the stage. Ideal for theatres and auditoriums.",
  },
  {
    id: "cabaret",
    title: "Cabaret",
    subtitle: "Tables & Chairs",
    description:
      "Round or square tables with seats around them. Perfect for comedy clubs and dinners.",
  },
  {
    id: "mixed",
    title: "Mixed Layout",
    subtitle: "Sections, Rows & Tables",
    description:
      "Combine seated rows with tables and other areas for flexible, multi-use spaces.",
  },
  {
    id: "blank",
    title: "Blank Canvas",
    subtitle: "Start from scratch",
    description:
      "An empty canvas where you can manually place every section, table and object.",
  },
];

const SeatMapDesignerPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [selectedLayout, setSelectedLayout] = useState<LayoutType | null>(
    null
  );

  const handleBackToEvent = () => {
    // Adjust this path to match your existing event edit route
    navigate(`/ui/events/${eventId}/tickets`, { replace: true });
  };

  const handleContinue = () => {
    if (!selectedLayout) return;

    // For now we just move to the next step in the wizard.
    // In the next phase we'll add the configuration screen
    // (rows, sections, tables, etc.) based on selectedLayout.
    navigate(
      `/ui/events/${eventId}/seat-map/config?layout=${selectedLayout}`
    );
  };

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-50">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackToEvent}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            ← Back to event
          </button>
          <div>
            <p className="text-sm font-semibold">
              Seat Map Designer
              {eventId ? (
                <span className="ml-2 text-xs font-normal text-slate-400">
                  Event #{eventId}
                </span>
              ) : null}
            </p>
            <p className="text-xs text-slate-400">
              Choose a starting layout. You can still tweak everything later.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Step 1 of 3</span>
          <div className="flex h-1 w-24 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-1/3 bg-blue-500" />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-6">
        <div className="w-full max-w-5xl">
          <h1 className="mb-2 text-xl font-semibold text-slate-50">
            Choose a layout type
          </h1>
          <p className="mb-6 text-sm text-slate-400">
            Start from a template that matches your room. You&apos;ll be able
            to fine-tune seat counts, tables, and objects on the next screens.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {LAYOUT_OPTIONS.map((option) => {
              const isSelected = selectedLayout === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedLayout(option.id)}
                  className={[
                    "flex h-full flex-col rounded-2xl border p-4 text-left transition",
                    isSelected
                      ? "border-blue-500 bg-slate-900 shadow-lg shadow-blue-900/30"
                      : "border-slate-800 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-900",
                  ].join(" ")}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-50">
                        {option.title}
                      </p>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        {option.subtitle}
                      </p>
                    </div>
                    <div
                      className={[
                        "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                        isSelected
                          ? "border-blue-500 bg-blue-500 text-white"
                          : "border-slate-700 bg-slate-900 text-slate-400",
                      ].join(" ")}
                    >
                      {isSelected ? "✓" : option.title[0]}
                    </div>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              You can switch layouts later by starting a new version of the
              map. This won&apos;t affect tickets until you publish changes.
            </p>
            <button
              type="button"
              disabled={!selectedLayout}
              onClick={handleContinue}
              className={[
                "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-slate-950",
                selectedLayout
                  ? "bg-blue-500 text-white hover:bg-blue-400"
                  : "cursor-not-allowed bg-slate-800 text-slate-500",
              ].join(" ")}
            >
              Continue
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SeatMapDesignerPage;
