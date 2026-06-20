# 🍪 Milla's Chunky Cookies – cookie-bestilling

En enkel, pen nettside for å selge hjemmebakte cookies på bestilling.
Hovedpoenget: **du åpner for bestilling, og siden stenger seg selv automatisk når
grensen er nådd** – så du slipper å stoppe manuelt. Du kan også åpne/stenge når du vil,
kjøre «kom og kjøp»-direktesalg, og samle en venteliste.

Alt styres fra **ett Google-regneark** + **én Google Drive-mappe** med bilder. Ingen koding
i hverdagen – det meste kan gjøres fra mobilen.

---

## Slik henger det sammen

```
Nettsiden (index.html, GitHub Pages)
        │  henter status + bilder
        ▼
Google Apps Script (Code.gs)  ──►  Google-regneark (Innstillinger, Innhold,
        ▲                            Bestillinger, Venteliste)
        │  lister bilder      ──►  Google Drive-mappe (bilder)
```

- **Innstillinger** – status, grense, pris, Vipps-nummer, hentested
- **Innhold** – all tekst på siden (navn, slagord, beskrivelse)
- **Bestillinger** – kommer inn her automatisk
- **Venteliste** – navn/kontakt når det er stengt
- **Drive-mappe** – bildene i galleriet

---

## Del 1 – Oppsett (gjøres én gang)

