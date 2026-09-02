"""Mint a YouTube refresh token against YOUR OAuth client. Run this locally.

Why this script rather than the OAuth Playground: the Playground defaults to
Google's own client, and a token minted there fails with `invalid_grant` when
you later present it with your client id and secret. Here the same credentials
you will deploy are the ones that sign the grant, so they cannot disagree.

Requires a "Desktop app" OAuth client — that type accepts a loopback redirect,
which is what this uses.

    python daily/lib/mint_youtube_token.py \
        --client-id "…apps.googleusercontent.com" --client-secret "GOCSPX-…"

It prints the three environment variables to deploy. Run it on a machine with a
browser; it does not work in a headless container.
"""
from __future__ import annotations

import argparse
import http.server
import secrets
import socket
import sys
import threading
import urllib.parse
import webbrowser

import requests

AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN = "https://oauth2.googleapis.com/token"
# upload puts the video up; force-ssl is what lets the job post the first
# comment under it. Asking for both here means the token never has to be
# re-minted to add the comment later.
SCOPE = ("https://www.googleapis.com/auth/youtube.upload"
         " https://www.googleapis.com/auth/youtube.force-ssl")


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Catch(http.server.BaseHTTPRequestHandler):
    code: str | None = None
    state: str | None = None
    error: str | None = None

    def do_GET(self):                                    # noqa: N802
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if q.get("state", [None])[0] != Catch.state:
            Catch.error = "state mismatch — possible interference, nothing was stored"
        else:
            Catch.code = q.get("code", [None])[0]
            Catch.error = q.get("error", [None])[0]
        body = (b"<h2>Done. Close this tab and return to the terminal.</h2>"
                if Catch.code else b"<h2>Authorisation failed. Check the terminal.</h2>")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):                           # silence the default access log
        pass


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--client-id", required=True)
    ap.add_argument("--client-secret", required=True)
    a = ap.parse_args()

    port = free_port()
    redirect = f"http://127.0.0.1:{port}"
    Catch.state = secrets.token_urlsafe(24)

    url = AUTH + "?" + urllib.parse.urlencode({
        "client_id": a.client_id, "redirect_uri": redirect, "response_type": "code",
        "scope": SCOPE, "access_type": "offline", "prompt": "consent",
        "state": Catch.state})

    srv = http.server.HTTPServer(("127.0.0.1", port), Catch)
    threading.Thread(target=srv.handle_request, daemon=True).start()

    print("\nOpening your browser. Sign in as the account that owns the channel.\n")
    print(f"If nothing opens, paste this into a browser:\n\n{url}\n")
    try:
        webbrowser.open(url)
    except Exception:                                    # noqa: BLE001 — headless is fine
        pass

    for _ in range(600):                                 # ~5 minutes
        if Catch.code or Catch.error:
            break
        threading.Event().wait(0.5)
    srv.server_close()

    if Catch.error or not Catch.code:
        print(f"\nFailed: {Catch.error or 'no authorisation code received'}", file=sys.stderr)
        return 1

    r = requests.post(TOKEN, data={
        "code": Catch.code, "client_id": a.client_id, "client_secret": a.client_secret,
        "redirect_uri": redirect, "grant_type": "authorization_code"}, timeout=60)
    if r.status_code != 200:
        print(f"\nToken exchange failed [{r.status_code}]: {r.text[:400]}", file=sys.stderr)
        return 1
    tok = r.json()
    refresh = tok.get("refresh_token")
    if not refresh:
        print("\nGoogle returned no refresh token. That happens when this account has "
              "already granted this client and Google reused the old grant. Revoke it at "
              "https://myaccount.google.com/permissions and run this again.", file=sys.stderr)
        return 1

    print("\nDeploy these three:\n")
    print(f"YOUTUBE_CLIENT_ID={a.client_id}")
    print(f"YOUTUBE_CLIENT_SECRET={a.client_secret}")
    print(f"YOUTUBE_REFRESH_TOKEN={refresh}")
    print("\nIf the OAuth consent screen is still in Testing mode, this token dies in 7 "
          "days. Publish the app to make it durable.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
