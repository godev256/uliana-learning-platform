# Сайт Ульяны

Одностраничный сайт репетитора: React 19, Vite 8, Tailwind CSS 4 и Framer Motion.
Для локальной разработки не нужны база данных, backend или `.env`.
Форма записи подготавливает сообщение для отправки посетителем через Telegram или VK.

## Локальный запуск

```sh
cd /Users/ulanaa/Desktop/website
./dev.sh
```

Сайт: http://127.0.0.1:5173. Изменения в `src/` автоматически появляются в браузере.
Остановка сервера: Ctrl+C. Для другого порта: `./dev.sh --port 5174`.

На текущем компьютере Node.js 24.19.0 с npm установлен в `.local/node/`.
Обёртка `scripts/npm.sh` автоматически использует его, поэтому системная установка не нужна.
Локальные инструменты, зависимости и результаты сборки исключены из Git.

На другом компьютере установите Node.js 24 (версия зафиксирована в `.nvmrc`
и `.node-version`), затем выполните:

```sh
./scripts/npm.sh ci
./dev.sh
```

При использовании nvm достаточно `nvm install && nvm use`.
Все стандартные команды `npm` также работают при установленном системном Node.js.

## Проверки и сборка

```sh
./scripts/npm.sh run build
./scripts/npm.sh run preview
```

Сборка сохраняется в `dist/`, preview доступен на http://127.0.0.1:4173.

Для браузерной проверки сначала запустите dev-сервер, затем в другом терминале:

```sh
./scripts/npm.sh exec -- playwright install chromium
./scripts/npm.sh run verify:playwright
```

Проверка охватывает три размера экрана, карусель и изображения отзывов,
валидацию формы, копирование сообщения и закрытие модальных окон.
Скриншоты сохраняются в `playwright-report/`.
Обёртка сохраняет браузеры Playwright в `.local/playwright/`.
Другой адрес: `PLAYWRIGHT_URL=http://127.0.0.1:5174 ./scripts/npm.sh run verify:playwright`.

После замены оригинальных фотографий или отзывов запустите
`./scripts/npm.sh run build:images` для обновления адаптивных файлов в `public/`.

## Пробная доска

Пункт «Доска» в меню справа сверху открывает `/board`.
Доступны ручка, стирание целого штриха или фигуры, линия, цвета, толщина,
клетка, отмена/повтор и скачивание PDF. Раздел «Фигуры» содержит прямоугольник,
квадрат, овал, треугольник, параллелограмм, ромб и три вида трапеции:
равнобедренную, прямоугольную и произвольную. Меню разделено на 2D и 3D:
доступны произвольный, равнобедренный и равносторонний треугольники,
куб, параллелепипед, тетраэдр, треугольная призма и четырёхугольная пирамида.
Объёмные фигуры строятся из 3D-моделей с пунктирными скрытыми рёбрами.
Отдельный раздел «3D-визуализация фигур» вставляет те же пять моделей в окна
с залитыми гранями. Новые окна имеют размер 1440 × 900, примерно треть листа.
Панель действий и её шрифт уменьшены, чтобы больше места занимала фигура.
Ладошка перемещает окно за его содержимое и меняет размер за уголки;
заголовок тоже позволяет перемещать окно. Внутри находятся кнопки
«Вращать», «Сбросить ракурс», «Точка на ребре», «Отрезок», «Прямая по точкам»,
«Точка пересечения», «Плоскость через 3 точки» и «Имя точки». Чтобы продолжить ребро,
постройте прямую через две его вершины. «Точка пересечения» отмечает настоящее
пересечение двух прямых или прямой с конечным ребром в пространстве;
параллельные и скрещивающиеся прямые не дают ложных точек.
Через отмеченное пересечение можно строить новые прямые. Оно сохраняется
при вращении, в браузере и PDF. Удаление исходной прямой убирает зависимую
точку и построения через неё; действие можно отменить.
Плоскость задаётся последовательным выбором трёх вершин или отмеченных точек,
не лежащих на одной прямой. Она отображается полупрозрачной, а её сечение
с фигурой выделяется цветом. Плоскости вращаются вместе с моделью,
сохраняются в браузере и PDF, удаляются ластиком и поддерживают отмену/повтор.
В заголовке каждого 3D-окна есть «Удалить»: нажмите кнопку, затем прямую,
точку или плоскость. Режим удаляет только построения, само окно сохраняется.
«Отменить» возвращает удалённое вместе с зависимыми построениями;
выбор «Вращать» или другого действия выключает режим удаления.
Бесконечные прямые отображаются светлым серо-синим цветом `#c2ccd4`.
«Отрезок» соединяет две выбранные вершины или отмеченные точки без продолжений.
Отрезки сохраняют более контрастный цвет `#74879a`, вращаются с фигурой,
сохраняются в браузере и PDF и удаляются кнопкой «Удалить».
При поиске пересечений учитываются только точки в пределах отрезка.
«Имя точки» позволяет выбрать свою точку и изменить её название (до 8 букв,
цифр или штрихов, включая кириллицу и нижние индексы). Названия вершин
фиксированы. Переименование сохраняет привязку всех построений, поддерживает
отмену/повтор и сохраняется в браузере и PDF.

