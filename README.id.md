# Swoosh Router

<p align="center">
  <a href="./README.md"><img src="https://img.shields.io/badge/English-README-2563EB?style=for-the-badge" alt="English README" /></a>
  <a href="./README.id.md"><img src="https://img.shields.io/badge/Bahasa_Indonesia-README.id-16A34A?style=for-the-badge" alt="Bahasa Indonesia README" /></a>
</p>

<p align="center">
  <img src="./assets/BannerGithubSwoosh.png" alt="Banner Swoosh Router" />
</p>

<p align="center">
  <strong>Satu router. Semua model. Nggak bikin pusing.</strong><br />
  Semua AI kamu, lewat satu gateway HTTP yang smooth.
</p>

<p align="center">
  <a href="https://github.com/envielxyz/SwooshRouter/actions/workflows/ci.yml"><img src="https://github.com/envielxyz/SwooshRouter/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/swooshrouter"><img src="https://img.shields.io/npm/v/swooshrouter?label=npm" alt="Versi npm" /></a>
  <a href="https://github.com/envielxyz/SwooshRouter/stargazers"><img src="https://img.shields.io/github/stars/envielxyz/SwooshRouter?style=flat" alt="GitHub stars" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="Lisensi MIT" /></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-Bun-black?logo=bun" alt="Bun" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/code-TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/dashboard-React-61DAFB?logo=react&logoColor=111827" alt="React" /></a>
  <a href="https://sqlite.org"><img src="https://img.shields.io/badge/storage-SQLite-003B57?logo=sqlite&logoColor=white" alt="SQLite" /></a>
</p>

Swoosh Router menaruh semua provider AI kamu di balik satu gateway HTTP yang
clean, lengkap dengan dashboard smooth untuk mengatur seluruh stack.

## Daftar isi

