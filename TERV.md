# GHOST LOOP – terv és tervezési döntések

Minden döntés mellett egy mondatos indoklás áll.

## Név

**GHOST LOOP** maradt: rövid, angol, egyből elmondja a csavart (a próbálkozásaid szellemként visszatérnek egy hurokban), és jól mutat a CrazyGames bélyegképein.

## Koncepció röviden

Rövid (8–14 mp-es) precíziós platformer-pályák. Minden kört rögzíthetsz (R), és a következő körben a korábbi köreid szellemként, pontosan ugyanúgy újrajátszódnak: gombot nyomnak, lépcsőként szolgálnak, egymásra állnak. A pálya akkor teljesül, ha az élő figura célba ér, miközben a szellemek a megfelelő pillanatban a megfelelő helyen vannak.

## Architektúra

```
src/
  core/        Phaser-független, tesztelt logika
    physics.js       fix időlépésű, determinisztikus test-fizika
    world.js         a teljes pálya szimulációja (élő + szellemek, gombok, ajtók, liftek, veszélyek)
    replay.js        input-rögzítés, visszajátszás, RLE-kódolás
    level-loader.js  JSON pálya ellenőrzése és pixel-koordinátára alakítása
    solver.js        megoldás-bot nyelv + teljes megoldás lefuttatása (ellenőrzés)
    daily.js         napi pálya-generátor (seed → sablon → ellenőrzés)
    rng.js, save.js, share.js
  levels/      level01..12.json + index.js (build időben beágyazva)
  render/      WorldView.js – a szimuláció kirajzolása Graphics-szal
  scenes/      BootScene, MenuScene, LevelSelectScene, GameScene, DailyScene
  ui/          HUD, panelek, gombok, érintős vezérlés, téma, áttűnések
  audio/       sfx.js – WebAudio szintetizátor
  sdk.js       CrazyGames SDK hívási pontok (kikapcsolva)
  state.js     mentés-példány és hangbeállítás
tests/         vitest: replay, betöltő, megoldhatóság, napi generátor, mentés/megosztás
scripts/       verify-levels.mjs (parancssori ellenőrzés), trace.mjs, daily-stats.mjs
```

- **A játéklogika Phaser nélkül fut** – így Node-ban tesztelhető, és ugyanaz a kód ellenőrzi a pályákat, amelyik a játékot futtatja.
- **Saját fizika a Phaser Arcade helyett** – az Arcade változó `delta`-val és belső sorrendekkel dolgozik, a szellem-visszajátszáshoz viszont bitre pontos ismétlés kell.
- **Fix 60 Hz-es lépés, akkumulátorral és interpolált rajzolással** – a szimuláció független a képfrissítéstől, 120 Hz-es kijelzőn is sima marad a kép.
- **Csak alap aritmetika a fizikában** (+ − × ÷, min/max) – az IEEE-754 ezekre minden gépen ugyanazt adja, a `Math.sin` és társai viszont eltérhetnek.
- **Input = 1 bájt/képkocka (bal, jobb, ugrás bitek)** – ez a legkisebb állapot, ami a mozgást teljesen meghatározza; egy 15 mp-es kör 900 bájt, RLE-vel néhány tucat karakter.
- **Az ugrás "lenyomás" élét a fizika képzi a tartott bitből** – így a visszajátszásnak nem kell külön eseményeket tárolnia.
- **Coyote-idő és ugráspuffer (6-6 képkocka)** – precíziós platformernél ez adja a "fair" érzést, és mivel inputból számolódik, determinisztikus marad.
- **A szellemek csak felülről szilárdak, és mindenki csak a nála régebbi szellemre állhat** – így egy korábbi kör szelleme pontosan úgy viselkedik, mint amikor élőben felvetted (az újabb szellemek nem zavarhatják meg).
- **Frissítési sorrend: mozgó elemek → ajtók → szellemek (régitől) → élő játékos → veszélyek → gombok** – ez ugyanaz a sorrend, amiben a szellem élőként futott, ezért a visszajátszás egyezik.
- **A szellem a felvétele vége után tétlenül áll** – így ha a gombon állva nyomsz R-t, a szellem örökre nyomva tartja.
- **A szellem inputot játszik vissza, nem pozíciót** – a feladat ezt kérte, és ettől lehetnek érdekes "paradoxonok" (ha az élő játékos megváltoztatja a világot, a szellem is máshogy mozoghat).
- **Egyirányú platformra 4 px-en belülről is fel lehet lépni** – a mozgó komp/lift elérése így nem pixelvadászat, a meglévő pályák megoldásai változatlanul működnek.
- **Az automatikusan járó elemek megállhatnak a végpontokon (`pause`)** – a kompra/liftre fel- és leszállásnak legyen emberi időablaka.
- **Az ajtó nem zárhat rá senkire** – amíg valaki benne áll, nyitva marad; így nincs érthetetlen halál vagy beszorulás.
- **A mozgó platformok egyirányúak (csak felülről)** – egyszerű, kiszámítható, és liftként így is működik.
- **A kör az első inputtal indul ("LOOP n – move to start")** – a szellemek nem mennek el nélküled, és van idő végiggondolni a következő kört.
- **Legfeljebb 4 szellem** – a pályák max. 3-at igényelnek, a 4. mozgásteret ad, de a képernyő áttekinthető marad.