Внизу раздела 3D-визуализации есть «Координатное пространство XYZ».
Это такое же вращаемое окно с осями X, Y и Z. «Добавить точку» позволяет
нажать на любую ось и поставить точку с шагом 0,25.
Координаты существующих точек редактируются через «Имя точки».
Переключателей рабочих плоскостей нет.
Точки можно соединять отрезками и прямыми, строить плоскости через три точки,
вращать построения, сохранять и выгружать в PDF. Масштаб осей учитывает
добавленные точки. Удаление точки также удаляет зависимые построения.
Действия внутри окна отключают ладошку, чтобы движение и вращение не путались.
Вершины подписаны по порядку: ABCD и A₁B₁C₁D₁ у куба/параллелепипеда,
ABC и D у тетраэдра, ABC и A₁B₁C₁ у призмы, ABCD и E у пирамиды.
На рёбрах каждой модели можно ставить точки M, N, P…
«Прямая по точкам» строит бесконечную прямую через две выбранные точки или
вершины. Она обрезается границами окна и вращается вместе с моделью.
Точки и прямые сохраняются в браузере и PDF; ластик удаляет их по отдельности.
Удаление точки убирает и зависимые от неё прямые. Отмена/повтор поддерживаются.
Ракурс сохраняется в браузере и попадает в PDF. Обычные 3D-чертежи доступны отдельно.
Инструмент «Ладошка» перед ручкой выбирает объекты для перемещения и изменения
размера. Цвет и толщина применяются к выбранному объекту. Для выбранной 3D-фигуры
кнопка «Вращать» включает вращение перетаскиванием внутри рамки; «Перемещать»
возвращает перемещение, «Сбросить ракурс» — исходный вид. Ракурс сохраняется
в браузере и PDF. Пометки ручкой остаются самостоятельными объектами на листе.
Инструмент «Оси X и Y» вставляет две перпендикулярные оси с подписями.
При выбранном инструменте оси можно выделить нажатием и растянуть за угловые
маркеры. Маркеры не попадают в PDF. Лист вертикальный, в пропорциях A4;
панель инструментов остаётся сверху при прокрутке. По умолчанию доступны три
листа подряд. Кнопки «Добавить лист» и «Удалить лист» находятся рядом с отменой и повтором;
удаление запрашивает подтверждение «Удалить лист №N?» для одного последнего листа.
Можно ответить «Нет» или «Да, удалить», а выполненное удаление — отменить.
Единственный оставшийся лист удалить нельзя;
листы пролистываются вниз. «Скачать конспект PDF» сохраняет все листы
в один файл A4 с нумерацией. Справа на каждом листе — изумрудная полоса
с подписью `ulianaa.maths` ближе к нижнему краю;
подпись также попадает в PDF.
Клетка имеет размер 50 × 50 вместо 40 × 40; координаты рисунков не меняются.
На телефоне панель компактная: цвет и толщина раскрываются отдельной кнопкой.
Масштаб листа меняется двумя пальцами или кнопками − / + (50–400%).
Кнопка с процентами возвращает лист по ширине экрана. Для перемещения по
увеличенному листу тяните свободное место ладошкой или используйте два пальца.
Масштаб влияет только на просмотр, координаты рисунка и PDF остаются прежними.
Старые рисунки автоматически переносятся на первый лист.
Рисунок сохраняется в localStorage текущего браузера. Общего доступа с учеником
и синхронизации между устройствами пока нет.

