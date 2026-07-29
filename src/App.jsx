import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * ЗАГЛУШКИ. Заменить на реальные данные — см. ДАННЫЕ-ОТ-УЛЬЯНЫ.md.
 * Пока ready = false, форма не отправляет заявку, а показывает честное уведомление.
 */
const CONTACTS = {
  ready: false,
  telegram: "https://t.me/uliana_math_placeholder",
  vk: "https://vk.com/uliana_math_placeholder",
};

const CONSENT_DOCUMENT = {
  title: "СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ",
  publishedDate: "21.07.2026",
  intro:
    "Я, заполняя форму на сайте и ставя галочку, даю согласие Самозанятой Куликовой Ульяне Дмитриевне на обработку моих персональных данных и данных моего несовершеннолетнего ребёнка.",
  sections: [
    {
      title: "Перечень данных",
      text: "ФИО родителя (законного представителя), контактный номер телефона, адрес электронной почты, имя и класс (возраст) ребёнка, а также иные данные, которые я сообщу в ходе переписки или устного общения для организации занятий.",
    },
    {
      title: "Цель обработки",
      text: "Запись на диагностику, заключение и исполнение договора на оказание консультационных услуг по математике (репетиторство), связь по организационным вопросам, отправка чеков.",
    },
    {
      title: "Способы обработки",
      text: "Сбор, запись, систематизация, накопление, хранение, уточнение, использование, удаление, уничтожение как с использованием средств автоматизации (компьютер, телефон), так и без их использования (бумажные записи).",
    },
    {
      title: "Срок хранения",
      text: "3 года с момента окончания занятий для целей бухгалтерского учёта и разрешения возможных споров. По истечении срока данные уничтожаются.",
    },
    {
      title: "Передача третьим лицам",
      text: "Не осуществляется, за исключением случаев, прямо предусмотренных законодательством РФ.",
    },
    {
      title: "Отзыв согласия",
      text: "Согласие можно отозвать в любое время, направив письменное заявление на электронную почту: uliana.kylikova@yandex.ru. В этом случае обработка данных прекращается, а данные уничтожаются в течение 30 календарных дней.",
    },
  ],
  outro:
    "Настоящее согласие действует с момента отправки формы на сайте до истечения срока хранения данных.",
  operator: {
    name: "Самозанятая Куликова Ульяна Дмитриевна",
    inn: "760211618932",
    email: "uliana.kylikova@yandex.ru",
  },
};

/**
 * Секция отзывов скрыта на публичном сайте.
 *
 * Тексты в массиве `reviews` ниже написаны при разработке, а не учениками: имена и результаты
 * («3 → 5», «выросла на 21 балл») выдуманы. Публиковать их как настоящие отзывы нельзя —
 * родители принимают по ним решение о деньгах и о ребёнке.
 *
 * Возвращаем в true, когда Ульяна пришлёт реальные отзывы с согласием на публикацию
 * (см. ДАННЫЕ-ОТ-УЛЬЯНЫ.md, блокер №3).
 */
const SHOW_REVIEWS = false;

const navItems = [
  { id: "start", label: "СТАРТ" },
  { id: "about", label: "ОБО МНЕ" },
  { id: "method", label: "МЕТОД" },
  { id: "format", label: "ФОРМАТ" },
  ...(SHOW_REVIEWS ? [{ id: "reviews", label: "ОТЗЫВЫ" }] : []),
  { id: "pricing", label: "ТАРИФЫ" },
  { id: "faq", label: "ВОПРОСЫ" },
  { id: "contact", label: "ЗАПИСЬ" },
];

const heroProof = [
  { value: "80%", label: "учеников выходят на «5»" },
  { value: "более 3 лет", label: "работаю с учениками" },
  { value: "Онлайн", label: "доска и конспекты" },
];

const aboutFacts = [
  {
    label: "ОБРАЗОВАНИЕ",
    title: "МОСКОВСКИЙ АВИАЦИОННЫЙ ИНСТИТУТ",
    copy: "Информатика и вычислительная техника, бакалавриат 2026 года.",
  },
  {
    label: "ОПЫТ",
    title: "БОЛЕЕ 3 ЛЕТ",
    copy: "Школьники с 7 по 11 класс: подготовка к экзаменам, вытягивание текущих тем и возвращение уверенности в предмете.",
  },
];

const roadmapSteps = [
  {
    number: "01",
    title: "ИНДИВИДУАЛЬНОЕ ЗАДАНИЕ",
    copy: "Перед диагностикой ребёнок получает небольшое задание под свой уровень и цель.",
  },
  {
    number: "02",
    title: "БЕСПЛАТНАЯ ДИАГНОСТИКА",
    copy: "На встрече знакомимся, разбираем ошибки в задании и видим, где нужна опора.",
  },
  {
    number: "03",
    title: "ПЛАН ДЕЙСТВИЙ",
    copy: "Исходя из ошибок строим маршрут: темы, темп, домашняя работа и ближайшая цель.",
  },
  {
    number: "04",
    title: "ПЕРВЫЕ УРОКИ",
    copy: "Собираем базу: понятные алгоритмы, самостоятельные решения и аккуратное оформление.",
  },
  {
    number: "05",
    title: "ОБРАТНАЯ СВЯЗЬ РОДИТЕЛЮ",
    copy: "Раз в месяц отправляю родителю подробный отчёт: что прошли, как меняется уровень, над чем работаем дальше и что стоит поддержать дома. Родитель видит прогресс и мои рекомендации.",
  },
  {
    number: "06",
    title: "ЭКЗАМЕН",
    copy: "Через срезы знаний, корректировку плана и экзаменационную стратегию идём к хорошему результату.",
  },
];

