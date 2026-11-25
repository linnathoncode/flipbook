const icons = {
  flips: (<><path fill="currentColor" d="M4 3h9.4A2.6 2.6 0 0 1 16 5.6v9.6H6a2 2 0 0 0-2 2V3Z"/><path d="M4 16.5a1.5 1.5 0 0 0 1.5 1.5H16"/><path d="M8 7h4m-4 3.5h3" stroke="var(--icon-cutout)"/></>),
  folder: (<><path d="M3 6.5a2 2 0 0 1 2-2h3l1.6 2h5.4a2 2 0 0 1 2 2v5.1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></>),
  review: (<><path d="M15.7 9a5.8 5.8 0 1 0-3 5.1L16.3 17"/><path d="M10 6.6v3.3m0 2.3h.01"/></>),
  analytics: (<><path d="M4 4v12h12M8 12v-2m4 2V7m4 5V4"/></>),
  search: (<><circle cx="8.7" cy="8.7" r="4.6"/><path d="m12.3 12.3 3.5 3.5"/></>),
  sun: (<><circle cx="10" cy="10" r="3.3"/><path d="M10 2.3v1.2m0 13v1.2M2.3 10h1.2m13 0h1.2M4.6 4.6l.9.9m9 9 .9.9m0-10.8-.9.9m-9 9-.9.9"/></>),
  moon: (<><path d="M16.7 12.2a6.8 6.8 0 0 1-8.9-8.9 6.9 6.9 0 1 0 8.9 8.9Z"/></>),
  settings: (<><path fillRule="evenodd" fill="currentColor" stroke="none" d="M8.7 2.5a1.3 1.3 0 0 1 2.6 0l.2 1.2a5.8 5.8 0 0 1 1.7.7l1-.7a1.3 1.3 0 0 1 1.8 1.8l-.7 1c.3.5.5 1.1.7 1.7l1.2.2a1.3 1.3 0 0 1 0 2.6l-1.2.2a5.8 5.8 0 0 1-.7 1.7l.7 1a1.3 1.3 0 0 1-1.8 1.8l-1-.7a5.8 5.8 0 0 1-1.7.7l-.2 1.2a1.3 1.3 0 0 1-2.6 0l-.2-1.2a5.8 5.8 0 0 1-1.7-.7l-1 .7a1.3 1.3 0 0 1-1.8-1.8l.7-1a5.8 5.8 0 0 1-.7-1.7l-1.2-.2a1.3 1.3 0 0 1 0-2.6l1.2-.2c.2-.6.4-1.2.7-1.7l-.7-1a1.3 1.3 0 0 1 1.8-1.8l1 .7c.5-.3 1.1-.5 1.7-.7l.2-1.2ZM10 7.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2Z"/></>),
  add: (<><path d="M10 3.8v12.4M3.8 10h12.4"/></>),
  export: (<><path d="M10 3.2v9.2M6.2 8.8L10 12.6l3.8-3.8M3.8 13.8v1.6a1.8 1.8 0 0 0 1.8 1.8h8.8a1.8 1.8 0 0 0 1.8-1.8v-1.6"/></>),
  filter: (<><path d="M3.4 5.6h13.2M5.8 10h8.4M8.2 14.4h3.6"/></>),
} as const;

export function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg className="ui-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {icons[name]}
    </svg>
  );
}
