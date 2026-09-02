import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  addFilmComment,
  deleteFilmComment,
  deleteFilmVideo,
  isFilmHelpful,
  loadFilmMember,
  loadSavedVideoIds,
  publishFilmVideo,
  subscribeFilmComments,
  subscribeFilmVideos,
  toggleFilmHelpful,
  toggleFilmSaved,
  type FilmComment,
  type FilmMember,
  type FilmVideo,
} from "./filmRoomStore";
import {
  parseVideoUrl,
  providerLabel,
  youtubeThumbnail,
} from "./videoProviders";
import "./filmRoom.css";

type FilmLocation = {
  open: boolean;
  videoId?: string;
};

const CATEGORIES = [
  "Technique",
  "Match Study",
  "Neutral",
  "Top",
  "Bottom",
  "Competition",
  "Performance",
];

function readFilmLocation(): FilmLocation {
  const hash = window.location.hash;
  if (!hash.startsWith("#/app/develop")) return { open: false };

  const queryIndex = hash.indexOf("?");
  if (queryIndex < 0) return { open: false };

  const params = new URLSearchParams(hash.slice(queryIndex + 1));
  const film = params.get("film");
  const filmRoom = params.get("filmRoom");

  return {
    open: filmRoom === "1" || Boolean(film),
    videoId: film ?? undefined,
  };
}

function openFilmRoom(videoId?: string) {
  window.location.hash = videoId
    ? `#/app/develop?film=${encodeURIComponent(videoId)}`
    : "#/app/develop?filmRoom=1";
}

function closeFilmRoom() {
  window.location.hash = "#/app/develop";
}

