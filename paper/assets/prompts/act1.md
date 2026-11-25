# Фото акту 1 — промпти

Загальний стиль: документальне фото, Україна 2020-х, без брендів, логотипів і читабельного тексту. Генерується в Gemini. Результат стискається до ≤ 400 КБ (`sips -Z 1600`) і кладеться в `app/public/img/`.

Обмеження 16+: жодного тіла чи ушкоджень у кадрі — лише покривало й черевик на краю кадру.

## Портрети фігурантів (картки А6, лист Крук)

Формат «фото для досьє»: анфас, плечі в кадрі, нейтральний сірий фон, рівне денне світло, без усмішки на камеру, вертикально 3:4. Однакове світло для всіх.

| Файл | Хто | Промпт |
|---|---|---|
| `p-orest.jpg` | Орест Гайовий, 58 | Realistic documentary portrait photo of a 58-year-old Ukrainian man, museum curator, thinning grey hair, neat short grey beard, round wire-rimmed glasses, brown tweed jacket over a light shirt, kind tired eyes, blurred museum display cases behind him, soft window light, vertical 3:4, natural skin texture, no text |
| `p-zgurska.jpg` | Марта Згурська, 46 | Realistic ID-style portrait photo of a 46-year-old Ukrainian woman, museum director, shoulder-length dark chestnut hair, confident expression, dark blazer, small statement earrings, neutral grey background, even daylight, vertical 3:4, no text |
| `p-prokopchuk.jpg` | Неля Прокопчук, 44 | Realistic ID-style portrait photo of a 44-year-old Ukrainian woman, quiet accountant, light brown hair in a low bun, minimal makeup, beige knitted cardigan, calm neutral face, neutral grey background, even daylight, vertical 3:4, no text |
| `p-luhovyi.jpg` | Степан Луговий, 39 | Realistic ID-style portrait photo of a 39-year-old Ukrainian man, night security guard, stocky, short buzz-cut dark hair, two-day stubble, tired eyes, dark navy security uniform jacket, neutral grey background, even daylight, vertical 3:4, no text or logos |
| `p-korzh.jpg` | Давид Корж, 61 | Realistic ID-style portrait photo of a 61-year-old Ukrainian man, metal restorer, curly grey hair, bushy eyebrows, weathered face, checked flannel shirt, neutral grey background, even daylight, vertical 3:4, no text |

## Місце події

| Файл | Що | Промпт |
|---|---|---|
| `1-02-clock.jpg` | Циферблат вежі, 23:17 | Realistic photo of the south clock face of an 18th-century stone clock tower in a small Ukrainian town, early morning overcast light, white clock dial with black Roman numerals, the hour hand just past XI and the minute hand pointing at 17 minutes past (time 11:17), damp stone, shot from below with a phone, horizontal 3:2, no text |
| `1-03-watch.jpg` (v2) | A police forensic evidence photo, horizontal 3:2, taken straight from above with a harsh on-camera flash. A man's old mechanical wristwatch with a worn brown leather strap lies on wet grey square concrete paving tiles. The dial is plain cream with simple thin baton hour markers and no numerals at all. The hands show 11:17: the short hour hand points just past the 11 o'clock marker, the long minute hand points a little past the 3 o'clock marker. The watch glass is smashed by a small point impact in the centre with radial cracks; the case and the strap have no scratches. Next to it a small white L-shaped forensic scale ruler with centimetre marks and a yellow plastic evidence marker with the number 2. Flat, slightly overexposed flash light, hard shadows, no artistic blur, looks like a real crime-scene photo. No other text, no logos. |
| `1-04-square.jpg` | Площа під вежею | Realistic smartphone photo at dawn of a small paved square below an old stone clock tower, wet grey square concrete paving tiles, a grey municipal blanket covering something on the ground at the very edge of the frame with only one black leather shoe visible, a street sweeper's cart in the distance, no people's faces, no blood, horizontal 3:2, no text |
| `1-10-fireworks-a.jpg` | Феєрверк, кадр 1 | Realistic night telephoto photo from a hotel balcony: colorful fireworks in the sky above an old European-style Ukrainian town, an illuminated stone clock tower in the frame with its clock face visible, at the base of the tower by the wooden door a small distant figure of an older man in a felt hat waiting, slight sensor noise, vertical 3:4, no text |
| `1-10-fireworks-b.jpg` | Феєрверк, кадр 2 | Realistic night telephoto photo: big colorful fireworks bursts filling the sky, the top of an old stone clock tower spire at the bottom edge of the frame, slight sensor noise, vertical 3:4, no text |
| `c-02-paving.jpg` | Текстура для фото криміналістів | Realistic top-down photo of a plain grey concrete surface wet after rain, subtle stains and small puddles, evenly lit overcast light, no tile seams, no objects, horizontal 2:1, no text |