const formatCards = [
  {
    label: "ГДЕ",
    title: "ОНЛАЙН, НА ИНТЕРАКТИВНОЙ ДОСКЕ",
    copy: "Все занятия проходят на платформе с общей доской: мы пишем и решаем на ней вместе, как за одним столом.",
  },
  {
    label: "МАТЕРИАЛЫ",
    title: "КОНСПЕКТЫ ОСТАЮТСЯ НА ПЛАТФОРМЕ",
    copy: "Схемы, разборы и опорные алгоритмы хранятся там же. Ученик в любой момент открывает нужный урок и возвращается к нему.",
  },
  {
    label: "ДЛИТЕЛЬНОСТЬ",
    title: "60 МИНУТ",
    copy: "Часа хватает на разбор, практику и фиксацию следующего шага.",
  },
  {
    label: "КЛАССЫ",
    title: "С 7 ПО 11",
    copy: "Школьная программа, ОГЭ в 9 классе, профильная математика в 10 классе и базовая в 11.",
  },
  {
    label: "ДОМАШНЯЯ РАБОТА",
    title: "ЧЁТКОЕ ЗАДАНИЕ",
    copy: "После урока остаётся понятная домашняя работа без случайных задач и лишней нагрузки.",
  },
  {
    label: "КОНТРОЛЬ",
    title: "РАЗБОР ОШИБОК",
    copy: "Ошибки не копятся: каждую превращаем в проверочное правило и следующий навык.",
  },
];

/**
 * ЗАГЛУШКИ. Тексты написаны нами, не учениками.
 * Заменить на реальные отзывы до публикации сайта — см. ДАННЫЕ-ОТ-УЛЬЯНЫ.md.
 */
const reviews = [
  {
    name: "Мария",
    meta: "ОГЭ · 9 класс",
    result: "3 → 5",
    text: "Пришла с постоянными ошибками во второй части. Ульяна разложила темы по шагам, и стало понятно, что именно тренировать дома. На пробниках появился спокойный темп и меньше случайных ошибок.",
  },
  {
    name: "София",
    meta: "ЕГЭ, профиль · 11 класс",
    result: "выросла на 21 балл",
    text: "Больше всего помогло, что на уроках не просто давали формулы, а учили видеть логику задачи. Я стала увереннее объяснять ход решения и перестала теряться в новых номерах.",
  },
  {
    name: "Алина",
    meta: "Школьная база · 8 класс",
    result: "3 → 4",
    text: "После нескольких занятий ушёл страх перед контрольными. Домашние задания были короткими и точными, поэтому я понимала, зачем делаю каждое упражнение и где у меня слабое место.",
  },
  {
    name: "Ольга",
    meta: "Мама ученика · 9 класс",
    result: "ОГЭ на 5",
    text: "Впервые получаю обратную связь после каждого занятия: что прошли, что задано, где сын проседает. Раньше я узнавала о проблемах из дневника, а теперь понимаю картину заранее.",
  },
  {
    name: "Полина",
    meta: "ОГЭ · 9 класс",
    result: "4 → 5",
    text: "Диагностика сразу показала пробелы, а дальше был понятный план. Уроки проходили спокойно, с разбором ошибок, и к экзамену я подошла без ощущения хаоса.",
  },
  {
    name: "Екатерина",
    meta: "Алгебра · 8 класс",
    result: "3 → 5",
    text: "Ульяна быстро нашла, где не хватает базы, и объяснила материал нормальным языком. Оценки стали стабильнее, а главное - ребёнок начал решать самостоятельно, без угадывания.",
  },
];

const pricingPlans = [
  {
    name: "РАЗОВЫЙ УРОК",
    rhythm: "ИНДИВИДУАЛЬНОЕ ЗАНЯТИЕ",
    price: "1 600 ₽",
    unit: "за 60 минут",
    description:
      "Оплата после урока. Подходит, если нужно начать спокойно и без обязательств.",
    features: [
      "60 минут занятия",
      "разбор текущей темы",
      "домашнее задание после урока",
    ],
  },
  {
    name: "ГРУППА 2 ЧЕЛОВЕКА",
    rhythm: "ЗАНИМАЕТЕСЬ ВДВОЁМ",
    price: "1 000 ₽",
    unit: "с одного человека за 60 минут",
    description:
      "Приведите друга и занимайтесь в паре: та же программа и та же доска, только вдвоём.",
    features: [
      "2 человека близкого уровня",
      "60 минут занятия на общей доске",
      "разбор задач и вопросов на двоих",
    ],
  },
  {
    name: "ГРУППА 3–4 ЧЕЛОВЕКА",
    rhythm: "МИНИ-ГРУППА С ДРУЗЬЯМИ",
    price: "800 ₽",
    unit: "с одного человека за 60 минут",
    description:
      "Соберите компанию из трёх-четырёх друзей и занимайтесь вместе.",
    features: [
      "3–4 человека близкого уровня",
      "60 минут занятия на общей доске",
      "разбор задач и вопросов на всех",
      "800 ₽ с каждого",
    ],
    badge: "ПРИВЕДИ ДРУЗЕЙ",
  },
];

const tariffOptions = pricingPlans.map((plan) => ({
  value: `${plan.name} (${plan.price})`,
  label: `${plan.name} (${plan.price})`,
}));