- [Mulai cepat](#mulai-cepat)
- [Requirement](#requirement)
- [HTTP API](#satu-http-api-untuk-semua-kebutuhan)
- [Dashboard](#dashboard-yang-enak-dipakai)
- [Providers](#providers)
- [Fitur lengkap](#fitur-yang-tersedia)
- [Operasional dan keamanan](#operasional-dan-keamanan)
- [Tech stack](#tech-stack)
- [Konfigurasi](#konfigurasi)
- [Atribusi dan lisensi](#atribusi)

## Mulai cepat

### Global CLI — cara paling cepat

Install global lalu jalanin router:

```bash
bun install -g swooshrouter@latest
swooshrouter
```

CLI bisa start, stop, restart, dan cek status router. Saat start, CLI juga
mengecek apakah ada versi baru, tapi nggak akan update sendiri tanpa persetujuan
kamu.

### Jalanin dari source

```bash
bun install --frozen-lockfile
cd dashboard
bun install --frozen-lockfile
bun run build
cd ..
bun run dev
```

Buka `http://127.0.0.1:14045/dashboard`, lalu tambahkan provider pertama kamu.

Kalau mau ngembangin dashboard, jalanin `bun run dev` di dalam folder
`dashboard/` lewat terminal kedua.

### Docker — terisolasi dan datanya persistent

```bash
docker build -t swooshrouter:latest .
docker compose up -d
docker compose ps
```

Docker juga membuat secret persistent di data volume. Copy `.env.example`
menjadi `.env` hanya kalau kamu ingin memberi override deployment sendiri.

Buka `http://127.0.0.1:14045/dashboard`. Untuk lihat log:

```bash
docker compose logs -f swooshrouter
```

Setup Docker memakai volume `swooshrouter-data`, bind port hanya ke localhost,
menjalankan container sebagai user non-root, memakai root filesystem read-only,
dan sudah punya readiness health check. Jangan hapus volume kalau ingin tetap
menyimpan koneksi provider, key, setting, dan data usage.

## Requirement

| Deployment | Yang dibutuhkan | Process manager |
| --- | --- | --- |
| Global CLI | Bun `1.3+`, data directory yang bisa ditulis, dan akses network ke provider | CLI untuk lokal; tambahkan supervisor untuk production |
| Docker | Docker Engine dengan plugin Compose dan volume persistent | Docker Compose sudah menangani restart dan health check; nggak perlu PM2 |
| Native VPS | Bun `1.3+`, data directory yang bisa ditulis, dan akses network ke provider | `systemd` direkomendasikan; PM2 opsional |

Untuk native VPS kecil, mulai dari **2 vCPU, RAM 2 GB, dan SSD 10 GB**. Komputer
lokal bisa jalan dengan resource lebih kecil. Sebelum dibuka ke internet, taruh
Swoosh di belakang reverse proxy HTTPS.

### Native VPS dengan PM2 (opsional)

PM2 sudah mendukung Bun, tapi hanya diperlukan kalau Swoosh dijalankan langsung
di VPS tanpa Docker atau supervisor lain:

```bash
npm install -g pm2
pm2 start src/server.ts --name swooshrouter --interpreter bun
pm2 save
pm2 startup
```

Jalankan `pm2 startup` sesuai perintah yang diberikan PM2 supaya process otomatis
balik hidup setelah reboot. Jangan menjalankan PM2 di atas Docker Compose untuk
container yang sama.

## Satu HTTP API untuk semua kebutuhan

Pakai format client yang sudah biasa kamu pakai. Swoosh akan menerjemahkan
request dan response ke provider di belakang layar.

| Client / fitur | Endpoint |
| --- | --- |
| OpenAI Chat Completions | `POST /v1/chat/completions` |
| OpenAI Responses | `POST /v1/responses` |
| Compact Responses | `POST /v1/responses/compact` |
| Anthropic Messages | `POST /v1/messages` |
| Anthropic token count | `POST /v1/messages/count_tokens` |
| Ollama-style chat | `POST /v1/api/chat` |
| Image generation | `POST /v1/images/generations` |
| Image editing | `POST /v1/images/edits` |
| Daftar model | `GET /v1/models` |

Streaming dan non-streaming tersedia selama provider dan model yang dipilih
mendukungnya. Alias `/codex` dan `/responses` juga tersedia untuk setup client
yang umum.

### Contoh singkat

```bash
export SWOOSH_API_KEY="sws_your_gateway_key"
curl http://127.0.0.1:14045/v1/chat/completions \
  --oauth2-bearer "${SWOOSH_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "your-active-model-id",
    "messages": [{"role": "user", "content": "Say hello"}]
  }'
```

Gateway key Swoosh berbeda dari credential provider di belakangnya. Secret
provider tetap tersimpan di server.

## Dashboard yang enak dipakai

Dashboard Swoosh bukan sekadar halaman admin. Ini jadi control room yang fokus
buat ngatur provider, model, akun, kuota, usage, log, dan routing. Ada compact
card, status badge yang jelas, search dan filter, layout responsive, serta
loading/refresh state yang smooth supaya semuanya tetap gampang dipantau di
desktop, tablet, dan mobile.

| Dashboard | Providers |
| --- | --- |
| ![Dashboard Swoosh Router](./docs/media/screenshots/dashboard.webp) | ![Pengelolaan provider](./docs/media/screenshots/providers.webp) |
| Usage & cost | Settings |
| ![Usage dan cost](./docs/media/screenshots/usage.webp) | ![Preferences dashboard](./docs/media/screenshots/settings-preferences.webp) |

[Lihat showcase UI lengkap](./docs/SHOWCASE.md) · [Tonton demo v1.0.0](https://github.com/envielxyz/SwooshRouter/releases/download/v1.0.0/swooshrouter-v1.0.0-demo.mp4)

### Menu utama

| Menu | Isinya |
| --- | --- |
| **Dashboard** | Jumlah request, total token, cost, latency, aktivitas provider, dan status sistem |
| **API Keys** | Buat, lihat, copy, rotate, enable, revoke, dan hapus gateway key |
| **Providers** | Tambah koneksi, pilih auth, test akun, kelola model, dan atur routing |
| **Combos** | Buat fallback berurutan untuk model/provider dan pilih strateginya |
| **Proxy** | Buat/test proxy pool, pasang koneksi, dan deploy relay opsional |
| **Usage** | Chart, breakdown token, estimasi cost, history, filter, sorting, dan detail request |
| **Quota Monitor** | Ketersediaan provider/akun, status kuota, diagnostik, dan refresh manual |
| **CLI Tools** | Atur coding tools yang didukung, pilih model, dan copy config otomatis |
| **Swoosh Chat** | Chat lewat router dengan pemilihan model dan built-in tools opsional |
| **Settings** | Kontrol Preferences, General, Security, dan Data |
| **Console Logs** | Cari, filter, wrap, copy, dan cek diagnostik runtime/provider |

### Isi Settings

- **Preferences:** foto profil dengan crop/zoom, nama profil, dan currency
  tampilan (USD default, IDR tersedia).
- **General:** RTK token saver, Caveman, Ponytail, capture payload request, dan
  Cloudflare Tunnel.
- **Security:** wajib API key, wajib login dashboard, password dashboard,
  login protection, dan graceful shutdown.
- **Data:** lokasi database, full data backup, dan restore dari backup.

## Providers

Registry bawaan Swoosh saat ini punya **67 entry provider**. Daftar di bawah
diambil dari provider yang benar-benar diregister Swoosh, bukan daftar marketing.
Ketersediaan provider dan pilihan auth bisa berubah mengikuti layanan upstream.

### API key — 45

| Provider | ID |
| --- | --- |
| Alibaba Coding | `alicode-intl` |
| Alibaba | `alicode` |
| Alibaba Studio | `alims-intl` |
| Anthropic | `anthropic` |
| Azure OpenAI | `azure` |
| Baidu Qianfan | `baidu` |
| Blackbox AI | `blackbox` |
| BytePlus ModelArk | `byteplus` |
| Cerebras | `cerebras` |
| Chutes AI | `chutes` |
| Cloudflare | `cloudflare-ai` |
| Command Code | `commandcode` |
| DeepSeek | `deepseek` |
| Featherless | `featherless` |
| Fireworks AI | `fireworks` |
| Gemini | `gemini` |
| GLM (China) | `glm-cn` |
| GLM Coding | `glm` |
| Groq | `groq` |
| Kilo Gateway | `kilo-gateway` |
| Minimax (China) | `minimax-cn` |
| Minimax Coding | `minimax` |
| Mistral | `mistral` |
| Morph | `morph` |
| Nebius AI | `nebius` |
| NVIDIA NIM | `nvidia` |
| Ollama Local | `ollama-local` |
| Ollama Cloud | `ollama` |
| OpenAI | `openai` |
| OpenCode Go | `opencode-go` |
| OpenRouter | `openrouter` |
| Perplexity Agent | `perplexity-agent` |
| Perplexity | `perplexity` |
| Poolside | `poolside` |
| Tencent Hunyuan | `tencent` |
| Together AI | `together` |
| Venice AI | `venice` |
| Vercel AI Gateway | `vercel-ai-gateway` |
| Vertex Partner | `vertex-partner` |
| Vertex AI | `vertex` |
| Xiaomi MiMo | `xiaomi-mimo` |
| Xiaomi MiMo (Token Plan) | `xiaomi-tokenplan` |
| Meta AI | `meta` |
| Agent Router | `agentrouter` |
| SumoPod | `sumopod` |

### OAuth, device code, atau token import — 19

| Provider | ID |
| --- | --- |
| Antigravity | `antigravity` |
| Claude Code | `claude` |
| Cline | `cline` |
| ClinePass | `clinepass` |
| CodeBuddy CN | `codebuddy-cn` |
| CodeBuddy | `codebuddy-intl` |
| OpenAI Codex | `codex` |
| Cursor IDE | `cursor` |
| Gemini CLI | `gemini-cli` |
| GitHub Copilot | `github` |
| Grok CLI (Grok Build) | `grok-cli` |
| Kilo Code | `kilocode` |
| Kimchi | `kimchi` |
| Kimi | `kimi` |
| Kiro AI | `kiro` |
| Qoder | `qoder` |
| Trae | `trae` |
| Windsurf | `windsurf` |
| xAI (Grok) | `xai` |

### Web cookie — 2

| Provider | ID |
| --- | --- |
| Grok Web (Subscription) | `grok-web` |
| Perplexity Web (Pro/Max) | `perplexity-web` |

### No auth — 1

| Provider | ID |
| --- | --- |
| OpenCode Free | `opencode` |

## Fitur yang tersedia

### Provider dan akun

- Hubungkan provider lewat API key, OAuth, device code, cookie/session, atau
  access/refresh token kalau flow tersebut didukung provider.
- Tambahkan banyak akun ke satu provider, lengkap dengan prioritas dan status
  enable/disable.
- Test koneksi, test model tertentu, atau test semua model dalam satu batch.
- Import katalog model secara live kalau endpoint upstream tersedia.
- Tambahkan custom provider, custom node, custom model, alias, dan pricing.
- Tandai capability model seperti vision, audio, video, search, tools, dan
  reasoning.
- Simpan ID model upstream, endpoint, header, dan aturan kompatibilitas khusus
  provider.

### Routing dan fallback

- `fill-first` untuk penggunaan akun yang predictable.
- `round-robin` untuk rotasi sederhana.
- `least-inflight` untuk membagi request aktif.
- `sticky` dan `cache-affine` saat koneksi akun perlu tetap stabil.
- Override routing per provider dan kontrol sticky.
- Combo untuk fallback model/provider secara berurutan.
- Cooldown akun, account lock, endpoint fallback, dan retry yang dibatasi.

### Translasi dan dukungan model

- Format request OpenAI, Anthropic, Responses, dan Ollama-style.
- Translasi request dan response khusus tiap provider.
- Konversi streaming lewat SSE dan response JSON biasa.
- Tool call, thinking/reasoning, vision, image input, media, dan usage sesuai
  dukungan model yang dipilih.
- Compatibility fallback untuk parameter opsional yang ditolak upstream.
- Dynamic model discovery, katalog statis, custom model, alias, disabled model,
  dan filter berdasarkan capability.

### Usage, cost, dan kuota

- History request dengan provider, model, akun, endpoint, status, dan latency.
- Tracking token input, output, cached, dan total.
- Estimasi cost dengan USD sebagai default dan IDR sebagai pilihan.
- Total per provider, chart, aktivitas terbaru, dan detail request.
- Quota monitor dengan status provider/akun dan tombol refresh.
- Optional capture request/response payload dengan kontrol retention.

### Performa dan reliability

- Global request admission control dan queue yang dibatasi.
- Batas concurrency per provider dan per akun.
- Kapasitas adaptif berdasarkan memory dan CPU yang tersedia.
- Batas body request plus timeout upload, koneksi, stream, dan queue.
- Retry upstream dan endpoint fallback dengan jumlah percobaan terkontrol.
- Refresh OAuth otomatis dan deduplikasi refresh token.
- Penanganan aman untuk disconnect, stream yang dibatalkan, provider error, dan
  response 429.
- Graceful shutdown supaya request aktif bisa selesai dengan rapi.

### Built-in tools

- Swoosh Chat dengan web search opsional lewat Tavily atau Brave.
- Shell, curl, dan router inspection tools dengan kontrol yang jelas.
- Fitur token saver RTK, Caveman, dan Ponytail.
- CLI model mapping untuk coding tools yang didukung.

## Operasional dan keamanan

- Session dashboard memakai JWT dan password hashing dengan bcrypt.
- Login limiting dan admin route yang terlindungi.
- Gateway auth lewat `Authorization: Bearer ...` atau `x-api-key`.
- Default binding ke localhost dan credential provider tetap di server.
- Secret dari environment variable dan perlindungan SSRF.
- Health, readiness, version, runtime status, dan Prometheus-style metrics.
- SQLite WAL mode, migration, index, backup, export, dan import.
- Docker/Compose, native source run, Bun CLI, dan standalone binary.

Swoosh menjaga process dan account pool-nya sendiri, tapi tidak membuat kuota
provider dan tidak menjanjikan RPS tetap. Kapasitas nyata tetap tergantung limit
provider, jumlah akun, latency jaringan, ukuran prompt, dan durasi stream.

## Tech stack

- **Runtime:** Bun, dengan fallback yang kompatibel dengan Node jika diperlukan
- **Gateway:** TypeScript, Hono, native HTTP, dan SSE
- **Dashboard:** React, Vite, Tailwind CSS, React Router, dan TanStack Query
- **Storage:** SQLite dengan WAL mode, migration, backup, dan fallback `sql.js`
- **Auth:** JWT, bcrypt, OAuth/PKCE, dan refresh token khusus provider
- **Shipping:** Bun CLI, Docker, standalone binary, dan GitHub Actions

## Konfigurasi

Untuk satu instance lokal atau Docker, konfigurasi bersifat opsional. Saat
start pertama, Swoosh membuat JWT secret, gateway-key secret, dan machine salt
yang kuat di data directory persistent. Pakai `.env` kalau perlu mengganti
default, bind ke host lain, atau mengelola secret dari luar:

```dotenv
PORT=14045
HOSTNAME=127.0.0.1
DATA_DIR=/var/lib/swooshrouter
NODE_ENV=production
JWT_SECRET=replace-with-a-random-secret-at-least-32-characters
API_KEY_SECRET=replace-with-a-random-secret-at-least-32-characters
MACHINE_ID_SALT=replace-with-a-random-private-salt
```

Jangan arahkan beberapa instance Swoosh yang berbeda ke SQLite data directory
yang sama. Kalau secret diberikan oleh supervisor, nilainya harus tetap sama
setelah restart agar session dashboard dan identitas instance tetap stabil.

Lokasi database default:

```text
Linux/macOS: ~/.swooshrouter/db/data.sqlite
Windows:     %APPDATA%\\.swooshrouter\\db\\data.sqlite
Docker:      /app/data/db/data.sqlite
```

Pastikan data directory tetap persistent. Isinya credential provider, config,
dan data usage. Jangan commit `.env`, file database, backup, OAuth token,
cookie, atau log.

## Kenapa SQLite?

SQLite bikin satu instance Swoosh private tetap kecil, portable, dan gampang
dibackup. PostgreSQL dan Redis lebih cocok untuk aplikasi komersial terpisah
dengan user terdistribusi, billing, background job, atau banyak instance Swoosh.

## Development checks

```bash
bun run typecheck
bun test
bun run routes:check
bun run package:check
bun run build:binary
bun run smoke:binary
bun run build:dashboard
bun run test:e2e:install
bun run test:e2e
```

## Atribusi

Swoosh adalah project standalone. Beberapa bagian OAuth, tunnel, CLI, dan utility
diadaptasi dari [9Router](https://github.com/decolua/9router), sedangkan gateway,
routing, dashboard, storage, API, performa, dan setup release dikembangkan serta
dirawat di project ini.

Lihat [`LICENSE`](./LICENSE) untuk atribusi MIT lengkap.

## Lisensi

MIT. Lihat [`LICENSE`](./LICENSE).

Swoosh Router adalah gateway dan admin tool. Kamu bertanggung jawab atas akun
provider, credential, traffic, privacy, compliance, dan keamanan deployment-mu.
