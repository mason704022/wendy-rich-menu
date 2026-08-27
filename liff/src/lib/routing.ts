const PAGE_TO_PATH: Record<string, string> = {
  courses: "/courses",
  purchase: "/purchase",
  booking: "/booking",
  member: "/member",
  admin: "/admin",
};

/** Resolve LIFF entry URL (?page= or /path) to a client route before React Router mounts. */
export function resolveInitialRoute(): void {
  const params = new URLSearchParams(window.location.search);
  let page = params.get("page");

  if (!page) {
    page = sessionStorage.getItem("liff_entry_page");
    if (page) sessionStorage.removeItem("liff_entry_page");
  }

  if (page && PAGE_TO_PATH[page]) {
    if (window.location.pathname !== PAGE_TO_PATH[page]) {
      window.history.replaceState(null, "", PAGE_TO_PATH[page]);
    }
    return;
  }

  const segment = window.location.pathname.replace(/\/$/, "").split("/").pop() ?? "";
  if (segment && PAGE_TO_PATH[segment] && window.location.pathname !== PAGE_TO_PATH[segment]) {
    window.history.replaceState(null, "", PAGE_TO_PATH[segment]);
  }
}
