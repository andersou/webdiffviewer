// TabIcon draws a sidebar tab's icon (codicon-like outlines in the text color).
const PATHS = {
  // source control: two branches merging
  changes: 'M6 3v12 M18 9a3 3 0 1 0 0-6a3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6a3 3 0 0 0 0 6z M18 9c0 6-12 3-12 9',
  // explorer: two stacked documents
  files: 'M8 3h7l4 4v11H8z M15 3v4h4 M5 7v14h11',
  // search: magnifier
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13a6.5 6.5 0 0 0 0 13z M15.2 15.2L21 21',
  // commits: a commit on a line
  commits: 'M12 15.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7z M2 12h6.5 M15.5 12H22',
}

export default function TabIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={PATHS[props.name]} />
    </svg>
  )
}
