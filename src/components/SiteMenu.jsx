import { useEffect, useRef, useState } from "react";

export default function SiteMenu() {
  const [open, setOpen] = useState(false);
  const menu = useRef(null);
  const trigger = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "pointerdown" && menu.current?.contains(event.target)) return;
      setOpen(false);
      if (event.type === "keydown") trigger.current?.focus();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="site-menu" ref={menu}>
      <button ref={trigger} type="button" className="site-menu-toggle" aria-label="Меню сайта" aria-expanded={open} aria-controls="site-menu-links" onClick={() => setOpen(!open)}>
        <span /><span /><span />
      </button>
      {open && <nav id="site-menu-links" className="site-menu-links" aria-label="Меню сайта">
        <a href="/">Главная</a>
        <a href="/cabinet">Мой кабинет</a>
        <a href="/board">Доска <span aria-hidden="true">↗</span></a>
      </nav>}
    </div>
  );
}
