export const config = { matcher: "/:path*" };

export default function middleware(req) {
  const auth = req.headers.get("authorization") ?? "";

  if (auth.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const colon   = decoded.indexOf(":");
      const user    = decoded.substring(0, colon);
      const pass    = decoded.substring(colon + 1);

      const validUser = process.env.BASIC_USER ?? "admin";
      const validPass = process.env.BASIC_PASS ?? "xindus";

      if (user === validUser && pass === validPass) return; // allow through
    } catch (_) { /* bad base64 — fall through to 401 */ }
  }

  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="Xindus Dashboard"` },
  });
}