## Перевірка кожного кадру

- 16+: у кадрі немає тіла чи ушкоджень.
- Годинники показують 23:17. Якщо ні — накладка `ClockHands` (циферблат) або повторна генерація.
- Немає читабельного тексту й логотипів.
- Вік і стать портретів відповідають біблії (розділ 3).

## Що вийшло (17.11.2026)

- Генерація в настільному застосунку Gemini. Файл береться з тимчасової теки після кліку по зображенню. У вбудованому браузері завантаження не зберігаються, а CSP Gemini блокує передачу байтів зі сторінки.
- `1-10-fireworks-b.jpg` — фрагмент верхньої частини кадру `1-10-fireworks-a`, без окремої генерації.
- `1-02-clock`: стрілки показують ≈ 11:15–11:17, накладка не потрібна. `1-03-watch`: циферблат повернутий, з урахуванням повороту ≈ 11:15.
- Оригінали — в `assets/raw/` (не в git), стиснені копії — в `app/public/img/` (≤ 400 КБ, ≤ 1600 px).

## Акт 2 (18.11.2026)

| Файл | Промпт |
|---|---|
| `astrolabe.jpg` | Realistic museum catalogue photo of an antique 17th-century brass planispheric astrolabe with gilded engraved scales and an ornate openwork rete, lying on a dark grey velvet cloth, soft studio light from above, square 1:1, no text |
| `p-bayda.jpg` | Realistic ID-style portrait photo of a 52-year-old Ukrainian man, local politician and construction business owner, heavyset, short greying hair, clean-shaven, self-assured slight smile, expensive dark suit with an open-collar white shirt, neutral grey background, vertical 3:4, no text, no flags or badges |
| `p-veis.jpg` | Realistic ID-style portrait photo of a 63-year-old Ukrainian man, antique dealer, thin face, neatly trimmed white goatee, slicked-back silver hair, small round tortoiseshell glasses, dark green corduroy jacket over a burgundy turtleneck, guarded expression, neutral grey background, vertical 3:4, no text |
| `p-dorosh.jpg` | Realistic ID-style portrait photo of a 49-year-old Ukrainian man, police sergeant, broad face, short dark hair greying at the temples, thick moustache, tired cautious eyes, plain dark blue uniform shirt without any insignia, neutral grey background, vertical 3:4 |

## Акт 3 (18.11.2026)

| Файл | Промпт (скорочено) |
|---|---|
| `3-03-mechanism.jpg` | Tower clock room: cast-iron movement, pendulum, two weights on chains, yellow tape measure along a chain, 3:2 |
| `3-05-tower-day.jpg` | Sunny late afternoon, arched door of a stone clock tower, long shadow of a street lamp across paving to the right, woman ~44 in beige cardigan by the door looking at a camera above it, 3:2. Довжину тіні (28 плиток) задає не фото, а позначка експерта в підписі. |
| `p-iryna.jpg` | 21-year-old student, long dark blonde hair, red-rimmed eyes, grey hoodie, ID-style 3:4 |
| `p-solomiya.jpg` | 34-year-old journalist, short curly auburn hair, olive utility jacket, ID-style 3:4 |
| `p-tymur.jpg` | 17-year-old museum volunteer, messy dark hair, navy hoodie, camera strap, ID-style 3:4 |
| `p-barvinok.jpg` | 72-year-old clockmaker, bald with white fringe, loupe on forehead, leather apron, ID-style 3:4 |

## Акт 4 (18.11.2026)

