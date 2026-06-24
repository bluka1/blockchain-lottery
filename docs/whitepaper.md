# Blockchain Lottery – Inicijalni White Paper

## 1. Uvod

Ovaj dokument opisuje koncept i tehničku realizaciju **Blockchain Lottery** projekta, razvijenog kao studentski projekt. Cilj projekta je demonstrirati korištenje pametnih ugovora (smart contracts), decentraliziranog random izvlačenja putem oraclea te integraciju s frontendom i backendom.

Projekt se izvodi na **Ethereum testnetu** i nema financijsku ili komercijalnu namjenu.

---

## 2. Pregled projekta

Blockchain Lottery omogućuje korisnicima da sudjeluju u decentraliziranoj lutriji putem svog crypto walleta, bez potrebe za centralnim posrednikom. Sva pravila, uvjeti sudjelovanja i mehanizmi raspodjele nagrada zapisani su u pametnom ugovoru (smart contract), čime se osigurava transparentnost i povjerenje u sustav.

Svaki sudionik sudjeluje pod jednakim uvjetima, s unaprijed definiranim iznosom uloga i jasno specificiranim pravilima odabira brojeva. Sustav je dizajniran tako da minimizira mogućnost manipulacije, oslanjajući se isključivo na on-chain logiku i decentralizirane orakle za generiranje slučajnosti.

Projekt nema cilj simulirati realnu financijsku lutriju, već služi kao edukativni primjer kako se može izgraditi kompletna decentralizirana aplikacija (dApp) koja uključuje:

* pametni ugovor
* web korisničko sučelje
* off-chain analitički sustav
* off-chain keeper servis koji automatizira životni ciklus pojedinog kruga

## 3. Pravila lutrije

### 3.1 Sudjelovanje

Sudjelovanje u lutriji odvija se isključivo putem web aplikacije povezane s Ethereum testnetom. Korisnik mora posjedovati kompatibilni crypto wallet (npr. MetaMask) kako bi mogao sudjelovati.

Uvjeti sudjelovanja:

* jedan wallet = jedna prijava po lutrijskom krugu
* fiksni ulog od **0,0050 ETH**
* obavezan odabir **5/50 brojeva** (svih 5 mora biti različito)

Smart contract validira sve uvjete prije prihvaćanja prijave.

### 3.2 Timeline i faze

Svaki lutrijski krug ima jasno definirani vremenski tijek:

1. **Open Phase**

   * dozvoljene su prijave i uplate
   * korisnici biraju brojeve i šalju transakciju

2. **Closed Phase**

   * prijave su zatvorene
   * više nije moguće sudjelovati

3. **Draw Phase**

   * pokreće se proces generiranja slučajnih brojeva
   * koristi se oracle za randomness

4. **Payout Phase**

   * izračun dobitnika
   * automatska isplata nagrada

Faze su implementirane kao stanje (state machine) unutar smart contracta.

---

## 4. Mehanizam izvlačenja

Dobitna kombinacija generira se korištenjem **Chainlink VRF-a (Verifiable Random Function)**.

Proces:

1. Kada istekne vrijeme kruga, keeper servis poziva `performUpkeep`, koji zatvara krug i šalje zahtjev VRF-u
2. VRF dostavlja kriptografski sigurne slučajne vrijednosti, iz kojih ugovor generira 5 jedinstvenih brojeva od 1 do 50
3. Rezultat (dobitni brojevi i seed za odabir sekundarnih dobitnika) trajno se zapisuje na blockchain

Ovim pristupom osigurava se:

* Nemogućnost manipulacije
* Transparentnost i provjerljivost
* Povjerenje bez centralnog autoriteta

Ugovor je kompatibilan s **Chainlink Automation** standardom — implementira `checkUpkeep`/`performUpkeep`. Cijeli životni ciklus kruga (zatvaranje → zahtjev VRF-u → isplata → novi krug) pokreće se automatski, bez ručne intervencije, putem **off-chain keeper servisa** koji periodički provjerava `checkUpkeep` i izvršava `performUpkeep` (vidi §6.4). Pristup je odabran jer je Chainlink Automation usluga povučena na testnetima; ista `checkUpkeep`/`performUpkeep` logika ostaje upotrebljiva i s Chainlink Automationom ili migracijom na CRE. Ako automatizacija zakaže, vlasnik ugovora ima ručne fallback funkcije, a postoji i mehanizam za otkazivanje zaglavljenog VRF zahtjeva nakon timeouta (koji keeper poziva automatski).

---

## 5. Podjela nagrada

Nagradni fond jednog kruga čine sve prikupljene uplate tog kruga. Uplate se dijele u tri dijela: **50%** ide u jackpot, **40%** u sekundarni (lucky-draw) fond i **10%** za pokrivanje troškova. Jackpot dio dodatno uključuje i **akumulirani iznos** prenesen iz prethodnih krugova (vidi §5.4).

### 5.1 Glavni dobitnik (jackpot)

* **50%** kruga (uvećano za akumulirani jackpot) dodjeljuje se sudioniku koji je pogodio **svih 5** brojeva
* ako ima više dobitnika s 5 pogodaka, jackpot se dijeli jednako među njima
* ako **nitko** ne pogodi svih 5, jackpot se ne isplaćuje nego se prenosi (rollover) u sljedeći krug

### 5.2 Sekundarni dobitnici (lucky draw)