## Pályák

A pályák JSON-ban, **rácsegységben** vannak (1 egység = 30 px, 32×18-as pálya = 960×540), mert kézzel így sokkal könnyebb szerkeszteni; a betöltő alakítja pixelre.

Mezők: `id, name, hint, size, timeLimit, ghosts (par), spawn, goal, platforms, hazards (álló tüske vagy `to`+`speed` mozgó fal), buttons, doors (button/buttons, mode any/all, invert = híd), movers (lift), solution`.

| # | Név | Szellem | Idő | Mit tanít |
|---|-----|---------|-----|-----------|
| 1 | First Steps | 0 | 8 s | mozgás, ugrás |
| 2 | Mind the Gap | 0 | 9 s | tüskék, szakadékok |
| 3 | Up and Over | 0 | 10 s | változó ugrásmagasság, platformok |
| 4 | Echo | 1 | 8 s | gomb + ajtó, első szellem |
| 5 | Ghost Step | 1 | 9 s | a szellem lépcső |
| 6 | Lift Off | 1 | 12 s | lift, a szellem időzítése |
| 7 | Two Keys | 2 | 10 s | két gomb, két szellem |
| 8 | Tower | 2 | 11 s | szellem a szellemen |
| 9 | Bridge Builder | 2 | 11 s | szellem-lépcső + híd |
| 10 | Relay | 2 | 14 s | ajtó + lift, egymásra épülő szellemek |
| 11 | Clockwork | 2 | 12 s | mozgó falak, "all" ajtó |
| 12 | Ghost Loop | 3 | 13 s | ajtó + kétszintes torony |
| **2. fejezet – Paradox** | | | | |
| 13 | Shuttle | 1 | 12 s | magától járó komp szakadék fölött |
| 14 | Crusher Row | 1 | 12 s | három zúzó, a szellem is átidőzít |
| 15 | Stairway | 2 | 12 s | két szellem = két lépcsőfok |
| 16 | Two to Tango | 2 | 12 s | „all” ajtó, egyik gomb egy másik ajtó mögött |
| 17 | Lift Shaft | 2 | 13 s | lift + keresztbe söprő lézer, időzített gomb |
| 18 | Hold the Bridge | 2 | 12 s | két híd, két őr, zúzó |
| 19 | Ghost Ladder | 3 | 14 s | háromszintes szellem-létra |
| 20 | Clock Tower | 2 | 13 s | torony + söprő akadály időzítése |
| 21 | Paradox | 1 | 12 s | egy gomb emel ÉS zár – a szellemnek jókor kell elengednie |
| 22 | Elevator | 2 | 13 s | magától járó lift + kétgombos ajtó fent |
| 23 | Echo Chamber | 3 | 14 s | három gomb egyszerre + zúzó |
| 24 | The Last Loop | 3 | 15 s | ajtó → lift → lépcső, mindenkinek dolga van |