| Файл | Промпт (скорочено) |
|---|---|
| `4-07-safe.jpg` | Cluttered curator's office, old CRT monitor, stacks of papers and books, grey wall safe with a 12-key keypad in the foreground, keys 1, 4, 6, 7 worn shiny, the rest dull, warm lamp light, 3:2 |
| `4-06-cctv.jpg` | High-angle CCTV still at night, wet cobbled street corner in an old town, small white hatchback turning, headlights glare, water droplets on the lens, no readable plate, 16:9 |
| `4-11-orest-1974.jpg` (v2) | An old amateur black-and-white family photograph from 1974, horizontal 3:2, printed on matte paper with a white border, faded and slightly yellowed, with grain, a few dust specks and a crease. Slightly out of focus and a little tilted, uneven exposure from a window. In a small Soviet-era provincial museum hall, a six-year-old boy in a buttoned wool coat and his father in a hat stand at a low glass display case; the boy presses his hands against the glass looking down at an antique brass astrolabe lying flat on velvet inside: a flat round disc like a large pocket watch, with an ornate openwork plate and a small ring on top. It is NOT a globe and NOT an armillary sphere. Seen from behind at a slight angle so their faces are barely visible. No text, no logos. |

## Етап 6 (18.11.2026) — заміна після сліпих проходжень

| Файл | Промпт |
|---|---|
| `1-04-square.jpg` (v2) | Realistic smartphone photo at dawn, taken standing on a small town square, looking along the foot of an old grey stone clock tower. The rough stone south wall and the wooden door of the tower fill the left third of the frame, close and clearly the tower's base. The ground is wet grey square concrete paving tiles 40 cm wide laid in straight rows starting at the wall. About four metres out from the foot of the tower wall, in the middle of the paving, lies a grey municipal blanket covering something on the ground, with only one black leather shoe visible at its edge. Nothing else nearby, a street sweeper's cart far in the distance, overcast early light, no people's faces, no blood, horizontal 3:2, no text, no logos. |

Стара версія показувала тіло біля стіни іншої будівлі, а вежу — далеко на задньому плані; усі три сліпі проходження помітили суперечність із протоколом. Нову версію обрізано праворуч від дверей (`sips -c 569 854 --cropOffset 140 410`): вхід до вежі за кресленням північний, тож на південній стіні дверей бути не може. Файл узято з тимчасової теки Quick Look (`lsof -c QuickLook`) після подвійного кліку по зображенню в Gemini.

## Реалістичніші фото (18.11.2026, ChatGPT)

Портрети були однією «фотосесією»: та сама сіра стіна, м'яке світло, ідеальна симетрія. Тепер кожне фото має своє правдоподібне джерело: база поліції, пропуск, преса, знімок колеги на телефон. Генерація — у ChatGPT (користувач обрав його після порівняння з Gemini на Барвінку). До кожного портретного промпту додано спільний хвіст:

> Unretouched and imperfect like a real photo: natural skin texture with pores, blemishes and asymmetry, no beauty retouching, no studio lighting, no shallow depth-of-field portrait look, no cinematic colour grading. No text, no logos, no watermarks.

