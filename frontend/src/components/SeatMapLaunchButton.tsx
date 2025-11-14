// frontend/src/components/SeatMapLaunchButton.tsx
import React from "react";

type SeatMapLaunchButtonProps = {
  eventId: string;
  hasSeatMap: boolean;
};

const SeatMapLaunchButton: React.FC<SeatMapLaunchButtonProps> = ({
  eventId,
  hasSeatMap,
}) => {
  const handleClick = () => {
    const url = `/ui/events/${eventId}/seat-map`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            Seating map
          </p>
          {hasSeatMap ? (
            <p className="text-xs text-slate-500">
              This event already has a seating layout. Open the designer to
              make changes or create a new version.
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              No seating layout yet. Launch the designer to build a map for
              this event&apos;s tickets.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          style={{ backgroundColor: "#007bff" }} // swap for your brand blue
        >
          {hasSeatMap ? "Open Seat Map Designer" : "Create Seating Map"}
        </button>
      </div>
    </div>
  );
};

export default SeatMapLaunchButton;
