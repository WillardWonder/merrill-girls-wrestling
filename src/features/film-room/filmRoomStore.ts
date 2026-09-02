import { getApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";

export type FilmProvider = "youtube" | "tiktok" | "instagram" | "vimeo" | "facebook";

export type FilmVideo = {
  id: string;
  teamId: string;
  url: string;
  provider: FilmProvider;
  title: string;
  watchFor: string;
  category: string;
  tags: string[];
  youUniversityConnection?: string;
  featured: boolean;
  status: "published";
  createdByUid: string;
  createdByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type FilmComment = {
  id: string;
  authorUid: string;
  authorName: string;
  authorRole: "athlete" | "coach" | "admin";
  text: string;
  createdAt?: unknown;
};

export type FilmMember = {
  uid: string;
  displayName: string;
  role: "athlete" | "coach" | "admin";
  teamId: string;
};

function database() {
  return getFirestore(getApp());
}

function authentication() {
  return getAuth(getApp());
}

async function waitForFirebaseApp() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (getApps().length > 0) return;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }

  throw new Error("Film Room is waiting for the app connection.");
}

function list<T>(docs: QueryDocumentSnapshot<DocumentData>[]): T[] {
  return docs.map((item) => ({ id: item.id, ...item.data() }) as T);
}

export async function waitForFilmUser(): Promise<User> {
  await waitForFirebaseApp();
  const auth = authentication();

  if (auth.currentUser) return auth.currentUser;

  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          unsubscribe();
          resolve(user);
        }
      },
      reject,
    );
  });
}

export async function loadFilmMember(): Promise<FilmMember> {
  const user = await waitForFilmUser();
  const userSnap = await getDoc(doc(database(), "users", user.uid));
  const teamId =
    (userSnap.data()?.defaultTeamId as string | undefined) ??
    "merrill-girls-wrestling";

  const memberSnap = await getDoc(doc(database(), "teams", teamId, "members", user.uid));

  if (!memberSnap.exists()) {
    throw new Error("Your team access needs a coach to check it.");
  }

  const data = memberSnap.data();
  const role = data.role as FilmMember["role"];

  if (!["athlete", "coach", "admin"].includes(role)) {
    throw new Error("Your Film Room access needs a coach to check it.");
  }

  return {
    uid: user.uid,
    displayName:
      (data.displayName as string | undefined) ??
      user.displayName ??
      "Team member",
    role,
    teamId,
  };
}

export function subscribeFilmVideos(
  teamId: string,
  onChange: (videos: FilmVideo[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(database(), "teams", teamId, "videos"),
    where("status", "==", "published"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const videos = list<FilmVideo>(snapshot.docs).sort((a, b) => {
        const aSeconds = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
        const bSeconds = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
        return bSeconds - aSeconds;
      });
      onChange(videos);
    },
    (error) => onError(error),
  );
}

export async function publishFilmVideo(
  member: FilmMember,
  input: Omit<
    FilmVideo,
    | "id"
    | "teamId"
    | "status"
    | "createdByUid"
    | "createdByName"
    | "createdAt"
    | "updatedAt"
  >,
) {
  if (member.role !== "coach" && member.role !== "admin") {
    throw new Error("Coach access is required to publish Film Room videos.");
  }

  await addDoc(collection(database(), "teams", member.teamId, "videos"), {
    ...input,
    teamId: member.teamId,
    status: "published",
    createdByUid: member.uid,
    createdByName: member.displayName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFilmVideo(member: FilmMember, videoId: string) {
  if (member.role !== "coach" && member.role !== "admin") {
    throw new Error("Coach access is required to remove a Film Room video.");
  }

  await deleteDoc(doc(database(), "teams", member.teamId, "videos", videoId));
}

export function subscribeFilmComments(
  teamId: string,
  videoId: string,
  onChange: (comments: FilmComment[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(database(), "teams", teamId, "videos", videoId, "comments"),
    orderBy("createdAt", "asc"),
  );

  return onSnapshot(
    q,
    (snapshot) => onChange(list<FilmComment>(snapshot.docs)),
    (error) => onError(error),
  );
}

export async function addFilmComment(
  member: FilmMember,
  videoId: string,
  text: string,
) {
  const clean = text.trim().slice(0, 500);
  if (!clean) return;

  await addDoc(
    collection(database(), "teams", member.teamId, "videos", videoId, "comments"),
    {
      authorUid: member.uid,
      authorName: member.displayName,
      authorRole: member.role,
      text: clean,
      createdAt: serverTimestamp(),
    },
  );
}

export async function deleteFilmComment(
  member: FilmMember,
  videoId: string,
  comment: FilmComment,
) {
  const canDelete =
    comment.authorUid === member.uid ||
    member.role === "coach" ||
    member.role === "admin";

  if (!canDelete) {
    throw new Error("A coach can help with that comment.");
  }

  await deleteDoc(
    doc(
      database(),
      "teams",
      member.teamId,
      "videos",
      videoId,
      "comments",
      comment.id,
    ),
  );
}

export async function isFilmHelpful(
  member: FilmMember,
  videoId: string,
): Promise<boolean> {
  return (
    await getDoc(
      doc(
        database(),
        "teams",
        member.teamId,
        "videos",
        videoId,
        "reactions",
        member.uid,
      ),
    )
  ).exists();
}

export async function toggleFilmHelpful(
  member: FilmMember,
  videoId: string,
  currentlyHelpful: boolean,
) {
  const ref = doc(
    database(),
    "teams",
    member.teamId,
    "videos",
    videoId,
    "reactions",
    member.uid,
  );

  if (currentlyHelpful) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, {
      uid: member.uid,
      kind: "helpful",
      createdAt: serverTimestamp(),
    });
  }
}

export async function loadSavedVideoIds(member: FilmMember): Promise<Set<string>> {
  const snapshot = await getDocs(
    collection(database(), "users", member.uid, "savedVideos"),
  );
  return new Set(snapshot.docs.map((item) => item.id));
}

export async function toggleFilmSaved(
  member: FilmMember,
  video: FilmVideo,
  currentlySaved: boolean,
) {
  const ref = doc(database(), "users", member.uid, "savedVideos", video.id);

  if (currentlySaved) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, {
      videoId: video.id,
      teamId: member.teamId,
      title: video.title,
      url: video.url,
      savedAt: serverTimestamp(),
    });
  }
}
