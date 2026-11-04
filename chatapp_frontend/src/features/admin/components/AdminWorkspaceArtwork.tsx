const scenes = {
  overview: 'M9 56h22l9-15 12 24 16-36 12 27h43',
  rooms: 'M12 28q0-9 9-9h52q9 0 9 9v21q0 9-9 9H38L21 70V58q-9 0-9-9Zm55 38h19l15 10V66h8q9 0 9-9V41q0-9-9-9H94M29 38h35m-35 8h24',
  safety: 'M22 18h55l16 16v42H22Zm55 0v16h16M33 39h28m-28 10h19m-19 10h13M100 50v13m0 6v1',
  insights: 'M12 72h108M23 65V51h16v14m11 0V40h16v25m11 0V49h16v16m11 0V25h16v40M25 38l30-12 29 6 24-16',
  access: 'M15 72v-7c0-11 12-18 25-18s25 7 25 18v7m-12-43a13 13 0 1 1-26 0 13 13 0 0 1 26 0Zm36 15a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm8-3 22 22m-10-10-6 6m11-1-6 6',
  stickers: 'm19 37 18-19 29 6 11 25-17 23-30-6Zm46-14 27-7 25 18-2 26-25 16-21-11M37 40h.1m16 3h.1m-19 8q7 11 19 4m33-17 4 5 7-8m-2 17h8',
  'system-settings': 'M11 25h110M11 46h110M11 67h110',
} as const;

export function AdminWorkspaceArtwork({ workspace }: { workspace: keyof typeof scenes }) {
  return (
    <svg className="admin-workspace-art" viewBox="0 0 144 88" fill="none" aria-hidden="true">
      <path className="admin-workspace-art-field" d="M5 53C-1 32 35 15 63 11c34-5 75 4 77 25 2 23-29 44-61 46C47 85 10 77 5 53Z" />
      <g className="admin-workspace-art-subject" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={scenes[workspace]} />
        {workspace === 'system-settings' && <>
          <circle cx="47" cy="25" r="6" />
          <circle cx="87" cy="46" r="6" />
          <circle cx="59" cy="67" r="6" />
        </>}
        {workspace === 'safety' && <circle cx="100" cy="60" r="17" />}
      </g>
    </svg>
  );
}
