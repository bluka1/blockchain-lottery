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

## 3. Pravila lutrije

### 3.1 Sudjelovanje

Sudjelovanje u lutriji odvija se isključivo putem web aplikacije povezane s Ethereum testnetom. Korisnik mora posjedovati kompatibilni crypto wallet (npr. MetaMask) kako bi mogao sudjelovati.

Uvjeti sudjelovanja:

* jedan wallet = jedna prijava po lutrijskom krugu
* fiksni ulog od **0,0050 ETH ili otprilike 10 USD**
* obavezan odabir **5/50 brojeva**

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

1. Kada istekne vrijeme kruga, Chainlink Automation poziva `performUpkeep`, koji zatvara krug i šalje zahtjev VRF-u
2. VRF dostavlja kriptografski sigurne slučajne vrijednosti, iz kojih ugovor generira 5 jedinstvenih brojeva od 1 do 50
3. Rezultat (dobitni brojevi i seed za odabir sekundarnih dobitnika) trajno se zapisuje na blockchain

Ovim pristupom osigurava se:

* Nemogućnost manipulacije
* Transparentnost i provjerljivost
* Povjerenje bez centralnog autoriteta

Cijeli životni ciklus kruga (zatvaranje → zahtjev VRF-u → isplata → novi krug) pokreće se automatski putem **Chainlink Automation-a**, bez ručne intervencije. Ako automatizacija zakaže, vlasnik ugovora ima ručne fallback funkcije, a postoji i mehanizam za otkazivanje zaglavljenog VRF zahtjeva nakon timeouta.

---

## 5. Podjela nagrada

Ukupni nagradni fond sastoji se od svih prikupljenih uplata u jednom lutrijskom krugu.

### 5.1 Glavni dobitnik

* **50%** ukupnog fonda dodjeljuje se sudioniku koji je pogodio točnu dobitnu kombinaciju
* u slučaju da nema točne kombinacije, može se primijeniti logika "najbliže kombinacije" (npr. najveći broj pogođenih brojeva)

### 5.2 Sekundarni dobitnici

* **40%** fonda raspodjeljuje se između **10–15% nasumično odabranih sudionika**
* svaki sekundarni dobitnik dobiva jednak udio

Odabir sekundarnih dobitnika također koristi randomness oracle kako bi se osigurala pravednost.

Zbog činjenice da svaka isplata nagrade predstavlja zasebnu blockchain transakciju koja troši gas, dio fonda (maksimalno **10%**) rezerviran je za pokrivanje transakcijskih troškova.
Time se osigurava da sustav može autonomno izvršiti sve isplate bez vanjske intervencije.

### 5.3 Isplate

* nakon izvlačenja ugovor automatski **izračunava i kreditira** nagrade svim dobitnicima (jackpot, sekundarni dobitnici i naknada za troškove)
* dobitnici svoje nagrade preuzimaju pozivom funkcije `withdraw()` (pull-payment obrazac)
* ovaj pristup sprječava da jedan dobitnik koji ne može primiti sredstva blokira isplatu svima ostalima
* nema ručne intervencije ili centralne kontrole nad izračunom dobitnika

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

---

## 7. Sigurnost i ograničenja

* Projekt je isključivo edukativnog karaktera
* Izvodi se na testnetu
* Nema stvarnu financijsku vrijednost
* Smart contract neće biti auditiran za produkcijsku upotrebu

---

## 8. Zaključak

Blockchain Lottery projekt demonstrira praktičnu primjenu blockchain tehnologije, pametnih ugovora i decentraliziranog random izvlačenja. Projekt služi kao edukativni primjer end-to-end blockchain aplikacije s frontendom i analitičkim backendom.

Dokument predstavlja okvirni razvojni plan i može se proširivati dodatnim tehničkim detaljima i implementacijskim odlukama.
