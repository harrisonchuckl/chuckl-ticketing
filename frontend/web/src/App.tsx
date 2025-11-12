import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import CreateShow from "./pages/CreateShow";
import TicketBuilder from "./pages/TicketBuilder";
import Logout from "./pages/Logout";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/events/new" replace />} />
        <Route path="/events/new" element={<CreateShow />} />
        <Route path="/events/:showId/tickets/setup" element={<TicketBuilder />} />
        <Route path="/logout" element={<Logout />} />
      </Routes>
    </BrowserRouter>
  );
}