### A. Lag regnearket
1. Gå til [sheets.new](https://sheets.new) og lag et nytt regneark. Kall det f.eks. «Milla's Chunky Cookies».

### B. Lag bildemappen i Google Drive
1. I [Google Drive](https://drive.google.com): **Ny → Mappe**, kall den f.eks. «Cookie-bilder».
2. Høyreklikk mappen → **Del** → endre til **«Alle med lenken» = Seer**.
3. Åpne mappen og kopier **ID-en fra adressefeltet**:
   `https://drive.google.com/drive/folders/`**`DETTE_ER_ID-EN`**
4. Legg noen cookie-bilder i mappen (kan gjøres senere).

### C. Lim inn Apps Script
1. I regnearket: **Utvidelser → Apps Script**.
2. Slett alt i `Code.gs`, lim inn hele innholdet fra denne mappens `Code.gs`.
3. Øverst i fila, fyll inn:
   - `BILDE_MAPPE_ID` = ID-en fra steg B3
   - `VARSEL_EPOST` = e-posten din (få varsel ved nye bestillinger). Kan stå tom.
4. Lagre (💾).

### D. Lag arkfanene automatisk
1. I Apps Script: velg funksjonen **`settUppRegneark`** i nedtrekksmenyen → trykk **Kjør**.
2. Godkjenn tilgang når Google spør (din egen konto).
3. Gå tilbake til regnearket – nå finnes fanene **Innstillinger, Innhold, Bestillinger,
   Venteliste** med standardverdier. ✅

### E. Publiser web-appen
1. I Apps Script: **Deploy → New deployment**.
2. Tannhjul → velg **Web app**.
3. Sett:
   - **Execute as:** Me
   - **Who has access:** **Anyone**
4. **Deploy** → kopier **web-app-URL-en** (slutter på `/exec`).

> Endrer du `Code.gs` senere, må du **Deploy → Manage deployments → rediger (blyant) →
> Version: New version → Deploy** for at endringen skal bli live.

### F. Koble nettsiden til
1. Åpne `index.html`, finn `CONFIG` nær toppen av `<script>`.
2. Lim web-app-URL-en inn i `APPS_SCRIPT_URL`:
   ```js
   const CONFIG = {
     APPS_SCRIPT_URL: "https://script.google.com/macros/s/.../exec",
     ...
   ```
3. Lagre. (Står den tom, viser siden et pent **demo-innhold** så du kan se designet.)

### G. Publiser nettsiden gratis (GitHub Pages)
1. Lag et nytt GitHub-repo og last opp `index.html` (+ ev. `og-image.jpg`).
2. **Settings → Pages → Branch: main / root → Save**.
3. Etter et minutt er siden live på `https://<brukernavn>.github.io/<repo>/`.

*(valgfritt)* Legg en fin cookie-bilde-fil som `og-image.jpg` i repoet for penere
forhåndsvisning når lenken deles på Facebook/Instagram.

---

## Del 2 – Daglig bruk (ingen koding)

Alt gjøres i **regnearket**, fanen **Innstillinger** – endringer vises på siden ved neste
sideoppdatering.

### Åpne / stenge bestilling
Sett **`status`**:
| Verdi | Hva skjer på siden |
|---|---|
| `BESTILLING_ÅPEN` | Bestillingsskjema vises – «X pakker igjen» |
| `BESTILLING_STENGT` | Venteliste vises i stedet |
| `DIREKTESALG` | «Kom og kjøp nå!» med hentested/tid |
| `UTSOLGT` | «Alt er utsolgt» + venteliste |

### Automatisk utsolgt (kjernefunksjonen)
Sett **`maks_pakker`** (f.eks. `60`). Når summen av bestilte pakker når grensen, **låser
siden seg selv** og viser «Utsolgt» – uansett om status står på åpen. Du trenger ikke gjøre
noe. Vil du ta imot flere, øk `maks_pakker`.

### Endre pris / Vipps / hentested
`pris_per_pakke`, `vipps_nummer`, `hentested`, `hentetid`, `neste_batch` – bare skriv om i
**Innstillinger**.

### Endre tekst på siden
Fanen **Innhold**: `firmanavn`, `slagord`, `produkt_beskrivelse`, `direktesalg_tekst`,
`facebook_url` (lenke til Facebook-siden – vises som knapp i bunnen og på venteliste-visningen).

### Bytte bilder 📸
Dra nye bilder inn i **Drive-bildemappen** (eller slett gamle). De vises i galleriet
automatisk (kan ta opptil et par minutter pga. mellomlagring). Vil du ha bildetekst, gi
filen et passende navn (f.eks. «Sjokolade og havsalt.jpg»).

### Se bestillinger
Fanen **Bestillinger** fylles automatisk. Får du varsel-e-post (hvis satt opp), ser du hver
nye bestilling med en gang. **Venteliste**-fanen samler dem som vil varsles.

> **Kjøre nytt parti?** Mange velger å tømme/arkivere gamle rader i **Bestillinger** før de
> åpner igjen, så «X pakker igjen» teller fra null for det nye partiet.

---

## Betaling

Versjon 1 bruker **Vipps ved henting** med privat Vipps – **krever ikke ENK/org.nr.**
Siden viser «Betal X kr til Vipps `<nummer>` ved henting» i bekreftelsen.

Vil du senere ha en ekte **«Betal med Vipps»-knapp** på siden, trenger du et
organisasjonsnummer. Å registrere et **ENK i Enhetsregisteret er gratis** og gir deg org.nr.
(den betalte Foretaksregisteret-registreringen kreves normalt bare ved videresalg av
**innkjøpte** varer – egenbakte cookies regnes som produksjon). Med org.nr. kan du skru på
Vipps Go / Vipps på Nett, og kun «betalings-blokka» i `index.html` byttes ut. Vurder også
skatt (hobby vs. næring) og evt. registrering hos Mattilsynet når salget vokser.

---

## Feilsøking

| Problem | Sjekk |
|---|---|
| Siden viser demo-innhold | `APPS_SCRIPT_URL` er tom eller feil i `index.html`. |
| Endring i `Code.gs` vises ikke | Du må deploye **ny versjon** (Manage deployments). |
| Bilder vises ikke | Mappen må være delt «Alle med lenken = Seer», og `BILDE_MAPPE_ID` riktig. |
| Bestilling lagres ikke | Web-appen må være «Who has access: **Anyone**». |
| Teller feil antall | `maks_pakker` minus summen i **Bestillinger**-fanen (kolonne «Antall pakker»). |
