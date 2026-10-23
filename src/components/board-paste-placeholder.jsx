export default function PastePlaceholder({job,scale,onRetry,onDismiss}){
 const [[x,y],[right,bottom]]=job.points,width=right-x,height=bottom-y,failed=job.status==='error',font=Math.min(14*scale,width/16),cx=x+width/2,cy=y+height/2;
 const action=(label,offset,callback)=><g role="button" tabIndex="0" aria-label={label} className="board-paste-action" transform={`translate(${cx+offset*scale},${cy+27*scale})`} onPointerDown={event=>event.stopPropagation()} onPointerUp={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();callback();}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();callback();}}}><rect x={-47*scale} width={94*scale} height={36*scale} rx={8*scale}/><text y={23*scale} textAnchor="middle" fontSize={12*scale}>{label}</text></g>;
 return <g data-pending-image={job.id} className={`board-paste-placeholder${failed?' has-error':''}`} role={failed?'alert':'status'} aria-label={failed?'Не удалось загрузить изображение':'Загружаем изображение…'} pointerEvents="none">
  <defs><clipPath id={`paste-clip-${job.id}`}><rect x={x} y={y} width={width} height={height} rx={12*scale}/></clipPath></defs>
  <rect className="board-paste-frame" x={x} y={y} width={width} height={height} rx={12*scale} vectorEffect="non-scaling-stroke"/>
  {job.preview&&<image href={job.preview} x={x} y={y} width={width} height={height} opacity=".25" style={{filter:'blur(5px)'}} clipPath={`url(#paste-clip-${job.id})`} preserveAspectRatio="xMidYMid meet"/>}
  {!failed&&<g transform={`translate(${cx},${cy-24*scale})`}><circle className="board-paste-spinner" r={10*scale} fill="none" stroke="#537361" strokeWidth={2*scale} strokeDasharray={`${42*scale} ${21*scale}`}/></g>}
  <text x={cx} y={cy+4*scale} textAnchor="middle" fontSize={font}>{failed?'Изображение не загрузилось':'Загружаем изображение…'}</text>
  {failed&&<>{action('Повторить',-52,onRetry)}{action('Убрать',52,onDismiss)}</>}
 </g>;
}
