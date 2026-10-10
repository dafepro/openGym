# Google Drive sync

Google Drive is an optional destination in **Settings → Data & backup → Cloud sync**.
It works in the browser and installed PWA, including guest mode. An openGym server
account is optional. If you also sign in to your openGym server, the merged data
continues to sync there using the existing server protocol.

Completed workout history, routines, plans, working weights, notes, body weight,
measurements, custom exercise definitions and settings sync in both directions.
The current workout stays device-local, just like server sync. Photo/video **files**
are not uploaded to Drive; their references travel with the data, but another
device needs the existing media server or a ZIP backup to obtain those files.
Keep exporting ZIP backups if you use personal media.

## Configure Google

1. In [Google Cloud Console](https://console.cloud.google.com/), create/select your
   project and enable **Google Drive API**.
2. Configure Google Auth Platform's branding/audience and create an **OAuth client
   ID** of type **Web application**. In testing mode, add your Google account(s) as
   test users. Configure the OAuth consent scope
   `https://www.googleapis.com/auth/drive.appdata`.
3. Add the app's exact origin(s) to **Authorized JavaScript origins**. For local
   development, include `http://localhost:8080` (and `http://127.0.0.1:8080` if used).
   Production must use HTTPS. Origins exclude the route/subpath.
4. In openGym, choose **Set up Google Drive**, paste the public client ID, and Save.
   Alternatively supply `VITE_GOOGLE_DRIVE_CLIENT_ID` when building the frontend.
   No client secret, API key, or server OAuth credential is needed.
5. Choose **Connect Google Drive**, select your account, and confirm the merge.
   Repeat on each device using the **same Google project/client ID and account**.

The first connection explicitly confirms the account and that local and remote
history/settings will merge. An existing connection refuses a different Google
account: disconnect first to link another. The link belongs to the local openGym
profile that was connected; switching/signing in/out pauses it. Disconnect and
reconnect to explicitly authorize a different profile's data.

Google Identity Services uses short-lived access tokens. Tokens remain in memory;
after a reload or expiry, choose **Reconnect Google Drive**. The app never opens
authorization popups in the background. Once authorized, changes sync after a
short debounce, on return/online, and every 30 seconds while the app is visible.
When offline, local saving and recovery continue and sync retries on return.
Disconnect keeps both local data and Drive data. To revoke Google's permission
as well, remove the app from your Google account's connected applications.

Only the app's private `appDataFolder` is requested; the app cannot browse your
ordinary Drive files. These app-data files are hidden in the Drive file browser.
They are not end-to-end encrypted. Google manages the account/quota/access.
This is synchronization, not a versioned backup: edits/deletions/reset propagate.

The Capacitor Android/iOS shell is not supported by this browser popup flow.
Use the browser/PWA for Drive; native shells retain server sync and local backups.
Do not configure a web OAuth client in an embedded native WebView.

If your proxy supplies a full CSP, permit `https://accounts.google.com/gsi/client`
in `script-src`, Google's OAuth frames in `frame-src`, and
`https://www.googleapis.com` in `connect-src`. If you use a strict
Cross-Origin-Opener-Policy, use Google's documented popup-compatible policy.
Google scripts are loaded only when a configured Drive section is opened.

## Provider interface and integrity

`frontend/src/lib/cloud-sync.js` contains the framework-free replication engine.
A backend supplies:

```js
read({ signal })                       // [{ id, state }] — complete immutable heads
append(state, { signal })              // create AND verify a new immutable head
compact(sourceIds, { signal })         // optional: remove only those exact read heads
```

The engine reuses openGym's existing merge rules, including per-field timestamps,
deletion/reset records and weight-unit conversions. The store applies merged data
through its existing persistence path and carries the local active workout into
the resulting unit. Edits made while fetching/uploading remain pending.
Cloud merges enable deterministic field-value tie breaking when edit timestamps
match. Missing field stamps stay zero, so an unrelated newer document/entry clock
cannot overrule an explicit field edit. The existing server/adoption merge mode
keeps its current behavior. Drive contributions are durably marked owed to the
server before persistence, including those with older clocks than its revision.

Drive lists all tagged app-data snapshots, following every page and refusing an
incomplete listing. It uploads a new uniquely named JSON file with multipart
`files.create`, downloads it again and verifies its envelope/content. Only then
does it delete the snapshots it actually read. Two devices uploading concurrently
create separate heads, so neither can overwrite the other. A later pass joins
them. A failed deletion leaves redundant heads; a failed/malformed read stops the
pass without uploading or deleting anything. Interrupted uploads may leave an
extra head, which the next pass merges and compacts. Normally one head remains.

Requests time out, never forward openGym cookies/tokens/Cloudflare headers, and
send Google tokens only to fixed Google API origins. Responses/snapshots are
capped at 5 MiB and listings at 10,000 snapshots; exceeding these limits fails
closed with local data retained. No database migration or server route is needed.
`useCloudSync` coordinates authorization, profile ownership, status and retry;
Google transport/auth stay in `lib/google-drive.js`. New snapshot backends can
replace that adapter without changing the workout store or merge rules. The
existing server's compare-and-swap transport remains unchanged.

References: [Google app-data folder](https://developers.google.com/workspace/drive/api/guides/appdata),
[browser token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model),
[OAuth setup](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid),
[uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
