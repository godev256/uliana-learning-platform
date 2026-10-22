// All interface icons share one grid, stroke weight, caps and joins.
const paths={
 hand:'M8 13V5a1.5 1.5 0 0 1 3 0v7-9a1.5 1.5 0 0 1 3 0v9-8a1.5 1.5 0 0 1 3 0v9-6a1.5 1.5 0 0 1 3 0v8c0 4-2 6-5 7h-4c-2-1-3-2-4-4l-3-4a1.5 1.5 0 0 1 2.4-1.8L8 15',
 pen:'m4 20 1-5L16 4a2.1 2.1 0 0 1 3 3L8 18l-4 2Zm10-14 3 3M4 22h16',
 highlighter:'m8 14 8-11 5 4-8 11-5-4Zm0 0-4 5 5 2 4-3M3 23h12',
 eraser:'m4 13 8-9a2 2 0 0 1 3 0l6 6a2 2 0 0 1 0 3l-7 7H9l-5-4a2 2 0 0 1 0-3Zm4-5 9 9M14 20h7',
 trash:'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6',
 crop:'M6 3v13a2 2 0 0 0 2 2h13M3 6h13a2 2 0 0 1 2 2v13',
 line:'M5 19 19 5',
 upload:'M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5',
 download:'M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4',
 figures:'m12 3 9 9-9 9-9-9 9-9Z',
 'chevron-down':'m7 10 5 5 5-5',
 'chevron-up':'m7 14 5-5 5 5',
 'chevron-right':'m10 7 5 5-5 5',
 undo:'m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12h-3',
 redo:'m16 4 5 5-5 5M21 9H10a6 6 0 0 0 0 12h3',
 plus:'M12 5v14M5 12h14',minus:'M5 12h14',close:'m6 6 12 12M18 6 6 18',
 'arrow-up':'M12 20V4m-6 6 6-6 6 6',
 'arrow-down':'M12 4v16m-6-6 6 6 6-6',
 'chevron-left':'m14 7-5 5 5 5',
 menu:'M4 6h16M4 12h16M4 18h16',
 'arrow-left':'M20 12H4m6-6-6 6 6 6',
 'arrow-right':'M4 12h16m-6-6 6 6-6 6',
 rotate:'M20 11a8 8 0 1 0-2 7M20 4v7h-7',
 file:'M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6',
 board:'M4 4h16v16H4V4Zm0 5h16M8 13h8m-8 3h5',
 grid:'M3 3h18v18H3V3Zm6 0v18m6-18v18M3 9h18M3 15h18',
 external:'M14 3h7v7m0-7L11 13M10 3H3v18h18v-7',
};
export default function BoardIcon({name,className='',...props}){
 return <svg className={`board-icon ${className}`} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}><path d={paths[name]??paths.file} vectorEffect="non-scaling-stroke"/></svg>;
}