const faqItems = [
  {
    q: "КАК ПРОХОДЯТ ЗАНЯТИЯ?",
    a: "Онлайн, на платформе с интерактивной доской. Мы пишем и решаем на ней вместе - ученик не просто смотрит, а работает руками. Все конспекты, схемы и разборы остаются на платформе, к ним можно вернуться в любой момент.",
  },
  {
    q: "С КАКИМИ КЛАССАМИ ВЫ РАБОТАЕТЕ?",
    a: "С 7 по 11 класс. По договорённости - с 5 и 6 классом. Школьная программа, подготовка к ОГЭ в 9 классе, профильная математика в 10 классе и базовая в 11.",
  },
  {
    q: "СКОЛЬКО ДЛИТСЯ УРОК?",
    a: "60 минут. Часа хватает на разбор, практику и фиксацию следующего шага.",
  },
  {
    q: "МОЖНО ЛИ ЗАНИМАТЬСЯ ВДВОЁМ С ДРУГОМ?",
    a: "Да. Можно заниматься в паре - 1 000 ₽ с человека, или собрать мини-группу из 3–4 человек близкого уровня - 800 ₽ с человека. Программа та же, всё на общей доске. Приведите друзей и учитесь в комфортной компании.",
  },
  {
    q: "ЧТО, ЕСЛИ МЫ НЕ ПОДОЙДЁМ ДРУГ ДРУГУ?",
    a: "Для этого и нужна бесплатная диагностика. На ней мы знакомимся, разбираем задание и смотрим, комфортно ли работать вместе. Она ни к чему не обязывает: если после неё вы не захотите продолжать, это нормально.",
  },
  {
    q: "ВИДИТ ЛИ РОДИТЕЛЬ, ЧТО ПРОИСХОДИТ НА УРОКАХ?",
    a: "Да. Раз в месяц я отправляю родителю подробный отчёт: что прошли, как меняется уровень ребёнка, над чем работаем дальше и что стоит поддержать дома. Родитель понимает картину и получает мои рекомендации заранее.",
  },
];

const goalOptions = [
  "ОГЭ, 9 класс",
  "ЕГЭ, профиль",
  "ЕГЭ, база",
  "Школьная программа",
  "Пока не решили",
];

function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    const nodes = ids.map((id) => document.getElementById(id)).filter(Boolean);

    if (!nodes.length || !("IntersectionObserver" in window)) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target.id) {
          setActive(visible.target.id);
        }
      },
      { rootMargin: "-35% 0px -45% 0px", threshold: [0.12, 0.28, 0.52] },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