| Файл | Промпт |
|---|---|
| `p-barvinok.jpg` | An unretouched, candid snapshot of a 72-year-old Ukrainian man, a small-town clockmaker, taken by a colleague on an ordinary mid-range smartphone in his cramped workshop … brass watchmaker's loupe hangs on a black cord around his neck … Vertical 3:4. (повний текст — у розмові ChatGPT «Create Workshop Portrait») |
| `p-bayda.jpg` | A slightly blurry press photo from a city council session in a small Ukrainian town, cropped to head and shoulders, vertical 3:4. A 52-year-old Ukrainian man, local deputy and construction business owner: heavyset, short greying hair, clean-shaven, fleshy face, self-assured half-smile, expensive dark suit with an open-collar white shirt, speaking with one hand raised mid-gesture. Behind him rows of wooden council desks, other people's shoulders, a beige wall, harsh fluorescent ceiling light, slight motion blur on the hand. |
| `p-dorosh.jpg` | A staff photo from a police personnel database, vertical 3:4, head and shoulders. A 49-year-old Ukrainian man, patrol police sergeant: broad face, short dark hair greying at the temples, thick moustache, tired cautious eyes, a shaving nick on the jaw. Plain dark blue uniform shirt without any readable insignia or badges. Shot with a harsh direct on-camera flash against a pale bluish wall with his hard shadow behind him, slightly overexposed forehead, flat colours, a bit off-centre, like a cheap compact camera in an office corridor. |
| `p-iryna.jpg` | A casual photo a friend took on a phone in a university chemistry lab, vertical 3:4, head and shoulders. A 21-year-old Ukrainian woman, fourth-year chemistry student: long dark blonde hair with a few loose strands, no make-up, slightly puffy tired eyes, a grey hoodie under an open white lab coat, safety glasses pushed up on her head. Behind her a cluttered lab bench with glassware, a fume hood and a whiteboard with illegible scribbles, cold fluorescent light with a faint green cast, slight phone noise, framing slightly tilted, she looks into the camera without smiling. |
| `p-korzh.jpg` | A photo for a small local newspaper feature, taken in a metal restorer's workshop, vertical 3:4, head and shoulders. A 61-year-old Ukrainian man, metal restorer: curly grey hair, bushy eyebrows, weathered sun-lined face, a checked flannel shirt with rolled sleeves, a little metal dust on his shoulder. Behind him a workbench with a vise, files, brass fragments and a grinding wheel, light from a dusty window and a work lamp, everything in focus, slight grain. He looks at the camera warily, not smiling. |
| `p-luhovyi.jpg` | A photo from a security company's personnel file, vertical 3:4, head and shoulders. A 39-year-old Ukrainian man, museum night security guard: stocky, short buzz-cut dark hair, two-day stubble, dark circles under tired eyes, a dark navy security jacket without logos over a grey T-shirt. Taken in a narrow corridor against a white door with a direct on-camera flash: flat light, his shadow on the door, slightly washed-out skin, a bit of red-eye, framing slightly off-centre. |
| `p-orest.jpg` | A photo from a small provincial museum's website staff page, taken by a colleague with an ordinary camera, vertical 3:4, head and shoulders. A 58-year-old Ukrainian man, the museum's chief curator: thinning grey hair, neat short grey beard, round wire-rimmed glasses, brown tweed jacket over a light shirt, kind tired eyes, a slight smile. He stands among old wooden display cases with exhibits; mixed window daylight and old ceiling lamps, slightly uneven white balance, mild noise, a window reflection in one display case. |
| `p-prokopchuk.jpg` | A photo for an office ID badge taken on a phone by a colleague in an accounting office, vertical 3:4, head and shoulders. A 44-year-old Ukrainian woman, chief accountant: light brown hair pulled into a low bun, minimal make-up, a beige knitted cardigan over a dark top, a calm, polite, unremarkable expression, thin lips, small earrings. Behind her a plain office wall with the edge of a wall calendar and a filing cabinet, cold fluorescent light, slightly soft focus, a little noise. |
| `p-solomiya.jpg` | A byline photo for a local news website, taken outdoors on a city street on an overcast day by a colleague with a phone, vertical 3:4, head and shoulders. A 34-year-old Ukrainian woman, journalist: short curly auburn hair messed by the wind, light freckles, an olive utility jacket over a black top, a press lanyard with a blank card, a confident, slightly impatient look. Behind her an ordinary street with parked cars and old buildings, flat grey daylight, framing slightly tilted. |
| `p-tymur.jpg` | A casual photo taken by a friend on a phone at a museum during a town festival, vertical 3:4, head and shoulders. A 17-year-old Ukrainian boy, volunteer museum guide: messy dark hair, a few teenage spots, a navy hoodie, a camera strap over one shoulder and a volunteer badge on a lanyard with a blank card, a shy grin. Behind him a museum hall with visitors and a plain festival banner, mixed indoor light, slight motion blur and noise. |
| `p-veis.jpg` | A photo taken by a customer with a phone inside a cramped antique shop, vertical 3:4, head and shoulders. A 63-year-old Ukrainian man, antique dealer: thin face, neatly trimmed white goatee, slicked-back silver hair, small round tortoiseshell glasses, a dark green corduroy jacket over a burgundy turtleneck, a guarded expression. Around him shelves of old clocks, porcelain and brass instruments, warm tungsten light with deep shadows, slight noise, a little off-centre. |
| `p-zgurska.jpg` | A press photo from a museum press conference in a small Ukrainian town, cropped to head and shoulders, vertical 3:4. A 46-year-old Ukrainian woman, museum director: shoulder-length dark chestnut hair, confident but tired expression, a dark blazer, small statement earrings, a slight frown while speaking; the edge of a microphone in the lower corner. Behind her a museum hall with a display case and a few blurred visitors, on-camera flash mixed with warm room light, slight motion blur. |
| `4-06-cctv.jpg` | A still frame from a cheap municipal street CCTV camera at night, horizontal 3:2. High-mounted wide-angle view looking down at a narrow wet cobbled street beside an old stone museum building. Grainy black-and-white infrared image with heavy compression blocks, noise and slight fisheye distortion. A light-coloured compact European hatchback with a Skoda-like shape and no logos drives through, headlights blooming, slight motion blur; its licence plate is an unreadable smear. Street lamp glare, puddles. No overlay text, no timestamp, no logos. |
| `1-03-watch.jpg` (v2) | A police forensic evidence photo, horizontal 3:2, taken straight from above with a harsh on-camera flash. A man's old mechanical wristwatch with a worn brown leather strap lies on wet grey square concrete paving tiles. The dial is plain cream with simple thin baton hour markers and no numerals at all. The hands show 11:17: the short hour hand points just past the 11 o'clock marker, the long minute hand points a little past the 3 o'clock marker. The watch glass is smashed by a small point impact in the centre with radial cracks; the case and the strap have no scratches. Next to it a small white L-shaped forensic scale ruler with centimetre marks and a yellow plastic evidence marker with the number 2. Flat, slightly overexposed flash light, hard shadows, no artistic blur, looks like a real crime-scene photo. No other text, no logos. |
| `4-11-orest-1974.jpg` (v2) | An old amateur black-and-white family photograph from 1974, horizontal 3:2, printed on matte paper with a white border, faded and slightly yellowed, with grain, a few dust specks and a crease. Slightly out of focus and a little tilted, uneven exposure from a window. In a small Soviet-era provincial museum hall, a six-year-old boy in a buttoned wool coat and his father in a hat stand at a low glass display case; the boy presses his hands against the glass looking down at an antique brass astrolabe lying flat on velvet inside: a flat round disc like a large pocket watch, with an ornate openwork plate and a small ring on top. It is NOT a globe and NOT an armillary sphere. Seen from behind at a slight angle so their faces are barely visible. No text, no logos. |