- **Minden pálya JSON-jában benne van a megoldása** (bot-tokenekben) – így a teszt minden futáskor igazolja, hogy a pálya megoldható, és egy pályamódosítás sem törheti el észrevétlenül.
- **A szellemes pályákra "rövidítés-keresés" is fut** (jobbra futás 1–2 ugrással, minden időzítéssel, szellem nélkül) – ez kiszűri, ha egy pálya véletlenül szellem nélkül is megoldható.
- **Az időkeretek a leghosszabb bot-kör kb. 1,8–2,5-szörösei** – a bot tökéletes, embernek kell ráhagyás, de feszesnek kell maradnia.

### A megoldás-nyelv (solver.js)

`R30`/`L30`/`W30` (tartás N lépésig), `RJ20` (ugrás + irány), `Rg` (amíg földet ér), `Wo:d1` (amíg az ajtó nyílik / lift felér), `T120` (várás adott képkockáig), `@12.5` (odasétál és megáll), `R@12.5` (fut addig). **Ezek állapotfüggő vezérlők, nem fix képkockaszámok** – így a megoldások olvashatók, és a generált pályák paraméterei mellett is működnek.

### Pályatervező eszközök

- `npm run verify` – minden pálya betöltése és a megoldás lefuttatása.
- `node scripts/trace.mjs levelXX` – a megoldás utolsó köre lépésenként.
- `node scripts/solve-timing.mjs levelXX --write` – a megoldásba írt `T?` helyőrzőkre (várakozás adott képkockáig) szimulációval keres működő időzítést. **Az időzítős pályákat (zúzók, liftek) így terveztem:** a pontos képkockát a gép számolja, a pálya garantáltan megoldható marad.

## Függőséget okozó rendszerek (visszatérésre ösztönzés)

- **3 csillag pályánként:** teljesítés, par szellemszám, arany idő – több futásból is összegyűjthetők, így mindig van egy következő cél.
- **Érmek a fejlesztői időhöz mérve:** bronz / ezüst (+60%) / arany (+25%) / **„Beat the Dev”** (a pályát igazoló bot ideje). A cél pontos, igazságos és mindig elérhető, hiszen a bot ugyanazzal a fizikával érte el.
- **PB-szellem:** a legjobb futásod arany körvonalként veled fut minden körben – közvetlenül látod, hol veszítesz időt (a trajektória külön localStorage-kulcsban, kb. 1 KB/pálya).
- **Eredménykártya:** a csillagok egyenként „pattannak be”, az idő felpörög, érem-jelvény, és kiírja a **következő elérhető célt** („finish in 5.40s for gold”); SPACE = következő pálya, R = újra.
- **Kinézetek:** 7 karakterszín csillagokért (0 / 6 / 14 / 24 / 36 / 50 / 66), az utolsó („Prism”) szivárványos.
- **16 achievement** felugró értesítéssel (pl. Beat the Dev, Clean Loop, Ghost Ladder, napi sorozatok).
- **Profil-képernyő:** kinézetválasztó, achievement-lista, statisztikák (körök, szellemek, esések).
- **HUD:** a pályanév mellett a már megszerzett csillagok, az időzítő alatt az arany célidő.

## Játék közbeni segítők (3. kör)

- **Szellem-előnézet:** a kör indulása előtt halvány pontsor mutatja a szellemek útját, és körvonal jelzi, hol állnak meg a felvételük végén. Egy külön, álló élő játékossal futtatott szimuláció adja (a világ determinisztikus, ezért pontos). **A tervezést segíti anélkül, hogy megoldaná a feladványt.**
- **Szellem-idővonal a HUD-on:** szellemenként egy sáv mutatja, meddig tart a felvétele, egy kurzor pedig azt, hol tart a kör – így látszik, mikor „áll le” egy szellem.
- **Visszatekerés-animáció:** rögzítéskor (lila) és halálnál/újraindításnál (a kinézet színében) a figura az útvonalán visszapörög a startra – a „hurok” téma vizuálisan is érződik.
- **Megoldás-visszajátszás:** 3 kör után a szünetmenüben „SHOW SOLUTION”: a fejlesztői megoldás (szellemekkel együtt) lejátszódik, bármely gombbal átugorható, utána a játékos saját szellemei változatlanok. A megoldó ehhez eltárolja a győztes kör inputjait (`finalInputs`), a teszt igazolja, hogy a visszajátszás képkockára nyer. 5 sikertelen kör után a kezdőfelirat is jelzi a lehetőséget. **Elakadásnál ez tartja meg a játékost ahelyett, hogy kilépne.** CrazyGames-en jutalomvideó elé köthető (`sdk.rewardedAd`, kikapcsolva azonnal indul).
- **Eltérés a legjobb időhöz** az eredménykártyán (pl. „NEW BEST −0.23s” vagy „+0.40s vs best”).

