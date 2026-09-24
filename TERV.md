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

- **Minden pálya JSON-jában benne van a megoldása** (bot-tokenekben) – így a teszt minden futáskor igazolja, hogy a pálya megoldható, és egy pályamódosítás sem törheti el észrevétlenül.
- **A szellemes pályákra "rövidítés-keresés" is fut** (jobbra futás 1–2 ugrással, minden időzítéssel, szellem nélkül) – ez kiszűri, ha egy pálya véletlenül szellem nélkül is megoldható.
- **Az időkeretek a leghosszabb bot-kör kb. 1,8–2,5-szörösei** – a bot tökéletes, embernek kell ráhagyás, de feszesnek kell maradnia.

### A megoldás-nyelv (solver.js)

`R30`/`L30`/`W30` (tartás N lépésig), `RJ20` (ugrás + irány), `Rg` (amíg földet ér), `Wo:d1` (amíg az ajtó nyílik / lift felér), `T120` (várás adott képkockáig), `@12.5` (odasétál és megáll), `R@12.5` (fut addig). **Ezek állapotfüggő vezérlők, nem fix képkockaszámok** – így a megoldások olvashatók, és a generált pályák paraméterei mellett is működnek.

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
- **Az első érintés automatikusan bekapcsolja az érintős módot** asztali érintőképernyőn is.

## Hang

**WebAudio szintetizátor, fájlok nélkül:** lépés (szűrt zaj), ugrás (felfelé csúszó négyszög), landolás, halál (zaj + lecsúszó fűrész), célba érés (C-dúr akkord arpeggio), szellem rögzítése (visszhangos csippanás késleltetés-visszacsatolással), gomb, ajtó, menü. Az AudioContext az első gesztusnál indul, a némítás mentődik.

## Mentés

`localStorage` (`ghostloop.save.v1`): pályánként teljesítve, legjobb idő, legkevesebb szellem, legkevesebb kör; napi sorozat, legjobb sorozat, napi eredmények; hangbeállítás. **Minden hozzáférés try/catch-ben** – privát módban vagy tiltott tárolónál is fut a játék, csak nem ment.

## CrazyGames SDK

`src/sdk.js`: `loadingStart/Stop` (Boot), `gameplayStart` (pálya indul, szünet vége), `gameplayStop` (szünet, győzelem, menük), `happytime` (első teljesítés, napi megoldás), `midgameAd` (minden 3. teljesített pálya után a "Next" gombnál). **`SDK_ENABLED = false`**: a hívások helyi placeholderek, a reklám-callback azonnal továbbenged, így nincs hálózati hívás. Élesítés: SDK v3 script tag az `index.html`-be és `SDK_ENABLED = true`.

## Teljesítmény és méret

- Build: ~1,3 MB (≈ 360 KB gzip), ebből a Phaser ~1,2 MB – jóval az 50 MB alatt.
- A statikus pályaelemek egyszer rajzolódnak ki; képkockánként csak néhány tucat dinamikus alakzat.
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

## Következő lépések (ötletek)

- Pályaszerkesztő a böngészőben (a JSON formátum és a solver már készen áll hozzá).
- "Szellem-idővonal" a HUD-on: mikor végez az egyes szellemek felvétele.
- Visszajátszás-megosztás: a győztes kör inputjai RLE-ben beleférnek a megosztott szövegbe.
- Több pálya és új elemek (időzített gomb, kapcsoló, teleport), valamint haptikus visszajelzés mobilon.