Проверка при запущенном dev-сервере: `./scripts/npm.sh run verify:whiteboard`.
Проверка точек пересечения и зависимых построений: `./scripts/npm.sh run verify:intersections`.
Проверка пересечений с рёбрами, плоскостей и сечений: `./scripts/npm.sh run verify:planes`.
Проверка кнопки удаления внутри окна: `./scripts/npm.sh run verify:local-delete`.
Проверка отрезков и светлых прямых: `./scripts/npm.sh run verify:segments`.
Проверка XYZ, координат и переименования: `./scripts/npm.sh run verify:coordinate-space`.
Проверка XYZ на телефоне: `./scripts/npm.sh run verify:coordinate-mobile`.
Проверка геометрии и изменения осей: `./scripts/npm.sh run verify:geometry`.
Проверка попадания пометок: `./scripts/npm.sh run verify:annotations`.
Проверка перемещения, вращения и удаления листов: `./scripts/npm.sh run verify:selection`.
Проверка действий, подписей, точек и пространственных прямых: `./scripts/npm.sh run verify:solid-actions`.
Проверка отдельных 3D-окон и вращения пальцем: `./scripts/npm.sh run verify:visualization`.
Проверка мобильных жестов и рисования с увеличением: `./scripts/npm.sh run verify:mobile-board`.
Проверка построения прямых пальцем на телефоне: `./scripts/npm.sh run verify:mobile-spatial`.
При публикации сервер должен отдавать `index.html` для маршрута `/board`,
чтобы открытие по прямой ссылке и перезагрузка работали корректно.

## Где вносить изменения

- `src/App.jsx` — разделы сайта, тексты и интерактивные элементы.
- `src/index.css` — оформление, шрифты и стили.
- `public/` — готовые изображения; `repetitor.png` и `reviews/` — оригиналы.
- `DESIGN.md` и `PRODUCT.md` — визуальные и продуктовые ориентиры.
- `scripts/verify-playwright.mjs` — существующие браузерные проверки.

## Git

Репозиторий клонирован с историей, `origin` указывает на
https://github.com/godev256/uliana-learning-platform.
На этом Mac без Xcode используйте обёртку для Git из Codex:

```sh
./scripts/git.sh status
./scripts/git.sh switch -c feature/my-change
./scripts/git.sh diff
```

На компьютере с системным Git можно использовать обычные команды `git`.

На телефоне инструменты доски расположены вертикально слева. «Ручка» рисует пальцем, в том числе поверх окна с 3D-фигурой; «Ладошка» прокручивает лист, два пальца перемещают и масштабируют. Левая панель прокручивается отдельно от листов. Для рисования на компьютере используется курсор-перо. Прямая, совпадающая с ребром объёмной фигуры, показывает продолжения за ребром, сохраняя исходный цвет самого ребра.

«Параллельная» в любом объёмном окне: выберите точку или вершину, затем
прямую, отрезок, ребро либо координатную ось. Направление задаётся в 3D;
построение сохраняется при вращении и обновляется при изменении исходных
точек. При удалении исходной прямой удаляются и зависимые построения.

Скриншоты из буфера вставляются на видимый лист через Command V (на Windows
и Linux — Ctrl V). Изображения хранятся внутри конспекта, под рукописными
пометками, попадают в PDF, перемещаются и пропорционально масштабируются
ладошкой. Отмена и повтор действуют и на вставку изображений.
Проверки: `./scripts/npm.sh run verify:parallel` и `./scripts/npm.sh run verify:clipboard`.

Телефоны и планшеты с сенсорным экраном используют левую панель инструментов,
прокрутку ладошкой и масштаб двумя пальцами в обеих ориентациях. Идентификаторы
штрихов создаются и при открытии через HTTP в локальной сети: доступный только
в защищённом контексте `crypto.randomUUID` имеет замену на `getRandomValues`.
Проверка HTTP-просмотра на телефонах и планшетах (Chromium и WebKit):
`./scripts/npm.sh run verify:touch-devices`. WebKit устанавливается командой
`./scripts/npm.sh exec -- playwright install webkit`.

Кнопка «Загрузить файл» добавляет фото или документы с устройства (до 50 МБ
на файл). Фотографии размещаются под пометками, перемещаются и пропорционально
масштабируются ладошкой. Порядок меню: оси X/Y стоят первыми среди 2D-фигур,
пространство XYZ — первым среди 3D-визуализаций.

PDF отображается карточкой с первой страницей. Нажатие открывает просмотрщик
с перелистыванием, скачиванием оригинала и кнопкой «Развернуть все страницы».
Каждая страница разворачивается на отдельный новый лист; последующие листы
с записями сдвигаются вместе с содержимым. Можно писать поверх страниц и
включать их в скачиваемый конспект. Раскрытие отменяется одним действием.
Повторное раскрытие уже размещённого PDF переводит к его страницам.
Текстовые файлы показываются в окне; остальные форматы сохраняются карточкой
со скачиванием оригинала для открытия в приложении устройства.