## Zene

**Generált synthwave (audio/music.js):** Am–F–C–G akkordmenet 104 BPM-en, lebegő pad, szűrt arpeggio visszhanggal; játék közben basszus, lábdob és cin is szól. Előretekintő ütemezéssel (25 ms-onként a következő 150 ms) pontos marad a ritmus; háttérbe tett lapon a hang szünetel; a zene külön kapcsolható.

## Daily Loop

- **Seed = hash("ghostloop:" + helyi dátum + ":" + próbálkozás)**, mulberry32 generátorral – mindenki ugyanazt kapja az adott napon, hálózat nélkül.
- **Generátor + szimulációs ellenőrzés a fix 30-as készlet helyett** – 7 paraméterezett sablon (ajtó, lépcső, lift, híd, két ajtó, torony, ajtó+lépcső), véletlen akadályokkal és tükrözéssel; minden sablon a saját megoldását is megírja, a generátor pedig csak akkor adja ki a pályát, ha a determinisztikus szimuláció igazolta, hogy a megoldás pontosan a megadott számú szellemmel nyer.
- **Ha egy seed nem ad igazolt pályát, a következő jön (max. 40), végső esetben a tesztelt kézi pályák közül választ** – így garantáltan megoldható pálya kerül ki; a teszt egy teljes évre ellenőrzi, hogy a tartalékra soha nincs szükség.
- **Az időkeret a leghosszabb kör 1,5-szerese + 2 s (8–15 s)**, majd újraellenőrzés a szűkített kerettel.
- **Megosztás: Wordle-szerű emojisor** – 🟪 szellem, 🟥 halál, 🟨 lejárt idő, ⬛ újraindítás, ⬜ visszavonás, 🟩 cél; alatta körök, szellemek, idő és sorozat.
- **Egy nap csak egyszer számít** – az újrajátszás gyakorló mód, így a sorozat és a megosztott eredmény tisztességes.

## Vizuális stílus és effektek

- **Háttér minden jelenetben (render/Backdrop.js):** mélylila → fekete színátmenet, két rétegű, halvány neon városkép ablakfényekkel, puha fényfoltok, lefelé erősödő rács, lebegő por (részecskék) és vignetta; így a képnek mélysége van, de a pálya elemei elől nem veszi el a figyelmet.
- **Platformok:** színátmenetes test, pontminta, körbefutó keret és fénylő, ragyogó tető sarokjelekkel, hogy a háttér előtt élesen kiváljanak.
- **Élő figura:** lekerekített cián test üveg-csillanással, pislogó szemekkel, amik a mozgás irányába néznek, összenyomás–nyújtással, gyors mozgásnál szellemképekkel.
- **Szellemek:** klasszikus hullámzó aljú sziluett (első ránézésre elkülönül az élő figurától), félig átlátszó lila, a régebbiek halványabbak, fölöttük sorszám, mögöttük nyomvonal.
- **Cél:** villogó zöld kapu forgó gyémánttal, az ég felé mutató fénysugárral és felszálló szikrákkal, így a pálya bármely pontjáról látszik, merre kell menni.
- **Veszély:** tüskék háromszínű fogakkal és vörös derengéssel, a mozgó falakon csúszó figyelmeztető csíkok.
- **Gombok, ajtók, liftek:** csoportonként saját szín, energiamező-ajtók mozgó csíkokkal és jelzőfényekkel, lenyomott gombnál fénysugár, a lift irányát chevronok mutatják.
- **Effektek:** részecskék és lökéshullám-gyűrűk halálnál, célba érésnél és rögzítésnél, "visszatekerés" (lila pásztázó sávok) minden új körnél, kamera-remegés és -villanás, pálya-intró kártya.
- **Betűk:** Orbitron a címekhez és számokhoz, Exo 2 a szöveghez (@fontsource, a buildbe csomagolva, ~50 KB), neon fénnyel.
- **Minden alakzat kódból (Graphics), a részecske-textúra is futásidőben generált 6×6-os négyzet** – nincs külső kép, a build kicsi.
- **Bloom helyett saját additív (ADD) fényréteg** – a kamera-bloom elmosta a szövegeket és gyenge telefonon drága, az ADD-glow mindenhol olcsó és éles marad.
- **Színátmenet csak téglalapon** – WebGL-ben a lekerekített alakzatokon a színátmenet átlós hibát rajzol, ezért ott rétegezett sima kitöltés van.
- **Belső 2× felbontás nagy kijelzőn, 1× kicsin** – asztalon éles a vektoros kép, olcsó telefonon nem pazaroljuk a kitöltési sebességet.

