import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import SiteMenu from "./components/SiteMenu.jsx";
import BoardIcon from "./components/board-icons.jsx";

/**
 * ЗАГЛУШКИ. Заменить на реальные данные — см. ДАННЫЕ-ОТ-УЛЬЯНЫ.md.
 * Пока ready = false, форма не отправляет заявку, а показывает честное уведомление.
 */
const CONTACTS = {
  ready: false,
  telegram: "https://t.me/ulianaa713",
  vk: "http://vk.ru/ulianaaa713",
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

const navItems = [
  { id: "start", label: "СТАРТ" },
  { id: "about", label: "ОБО МНЕ" },
  { id: "method", label: "МЕТОД" },
  { id: "format", label: "ФОРМАТ" },
  { id: "reviews", label: "ОТЗЫВЫ" },
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
    copy: "Информатика и вычислительная техника, бакалавриат.",
    document: { label: "Просмотреть диплом", href: "/diploma.jpg" },
  },
  {
    label: "ОПЫТ",
    title: "БОЛЕЕ 3 ЛЕТ",
    copy: "Школьники с 7 по 11 класс: подготовка к экзаменам, разбор текущих тем и возвращение уверенности в предмете.",
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
    copy: "Через пробные экзамены, корректировку плана и экзаменационную стратегию идём к хорошему результату.",
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
    copy: "Школьная программа, ОГЭ в 9 классе, профильная или базовая математика в 10-11 классах.",
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
 * Настоящие отзывы — только скриншотами, без пересказа: текст отзыва не переписываем.
 * Содержание скриншота дублирует alt — иначе отзыв не существует для скринридера
 * и для поиска.
 *
 * Исходники — в reviews/, адаптивные версии генерирует npm run build:images
 * в public/reviews/. Публиковать отзыв можно только с согласия автора.
 */
const reviews = [
  {
    id: "otzyv-5",
    meta: "ШКОЛЬНАЯ ПРОГРАММА · 8 КЛАСС",
    shots: [
      {
        name: "otzyv-5-chat",
        widths: [640, 1081],
        width: 1081,
        height: 875,
        alt: "Скриншот сообщения родителя: «Ульяна добрый день! Спасибо большое за такой подробный отчет. Я заметила, что практически пропали тройки и двойки - это первое, а второе и что для меня как для мамы важнее - она перестала сильно нервничать в день проверочных и контрольных работ как это было ранее! Вот это для меня показатель, безусловно это ваша заслуга. Благодарю Вас и желаю нам всем далее двигаться в том же направлении!!!»",
      },
    ],
  },
  {
    id: "otzyv-7",
    meta: "ОГЭ · 9 КЛАСС",
    shots: [
      {
        name: "otzyv-7-chat",
        widths: [640, 775],
        width: 775,
        height: 1280,
        alt: "Скриншот сообщения ученицы: «После занятий с репетитором, в школе справляться с программой стало намного легче. С геометрией у меня были проблемы с 7 класса, но в этом году я ее сильно подтянула, благодаря занятиям. В добавок я перестала бояться уроков математики, так как с моим репетитором мы успевали проходить все темы наперед. А если по какой то теме в школе у меня возникали проблемы, то мы быстро ее прогоняли и дальше продолжали работать в привычном темпе. Честно говоря, у меня было много репетиторов до Ульяны, но она мне помогла больше всех. Самое главное для меня, что уроки с ней проходили супер комфортно. Я очень ленивая, но когда приходило время наших занятий, то я вообще не ленилась, а напротив была рада. А все потому, что я знала, что после наших занятий есть результат. Подтверждение этому — я сдала ОГЭ на пять) Учитывая, что я учусь в гуманитарном классе и математика мне естественно дается сложнее всего»",
      },
    ],
  },
  {
    id: "otzyv-6",
    meta: "ШКОЛЬНАЯ ПРОГРАММА · МЦКО",
    shots: [
      {
        name: "otzyv-6-chat",
        widths: [640, 1099],
        width: 1099,
        height: 1280,
        alt: "Скриншот сообщения родителя: «Добрый вечер, Ульяна Дмитриевна! Заметила! Успеваемость и отношение к математике изменилось, оценки стали значительно лучше. Если честно с 3-ки перешли на твердую 4-ку. В каких-то темах, даже на 5! Успешно сдали МЦКО (5 и 4) только благодаря занятиям с Вами. Начали заниматься с середины года, поэтому подстраивались под свободные места. В этом году было бы удобнее, занятия пораньше. Дом занятия и обратная связь всегда — супер!!! Очень нравится заниматься с Вами, комфортно, нет стеснения. Объясняете легко и доступно! Спасибо Вам»",
      },
    ],
  },
  {
    id: "otzyv-1",
    meta: "ОГЭ · 9 КЛАСС",
    // shots[0] — превью в секции. Остальные открываются под ним в модалке:
    // это части одного отзыва, отдельными карточками они не живут.
    shots: [
      {
        name: "otzyv-1-chat",
        widths: [640, 1066],
        width: 1066,
        height: 1409,
        alt: "Скриншот сообщения ученицы: «очень хочу поблагодарить Ульяну за подготовку к ОГЭ и заслуженную 5. мы начали заниматься в августе, за 10 месяцев до экзамена. пришла я с огромными пробелами в знаниях и стойкой нелюбовью к математике. в процессе мы все таки подружились, уроки стали проходить активно и комфортно, а страх предмета исчез. благодаря классным схемам и большому количеству практики всё разложилось по полочкам. результат — 25 баллов. но главный плюс даже не в оценке, а в том, что я смогла полюбить математику»",
      },
      {
        name: "otzyv-1-result",
        widths: [640, 1206],
        width: 1206,
        height: 511,
        // Не продолжение переписки, а другой документ — отделяем подписью.
        label: "РЕЗУЛЬТАТ ЭКЗАМЕНА",
        alt: "Скриншот результата ОГЭ: первичный балл 25, отметка 5",
      },
    ],
  },
  {
    id: "otzyv-2",
    meta: "ШКОЛЬНАЯ ПРОГРАММА · 8 КЛАСС",
    shots: [
      {
        name: "otzyv-2-chat-1",
        widths: [640, 977],
        width: 977,
        height: 1773,
        alt: "Скриншот сообщения ученицы: «Здравствуйте. Мне стала легче даваться алгебра и геометрия. Раньше я очень нервничала перед каждым уроком в школе, потому что не понимала эти предметы, боялась разных работ, но сейчас у меня уверено получается решать задачи, и даже если появляется что-то новое, я знаю что смогу разобраться в этом. Я очень рада, что занимаюсь в такой комфортной обстановке, на уроке мы разбираем все мои пробелы и вопросы, все объясняли спокойно и намного понятней чем в школе. Домашнее задание я стала решать намного быстрее. В седьмом классе я не понимала геометрию полностью, она была самой сложной, но с началом наших занятий в восьмом классе геометрия для меня стала совсем другим предметом, понятным и интересным»",
      },
      {
        name: "otzyv-2-chat-2",
        widths: [640, 968],
        width: 968,
        height: 1024,
        alt: "Продолжение сообщения: «Я закончила год без троек, контрольные работы и самостоятельные пишу на 4-5, больше не переживаю выходить к доске, впр написала на 4, и не ходила на пересдачи, как это делали большинство из класса. Мне очень нравится заниматься с вами, вы очень хорошо и спокойно объясняете все темы, домашние задания были не такие большие, вы часто меня поддерживали если что то не получалось, я уже очень скучаю по нашим занятиям»",
      },
    ],
  },
  {
    id: "otzyv-4",
    meta: "ШКОЛЬНАЯ ПРОГРАММА · 7 КЛАСС",
    shots: [
      {
        name: "otzyv-4-chat",
        widths: [640, 953],
        width: 953,
        height: 513,
        alt: "Скриншот сообщения родителя: «Доброе утро! Ульяна Дмитриевна, выражаю Вам огромную благодарность!!! написала МЦКО на 4, 5, 5. По геометрии вообще 4 из 4! Спасибо Вам огромное!!!»",
      },
    ],
  },
];

const pricingPlans = [
  {
    name: "РАЗОВЫЙ УРОК",
    rhythm: "ИНДИВИДУАЛЬНОЕ ЗАНЯТИЕ",
    price: "1 600 ₽",
    unit: "за 60 минут",
    description:
      "Оплата после урока.",
    features: [
      "60 минут занятия",
      "разбор текущей темы",
      "домашнее задание после урока",
    ],
  },
  {
    name: "ГРУППА 2 ЧЕЛОВЕКА",
    rhythm: "ЗАНИМАЕТЕСЬ ВДВОЁМ",
    price: "1 100 ₽",
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
    a: "С 7 по 11 класс. По договорённости - с 5 и 6 классом. Школьная программа, подготовка к ОГЭ в 9 классе, профильная или базовая математика в 10-11 классах.",
  },
  {
    q: "СКОЛЬКО ДЛИТСЯ УРОК?",
    a: "60 минут. Часа хватает на разбор, практику и фиксацию следующего шага.",
  },
  {
    q: "МОЖНО ЛИ ЗАНИМАТЬСЯ ВДВОЁМ С ДРУГОМ?",
    a: "Да. Можно заниматься в паре - 1 100 ₽ с человека, или собрать мини-группу из 3–4 человек близкого уровня - 800 ₽ с человека. Программа та же, всё на общей доске. Приведите друзей и учитесь в комфортной компании.",
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

// Класс спрашиваем отдельным полем, поэтому в цели его не повторяем:
// иначе в шаблоне заявки выходит «9 класс, цель: ОГЭ, 9 класс».
const goalOptions = [
  "ОГЭ",
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
    <div className="mt-34 sm:mt-63">
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
      className={`rounded-[8px] border border-sage/25 bg-bone p-23 sm:p-28 ${className}`}
      {...rest}
    >
      {children}
    </motion.article>
  );
}

/**
 * Превью-окно шире, чем 1:1. Скриншот считаем высоким, если в него не влезает,
 * — такой обрезаем снизу, остальные показываем целиком.
 */
function isTallShot(shot) {
  return shot.height / shot.width > 1;
}

function shotSrcSet(shot, extension) {
  return shot.widths
    .map((width) => `/reviews/${shot.name}-${width}.${extension} ${width}w`)
    .join(", ");
}

function ShotPicture({ shot, sizes, className, loading = "lazy" }) {
  return (
    <picture className="block w-full">
      <source
        type="image/avif"
        srcSet={shotSrcSet(shot, "avif")}
        sizes={sizes}
      />
      <source
        type="image/webp"
        srcSet={shotSrcSet(shot, "webp")}
        sizes={sizes}
      />
      <img
        src={`/reviews/${shot.name}-${shot.widths[0]}.jpg`}
        srcSet={shotSrcSet(shot, "jpg")}
        sizes={sizes}
        width={shot.width}
        height={shot.height}
        loading={loading}
        decoding="async"
        alt={shot.alt}
        className={className}
      />
    </picture>
  );
}

/**
 * Отзыв целиком: первый скриншот в читаемом размере, под ним — остальные части.
 * Продолжение переписки идёт встык, документ другого рода (результат экзамена) —
 * через разделитель с подписью.
 */
function ReviewLightbox({ review, onClose }) {
  useEffect(() => {
    if (!review) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [review, onClose]);

  if (!review) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-obsidian-ink/80 px-11 py-18 sm:px-23 sm:py-34"
      role="presentation"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Отзыв: ${review.meta}`}
        className="w-full max-w-[560px] rounded-[8px] bg-bone p-9 sm:p-18"
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mb-18 flex items-center justify-between gap-18 pl-9">
          <p className="micro-label text-clay">{review.meta}</p>
          <button
            type="button"
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-sage/40 text-body leading-none text-sage-dark transition-colors hover:bg-mist"
            onClick={onClose}
            aria-label="Закрыть"
            autoFocus
          >
            ×
          </button>
        </div>

        <div className="grid gap-14">
          {review.shots.map((shot) =>
            shot.label ? (
              <div
                className="mt-9 border-t border-sage/25 pt-23"
                key={shot.name}
              >
                <p className="micro-label mb-14 pl-9 text-ash">{shot.label}</p>
                <ShotPicture
                  shot={shot}
                  sizes="(min-width: 600px) 524px, 84vw"
                  className="w-full rounded-[4px]"
                  loading="eager"
                />
              </div>
            ) : (
              <ShotPicture
                key={shot.name}
                shot={shot}
                sizes="(min-width: 600px) 524px, 84vw"
                className="w-full rounded-[4px]"
                loading="eager"
              />
            ),
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ReviewCard({ review, onOpen, isActive = true, isClone = false }) {
  return (
    <button
      type="button"
      className="group flex h-full w-full flex-col rounded-[8px] border border-sage/25 bg-bone p-14 text-left transition-colors hover:border-sage-dark sm:p-23"
      onClick={() => onOpen(review)}
      // Копии ленты не должны попадаться при табуляции: тот же отзыв уже есть в середине.
      tabIndex={isClone ? -1 : undefined}
      data-review-card
      data-review-active={isActive ? "true" : undefined}
    >
      <span className="micro-label mb-18 flex w-full items-center justify-between gap-14 text-clay">
        {review.meta}
        <span className="flex shrink-0 items-center gap-9 whitespace-nowrap text-sage-dark">
          ОТКРЫТЬ
          <span
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-4"
          >
            →
          </span>
        </span>
      </span>

      {/* Скриншоты разной высоты. Превью режем по одной высоте, чтобы карточки
          в сетке были одинаковыми, а полный текст открываем в модалке.
          Широкие скриншоты вписываем целиком: cover обрезал бы их по бокам,
          то есть по буквам. */}
      {/* Одна высота нужна в сетке: в одну колонку карточки всё равно идут
          друг под другом, и фиксированная высота там только добавляет пустоту
          вокруг широких скриншотов. */}
      <span
        className={`relative flex h-[320px] w-full overflow-hidden rounded-[4px] sm:h-[340px] ${
          isTallShot(review.shots[0]) ? "items-start" : "items-center"
        }`}
      >
        <ShotPicture
          shot={review.shots[0]}
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 44vw, 82vw"
          className="w-full"
        />
        {isTallShot(review.shots[0]) ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-63 bg-gradient-to-t from-bone via-bone/70 to-transparent"
          />
        ) : null}
      </span>
    </button>
  );
}

/** Сколько карточек помещается в ряд — от этого зависит, какая из них центральная. */
function useVisibleCount() {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    if (!window.matchMedia) {
      return undefined;
    }

    const breakpoints = [
      { media: window.matchMedia("(min-width: 1024px)"), count: 3 },
      { media: window.matchMedia("(min-width: 640px)"), count: 2 },
    ];

    const sync = () =>
      setVisibleCount(
        breakpoints.find(({ media }) => media.matches)?.count ?? 1,
      );

    sync();
    breakpoints.forEach(({ media }) => media.addEventListener("change", sync));

    return () =>
      breakpoints.forEach(({ media }) =>
        media.removeEventListener("change", sync),
      );
  }, []);

  return visibleCount;
}

/**
 * Бесконечная карусель: лента едет на одну карточку, а не пересобирается заново.
 *
 * Отзывы отрисованы трижды подряд, работаем в средней копии — доехав до её края,
 * мгновенно (без анимации) перескакиваем на такую же карточку в середине.
 * Для зрителя это выглядит как лента без конца и начала.
 */
function ReviewsCarousel({ shouldReduceMotion, onOpen }) {
  const total = reviews.length;
  const items = useMemo(() => [...reviews, ...reviews, ...reviews], []);
  const visibleCount = useVisibleCount();

  // Позиция центральной карточки в ленте из трёх копий.
  const [center, setCenter] = useState(total);
  const [isInstant, setIsInstant] = useState(false);

  const centerOffset = visibleCount === 3 ? 1 : 0;
  const activeReview = center % total;
  const step = 100 / items.length;

  const move = (delta) => {
    setIsInstant(false);
    setCenter((current) => current + delta);
  };

  const goToReview = (index) => {
    setIsInstant(false);
    setCenter(total + index);
  };

  // Возврат в среднюю копию — только после того, как анимация доехала.
  const normalize = () => {
    if (center >= total * 2) {
      setIsInstant(true);
      setCenter(center - total);
    } else if (center < total) {
      setIsInstant(true);
      setCenter(center + total);
    }
  };

  return (
    <div className="mt-34 sm:mt-63">
      <div className="mb-28 flex justify-end">
        <div className="flex items-center gap-9">
          <button
            type="button"
            className="flex h-[50px] w-[50px] items-center justify-center rounded-full border border-sage-dark bg-transparent text-body leading-none text-sage-dark transition-colors hover:bg-mist"
            onClick={() => move(-1)}
            aria-label="Предыдущий отзыв"
            data-review-prev
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            className="flex h-[50px] w-[50px] items-center justify-center rounded-full border border-sage-dark bg-sage-dark text-body leading-none text-bone transition-colors hover:bg-obsidian-ink"
            onClick={() => move(1)}
            aria-label="Следующий отзыв"
            data-review-next
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Отзыв {activeReview + 1} из {total}
      </p>

      {/* py-9: центральная карточка чуть крупнее соседних, ей нужен запас по краям. */}
      <div className="overflow-hidden py-9">
        <motion.div
          className="flex"
          style={{ width: `${(items.length * 100) / visibleCount}%` }}
          animate={{ x: `-${(center - centerOffset) * step}%` }}
          transition={
            isInstant || shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.55, ease: [0.16, 1, 0.3, 1] }
          }
          onAnimationComplete={normalize}
        >
          {items.map((review, itemIndex) => {
            const isCenter = itemIndex === center;
            const isClone = itemIndex < total || itemIndex >= total * 2;

            return (
              <motion.div
                key={`${review.id}-${itemIndex}`}
                className="shrink-0 px-9"
                style={{ flexBasis: `${step}%` }}
                animate={{
                  scale: isCenter ? 1 : 0.94,
                  opacity: isCenter ? 1 : 0.72,
                }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 0.55, ease: [0.16, 1, 0.3, 1] }
                }
                // Копии тех же отзывов скринридеру не нужны.
                aria-hidden={isClone ? "true" : undefined}
              >
                <ReviewCard
                  review={review}
                  onOpen={onOpen}
                  isActive={isCenter}
                  isClone={isClone}
                />
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      <div
        className="mt-34 flex justify-center"
        aria-label="Навигация по отзывам"
      >
        {reviews.map((review, index) => (
          <button
            key={review.id}
            type="button"
            className="flex h-[44px] w-[24px] items-center justify-center"
            onClick={() => goToReview(index)}
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

/**
 * Заявка уходит в чат текстом, а не в базу: если имя или контакт кривые, Ульяна
 * просто не сможет ответить. Поэтому проверяем оба поля до открытия мессенджера.
 */
const leadValidators = {
  name(value) {
    const name = value.trim();

    if (name.length < 3) {
      return "Имя должно быть не короче трёх символов.";
    }

    // Алфавит не ограничиваем — важно лишь, чтобы это не был набор цифр и знаков.
    if (!/\p{L}/u.test(name)) {
      return "В имени должна быть хотя бы одна буква.";
    }

    return null;
  },

  contact(value) {
    const contact = value.trim();

    if (contact.startsWith("@")) {
      return /^@[a-zA-Z0-9_]{4,32}$/.test(contact)
        ? null
        : "Ник в телеграме: @ и минимум 4 символа - латиница, цифры или _.";
    }

    // Телефон принимаем в любом виде записи: +7 (900) 000-00-00, 8 900 000 00 00.
    const digits = contact.replace(/[\s()\-‑–—.]/g, "");

    if (/^(\+7|7|8)\d{10}$/.test(digits)) {
      return null;
    }

    return "Телефон в формате +7 900 000-00-00 или ник в телеграме через @.";
  },
};

function validateLead(lead) {
  const errors = {};

  for (const [field, validate] of Object.entries(leadValidators)) {
    const error = validate(lead[field] ?? "");

    if (error) {
      errors[field] = error;
    }
  }

  return errors;
}

/**
 * Шаблон заявки: человек не пишет сообщение сам, а получает его готовым из полей формы.
 */
function buildBookingMessage(lead) {
  return `Добрый день, Ульяна! Меня зовут ${lead.name}, хочу записаться на бесплатную диагностику. Мой контакт: ${lead.contact} (${lead.grade}, цель: ${lead.goal}).`;
}

/** Старый способ — для случаев, когда Clipboard API недоступен (не-https, старые браузеры). */
function copyWithSelection(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => copyWithSelection(text));
  }

  return Promise.resolve(copyWithSelection(text));
}

/**
 * Выбор мессенджера с готовым текстом заявки.
 *
 * Ни Telegram, ни ВКонтакте не умеют подставлять текст в личный чат по ссылке:
 * `?text=` работает только в share-диалоге и у ботов. Поэтому текст копируем
 * в буфер обмена и показываем целиком — остаётся вставить его в чат.
 */
function BookingChannelModal({ lead, onClose }) {
  const [copyState, setCopyState] = useState("idle");

  useEffect(() => {
    if (!lead) {
      return undefined;
    }

    setCopyState("idle");

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [lead, onClose]);

  if (!lead) {
    return null;
  }

  const message = buildBookingMessage(lead);

  const copyMessage = () =>
    copyText(message).then((isCopied) =>
      setCopyState(isCopied ? "copied" : "failed"),
    );

  const openChannel = (href) => {
    // Копируем до открытия вкладки: после window.open жест пользователя теряется.
    copyMessage();
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const copyNote = {
    copied: "Текст заявки скопирован - вставьте его в чат и отправьте.",
    failed: "Не удалось скопировать - выделите текст выше и скопируйте вручную.",
    idle: "При переходе текст заявки скопируется - останется вставить его в чат.",
  }[copyState];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-obsidian-ink/55 px-23 py-34"
      role="presentation"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
        className="w-full max-w-[480px] rounded-[8px] border border-sage/25 bg-bone p-34"
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        data-booking-modal
      >
        <div className="flex items-start justify-between gap-18">
          <h2
            id="booking-modal-title"
            className="display text-h3 leading-h3 tracking-[0.04em] text-obsidian-ink"
          >
            Куда отправить заявку?
          </h2>
          <button
            type="button"
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-sage/40 text-body leading-none text-sage-dark transition-colors hover:bg-mist"
            onClick={onClose}
            aria-label="Закрыть"
            autoFocus
          >
            ×
          </button>
        </div>

        <p className="micro-label mt-28 mb-14 text-ash">ТЕКСТ ЗАЯВКИ</p>
        <p
          className="m-0 rounded-[8px] border border-sage/25 bg-canvas p-18 text-body-sm leading-body-sm text-obsidian-ink/82"
          data-booking-message
        >
          {message}
        </p>

        <div className="mt-23 flex flex-wrap gap-11">
          <button
            type="button"
            className="pill-link pill-link--solid"
            onClick={() => openChannel(CONTACTS.telegram)}
          >
            TELEGRAM <span aria-hidden="true">→</span>
          </button>
          <button
            type="button"
            className="pill-link"
            onClick={() => openChannel(CONTACTS.vk)}
          >
            ВКОНТАКТЕ <span aria-hidden="true">→</span>
          </button>
        </div>

        <button
          type="button"
          className="section-cta mt-23"
          onClick={copyMessage}
        >
          СКОПИРОВАТЬ ТЕКСТ
          <span aria-hidden="true">⧉</span>
        </button>

        <p
          aria-live="polite"
          className="mt-23 text-body-sm leading-body-sm text-pebble"
        >
          {copyNote}
        </p>
      </motion.div>
    </div>
  );
}

function BookingForm() {
  const [lead, setLead] = useState(null);
  const [errors, setErrors] = useState({});
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const nextLead = {
      name: (data.get("name") ?? "").trim(),
      contact: (data.get("contact") ?? "").trim(),
      grade: data.get("grade"),
      goal: data.get("goal"),
    };

    const nextErrors = validateLead(nextLead);
    setErrors(nextErrors);

    const firstInvalidField = Object.keys(nextErrors)[0];

    if (firstInvalidField) {
      form.elements[firstInvalidField]?.focus();
      return;
    }

    setLead(nextLead);
  };

  // Ошибку снимаем сразу, как только человек начал править поле.
  const clearError = (field) =>
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const { [field]: _removed, ...rest } = current;
      return rest;
    });

  const validateField = (field, value) =>
    setErrors((current) => {
      const error = leadValidators[field](value.trim());

      if (!error) {
        const { [field]: _removed, ...rest } = current;
        return rest;
      }

      return { ...current, [field]: error };
    });

  const fieldProps = (field) => ({
    className: `field-input ${errors[field] ? "field-input--invalid" : ""}`,
    "aria-invalid": errors[field] ? "true" : undefined,
    "aria-describedby": errors[field] ? `${field}-error` : undefined,
    onInput: () => clearError(field),
    onBlur: (event) => {
      if (event.target.value.trim()) {
        validateField(field, event.target.value);
      }
    },
  });

  return (
    <>
      <form className="grid gap-34" onSubmit={handleSubmit}>
        <div className="grid gap-28 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="name">
              Как вас зовут
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              placeholder="Имя"
              {...fieldProps("name")}
            />
            {errors.name ? (
              <p className="field-error" id="name-error">
                {errors.name}
              </p>
            ) : null}
          </div>

          <div>
            {/* id не должен совпадать с id секции #contact — иначе якорь ведёт в поле. */}
            <label className="field-label" htmlFor="lead-contact">
              Телефон или телеграм
            </label>
            <input
              id="lead-contact"
              name="contact"
              type="text"
              required
              autoComplete="tel"
              placeholder="+7 900 000-00-00 или @nickname"
              {...fieldProps("contact")}
            />
            {errors.contact ? (
              <p className="field-error" id="contact-error">
                {errors.contact}
              </p>
            ) : null}
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

          <p className="text-body-sm leading-body-sm text-pebble">
            После заполнения выберете, куда написать: Telegram или ВКонтакте.
            Отвечаю в течение дня.
          </p>
        </div>
      </form>

      <ConsentModal
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
      />

      <BookingChannelModal lead={lead} onClose={() => setLead(null)} />
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
  const [activeReview, setActiveReview] = useState(null);

  return (
    <div className="min-h-screen bg-canvas text-obsidian-ink">
      <header className="site-header">
        <a className="site-brand" href="#start">ulianaa-learning.pro<span>Математика с Ульяной</span></a>
        <nav className="site-header-nav" aria-label="Основная навигация"><a href="#about">О занятиях</a><a href="#reviews">Отзывы</a><a href="#pricing">Стоимость</a></nav>
        <div className="site-header-actions"><a className="site-cabinet-link" href="/cabinet">Мой кабинет <BoardIcon name="arrow-right"/></a><SiteMenu /></div>
      </header>
      <a className="skip-link" href="#main-content">
        К основному содержанию
      </a>

      <main id="main-content" tabIndex="-1">
        {/* ── СТАРТ ──────────────────────────────────────────────── */}
        <section
          id="start"
          className="home-hero grid grid-cols-1 items-start lg:grid-cols-2"
          aria-labelledby="hero-title"
        >
          <motion.figure
            className="home-hero-photo relative m-0 aspect-square overflow-hidden bg-canvas"
            initial={
              shouldReduceMotion ? false : { clipPath: "inset(0 18% 0 0)" }
            }
            animate={shouldReduceMotion ? {} : { clipPath: "inset(0 0% 0 0)" }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.picture
              className="absolute inset-0 block overflow-hidden"
              initial={shouldReduceMotion ? false : { scale: 1.05 }}
              animate={shouldReduceMotion ? {} : { scale: 1 }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <source
                type="image/avif"
                srcSet="/hero-640.avif 640w, /hero-960.avif 960w, /hero-1254.avif 1254w"
                sizes="(max-width: 640px) 220px, (min-width: 1024px) 50vw, 100vw"
              />
              <source
                type="image/webp"
                srcSet="/hero-640.webp 640w, /hero-960.webp 960w, /hero-1254.webp 1254w"
                sizes="(max-width: 640px) 220px, (min-width: 1024px) 50vw, 100vw"
              />
              <img
                src="/hero-960.jpg"
                srcSet="/hero-640.jpg 640w, /hero-960.jpg 960w, /hero-1254.jpg 1254w"
                sizes="(max-width: 640px) 220px, (min-width: 1024px) 50vw, 100vw"
                width="1254"
                height="1254"
                fetchPriority="high"
                decoding="async"
                alt="Ульяна, репетитор по математике, в белой рубашке у светлой стены"
                className="h-full w-full scale-[1.28] object-cover object-center"
              />
            </motion.picture>
          </motion.figure>

          <div className="home-hero-content relative flex h-full flex-col">

            <motion.div
              className="home-hero-copy flex flex-1 flex-col items-start justify-center gap-23 text-left sm:gap-28"
              initial={shouldReduceMotion ? false : "hidden"}
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: { staggerChildren: 0.11, delayChildren: 0.2 },
                },
              }}
            >
              <p className="home-hero-eyebrow">Онлайн · 7–11 класс · ОГЭ и ЕГЭ</p>
              <motion.h1
                id="hero-title"
                className="display home-hero-title"
                variants={{
                  hidden: { opacity: 0, y: 18 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                Математика, в которой всё становится понятно
              </motion.h1>
              <p className="home-hero-description">Разбираемся в школьной программе и готовимся к экзаменам. Работаем на индивидуальной доске через личный кабинет.</p>

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
              </motion.div>
              <motion.dl
                className="home-hero-proof m-0 grid w-full grid-cols-3 gap-11 border-t border-sage/25 pt-18 sm:gap-18 sm:pt-28"
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={shouldReduceMotion ? {} : { opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.75 }}
              >
                {heroProof.map((item) => (
                  <div key={item.label}>
                    <dt className="sr-only">{item.label}</dt>
                    <dd className="m-0">
                      <span className="display block text-[20px] leading-stat sm:text-stat tracking-[0.02em] text-sage-dark">
                        {item.value}
                      </span>
                      <span className="mt-9 block text-[13px] leading-[1.45] sm:text-body-sm text-pebble">
                        {item.label}
                      </span>
                    </dd>
                  </div>
                ))}
              </motion.dl>
            </motion.div>
          </div>
        </section>

        {/* ── ОБО МНЕ ────────────────────────────────────────────── */}
        <section
          id="about"
          className="px-23 pb-63 sm:pb-96 pt-63 sm:pt-144 sm:px-34 lg:px-63"
          aria-labelledby="about-title"
        >
          <motion.div {...reveal}>
            <div className="grid gap-34 sm:gap-63 lg:grid-cols-[0.42fr_1fr] lg:gap-72">
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
                    <p className="micro-label mb-23 sm:mb-34 text-clay">{fact.label}</p>
                    <h3 className="display text-h3 leading-h3 tracking-[0.04em] text-sage-dark">
                      {fact.title}
                    </h3>
                    <p className="mt-18 text-body-sm leading-body-sm text-obsidian-ink/82">
                      {fact.copy}
                      {fact.document && (
                        <>
                          {" "}
                          <a
                            href={fact.document.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sage-dark underline decoration-sage/50 underline-offset-4 hover:decoration-sage-dark"
                          >
                            {fact.document.label}
                          </a>
                        </>
                      )}
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
          className="px-23 pb-63 sm:pb-96 sm:px-34 lg:px-63"
          aria-labelledby="method-title"
        >
          <motion.div {...reveal}>
            <SectionIntro
              titleId="method-title"
              eyebrow="МЕТОДИКА"
              title="Дорожная карта от знакомства до экзамена"
            />
          </motion.div>

          <div className="mt-34 sm:mt-63 grid gap-18 md:grid-cols-2 xl:grid-cols-3">
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
                <span className="mb-23 sm:mb-34 flex items-center gap-18">
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
          className="px-23 pb-63 sm:pb-96 sm:px-34 lg:px-63"
          aria-labelledby="format-title"
        >
          <motion.div {...reveal}>
            <SectionIntro
              titleId="format-title"
              eyebrow="ФОРМАТ"
              title="Как устроены занятия"
            />
          </motion.div>

          <div className="mt-34 sm:mt-63 grid gap-18 md:grid-cols-2 xl:grid-cols-3">
            {formatCards.map((card, index) => (
              <Card key={card.title} {...cardMotion(shouldReduceMotion, index)}>
                <span className="micro-label mb-23 sm:mb-34 inline-flex rounded-full border border-clay-light/60 px-14 py-11 text-clay">
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

        {/* ── ОТЗЫВЫ ─────────────────────────────────────────────── */}
        <section
          id="reviews"
          className="px-23 pb-63 sm:pb-96 sm:px-34 lg:px-63"
          aria-labelledby="reviews-title"
        >
          <motion.div {...reveal}>
            <SectionIntro
              titleId="reviews-title"
              eyebrow="УЧЕНИКИ"
              title="Отзывы и результаты"
            />
          </motion.div>

          <ReviewsCarousel
            shouldReduceMotion={shouldReduceMotion}
            onOpen={setActiveReview}
          />

          <SectionCta />
        </section>

        {/* ── ТАРИФЫ ─────────────────────────────────────────────── */}
        <section
          id="pricing"
          className="px-23 pb-63 sm:pb-96 sm:px-34 lg:px-63"
          aria-labelledby="pricing-title"
        >
          <motion.div {...reveal}>
            <SectionIntro
              titleId="pricing-title"
              eyebrow="ТАРИФЫ"
              title="Индивидуально или в мини-группе с друзьями"
            />
          </motion.div>

          <div className="mt-34 sm:mt-63 grid gap-18 md:grid-cols-2 lg:grid-cols-3">
            {pricingPlans.map((plan, index) => (
              <motion.article
                key={plan.name}
                className={`relative grid content-between rounded-[8px] border p-23 sm:p-34 ${
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
          className="px-23 pb-63 sm:pb-96 sm:px-34 lg:px-63"
          aria-labelledby="faq-title"
        >
          <motion.div {...reveal}>
            <SectionIntro
              titleId="faq-title"
              eyebrow="ВОПРОСЫ"
              title="Частые вопросы"
            />
          </motion.div>

          <motion.div className="mt-34 sm:mt-63 max-w-[900px]" {...reveal}>
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
          className="px-23 pb-63 sm:pb-96 sm:px-34 lg:px-63"
          aria-labelledby="contact-title"
        >
          <motion.div
            className="grid gap-34 sm:gap-63 lg:grid-cols-[0.8fr_1fr] lg:gap-96"
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

      <ReviewLightbox
        review={activeReview}
        onClose={() => setActiveReview(null)}
      />
    </div>
  );
}

export default App;