Оригиналы и изображения страниц хранятся локально в IndexedDB, а структура
доски — в localStorage. Файлы не отправляются на сервер. Очистка данных сайта
удаляет локальные записи и вложения. PDF.js, шрифты и декодеры входят в сборку,
просмотр не зависит от внешнего CDN. Проверка: `./scripts/npm.sh run verify:files`
(компьютер, WebKit на планшете, телефон по HTTP). Для одного профиля:
`./scripts/npm.sh run verify:files -- phone`.

«Удалить лист» открывает выбор одного номера или диапазона с начальным и
конечным листом включительно. Можно удалить первый, последний или средние
листы. Следующие листы с содержимым получают новые номера; хотя бы один лист
остаётся. Удаление подтверждается и целиком отменяется/повторяется одним
действием. Проверка: `./scripts/npm.sh run verify:page-deletion`.

## Личные кабинеты: первый этап

Оценки за урок выставляются от 1 до 10. К каждой записи результата преподаватель
может прикрепить один PDF-конспект (до 20 МБ), заменить его или убрать вложение.
После загрузки нужно нажать «Сохранить изменения». Ученик может просмотреть
или скачать конспект в своём кабинете; файлы доступны только участникам этого кабинета.

На телефонах и планшетах масштабируются только листы; инструменты и список тем остаются на месте.
Двумя пальцами можно увеличивать и перемещать рабочую область; ладошкой —
листать, ручкой — писать. В кабинете ученика скрыты фигуры, загрузка файлов
и полная очистка; вставка изображений из буфера также отключена.
Проверка масштаба листа в Chromium и WebKit: `npm run verify:board-scale`.

В профиле есть календарь, который строится из еженедельного расписания.
Чтобы перенести одно занятие, выберите день → «Перенести урок», укажите новую
дату и время → «Применить перенос» → «Сохранить изменения». Остальные недели
сохраняют обычное расписание. Перенос можно вернуть кнопкой «Вернуть по расписанию».
Ученик видит сохранённые изменения; открытый кабинет обновляется каждые 30 секунд
и при возвращении в окно. Все даты и время занятий указаны по Москве.

Откройте `/cabinet` через главное меню «Мой кабинет». При первом запуске на
самом Mac (`127.0.0.1`/`localhost`) можно один раз создать учительский логин и
пароль. Открытая регистрация отсутствует; с телефона по LAN этот шаг недоступен.
Учитель создаёт учеников по логину и паролю, задаёт постоянное расписание
(московское время), оценки 1–10, выполнение ДЗ 0–100% и комментарии к урокам.
Пароль ученика можно сменить; старые сеансы при этом отключаются. Почта, имена
и телефоны не нужны. Пароли хранятся как scrypt-хеши, сеансы — серверные,
в HttpOnly/SameSite cookies. API проверяет права на каждый профиль, доску и файл.

У каждого ученика есть `/cabinet/board/<id>`: отдельная доска с сохранением на
сервере, доступная ему и преподавателю. Файлы передаются по частям и также
хранятся на сервере, чтобы открываться в другом браузере. Общая доска автоматически обновляется в двух кабинетах: вращение 3D-фигур
передаётся во время перетягивания, точки и построения видны обоим участникам.
При одновременном редактировании клиент объединяет изменения отдельных объектов
и полей, а API проверяет ревизию перед записью. Локальная копия сохраняется
для восстановления при обрыве связи. Доска `/board` хранится в браузере.

Локальная база автоматически создаётся в `.local/accounts.sqlite` и не входит
в Git. Не удаляйте `.local`, если в базе уже есть нужные аккаунты. `.env.local`
может задать DATABASE_URL для PostgreSQL; пример переменной — в `.env.example`.
При DATABASE_URL SQLite не используется. В production без DATABASE_URL API
закрыт (503), а публичная регистрация преподавателя запрещена.

Для Vercel потребуется отдельная PostgreSQL-база и серверная переменная
DATABASE_URL. Учитель создаётся один раз локальной командой с подключением
к этой базе: `./scripts/npm.sh run accounts:setup` (логин и скрытый ввод пароля).
Не используйте переменную VITE_DATABASE_URL: строка подключения остаётся только
на сервере. На Vercel Node.js 24+. После подключения базы нужно отдельно
проверить миграцию, вход и сохранение в production перед выдачей данных ученикам.