## Vezérlés

- Billentyűzet: nyilak/A-D mozgás, Space/fel/W ugrás, R rögzítés, Backspace újraindítás, Z utolsó szellem törlése, Esc/P szünet, M némítás; a menük nyilakkal + Enterrel is kezelhetők.
- **Mobilon a pálya 72%-ra kicsinyítve felülre kerül, a vezérlők alá és mellé** – így az ujj soha nem takarja el a pályát vagy a célt.
- Érintés: bal-alul ◀ ▶ zóna, jobb-alul JUMP és REC, a jobb szélen UNDO és újraindítás; több ujjas érintést kezel (futás + ugrás egyszerre).
- **Álló telefonon „fordítsd el” képernyő** (HTML/CSS, animált neon telefon-ikon): a 16:9-es kép állva a képernyő negyedét töltené ki; a futó kör ilyenkor szünetel, fekvőre fordítva eltűnik, a „PLAY ANYWAY” gomb a következő fordításig elrejti. Asztali álló ablakban nincs ilyen, ott letterbox marad.
- **Az első érintés automatikusan bekapcsolja az érintős módot** asztali érintőképernyőn is.

## Hang

**WebAudio szintetizátor, fájlok nélkül:** lépés (szűrt zaj), ugrás (felfelé csúszó négyszög), landolás, halál (zaj + lecsúszó fűrész), célba érés (C-dúr akkord arpeggio), szellem rögzítése (visszhangos csippanás késleltetés-visszacsatolással), gomb, ajtó, menü. Az AudioContext az első gesztusnál indul, a némítás mentődik.

## Mentés

`localStorage` (`ghostloop.save.v1`): pályánként teljesítve, legjobb idő, legkevesebb szellem, legkevesebb kör; napi sorozat, legjobb sorozat, napi eredmények; hangbeállítás. **Minden hozzáférés try/catch-ben** – privát módban vagy tiltott tárolónál is fut a játék, csak nem ment.

## CrazyGames SDK

`src/sdk.js`: `loadingStart/Stop` (Boot), `gameplayStart` (pálya indul, szünet vége), `gameplayStop` (szünet, győzelem, menük), `happytime` (első teljesítés, napi megoldás), `midgameAd` (minden 3. teljesített pálya után a "Next" gombnál). **`SDK_ENABLED = false`**: a hívások helyi placeholderek, a reklám-callback azonnal továbbenged, így nincs hálózati hívás. Élesítés: SDK v3 script tag az `index.html`-be és `SDK_ENABLED = true`.

## Teljesítmény és méret