function getMotion(shouldReduceMotion) {
  if (shouldReduceMotion) {
    return {
      initial: false,
      whileInView: {},
      viewport: {},
      transition: { duration: 0 },
    };
  }

  return {
    initial: { opacity: 0, y: 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
  };
}

function cardMotion(shouldReduceMotion, index) {
  return {
    initial: shouldReduceMotion ? false : { opacity: 0, y: 18 },
    whileInView: shouldReduceMotion ? {} : { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: {
      duration: 0.68,
      delay: shouldReduceMotion ? 0 : index * 0.06,
      ease: [0.16, 1, 0.3, 1],
    },
  };
}

function SectionIntro({ titleId, eyebrow, title, copy }) {
  return (
    <div className="grid max-w-[820px] gap-23">
      <p className="micro-label text-ash">{eyebrow}</p>
      <h2
        id={titleId}
        className="display text-[24px] leading-[1.28] tracking-[0.05em] text-obsidian-ink lg:text-h2 lg:leading-h2"
      >
        {title}
      </h2>
      {copy ? (
        <p className="max-w-[64ch] text-body leading-body text-obsidian-ink/82">
          {copy}
        </p>
      ) : null}
    </div>
  );
}

function SectionCta({ children = "ЗАПИСАТЬСЯ НА БЕСПЛАТНУЮ ДИАГНОСТИКУ" }) {
  return (
    <div className="mt-63">
      <a className="section-cta" href="#contact">
        {children}
        <span aria-hidden="true">→</span>
      </a>
    </div>
  );
}

function Card({ children, className = "", ...rest }) {
  return (
    <motion.article
      className={`rounded-[8px] border border-sage/25 bg-bone p-28 ${className}`}
      {...rest}
    >
      {children}
    </motion.article>
  );
}

function ReviewsCarousel({ shouldReduceMotion }) {
  const [activeReview, setActiveReview] = useState(0);

  const visibleReviews = Array.from({ length: 3 }, (_, offset) => {
    const reviewIndex = (activeReview + offset) % reviews.length;
    return { ...reviews[reviewIndex], reviewIndex };
  });

  const goToPrevious = () =>
    setActiveReview(
      (current) => (current - 1 + reviews.length) % reviews.length,
    );
  const goToNext = () =>
    setActiveReview((current) => (current + 1) % reviews.length);

  return (
    <div className="mt-63">
      <div className="mb-28 flex justify-end">
        <div className="flex items-center gap-9">
          <button
            type="button"
            className="flex h-[50px] w-[50px] items-center justify-center rounded-full border border-sage-dark bg-transparent text-body leading-none text-sage-dark transition-colors hover:bg-mist"
            onClick={goToPrevious}
            aria-label="Предыдущий отзыв"
            data-review-prev
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            className="flex h-[50px] w-[50px] items-center justify-center rounded-full border border-sage-dark bg-sage-dark text-body leading-none text-bone transition-colors hover:bg-obsidian-ink"
            onClick={goToNext}
            aria-label="Следующий отзыв"
            data-review-next
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Отзыв {activeReview + 1} из {reviews.length}
      </p>

      <motion.div
        key={activeReview}
        className="grid gap-18 md:grid-cols-3"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
        animate={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      >
        {visibleReviews.map((review, position) => (
          <figure
            key={`${review.name}-${review.reviewIndex}`}
            className={`m-0 flex flex-col rounded-[8px] border border-sage/25 bg-bone p-28 ${
              position > 0 ? "hidden md:flex" : ""
            }`}
            data-review-card
          >
            <div className="flex items-center gap-18">
              <span
                className="display flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full border border-sage/35 text-h3 leading-none text-sage-dark"
                aria-hidden="true"
              >
                {review.name[0]}
              </span>
              <figcaption>
                <p className="display text-label leading-label tracking-label text-obsidian-ink">
                  {review.name}
                </p>
                <p className="mt-9 text-body-sm leading-none text-pebble">
                  {review.meta}
                </p>
              </figcaption>
            </div>

            <p className="micro-label mt-23 text-clay">{review.result}</p>

            <blockquote className="m-0 mt-23 border-0 p-0 text-body-sm leading-body-sm text-obsidian-ink/82">
              {review.text}
            </blockquote>
          </figure>
        ))}
      </motion.div>

      <div
        className="mt-34 flex justify-center"
        aria-label="Навигация по отзывам"
      >
        {reviews.map((review, index) => (
          <button
            key={review.name}
            type="button"
            className="flex h-[44px] w-[24px] items-center justify-center"
            onClick={() => setActiveReview(index)}
            aria-label={`Показать отзыв ${index + 1}`}
            aria-current={index === activeReview ? "true" : undefined}
          >
            <span
              className={`block h-8 rounded-full transition-[width,background-color,border-color] ${
                index === activeReview
                  ? "w-[34px] bg-sage-dark"
                  : "w-8 border border-sage bg-transparent"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function ConsentModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-ink/55 px-23 py-34"
      role="presentation"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-modal-title"
        className="grid max-h-[80vh] w-full max-w-[560px] gap-23 overflow-y-auto rounded-[8px] border border-sage/25 bg-bone p-34"
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-start justify-between gap-18">
          <h2
            id="consent-modal-title"
            className="display max-w-[440px] text-h3 leading-h3 tracking-[0.04em] text-obsidian-ink"
          >
            {CONSENT_DOCUMENT.title}
          </h2>
          <button
            type="button"
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-sage/40 text-body leading-none text-sage-dark transition-colors hover:bg-mist"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="grid gap-18 text-body-sm leading-body-sm text-obsidian-ink/82">
          <p>{CONSENT_DOCUMENT.intro}</p>

          {CONSENT_DOCUMENT.sections.map((section) => (
            <p key={section.title}>
              <strong className="text-obsidian-ink">{section.title}.</strong>{" "}
              {section.text}
            </p>
          ))}

          <p>{CONSENT_DOCUMENT.outro}</p>

          <p className="text-pebble">
            Дата публикации: {CONSENT_DOCUMENT.publishedDate}
          </p>

          <div className="border-t border-sage/20 pt-18">
            <p className="micro-label mb-9 text-ash">РЕКВИЗИТЫ ОПЕРАТОРА</p>
            <p>{CONSENT_DOCUMENT.operator.name}</p>
            <p>ИНН: {CONSENT_DOCUMENT.operator.inn}</p>
            <p>Email: {CONSENT_DOCUMENT.operator.email}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function BookingForm() {
  const [status, setStatus] = useState("idle");
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    const message = [
      "Заявка на бесплатную диагностику",
      `Имя: ${data.get("name")}`,
      `Класс: ${data.get("grade")}`,
      `Цель: ${data.get("goal")}`,
      `Контакт: ${data.get("contact")}`,
    ].join("\n");

    if (!CONTACTS.ready) {
      // TODO: как появится рабочий телеграм — выставить CONTACTS.ready = true.
      console.info(`Заявка собрана, отправка пока не подключена:\n${message}`);
      setStatus("pending");
      return;
    }

    window.open(
      `${CONTACTS.telegram}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener",
    );
    setStatus("sent");
  };

  const note = {
    pending:
      "Форма собрана верно. Отправка подключится, когда появится рабочий телеграм.",
    sent: "Открываю телеграм - останется нажать «Отправить».",
    idle: "Отвечаю в течение дня.",
  }[status];

  return (
    <>
      <form className="grid gap-34" onSubmit={handleSubmit}>
        <div className="grid gap-28 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="name">
              Как вас зовут
            </label>
            <input
              className="field-input"
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              placeholder="Имя"
            />
          </div>

          <div>
            {/* id не должен совпадать с id секции #contact — иначе якорь ведёт в поле. */}
            <label className="field-label" htmlFor="lead-contact">
              Телефон или телеграм
            </label>
            <input
              className="field-input"
              id="lead-contact"
              name="contact"
              type="text"
              required
              autoComplete="tel"
              placeholder="+7 900 000-00-00 или @nickname"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="grade">
              Класс
            </label>
            <select
              className="field-input"
              id="grade"
              name="grade"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Выберите класс
              </option>
              {[5, 6, 7, 8, 9, 10, 11].map((grade) => (
                <option key={grade} value={`${grade} класс`}>
                  {grade} класс
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="goal">
              Цель
            </label>
            <select
              className="field-input"
              id="goal"
              name="goal"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Выберите цель
              </option>
              {goalOptions.map((goal) => (
                <option key={goal} value={goal}>
                  {goal}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-start gap-14 text-body-sm leading-body-sm text-obsidian-ink/82">
          <input
            className="mt-4 h-[18px] w-[18px] shrink-0 accent-sage-dark"
            type="checkbox"
            name="consent"
            required
          />
          <span>
            Согласен(-на) на{" "}
            <button
              type="button"
              className="text-sage-dark underline underline-offset-4"
              onClick={() => setIsConsentModalOpen(true)}
            >
              обработку персональных данных
            </button>
            .
          </span>
        </label>

        <div className="grid justify-items-start gap-18">
          <button className="pill-link pill-link--solid" type="submit">
            ЗАПИСАТЬСЯ НА БЕСПЛАТНУЮ ДИАГНОСТИКУ{" "}
            <span aria-hidden="true">→</span>
          </button>

          <p
            aria-live="polite"
            className="text-body-sm leading-body-sm text-pebble"
          >
            {note}
          </p>
        </div>
      </form>

      <ConsentModal
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
      />
    </>
  );
}

/**
 * Прежде чем платить, нужно понять, за кого именно платят: без имени и класса
 * оплата приходит "от неизвестного" и её не с чем сопоставить. Форма собирает
 * эти два поля и передаёт их мне в Telegram — дальше я отвечаю плательщику
 * персональной ссылкой на оплату.
 */
/**
 * ЗАГЛУШКА без реального платёжного бэкенда: заявка уходит мне в Telegram,
 * дальше связываюсь с плательщиком сама (или менеджер) и присылаю оплату вручную.
 * Когда подключим реальный эквайринг — сюда встанет редирект на платёжную страницу
 * и обработка вебхука об оплате на бэкенде.
 */
function PaymentModal({ isOpen, onClose }) {
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    const message = [
      "Хочу оплатить занятие",
      `ФИО ребёнка: ${data.get("childName")}`,
      `Тариф: ${data.get("tariff")}`,
    ].join("\n");

    if (!CONTACTS.ready) {
      // TODO: как появится рабочий телеграм — выставить CONTACTS.ready = true.
      console.info(
        `Заявка на оплату собрана, отправка пока не подключена:\n${message}`,
      );
      setStatus("pending");
      return;
    }

    window.open(
      `${CONTACTS.telegram}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener",
    );
    setStatus("sent");
  };

  const note = {
    pending:
      "Заявка собрана. Отправка подключится, когда появится рабочий телеграм.",
    sent: "Открываю телеграм - дальше с вами свяжется Ульяна или менеджер.",
  }[status];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-ink/55 px-23 py-34"
      role="presentation"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        className="w-full max-w-[420px] rounded-[8px] border border-sage/25 bg-bone p-34"
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-start justify-between gap-18">
          <h2
            id="payment-modal-title"
            className="display text-h3 leading-h3 tracking-[0.04em] text-obsidian-ink"
          >
            Оплатить занятие
          </h2>
          <button
            type="button"
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-sage/40 text-body leading-none text-sage-dark transition-colors hover:bg-mist"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <form className="mt-28 grid gap-23" onSubmit={handleSubmit}>
          <div>
            <label className="field-label" htmlFor="childName">
              ФИО ребёнка
            </label>
            <input
              className="field-input"
              id="childName"
              name="childName"
              type="text"
              required
              autoComplete="name"
              placeholder="Фамилия Имя"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="tariff">
              Тариф
            </label>
            <select
              className="field-input"
              id="tariff"
              name="tariff"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Выберите тариф
              </option>
              {tariffOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button className="pill-link pill-link--solid" type="submit">
            ОТПРАВИТЬ ЗАЯВКУ <span aria-hidden="true">→</span>
          </button>

          {note ? (
            <p
              aria-live="polite"
              className="text-body-sm leading-body-sm text-pebble"
            >
              {note}
            </p>
          ) : null}
        </form>
      </motion.div>
    </div>
  );
}

function App() {
  const shouldReduceMotion = useReducedMotion();
  const activeSection = useActiveSection(
    useMemo(() => navItems.map((item) => item.id), []),
  );
  const reveal = getMotion(shouldReduceMotion);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas text-obsidian-ink">
      <a className="skip-link" href="#main-content">
        К основному содержанию
      </a>

      <main id="main-content" tabIndex="-1">
        {/* ── СТАРТ ──────────────────────────────────────────────── */}
        <section
          id="start"
          className="grid grid-cols-1 lg:min-h-screen lg:grid-cols-2"
          aria-labelledby="hero-title"
        >
          <motion.figure
            className="relative m-0 min-h-[58vh] overflow-hidden bg-sage-dark lg:min-h-screen"
            initial={
              shouldReduceMotion ? false : { clipPath: "inset(0 18% 0 0)" }
            }
            animate={shouldReduceMotion ? {} : { clipPath: "inset(0 0% 0 0)" }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.picture
              className="block h-full w-full"
              initial={shouldReduceMotion ? false : { scale: 1.05 }}
              animate={shouldReduceMotion ? {} : { scale: 1 }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <source
                type="image/avif"
                srcSet="/hero-640.avif 640w, /hero-960.avif 960w, /hero-1254.avif 1254w"
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
              <source
                type="image/webp"
                srcSet="/hero-640.webp 640w, /hero-960.webp 960w, /hero-1254.webp 1254w"
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
              <img
                src="/hero-960.jpg"
                srcSet="/hero-640.jpg 640w, /hero-960.jpg 960w, /hero-1254.jpg 1254w"
                sizes="(min-width: 1024px) 50vw, 100vw"
                width="1254"
                height="1254"
                fetchPriority="high"
                decoding="async"
                alt="Ульяна, репетитор по математике, в белой рубашке у светлой стены"
                className="h-full min-h-[58vh] w-full object-cover object-[54%_50%] lg:min-h-screen"
              />
            </motion.picture>
          </motion.figure>

          <div className="relative flex min-h-screen flex-col px-23 py-34 sm:px-34 lg:px-63">
            <div className="flex items-start justify-between gap-23">
              <a
                href="#start"
                className="display text-label leading-label tracking-label text-obsidian-ink no-underline"
              >
                УЛЬЯНА
                <span className="mt-9 block text-pebble">МАТЕМАТИКА</span>
              </a>
              <p className="micro-label text-right text-pebble">
                ОНЛАЙН · 7–11 КЛАСС
              </p>
            </div>

            <motion.div
              className="flex flex-1 flex-col items-start justify-center gap-28 py-63 text-left"
              initial={shouldReduceMotion ? false : "hidden"}
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: { staggerChildren: 0.11, delayChildren: 0.2 },
                },
              }}
            >
              <motion.p
                className="micro-label text-clay"
                variants={{
                  hidden: { opacity: 0, y: 18 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                БЕСПЛАТНАЯ ДИАГНОСТИКА · ОНЛАЙН
              </motion.p>

              <motion.h1
                id="hero-title"
                className="display max-w-[640px] text-[32px] leading-[1.2] tracking-[0.04em] text-obsidian-ink sm:text-[38px] lg:text-h1 lg:leading-h1"
                variants={{
                  hidden: { opacity: 0, y: 18 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                Подготовка к ОГЭ и ЕГЭ
              </motion.h1>

              <motion.p
                className="max-w-[540px] text-lead leading-lead text-obsidian-ink/82"
                variants={{
                  hidden: { opacity: 0, y: 18 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                Начинаем с бесплатной диагностики: нахожу настоящие пробелы и
                показываю маршрут до экзамена. Занятия - онлайн на интерактивной
                доске, конспекты остаются у ученика.
              </motion.p>

              <motion.div
                className="grid gap-14"
                variants={{
                  hidden: { opacity: 0, y: 18 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex flex-wrap gap-11">
                  <a className="pill-link pill-link--solid" href="#contact">
                    ЗАПИСАТЬСЯ НА ДИАГНОСТИКУ <span aria-hidden="true">→</span>
                  </a>
                  <button
                    type="button"
                    className="pill-link"
                    onClick={() => setIsPaymentModalOpen(true)}
                  >
                    ОПЛАТИТЬ ЗАНЯТИЕ
                  </button>
                </div>
                <p className="text-body-sm leading-none text-pebble">
                  Первая встреча ни к чему не обязывает · оплата - для тех, кто
                  уже занимается
                </p>
              </motion.div>
            </motion.div>

            <motion.dl
              className="m-0 grid grid-cols-3 gap-18 border-t border-sage/25 pt-28"
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={shouldReduceMotion ? {} : { opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.75 }}
            >
              {heroProof.map((item) => (
                <div key={item.label}>
                  <dt className="sr-only">{item.label}</dt>
                  <dd className="m-0">
                    <span className="display block text-stat leading-stat tracking-[0.02em] text-sage-dark">
                      {item.value}
                    </span>
                    <span className="mt-9 block text-body-sm leading-[1.35] text-pebble">
                      {item.label}
                    </span>
                  </dd>
                </div>
              ))}
            </motion.dl>
          </div>
        </section>

        {/* ── ОБО МНЕ ────────────────────────────────────────────── */}
        <section
          id="about"
          className="px-23 pb-96 pt-144 sm:px-34 lg:px-63"
          aria-labelledby="about-title"
        >
          <motion.div {...reveal}>
            <div className="grid gap-63 lg:grid-cols-[0.42fr_1fr] lg:gap-72">
              <div>
                <p className="micro-label text-ash">ОБО МНЕ</p>
                <h2
                  id="about-title"
                  className="display mt-23 max-w-[440px] text-[24px] leading-[1.28] tracking-[0.05em] lg:text-h2 lg:leading-h2"
                >
                  Кто будет заниматься с вашим ребёнком
                </h2>
              </div>

              <div className="grid gap-18 md:grid-cols-2">
                {aboutFacts.map((fact, index) => (
                  <Card
                    key={fact.label}
                    {...cardMotion(shouldReduceMotion, index)}
                  >
                    <p className="micro-label mb-34 text-clay">{fact.label}</p>
                    <h3 className="display text-h3 leading-h3 tracking-[0.04em] text-sage-dark">
                      {fact.title}
                    </h3>
                    <p className="mt-18 text-body-sm leading-body-sm text-obsidian-ink/82">
                      {fact.copy}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── МЕТОД ──────────────────────────────────────────────── */}
        <section
          id="method"
          className="px-23 pb-96 sm:px-34 lg:px-63"
          aria-labelledby="method-title"
        >
          <motion.div {...reveal}>
            <SectionIntro
              titleId="method-title"
              eyebrow="МЕТОДИКА"
              title="Дорожная карта от знакомства до экзамена"
              copy="Ребёнок всегда знает, что мы делаем сейчас и зачем. Родитель - тоже."
            />
          </motion.div>

          <div className="mt-63 grid gap-18 md:grid-cols-2 xl:grid-cols-3">
            {roadmapSteps.map((step, index) => (
              <Card
                key={step.number}
                className="relative overflow-hidden"
                {...cardMotion(shouldReduceMotion, index)}
              >
                <span
                  className="absolute inset-x-0 top-0 h-4 bg-sage"
                  aria-hidden="true"
                />
                <span className="mb-34 flex items-center gap-18">
                  {/* sage-dark, а не sage: белое на #667f70 даёт 4.34:1 и не проходит AA. */}
                  <span className="display flex h-[38px] w-[38px] items-center justify-center rounded-full bg-sage-dark text-caption leading-caption tracking-caption text-bone">
                    {step.number}
                  </span>
                  <span className="h-px flex-1 bg-sage/25" aria-hidden="true" />
                </span>
                <h3 className="display text-h3 leading-h3 tracking-[0.04em] text-sage-dark">
                  {step.title}
                </h3>
                <p className="mt-18 text-body-sm leading-body-sm text-obsidian-ink/82">
                  {step.copy}
                </p>
              </Card>
            ))}
          </div>

          <SectionCta />
        </section>

        {/* ── ФОРМАТ ─────────────────────────────────────────────── */}
        <section
          id="format"
          className="px-23 pb-96 sm:px-34 lg:px-63"
          aria-labelledby="format-title"
        >
          <motion.div {...reveal}>
            <SectionIntro
              titleId="format-title"
              eyebrow="ФОРМАТ"
              title="Как устроены занятия"
              copy="Урок устроен так, чтобы ученик понимал, что делаем сейчас, что тренируем дома и как это приближает к цели."
            />
          </motion.div>

          <div className="mt-63 grid gap-18 md:grid-cols-2 xl:grid-cols-3">
            {formatCards.map((card, index) => (
              <Card key={card.title} {...cardMotion(shouldReduceMotion, index)}>
                <span className="micro-label mb-34 inline-flex rounded-full border border-clay-light/60 px-14 py-11 text-clay">
                  {card.label}
                </span>
                <h3 className="display text-h3 leading-h3 tracking-[0.04em] text-sage-dark">
                  {card.title}
                </h3>
                <p className="mt-18 text-body-sm leading-body-sm text-obsidian-ink/82">
                  {card.copy}
                </p>
              </Card>
            ))}
          </div>

          <SectionCta />
        </section>

        {/* ── ОТЗЫВЫ ─── скрыто до появления настоящих, см. SHOW_REVIEWS ─── */}
        {SHOW_REVIEWS ? (
          <section
            id="reviews"
            className="px-23 pb-96 sm:px-34 lg:px-63"
            aria-labelledby="reviews-title"
          >
            <motion.div {...reveal}>
              <SectionIntro
                titleId="reviews-title"
                eyebrow="ОТЗЫВЫ"
                title="Что говорят ученики и родители"
                copy="Разные стартовые ситуации: подготовка к экзамену, восстановление базы и спокойная работа с ошибками."
              />
            </motion.div>

            <ReviewsCarousel shouldReduceMotion={shouldReduceMotion} />
            <SectionCta />
          </section>
        ) : null}

        {/* ── ТАРИФЫ ─────────────────────────────────────────────── */}
        <section
          id="pricing"
          className="px-23 pb-96 sm:px-34 lg:px-63"
          aria-labelledby="pricing-title"
        >
          <motion.div {...reveal}>
            <SectionIntro
              titleId="pricing-title"
              eyebrow="ТАРИФЫ"
              title="Индивидуально или в мини-группе с друзьями"
              copy="Диагностика бесплатна. Дальше - как удобнее: заниматься один на один или собрать мини-группу из друзей и платить меньше."
            />
          </motion.div>

          <div className="mt-63 grid gap-18 md:grid-cols-2 lg:grid-cols-3">
            {pricingPlans.map((plan, index) => (
              <motion.article
                key={plan.name}
                className={`relative grid content-between rounded-[8px] border p-34 ${
                  plan.badge
                    ? "on-dark border-sage-dark bg-sage-dark text-bone"
                    : "border-sage/25 bg-bone text-obsidian-ink"
                }`}
                {...cardMotion(shouldReduceMotion, index)}
              >
                <div>
                  {plan.badge ? (
                    <span className="micro-label mb-23 inline-flex rounded-full border border-bone/40 px-14 py-11 text-bone">
                      {plan.badge}
                    </span>
                  ) : null}

                  <p
                    className={`micro-label ${plan.badge ? "text-bone/72" : "text-pebble"}`}
                  >
                    {plan.rhythm}
                  </p>

                  <h3 className="display mt-18 text-h3 leading-h3 tracking-[0.06em]">
                    {plan.name}
                  </h3>

                  <p
                    className={`mt-23 max-w-[46ch] text-body-sm leading-body-sm ${
                      plan.badge ? "text-bone/82" : "text-obsidian-ink/82"
                    }`}
                  >
                    {plan.description}
                  </p>

                  <ul className="mt-34 grid list-none gap-14 p-0">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className={`border-t pt-14 text-body-sm leading-[1.45] ${
                          plan.badge
                            ? "border-bone/25 text-bone/88"
                            : "border-sage/20 text-obsidian-ink/82"
                        }`}
                      >
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-43">
                  <div className="flex flex-wrap items-baseline gap-x-14 gap-y-9">
                    <span
                      className="display text-price leading-price"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {plan.price}
                    </span>

                    {plan.oldPrice ? (
                      <>
                        {/* /68, а не /55: на 18px нужен контраст 4.5:1, /55 даёт только 4.14. */}
                        <span className="display text-lead leading-none text-bone/68 line-through">
                          {plan.oldPrice}
                        </span>
                        <span className="micro-label rounded-full border border-bone/40 px-11 py-9 text-bone">
                          {plan.discount}
                        </span>
                      </>
                    ) : null}
                  </div>

                  <p
                    className={`mt-14 text-body-sm leading-none ${
                      plan.badge ? "text-bone/72" : "text-pebble"
                    }`}
                  >
                    {plan.unit}
                  </p>

                  {/* TODO: подключить оплату (СБП / ЮKassa). Пока ведём на запись. */}
                  <motion.a
                    className={`display mt-28 inline-flex min-h-[54px] w-full items-center justify-center rounded-full border px-23 py-14 text-label leading-label tracking-label no-underline transition-colors ${
                      plan.badge
                        ? "border-bone/50 text-bone hover:bg-bone hover:text-sage-dark"
                        : "border-sage-dark bg-sage-dark text-bone hover:bg-obsidian-ink"
                    }`}
                    href="#contact"
                    whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                  >
                    ЗАПИСАТЬСЯ НА ДИАГНОСТИКУ
                  </motion.a>
                </div>
              </motion.article>
            ))}
          </div>

          <p className="mt-28 text-body-sm leading-body-sm text-pebble">
            Оплата - после первого урока. Диагностика бесплатна.
          </p>
        </section>

        {/* ── ВОПРОСЫ ────────────────────────────────────────────── */}
        <section
          id="faq"
          className="px-23 pb-96 sm:px-34 lg:px-63"
          aria-labelledby="faq-title"
        >
          <motion.div {...reveal}>
            <SectionIntro
              titleId="faq-title"
              eyebrow="ВОПРОСЫ"
              title="Частые вопросы"
              copy="Если чего-то здесь нет - просто спросите, отвечу честно."
            />
          </motion.div>

          <motion.div className="mt-63 max-w-[900px]" {...reveal}>
            {faqItems.map((item) => (
              <details className="faq-item" key={item.q}>
                <summary>{item.q}</summary>
                <p className="faq-answer">{item.a}</p>
              </details>
            ))}
          </motion.div>

          <SectionCta />
        </section>

        {/* ── ЗАПИСЬ ─────────────────────────────────────────────── */}
        <section
          id="contact"
          className="px-23 pb-96 sm:px-34 lg:px-63"
          aria-labelledby="contact-title"
        >
          <motion.div
            className="grid gap-63 lg:grid-cols-[0.8fr_1fr] lg:gap-96"
            {...reveal}
          >
            <div>
              <p className="micro-label text-ash">ЗАПИСЬ</p>
              <h2
                id="contact-title"
                className="display mt-23 max-w-[420px] text-[24px] leading-[1.28] tracking-[0.05em] lg:text-h2 lg:leading-h2"
              >
                Начнём с бесплатной диагностики?
              </h2>
              <p className="mt-23 max-w-[44ch] text-body leading-body text-obsidian-ink/82">
                На первой встрече знакомимся с ребёнком, разбираем задание,
                определяем текущий уровень и выстраиваем план действий. Это
                бесплатно.
              </p>

              <div className="mt-43">
                <p className="micro-label mb-18 text-ash">
                  ИЛИ НАПИШИТЕ НАПРЯМУЮ
                </p>
                {/* TODO: заменить на реальные ссылки — см. ДАННЫЕ-ОТ-УЛЬЯНЫ.md */}
                <div className="flex flex-wrap gap-11">
                  <a
                    className="pill-link"
                    href={CONTACTS.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    TELEGRAM
                  </a>
                  <a
                    className="pill-link"
                    href={CONTACTS.vk}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ВКОНТАКТЕ
                  </a>
                </div>
              </div>
            </div>

            <BookingForm />
          </motion.div>
        </section>
      </main>

      <footer className="px-23 pb-34 sm:px-34 lg:px-63">
        <nav
          className="flex flex-wrap items-center justify-center gap-x-28 border-t border-ash/40 pt-28"
          aria-label="Нижняя навигация"
        >
          {navItems.map((item) => {
            const isActive = activeSection === item.id;

            return (
              <a
                key={item.id}
                className="group inline-flex min-h-[44px] items-center gap-9 py-11 text-obsidian-ink no-underline"
                href={`#${item.id}`}
                aria-current={isActive ? "page" : undefined}
              >
                <motion.span
                  className={`h-8 w-8 rounded-full ${
                    isActive
                      ? "bg-sage-dark"
                      : "border border-sage bg-transparent"
                  }`}
                  animate={{
                    scale: isActive && !shouldReduceMotion ? 1.18 : 1,
                  }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  aria-hidden="true"
                />
                <span className="display text-caption leading-caption tracking-caption underline-offset-4 group-hover:underline">
                  {item.label}
                </span>
              </a>
            );
          })}
        </nav>

        <p className="micro-label mt-28 text-center text-pebble">
          © {new Date().getFullYear()} УЛЬЯНА / МАТЕМАТИКА
        </p>
      </footer>

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
      />
    </div>
  );
}

export default App;