`./scripts/npm.sh run verify:accounts` запускает изолированную SQLite-базу на
порту 5176 и проверяет вход, роли, чужие данные, CSRF, смену пароля, расписание,
результаты, создание ученика через UI и доску из двух отдельных сеансов.
Тест не создаёт аккаунтов в рабочей базе.

Выделение области на доске: выберите «Ладошка», дважды нажмите на листе и,
удерживая второе нажатие, протяните рамку. На компьютере можно также просто
потянуть на пустом месте. Объекты, целиком попавшие в рамку, перемещаются вместе
при перетягивании внутри выделения. Escape или «Снять выделение» убирает рамку,
«Отменить» возвращает перемещение всей группы за один шаг.
Проверка в Chromium и WebKit: `npm run verify:group-selection`.

Обрезка скриншота: выберите изображение ладошкой → «Обрезать», выделите
нужную область или перетащите уголки рамки → «Применить обрезку». Исходные
пиксели сохраняются, обрезка поддерживает отмену/повтор, сохранение в кабинете
и экспорт PDF. Надписи поверх изображения остаются на своих местах.
Проверка на телефоне и компьютере в Chromium/WebKit: `npm run verify:image-crop`.

Доски по темам доступны на `/board` и в кабинетах. На компьютере слева от листа
находятся карточки: нажмите на название для переключения. Новую тему можно
создать, переименовать и переместить стрелками. В кабинетах список создаёт
преподаватель, ученику доступны переходы между готовыми темами. На телефоне
список сворачивается под заголовком «Доски по темам».

Старая доска остаётся в карточке «Текущий урок». В кабинете каждая тема хранится
с отдельной версией; перед переходом записи отправляются на сервер. Если
сохранение не удалось, переключение блокируется, текущие записи остаются
открытыми. При ошибке показывается её причина и результат записи локальной
копии. Быстрая отмена штриха до автосохранения отменяет и его отправку.
В общей доске темы хранятся в этом браузере. За раз загружается содержимое
одной темы; список остальных содержит только названия. Новые скриншоты из
буфера хранятся отдельными файлами, без больших строк изображений в записях.

Календарь подсвечивает светло-зелёным дни с занятиями, включая перенесённые.
Проверка тем, переноса старых данных и защиты сохранения: `npm run verify:topics`.

PDF как доска: в списке тем нажмите «Добавить PDF» и выберите файл до 20 МБ,
от 1 до 100 страниц. Дождитесь подготовки всех страниц. PDF появится отдельной
карточкой с названием файла; его можно переименовать и переместить в списке.
Страницы закреплены фоном: ручка и выделитель пишут поверх, ластик стирает
пометки, исходный лист не сдвигается и не удаляется ластиком. 3D-визуализации
в меню такой доски скрыты. Готовые записи можно скачать через обычный экспорт
конспекта PDF. В кабинете файл добавляет преподаватель, ученик открывает
готовую PDF-доску и пишет на ней; данные сохраняются с теми же правами, что
и остальные тематические доски. Прежний способ вставки PDF-вложений тоже доступен.
Проверка PDF-досок и доступа с телефона: `npm run verify:pdf-topics`.

На ноутбуке жест приближения двумя пальцами на тачпаде увеличивает только
листы под курсором, без браузерного увеличения панелей. Поддерживаются
Ctrl+wheel-события тачпада и gesture-события Safari. На сенсорном экране
двумя пальцами можно увеличивать лист и перемещать область просмотра.
Масштаб ограничен диапазоном 50–400%; кнопка процента возвращает исходный размер 75%.
Проверка точности привязки и письма: `npm run verify:sheet-zoom`.

## Локальный Go backend

Go backend находится в `backend-go/` и входит в общий репозиторий проекта.
Инструкции — `backend-go/README.md`. Для подключения этого React к Go:

```sh
./scripts/npm.sh run dev:go
```

В этом режиме `/board` открывает личные доски вошедшего пользователя с хранением
в PostgreSQL, `/cabinet` использует тот же Go API. Обычный `npm run dev` и сборка
Vercel сохраняют прежнее поведение. Production Docker-образ собирается с `VITE_GO_BACKEND=true`.

Настройка сервера, GHCR, GitHub Actions, SSL и резервного копирования описана
в [deploy/README.md](deploy/README.md).

## Account-based boards and topic management