- Build: ~1,4 MB (≈ 370 KB gzip), ebből a Phaser ~1,2 MB – jóval az 50 MB alatt.
- **A statikus rétegek textúrába sülnek (render/bake.js):** a Phaser a Graphics parancsait minden képkockán újra feldolgozza, ezért a háttér (városkép, rács, fényfoltok) és a pálya statikus része (platformok, tüskék) egyszer egy DynamicTexture-be rajzolódik, és onnan egyetlen képként jelenik meg. A statikus fény külön textúra, additív keveréssel – a kép pontosan ugyanaz, mint élőben rajzolva.
- **A szöveg csak változáskor rajzolódik újra:** a HUD időzítőjének színe és fénye csak a „kevés idő” állapot váltásakor frissül (korábban minden képkockán kétszer rajzolta újra a canvas-szöveget blurral).
- **Radiális fény-textúra** (Boot-ban generálva) a körökből összerakott fényfoltok helyett; képkockánként újrahasznosított képek.
- **Telefonon legfeljebb 1,5× belső felbontás és 60 fps-limit**, a Phaser saját hangrendszere kikapcsolva (a hangot a saját WebAudio szintetizátor adja).
- **Automatikus könnyített mód:** ha játék közben a képkockaidő tartósan 25 ms fölött van, a dinamikus fényréteg, az utóképek és a por nagy része kikapcsol; a döntés mentődik. Kézzel: `?fx=lite` / `?fx=full`.
- **A fejlesztői idők lusta számítással** készülnek (első használatkor), így a 24 megoldás szimulációja nem lassítja az indulást.
- Mérés (szoftveres WebGL, azonos gép, 12. pálya 3 szellemmel): renderelés 15,0 → ~9 ms/képkocka, könnyített módban ~5,6 ms.
- Legfeljebb 6 fizikai lépés egy képkockán (lassú eszközön sem "spirál" a fix lépés).

## Tesztelés

`npm test` (vitest):
- **replay**: ugyanaz az input → ugyanaz a mozgás (test és teljes világ szinten); a rögzített kör szellemként pontosan ugyanazt a pályát járja be; 3 réteg egymásra épülő szellem is egyezik; RLE oda-vissza; tétlen szellem.
- **pályabetöltő**: minden pálya betölt, a nehézségi görbe (0-0-0, 1-1-1, 2+…), időkeretek, mértékegység-átváltás, 10 féle hibás bemenet elutasítása.
- **megoldhatóság**: mind a 12 pálya megoldása lefut a par szellemszámmal; szellemes pályák szellem nélkül nem mennek; nincs futás-ugrás rövidítés; a napi generátor egy teljes évre igazolt pályát ad tartalék nélkül; determinisztikus; minden sablon működik.
- **mentés/megosztás**: rekordok, sorozat (hónapváltással), sérült mentés, emojisor.

Ezen felül fejlesztés közben Playwright-tal a valódi GameScene-ben is lefutott mind a 12 megoldás, képkockára ugyanazzal az eredménnyel, mint a szimulátorban.

## Fejlesztési sorrend (állapot)

1. ✅ Vite + Phaser váz, git, README, TERV.md, jelenetek
2. ✅ Mozgás, determinisztikus fizika fix időlépéssel
3. ✅ Input-rögzítő és visszajátszó rendszer
4. ✅ JSON pályabetöltő, 1–6. pálya
5. ✅ Több szellem, gombok, ajtók, liftek, mozgó falak, 7–12. pálya
6. ✅ Menük, pályaválasztó, HUD, mentés
7. ✅ Hangok
8. ✅ Daily Loop és megosztható eredmény
9. ✅ Effektek, átmenetek, időkeretek hangolása
10. ✅ SDK hívási pontok (kikapcsolva), production build

## Második kör (bővítés)

11. ✅ 2. fejezet: 12 új, ellenőrzötten megoldható pálya (összesen 24)
12. ✅ Csillagok, érmek, PB-szellem, eredménykártya
13. ✅ Kinézetek, achievementek, profil
14. ✅ Generált zene, letisztított HUD

## Következő lépések (ötletek)

- Pályaszerkesztő a böngészőben (a JSON formátum és a solver már készen áll hozzá).
- "Szellem-idővonal" a HUD-on: mikor végez az egyes szellemek felvétele.
- Visszajátszás-megosztás: a győztes kör inputjai RLE-ben beleférnek a megosztott szövegbe.
- Több pálya és új elemek (időzített gomb, kapcsoló, teleport), valamint haptikus visszajelzés mobilon.
