// frontend/src/AppRouter.tsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import TicketsPage from "./pages/TicketsPage";
import SeatMapDesignerPage from "./pages/SeatMapDesignerPage";
// import other pages as needed…

const AppRouter: React.FC = () => {
  return (
    <BrowserRouter basename="/ui">
      <Routes>
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/home" replace />} />

        {/* Your existing routes */}
        <Route path="/home" element={<div>Home</div>} />
        <Route path="/events/:eventId/tickets" element={<TicketsPage />} />

        {/* New seat-map designer route */}
        <Route
          path="/events/:eventId/seat-map"
          element={<SeatMapDesignerPage />}
        />

        {/* Optional future config step */}
        {/* <Route
          path="/events/:eventId/seat-map/config"
          element={<SeatMapConfigPage />}
        /> */}

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