Перевірка:
- `1-03-watch`: перша версія мала зіпсований циферблат (дві «10», дві «2»). Друга — циферблат без цифр, лише риски; стрілки 11:17.
- `4-11-orest-1974`: у першій версії у вітрині була армілярна сфера. Друга — пласка астролябія, як на `astrolabe.jpg`.
- `4-06-cctv`: номер авто — нечитабельна пляма; його частковий запис «ВХ 47?7 А?» дає підпис.

Файли забираються з ChatGPT кнопкою «Copy image» під зображенням (справжній клік; натискання через доступність не копіює) і зберігаються з буфера обміну через `osascript … «class PNGf»`. Оригінали — в `assets/raw/*-chatgpt.png`.

## Постановочний час 22:10 (18.11.2026, ChatGPT)

Сюжет перевели з 23:17 на 22:10, бо 10:10 — класична поза стрілок, яку генератори малюють упевнено. Перегенеровано всі кадри, де видно стрілки.

| Файл | Промпт |
|---|---|
| `1-02-clock.jpg` | A realistic smartphone photo taken from the street below in early morning overcast light: the south clock face of an old 18th-century stone clock tower in a small Ukrainian town, a white dial with black Roman numerals. The clock is stopped and shows exactly 10:10: the short hour hand points just past X and the long minute hand points straight at II. Damp weathered stone with moss and streaks, slight upward perspective, a bit of noise and smartphone sharpening, flat grey light, horizontal 3:2. Unretouched, no cinematic grading. No text, no logos. |
| `1-03-watch.jpg` | A police forensic evidence photo, horizontal 3:2, taken straight from above with a harsh on-camera flash. A man's old mechanical wristwatch with a worn brown leather strap lies on wet grey square concrete paving tiles; the watch is oriented normally, with its 12 o'clock at the top of the frame and the crown on the right. The dial is plain cream with simple thin baton hour markers and no numerals at all. The hands show exactly 10:10 … Next to it a small white L-shaped forensic scale ruler with centimetre marks and a yellow plastic evidence marker with the number 2. … |
| `1-10-fireworks-a.jpg` | A real night photo taken with a 200 mm telephoto lens from a third-floor hotel balcony during a town festival, vertical 3:4. Colourful fireworks burst in the sky above the old rooftops … an illuminated old stone clock tower with a white clock face with Roman numerals clearly visible; the clock shows 10:10 … At the base of the tower, by its wooden door, a small distant figure of an older man in a felt hat is waiting. Slight sensor noise … not cinematic. No text, no logos. |
| `1-10-fireworks-b.jpg` | Фрагмент верхньої частини `1-10-fireworks-a` (`sips -c 1013 760 --cropOffset 0 120`, потім `-Z 840`). |

Оригінали — `assets/raw/*-2210-chatgpt.png`.
