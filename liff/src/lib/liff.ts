import liff from "@line/liff";

const LIFF_ID = import.meta.env.VITE_LIFF_ID ?? "";

export interface LiffProfile {
  userId: string;
  displayName: string;
}

let profile: LiffProfile | null = null;

export async function initLiff(): Promise<LiffProfile> {
  if (!LIFF_ID) {
    profile = { userId: "dev-user", displayName: "開發測試" };
    return profile;
  }

  await liff.init({ liffId: LIFF_ID });
  if (!liff.isLoggedIn()) {
    const page = new URLSearchParams(window.location.search).get("page");
    if (page) sessionStorage.setItem("liff_entry_page", page);
    const redirectUri = `${window.location.origin}/`;
    liff.login({ redirectUri });
    throw new Error("Redirecting to LINE login");
  }

  const p = await liff.getProfile();
  profile = { userId: p.userId, displayName: p.displayName };
  return profile;
}

export function getProfile(): LiffProfile {
  if (!profile) throw new Error("LIFF not initialized");
  return profile;
}

export function closeLiff() {
  if (liff.isInClient()) liff.closeWindow();
}