* **40%** fonda raspodjeljuje se na **nasumično odabrane sudionike** (otprilike **10%** sudionika, najmanje 1, najviše 20)
* odabir je **neovisan o broju pogođenih brojeva** — moguće je osvojiti i bez ijednog pogotka, a pogodak ne jamči nagradu
* svaki sekundarni dobitnik dobiva jednak udio

Odabir sekundarnih dobitnika koristi seed iz Chainlink VRF-a kako bi se osigurala pravednost. Ako je jackpot osvojen, dobitnici jackpota se isključuju iz sekundarnog izvlačenja (osim ako nema dovoljno drugih sudionika).

Zbog činjenice da svaka isplata nagrade predstavlja zasebnu blockchain transakciju koja troši gas, dio fonda (maksimalno **10%**) rezerviran je za pokrivanje transakcijskih troškova.
Time se osigurava da sustav može autonomno izvršiti sve isplate bez vanjske intervencije.

### 5.3 Isplate

* nakon izvlačenja ugovor automatski **izračunava i kreditira** nagrade svim dobitnicima (jackpot, sekundarni dobitnici i naknada za troškove)
* dobitnici svoje nagrade preuzimaju pozivom funkcije `withdraw()` (pull-payment obrazac)
* ovaj pristup sprječava da jedan dobitnik koji ne može primiti sredstva blokira isplatu svima ostalima
* nema ručne intervencije ili centralne kontrole nad izračunom dobitnika

### 5.4 Akumulacija jackpota (rollover)

Budući da se jackpot dodjeljuje samo za pogođenih svih 5 brojeva, u praksi često nema dobitnika jackpota u pojedinom krugu. U tom slučaju:

* neisplaćeni jackpot dio (50% kruga + eventualni ranije akumulirani iznos) **prenosi se u sljedeći krug** (`accumulatedJackpot`)
* sekundarni fond (40%) i naknada za troškove (10%) isplaćuju se normalno u tekućem krugu
* time jackpot raste iz kruga u krug sve dok ga netko ne osvoji, kada se resetira na nulu

Prikazani "Current Jackpot" je stoga zbroj akumuliranog iznosa i 50% trenutno prikupljenih uplata.

---

## 6. Tehnička arhitektura

### 6.1 Smart Contract

Smart contract predstavlja središnji dio sustava i implementiran je u programskom jeziku **Solidity**.

Glavne odgovornosti:

* upravljanje lutrijskim fazama
* validacija uplata i odabranih brojeva
* pohrana prijava sudionika
* komunikacija s randomness oracleom
* izračun dobitnika
* automatska distribucija nagrada

Contract je dizajniran kao deterministički sustav, gdje je jedini izvor nedeterminističkog ponašanja oracle-based randomness.

### 6.2 Frontend

Frontend je web aplikacija koja služi kao korisničko sučelje prema smart contractu.

Osnovni ekrani:

* početna stranica s opisom projekta i pravilima
* povezivanje walleta
* forma za odabir brojeva i uplatu
* prikaz statusa lutrije (otvorena / zatvorena / izvlačenje)
* prikaz rezultata i dobitnika

Frontend ne sadrži poslovnu logiku – sva pravila su u smart contractu.

### 6.3 Backend (Analitika)

Backend komponenta služi isključivo za analizu i vizualizaciju podataka.

Primjeri analitika:

* učestalost pojedinih brojeva
* broj sudionika po krugu
* raspodjela dobitaka kroz vrijeme

Backend koristi blockchain evente kao izvor podataka i nema mogućnost utjecaja na ishod lutrije.

### 6.4 Keeper servis (automatizacija)

Keeper je zaseban off-chain proces koji automatizira napredovanje životnog ciklusa kruga. U pravilnim intervalima poziva `checkUpkeep`; kada ugovor signalizira da je akcija potrebna, keeper šalje `performUpkeep` transakciju.

Karakteristike:

* izveden kao samostalan worker, odvojen od API-ja i analitičkog listenera (jedinstvena odgovornost, izolacija ovlaštenog ključa)
* potpisuje transakcije računom koji je ovlašten u ugovoru (vlasnik / registry), te troši ETH za gas
* **bez utjecaja na ishod** — ne generira slučajnost niti bira dobitnike; samo "gura" korake koje ugovor ionako dopušta
* mora postojati točno jedna aktivna instanca (više njih = konkurentne transakcije)
* automatski otkazuje zaglavljeni VRF zahtjev nakon isteka timeouta i ponavlja izvlačenje

Lokalni razvoj koristi ekvivalentni keeper koji dodatno simulira VRF i napredovanje vremena na lokalnom čvoru.

---

## 7. Sigurnost i ograničenja

* Projekt je isključivo edukativnog karaktera
* Izvodi se na testnetu
* Nema stvarnu financijsku vrijednost
* Smart contract neće biti auditiran za produkcijsku upotrebu
* Napredovanje životnog ciklusa ovisi o off-chain keeper servisu (ovlašteni račun) — to je točka centralizacije, ali keeper ne može utjecati na slučajnost ni odabir dobitnika (oni su određeni Chainlink VRF-om i on-chain logikom); u najgorem slučaju (keeper nedostupan) krug čeka, a vlasnik ima ručne fallback funkcije

---

## 8. Zaključak

Blockchain Lottery projekt demonstrira praktičnu primjenu blockchain tehnologije, pametnih ugovora i decentraliziranog random izvlačenja. Projekt služi kao edukativni primjer end-to-end blockchain aplikacije s frontendom i analitičkim backendom.

Dokument predstavlja okvirni razvojni plan i može se proširivati dodatnim tehničkim detaljima i implementacijskim odlukama.
