# 👾 Arcade Timba Simulator

### 🔴 EN VIVO → **[arcade-timba-simulator.vercel.app](https://arcade-timba-simulator.vercel.app)**

**Arcade multijugador con bote en Lightning.** Juega con tus amigos a clásicos del arcade, cada uno rellena el bote, configuras a cuántas victorias se gana (primero a 7, 10, 12…) y **el ganador se lleva todos los sats automáticamente por Lightning**.

> 🎮 **Hackaton #04 · [La Crypta](https://lacrypta.dev/)** — Bitcoin, Lightning y Nostr.

---

## ⚡ Cómo funciona

1. **Login con Nostr** (NIP-07 — Alby, nos2x…). Tu identidad es tu pubkey, sin registros ni passwords.
2. **Crea una sala**: eliges el juego, el bote por jugador (en sats) y a cuántas victorias se gana.
3. **Rellenad el bote**: cada jugador paga su parte por Lightning al *escrow* de la sala. El marcador se sincroniza en tiempo real vía relays Nostr.
4. **Cobro automático**: cuando alguien llega al objetivo de victorias, el bote completo se envía a su Lightning Address mediante un zap.

## 🕹️ Single game (modo práctica)

Botón **Single game** en la cabecera / portada: prueba cualquier juego **solo, sin login Nostr ni bote**. Los juegos por turnos (Conecta 4, Tic Tac Toe) se juegan en *hotseat* (controlas ambos lados). Ideal para testear y dar feedback.

## 🕹️ Juegos

| Juego | Modo | Jugadores |
|-------|------|-----------|
| 🔴 Conecta 4 | 🌐 Online por turnos | 2 |
| ⭕ Tic Tac Toe | 🌐 Online por turnos | 2 |
| 🏓 Pong | 🌐 Online tiempo real (host-autoritativo) | 2 |
| 🐍 Snake Duel | 🌐 Online tiempo real (host-autoritativo) | 2 |
| 🏍️ Tron | 🌐 Online tiempo real (host-autoritativo) | 2 |
| 🧱 Tetris | 🌐 Online — duelo paralelo de 2 tableros | 2 |
| 🪳 Kuka Exterminator | 🌐 Online — 60s simultáneos | 2 |

**Todos los juegos son online y simultáneos.** Ver la sección de tiempo real abajo.

## ⚡ Tiempo real sobre Nostr (claves de sesión efímeras)

Firmar cada fotograma con la extensión NIP-07 es inviable. Solución (`src/lib/realtime.js`):

1. Al empezar la partida, cada jugador genera una **clave de sesión efímera** en el navegador.
2. Anuncia **una vez** la vinculación `pubkey real → pubkey de sesión` con un mensaje firmado por NIP-07 (así nadie puede suplantar).
3. Todos los eventos de juego de alta frecuencia se firman **localmente** con la clave de sesión (schnorr ≈ 1 ms, sin extensión) y se publican en un **kind efímero (24420)** que los relays difunden pero no almacenan.

**Netcode por juego:**
- **Pong / Tron / Snake**: el `host` (jugador 1) simula la física y difunde el estado ~15 Hz; el `guest` envía solo sus inputs y predice su lado localmente.
- **Tetris**: paralelo — cada uno corre su tablero y difunde un snapshot comprimido ~5 Hz; el primero que se desborda pierde.
- **Kuka**: paralelo — ambos juegan sus 60 s a la vez y difunden su marcador; gana quien más mate.
- **Conecta 4 / Tic Tac Toe**: por turnos, cada jugada firmada por Nostr (poca frecuencia, sin necesidad de claves de sesión).

## 🏦 El bote (escrow — Opción A)

Versión *hackathon-friendly*, **sin backend**:

- El creador de la sala pone su **Lightning Address** como escrow.
- Al terminar, el escrow paga el bote completo a la **Lightning Address del ganador**.

### Modalidades de bote

| Modo | Cómo se llena | Ideal para |
|------|---------------|-----------|
| 🪙 **Timba** | Cada jugador aporta los **mismos sats**; el bote es la suma. | Partidas entre iguales |
| 👑 **Rey de la pista** | Un **admin pone el bote final** completo; los demás juegan **gratis** y el ganador se lo lleva. | Retos, premios, torneos |

En Timba cada jugador paga su parte (LNURL-pay / LUD-16 → BOLT11 → WebLN o QR). En Rey de la pista nadie paga por entrar: el admin es la banca y abona el bote al ganador al final.

> Requiere confianza en el host (tiene la custodia temporal del bote). Una **Opción B** custodial real (wallet efímera por sala vía LNbits/Strike) puede sustituir `resolvePayout` sin tocar el resto de la app.

## 🛠️ Stack

- **React + Vite + TailwindCSS**
- **nostr-tools** — identidad NIP-07, eventos firmados y verificados
- **LNURL-pay / WebLN** — facturas y pagos Lightning
- Estado de sala sobre **relays Nostr** (eventos `kind:30420` replaceable para el documento de sala + `kind:2420` para jugadas)

Toda la verificación de firmas se hace en cliente (`src/lib/nostrRelay.js`) para impedir spoofing de pubkeys desde relays hostiles.

## 🚀 Desarrollo

```bash
npm install
npm run dev      # http://localhost:5174
npm run build
```

Relay por defecto: `wss://relay.damus.io` (configurable con `VITE_NOSTR_RELAY`).

Necesitas una extensión Nostr (NIP-07) y, para pagos automáticos, una wallet WebLN como [Alby](https://getalby.com).

## 📁 Estructura

```
src/
  lib/        nostrRelay.js · lightning.js · protocol.js
  store/      authStore.js (NIP-07) · gameStore.js (salas/bote)
  games/      Connect4 · TicTacToe · Pong · Tron(+Snake)
  components/ Landing · Lobby · Room · Scoreboard · FundingModal · PayoutPanel
```

## 🎬 Demo

1. Abre la app (`npm run dev`) en dos navegadores con extensión Nostr (NIP-07).
2. En uno: **Entrar con Nostr** → **Crear sala** (elige juego, bote en sats y “primero a N victorias”) → pon tu Lightning Address como escrow.
3. En el otro: entra, pon tu Lightning Address y únete con el código de sala.
4. Cada jugador paga su parte del bote (WebLN/Alby o QR). El host pulsa **Empezar**.
5. Jugáis las rondas; el marcador se actualiza en vivo. Al llegar al objetivo, el bote completo se envía a la Lightning Address del ganador.

> Juegos online por turnos (Conecta 4, Tic Tac Toe) = multijugador remoto real. Pong/Snake/Tron/Tetris = modo party local (mismo dispositivo) que reporta el ganador al bote.

## 📜 Licencia

[MIT](./LICENSE) — código abierto. Úsalo, modifícalo y compártelo.

---

Construido con ⚡ para el Hackaton #04 de [lacrypta.dev](https://lacrypta.dev/).
