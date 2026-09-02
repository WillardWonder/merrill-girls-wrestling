import { createRoot } from "react-dom/client";
import { FilmRoomLayer } from "./FilmRoomLayer";

export function mountFilmRoom() {
  if (document.getElementById("merrill-film-room-root")) return;

  const root = document.createElement("div");
  root.id = "merrill-film-room-root";
  document.body.appendChild(root);

  createRoot(root).render(<FilmRoomLayer />);
}
