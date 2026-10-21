import BoardIcon from './board-icons.jsx';
import './board-loading.css';

export default function BoardLoading({label='Открываем доску…',caption='Загружаем листы и записи'}){
 // Use a shared clock so the ring does not jump back when loading advances
 // from the session to the board list and then to the selected notebook.
 const phase=-(performance.now()%1800);
 return <div className="board-loading-screen" role="status" aria-live="polite" aria-atomic="true">
  <div className="board-loading-content">
   <svg className="board-loading-symbol" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
    <circle cx="32" cy="32" r="26" stroke="#dce7df" strokeWidth="2"/>
    <g className="board-loading-orbit" style={{animationDelay:`${phase}ms`}}><circle cx="32" cy="32" r="26" stroke="#667f70" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="48 116"/></g>
    <BoardIcon name="board" x="21" y="21" width="22" height="22" color="#2f493f"/>
   </svg>
   <p className="board-loading-title">{label}</p>
   <p className="board-loading-caption">{caption}</p>
  </div>
 </div>;
}