function useFilmLocation() {
  const [location, setLocation] = useState<FilmLocation>(() => readFilmLocation());

  useEffect(() => {
    const update = () => setLocation(readFilmLocation());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  return location;
}

function FilmEmbed({ video }: { video: FilmVideo }) {
  const parsed = useMemo(() => {
    try {
      return parseVideoUrl(video.url);
    } catch {
      return undefined;
    }
  }, [video.url]);

  if (parsed?.provider === "youtube" && parsed.youtubeId) {
    return (
      <div className="film-embed">
        <iframe
          title={video.title}
          src={`https://www.youtube-nocookie.com/embed/${parsed.youtubeId}?rel=0`}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  if (parsed?.provider === "vimeo" && parsed.vimeoId) {
    return (
      <div className="film-embed">
        <iframe
          title={video.title}
          src={`https://player.vimeo.com/video/${parsed.vimeoId}`}
          loading="lazy"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <a
      className="film-external-preview"
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="film-provider">{providerLabel(video.provider)}</span>
      <strong>Watch video</strong>
      <span>Opens on {providerLabel(video.provider)}</span>
    </a>
  );
}

function FilmActions({
  member,
  video,
  savedIds,
  setSavedIds,
}: {
  member: FilmMember;
  video: FilmVideo;
  savedIds: Set<string>;
  setSavedIds: (next: Set<string>) => void;
}) {
  const [helpful, setHelpful] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void isFilmHelpful(member, video.id).then(setHelpful);
  }, [member, video.id]);

  const saved = savedIds.has(video.id);

  async function changeHelpful() {
    if (busy) return;
    setBusy(true);
    try {
      await toggleFilmHelpful(member, video.id, helpful);
      setHelpful(!helpful);
    } finally {
      setBusy(false);
    }
  }

  async function changeSaved() {
    if (busy) return;
    setBusy(true);
    try {
      await toggleFilmSaved(member, video, saved);
      const next = new Set(savedIds);
      if (saved) next.delete(video.id);
      else next.add(video.id);
      setSavedIds(next);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const deepLink = `${window.location.origin}${window.location.pathname}#/app/develop?film=${encodeURIComponent(video.id)}`;
    const data = {
      title: video.title,
      text: `Film Room: ${video.title}`,
      url: deepLink,
    };

    if (navigator.share) {
      await navigator.share(data);
      return;
    }

    await navigator.clipboard.writeText(deepLink);
  }

  return (
    <div className="film-actions">
      <button
        type="button"
        className={helpful ? "film-action active" : "film-action"}
        onClick={changeHelpful}
        disabled={busy}
      >
        {helpful ? "Helpful" : "Mark helpful"}
      </button>
      <button
        type="button"
        className={saved ? "film-action active" : "film-action"}
        onClick={changeSaved}
        disabled={busy}
      >
        {saved ? "Saved" : "Save"}
      </button>
      <button type="button" className="film-action" onClick={share}>
        Share
      </button>
      <button
        type="button"
        className="film-action"
        onClick={() => openFilmRoom(video.id)}
      >
        Discuss
      </button>
    </div>
  );
}

function FilmCard({
  member,
  video,
  savedIds,
  setSavedIds,
}: {
  member: FilmMember;
  video: FilmVideo;
  savedIds: Set<string>;
  setSavedIds: (next: Set<string>) => void;
}) {
  const thumbnail = youtubeThumbnail(video.url);

  return (
    <article className="film-card">
      <button
        type="button"
        className="film-card-media"
        onClick={() => openFilmRoom(video.id)}
        aria-label={`Open ${video.title}`}
      >
        {thumbnail ? (
          <img src={thumbnail} alt="" />
        ) : (
          <div className="film-card-placeholder">
            <span>{providerLabel(video.provider)}</span>
          </div>
        )}
        <span className="film-play">WATCH</span>
      </button>

      <div className="film-card-body">
        <div className="film-meta-row">
          <span>{video.category}</span>
          <span>{providerLabel(video.provider)}</span>
          {video.featured ? <strong>Coach pick</strong> : null}
        </div>

        <h3>{video.title}</h3>

        <div className="film-watch-for">
          <span>WATCH FOR</span>
          <p>{video.watchFor}</p>
        </div>

        {video.youUniversityConnection ? (
          <p className="film-connection">
            YOU University: {video.youUniversityConnection}
          </p>
        ) : null}

        {video.tags.length ? (
          <div className="film-tags">
            {video.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}

        <FilmActions
          member={member}
          video={video}
          savedIds={savedIds}
          setSavedIds={setSavedIds}
        />
      </div>
    </article>
  );
}

function CoachAddVideo({ member }: { member: FilmMember }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [watchFor, setWatchFor] = useState("");
  const [category, setCategory] = useState("Technique");
  const [tags, setTags] = useState("");
  const [connection, setConnection] = useState("");
  const [featured, setFeatured] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    try {
      const parsed = parseVideoUrl(url);

      if (!title.trim()) {
        setMessage("Add a short title athletes will recognize.");
        return;
      }

      if (!watchFor.trim()) {
        setMessage("Add one clear thing for athletes to watch.");
        return;
      }

      setBusy(true);

      await publishFilmVideo(member, {
        url: parsed.url,
        provider: parsed.provider,
        title: title.trim().slice(0, 120),
        watchFor: watchFor.trim().slice(0, 320),
        category,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 8),
        youUniversityConnection: connection.trim().slice(0, 120) || undefined,
        featured,
      });

      setUrl("");
      setTitle("");
      setWatchFor("");
      setTags("");
      setConnection("");
      setFeatured(false);
      setMessage("Published to the team.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Check the video details and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="film-coach-panel">
      <button
        type="button"
        className="film-primary-button"
        onClick={() => setOpen(!open)}
      >
        {open ? "Close video form" : "Add video"}
      </button>

      {open ? (
        <form className="film-form" onSubmit={submit}>
          <div className="film-form-intro">
            <span>COACH CURATION</span>
            <h3>Give the team a video and a job.</h3>
            <p>
              Point athletes toward one or two observable details. Specific cues
              help turn watching into learning.
            </p>
          </div>

          <label>
            Video link
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Paste YouTube, TikTok, Instagram, Vimeo, or Facebook URL"
              inputMode="url"
              required
            />
          </label>

          <label>
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Sweep single: turn the corner"
              required
            />
          </label>

          <label>
            What should athletes watch for?
            <textarea
              value={watchFor}
              onChange={(event) => setWatchFor(event.target.value)}
              placeholder="Watch her outside foot and how she keeps moving through the finish."
              rows={3}
              required
            />
          </label>

          <div className="film-form-grid">
            <label>
              Category
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {CATEGORIES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label>
              Tags
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="single leg, finish, feet"
              />
            </label>
          </div>

          <label>
            Connect to YOU University
            <input
              value={connection}
              onChange={(event) => setConnection(event.target.value)}
              placeholder="Optional, for example: Week 6, Self-talk"
            />
          </label>

          <label className="film-check">
            <input
              type="checkbox"
              checked={featured}
              onChange={(event) => setFeatured(event.target.checked)}
            />
            <span>Feature as a Coach Pick</span>
          </label>

          {message ? <p className="film-form-message">{message}</p> : null}

          <button type="submit" className="film-primary-button" disabled={busy}>
            {busy ? "Publishing..." : "Publish to team"}
          </button>
        </form>
      ) : null}
    </section>
  );
}

function FilmDiscussion({
  member,
  video,
  savedIds,
  setSavedIds,
}: {
  member: FilmMember;
  video: FilmVideo;
  savedIds: Set<string>;
  setSavedIds: (next: Set<string>) => void;
}) {
  const [comments, setComments] = useState<FilmComment[]>([]);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    return subscribeFilmComments(
      member.teamId,
      video.id,
      setComments,
      () => setMessage("The discussion is reconnecting."),
    );
  }, [member.teamId, video.id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;

    try {
      await addFilmComment(member, video.id, text);
      setText("");
      setMessage("");
    } catch {
      setMessage("Your comment is ready to try again.");
    }
  }

  async function removeComment(comment: FilmComment) {
    await deleteFilmComment(member, video.id, comment);
  }

  async function removeVideo() {
    const confirmed = window.confirm(
      "Remove this video and its team discussion from Film Room?",
    );
    if (!confirmed) return;

    await deleteFilmVideo(member, video.id);
    openFilmRoom();
  }

  return (
    <div className="film-detail">
      <div className="film-detail-top">
        <button type="button" className="film-back" onClick={() => openFilmRoom()}>
          Back to Film Room
        </button>
        {member.role === "coach" || member.role === "admin" ? (
          <button type="button" className="film-remove" onClick={removeVideo}>
            Remove video
          </button>
        ) : null}
      </div>

      <div className="film-detail-heading">
        <div className="film-meta-row">
          <span>{video.category}</span>
          <span>{providerLabel(video.provider)}</span>
          {video.featured ? <strong>Coach pick</strong> : null}
        </div>
        <h2>{video.title}</h2>
        <div className="film-watch-for">
          <span>WATCH FOR</span>
          <p>{video.watchFor}</p>
        </div>
      </div>

      <FilmEmbed video={video} />

      <FilmActions
        member={member}
        video={video}
        savedIds={savedIds}
        setSavedIds={setSavedIds}
      />

      <section className="film-discussion">
        <div className="film-section-heading">
          <span>TEAM FILM TALK</span>
          <h3>What did you notice?</h3>
          <p>
            Keep it specific. Position, timing, setup, finish, reaction, or one
            detail you want to try.
          </p>
        </div>

        <form onSubmit={submit} className="film-comment-form">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="I noticed..."
            aria-label="Add a Film Room comment"
          />
          <div className="film-comment-submit">
            <span>{text.length}/500</span>
            <button type="submit" className="film-primary-button">
              Add to discussion
            </button>
          </div>
        </form>

        {message ? <p className="film-inline-message">{message}</p> : null}

        <div className="film-comments">
          {comments.length === 0 ? (
            <div className="film-empty">
              <strong>Start the film conversation.</strong>
              <span>Share one detail you saw.</span>
            </div>
          ) : (
            comments.map((comment) => {
              const canRemove =
                comment.authorUid === member.uid ||
                member.role === "coach" ||
                member.role === "admin";

              return (
                <article key={comment.id} className="film-comment">
                  <div>
                    <strong>{comment.authorName}</strong>
                    {comment.authorRole !== "athlete" ? (
                      <span className="film-coach-badge">Coach</span>
                    ) : null}
                  </div>
                  <p>{comment.text}</p>
                  {canRemove ? (
                    <button
                      type="button"
                      onClick={() => void removeComment(comment)}
                    >
                      Remove
                    </button>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function FilmRoom({
  member,
  location,
}: {
  member: FilmMember;
  location: FilmLocation;
}) {
  const [videos, setVideos] = useState<FilmVideo[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState("All");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadSavedVideoIds(member).then(setSavedIds);
    return subscribeFilmVideos(
      member.teamId,
      setVideos,
      () => setMessage("Film Room is reconnecting."),
    );
  }, [member]);

  const selected = location.videoId
    ? videos.find((video) => video.id === location.videoId)
    : undefined;

  const visible = videos
    .filter((video) => category === "All" || video.category === category)
    .sort((a, b) => Number(b.featured) - Number(a.featured));

  if (location.videoId && selected) {
    return (
      <FilmDiscussion
        member={member}
        video={selected}
        savedIds={savedIds}
        setSavedIds={setSavedIds}
      />
    );
  }

  return (
    <>
      <header className="film-hero">
        <button type="button" className="film-close" onClick={closeFilmRoom}>
          Back to Develop
        </button>
        <span className="film-eyebrow">MERRILL FILM ROOM</span>
        <h1>Watch with a job.</h1>
        <p>Notice one useful detail. Talk about it. Take it to the mat.</p>
      </header>

      {member.role === "coach" || member.role === "admin" ? (
        <CoachAddVideo member={member} />
      ) : null}

      <nav className="film-filters" aria-label="Film Room categories">
        {["All", ...CATEGORIES].map((item) => (
          <button
            type="button"
            key={item}
            className={category === item ? "active" : ""}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      {message ? <p className="film-inline-message">{message}</p> : null}

      <section className="film-grid">
        {visible.length === 0 ? (
          <div className="film-empty film-empty-large">
            <strong>Film Room is ready for the first video.</strong>
            <span>Coach-curated film will appear here.</span>
          </div>
        ) : (
          visible.map((video) => (
            <FilmCard
              key={video.id}
              member={member}
              video={video}
              savedIds={savedIds}
              setSavedIds={setSavedIds}
            />
          ))
        )}
      </section>
    </>
  );
}

function FilmRoomEntryCard() {
  return (
    <section className="film-entry-card">
      <div>
        <span className="film-eyebrow">FILM ROOM</span>
        <h2>See it. Notice it. Try it.</h2>
        <p>
          Coach-picked technique, match film, and performance clips with one
          clear thing to watch for.
        </p>
      </div>
      <button
        type="button"
        className="film-primary-button"
        onClick={() => openFilmRoom()}
      >
        Open Film Room
      </button>
    </section>
  );
}

export function FilmRoomLayer() {
  const location = useFilmLocation();
  const [member, setMember] = useState<FilmMember | null>(null);
  const [message, setMessage] = useState("");
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);

  useEffect(() => {
    void loadFilmMember()
      .then(setMember)
      .catch(() =>
        setMessage("Film Room will be ready after team access loads."),
      );
  }, []);

  useEffect(() => {
    const findTarget = () => {
      const hash = window.location.hash;
      if (!hash.startsWith("#/app/develop") || location.open) {
        setPortalTarget(null);
        return;
      }

      const target =
        document.querySelector("main") ??
        document.querySelector(".app-main") ??
        document.querySelector("[role='main']");

      setPortalTarget(target);
    };

    const frame = window.requestAnimationFrame(findTarget);
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [location.open]);

  if (location.open) {
    return (
      <div
        className="film-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Film Room"
      >
        <main className="film-room-shell">
          {member ? (
            <FilmRoom member={member} location={location} />
          ) : (
            <div className="film-loading">
              <strong>Opening Film Room</strong>
              <span>{message || "Loading team film..."}</span>
            </div>
          )}
        </main>
      </div>
    );
  }

  if (
    portalTarget &&
    member &&
    window.location.hash.startsWith("#/app/develop")
  ) {
    return createPortal(<FilmRoomEntryCard />, portalTarget);
  }

  return null;
}