`/board` now always opens the signed-in user's server board. Go deployments
persist accounts, notebooks, and attachments in PostgreSQL. Local Node-only
development uses its server-side SQLite database. Legacy anonymous notebooks
remain at `/board/local`; they are preserved and are not automatically migrated
into an account. A link to existing legacy notes appears in the teacher board.
To share data across devices, use the same published site and the correct account.

Return/Enter submits topic/PDF renaming. Teachers can move an extra board into
the workspace's Trash using the button below its active title and a confirmation
dialog. Trash preserves all pages, PDF metadata, annotations and the board ID for
seven days. Restore returns the board to the active list and opens it. The required
`main` board is protected. Students cannot see trash, restore boards, or read/write
trashed boards. Revisions advance on deletion and restoration to reject stale writes.

Migration `002_board_trash.sql` adds nullable `deleted_at`; existing boards stay
active. The Go API purges expired boards (including their pages and PDF metadata
via cascading foreign keys) on startup and every minute, independently of requests.
Expired entries are immediately excluded from trash and restoration. Node local
development uses the same retention and cleanup interval with SQLite. Shared asset
bytes remain because other notebooks or lesson notes may reference them. Legacy
anonymous `/board/local` retains its original local-only deletion behavior.
Verification: `npm run verify:topic-management`; Go: `cd backend-go && ./scripts/dev.sh test`.


## Groups of boards

Account workspaces support up to 50 named groups (migration `003_board_groups.sql`).
Teachers can create/rename groups, add boards and PDFs directly into a group, and
move existing boards using “Группа этой доски”. Groups collapse independently and
show active-board highlighting and board counts. The main lesson stays pinned;
existing boards start ungrouped. Topic ordering controls operate within a group.

Group membership is server-owned metadata, separate from notebook revisions and
contents. Removing a group moves its active and trashed boards to “Без группы”;
restoring a trashed board keeps its group if the group still exists. Students can
browse groups but cannot manage them. Composite owner/group foreign keys and
teacher-only mutations prevent cross-account assignment. Node local development
has matching group operations; anonymous legacy boards keep their original list.
Verification: `npm run verify:board-groups` and the Go PostgreSQL integration suite.


## Shared phone and tablet board layout

Teachers and pupils share the full-width sheet viewport and translucent floating
controls on touch devices. Both start at 100% and can pull the first sheet down
or sideways using the hand tool and the existing 96px margins. Topic/group lists
collapse after selection. The teacher retains file uploads, figures, grid toggling,
selection controls, trash, groups, and page management; page buttons are compact
icons above undo/redo. The tool strip scrolls independently on short screens.
Figure menus, drawing options, and confirmation dialogs remain within the viewport.
Desktop layout and student permissions are preserved.
`npm run verify:teacher-touch` covers phone/tablet portrait and landscape; local
runs check Chromium and WebKit, while CI runs the available Chromium browser.


## Insert theory PDF pages into the current board

The teacher toolbar's “Добавить PDF в эту доску” button accepts a PDF up to 20 MB.
Choose the beginning (default), a position before any existing sheet, or the end.
All imported pages are locked backgrounds with writable ink above them. Existing
objects shift with their sheets; the current board/topic, group and original PDF
remain unchanged. Insertion is one undo/redo operation and is included in account
sync and exported lesson PDFs. Assets upload before notebook changes; malformed
files, processing errors and the 100-sheet limit do not change existing content.
The sidebar's “PDF как новая доска” remains a separate workflow.

Laptop controls now use separate rounded tiles for teachers and pupils, with a
transparent container and the existing desktop layout. Touch controls retain their
floating layout. `npm run verify:inline-pdf` checks both board kinds, every insertion
position, old content, undo/redo, persistence, cross-device pupil annotations, export
and failure cases. Set `BOARD_BROWSER=webkit` for the same check in WebKit.


## Feedback while pasting screenshots

Image paste immediately displays a transient frame, then a blurred preview with a
loading indicator until the image is uploaded and committed. The frame is separate
from the notebook, does not intercept drawing input, and is excluded from saved data and PDF
exports. Errors remain visible with Retry/Dismiss actions. Multiple images have
independent jobs. Account topic switches wait for pending uploads and flush the
result to the original board. Leaving the page uses the existing unsaved-work guard;
unmounted boards ignore late upload completions.
`npm run verify:paste-feedback` holds asset requests to exercise loading, failure,
retry/dismiss, ink layering, multi-image paste, undo/redo and account persistence.
The test dispatches clipboard events without altering the user's system clipboard.
Use `BOARD_BROWSER=webkit` to run it in WebKit.
