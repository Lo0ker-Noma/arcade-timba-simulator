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

**Modelo: cada jugador compite contra la máquina (IA); gana el bote quien hace más puntos / aguanta más.**

| Juego | Reto vs máquina | Puntuación |
|-------|-----------------|-----------|
| 🔴 Conecta 4 | Vence a la IA | 1000 − jugadas (gana) · 500 empate |
| ⭕ Tic Tac Toe | Vence a la IA (minimax) | 1000 − jugadas (gana) · 500 empate |
| 🏓 Pong | Marca más goles a la IA en 45 s | tus goles |
| 🐍 Snake / 🏍️ Tron | Aguanta más que la moto IA | seg. supervividos ×100 (+5000 si la vences) |
| 🧱 Tetris | Score-attack hasta desbordarte | puntuación de Tetris |
| 🪳 Kuka | Aplasta cucarachas en 60 s | nº de cucarachas |

## 🌐 Cómo es "online" sin sincronización física

En vez de sincronizar física entre jugadores (frágil sobre relays públicos), cada participante **juega su propia partida contra la máquina** y, al terminar, **firma y publica su puntuación** por Nostr (kind 2420). El host la recibe, y cuando **todos los participantes de la ronda han enviado su puntuación**, la **más alta gana la ronda**. Primero en llegar al objetivo de victorias se lleva el bote.

Ventajas: robusto (solo se firma una vez por ronda, no por fotograma), sin backend, y cada quien juega a su ritmo. En **Single game** juegas vs la IA sin bote.

### Dificultad progresiva y ranking

- **Niveles**: cada victoria sube el nivel — la IA es más dura, los juegos más rápidos, y **más dificultad da más puntos** (la puntuación se multiplica por el nivel).
- **Marcador grande**: en Single game se ven NIVEL · ÚLTIMA PARTIDA · TOTAL acumulado.
- **Salas de N jugadores**: todos compiten cada ronda; el de mayor puntuación gana la ronda. El **ranking en vivo** (🥇🥈🥉) ordena por puntos acumulados de todos los conectados, en tiempo real vía Nostr.

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
