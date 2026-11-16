#!/usr/bin/env node

// src/discord.ts
var API_BASE = "https://discord.com/api/v10";
var DiscordError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
  status;
};
function httpErrorMessage(status, path, detail) {
  switch (status) {
    case 401:
      return "O Discord rejeitou o token. Confira DISCORD_BOT_TOKEN (copie de novo em Developer Portal > Bot > Reset Token).";
    case 403:
      return `Sem permiss\xE3o (${path}). Verifique as permiss\xF5es do bot no servidor/canal (Ver Canal, Ler Hist\xF3rico, Enviar Mensagens...) e, para listar membros, ative 'Server Members Intent' no Developer Portal. ${detail}`;
    case 404:
      return `N\xE3o encontrado (${path}). Confira o ID. Use discord_list_guilds e discord_list_channels para achar IDs v\xE1lidos. O bot tamb\xE9m precisa estar no servidor.`;
    case 400:
      return `Requisi\xE7\xE3o inv\xE1lida: ${detail}`;
    default:
      return `O Discord retornou HTTP ${status}: ${detail}`;
  }
}
async function discord(method, path, opts) {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== void 0) url.searchParams.set(k, String(v));
  }
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bot ${opts.token}`,
        "Content-Type": "application/json",
        "User-Agent": "DiscordBot (discord-mcp-server, 1.0.0)"
      },
      body: opts.body === void 0 ? void 0 : JSON.stringify(opts.body),
      signal: opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(3e4)]) : AbortSignal.timeout(3e4)
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("O Discord n\xE3o respondeu em 30 segundos. Tente de novo.");
    }
    const code = String(error?.cause?.code ?? "");
    const neverSent = ["UND_ERR_CONNECT_TIMEOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ENETUNREACH"].includes(code);
    if ((neverSent || method === "GET") && (opts.attempt ?? 0) < 8) {
      const wait = Math.min(3 * ((opts.attempt ?? 0) + 1), 20);
      console.error(`  (sem conex\xE3o com o Discord [${code || "rede"}]; nova tentativa em ${wait}s...)`);
      await new Promise((resolve) => setTimeout(resolve, wait * 1e3));
      return discord(method, path, { ...opts, attempt: (opts.attempt ?? 0) + 1 });
    }
    if (code) throw new Error(`Sem conex\xE3o com o Discord (${code}). Verifique internet, VPN, antiv\xEDrus ou firewall do seu PC.`);
    throw error;
  }
  if (response.status === 429 && (opts.attempt ?? 0) < 8) {
    const data = await response.json().catch(() => ({}));
    const wait = Math.min((data.retry_after ?? 1) + 0.5, 120);
    console.error(`  (limite de velocidade do Discord: esperando ${Math.ceil(wait)}s...)`);
    await new Promise((resolve) => setTimeout(resolve, wait * 1e3));
    return discord(method, path, { ...opts, attempt: (opts.attempt ?? 0) + 1 });
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = `${data.message ?? ""}${data.errors ? " " + JSON.stringify(data.errors).slice(0, 600) : ""}`.trim();
    throw new DiscordError(response.status, httpErrorMessage(response.status, `${method} ${path}`, detail));
  }
  if (response.status === 204) return void 0;
  return await response.json();
}

// src/layout.ts
var TEXT = 0;
var VOICE = 2;
var CATEGORY = 4;
var FLAG = { en: "\u{1F1FA}\u{1F1F8}", pt: "\u{1F1E7}\u{1F1F7}", es: "\u{1F1EA}\u{1F1F8}" };
var ALL_FLAGS = "\u{1F1FA}\u{1F1F8}\u{1F1E7}\u{1F1F7}\u{1F1EA}\u{1F1F8}";
var RULES = {
  en: [
    "**SERVER RULES**",
    "Respect above all: no insults, harassment, discrimination or hate speech.",
    "History and geopolitics debates are welcome, but keep the focus on the game. Current politics and political parties stay out of the server.",
    "Use each channel for its purpose: bugs go in {bugs}, ideas in {suggestions}, opinions in {feedback}.",
    "No spam, advertising or suspicious links. Do not share personal data, yours or anyone else's.",
    "When reporting a bug, say what you were doing and what happened. The more detail, the faster we can fix it.",
    "Anyone who breaks the rules may be warned, muted or removed from the server."
  ],
  es: [
    "**REGLAS DEL SERVIDOR**",
    "El respeto ante todo: sin insultos, acoso, discriminaci\xF3n ni discurso de odio.",
    "Los debates de historia y geopol\xEDtica son bienvenidos, pero mant\xE9n el foco en el juego. La pol\xEDtica actual y los partidos se quedan fuera del servidor.",
    "Usa cada canal para su prop\xF3sito: los errores en {bugs}, las ideas en {suggestions}, las opiniones en {feedback}.",
    "Nada de spam, publicidad ni enlaces sospechosos. No compartas datos personales, ni tuyos ni de otras personas.",
    "Al reportar un error, cuenta qu\xE9 estabas haciendo y qu\xE9 pas\xF3. Cuantos m\xE1s detalles, m\xE1s r\xE1pido lo corregimos.",
    "Quien incumpla las reglas puede ser advertido, silenciado o expulsado del servidor."
  ],
  pt: []
};
var WELCOME = {
  en: [
    "**Welcome to Era do Bronze!**",
    "Era do Bronze is an indie geopolitics and historical simulation game made in Brazil. It runs on any phone or PC, straight from the browser (the game is currently in Portuguese).",
    "Do you like HOI4, EU4 or Victoria 3? We are looking for people to test it. The game starts in 1000 BC, with the known map and civilizations, and it is built to be easy to pick up even if you have never played a geopolitics game.",
    "Transparency: the game will not be sold and is not for profit. Even so, keeping the server and the API running costs money, so the statements are published every month for everyone to see where the money goes.",
    "If you like history and strategy, your opinion will help shape the game: what is fun, what is confusing, what is missing.",
    "Start by reading {rules}, say hi in {introductions} and chat in {general}. Invite link: https://discord.gg/j2kUW2GsWP"
  ],
  es: [
    "**\xA1Bienvenido a Era do Bronze!**",
    "Era do Bronze es un juego indie brasile\xF1o de geopol\xEDtica y simulaci\xF3n hist\xF3rica. Funciona en cualquier celular o PC, directamente desde el navegador (por ahora el juego est\xE1 en portugu\xE9s).",
    "\xBFTe gustan HOI4, EU4 o Victoria 3? Buscamos gente para probarlo. El juego empieza en el a\xF1o 1000 a. C., con el mapa y las civilizaciones conocidos, y est\xE1 hecho para que sea f\xE1cil entrar aunque nunca hayas jugado un juego de geopol\xEDtica.",
    "Transparencia: el juego no se vender\xE1 y no tiene fines de lucro. Aun as\xED, mantener el servidor y la API cuesta dinero, por eso los extractos se publican cada mes para que todos vean a d\xF3nde va el dinero.",
    "Si te gustan la historia y la estrategia, tu opini\xF3n ayudar\xE1 a dar forma al juego: qu\xE9 es divertido, qu\xE9 confunde, qu\xE9 falta.",
    "Empieza leyendo {rules}, pres\xE9ntate en {introductions} y charla en {general}. Enlace de invitaci\xF3n: https://discord.gg/j2kUW2GsWP"
  ],
  pt: []
};
var PROMO = {
  en: [
    "**Rule: spread the word about the game**",
    "Share this text with your friends and in other communities:",
    "",
    "**Brazilian indie geopolitics game. RUNS ON ANY PHONE OR PC, STRAIGHT FROM THE BROWSER**",
    "",
    "Do you like HOI4, EU4 or Victoria 3? I am developing Era do Bronze, a geopolitics and historical simulation game (currently in Portuguese), and I am looking for people to test it.",
    "",
    "\u{1F539} Starts in the year 1000 BC, with the known map and civilizations",
    "\u{1F539} Built to be easy to get into, even if you have never played a geopolitics game",
    "\u{1F539} Almost ready, only a little is missing",
    "",
    "\u{1F49A} **Transparency:** the game will not be sold and is not for profit. Even so, keeping the server and the API running costs money, so the statements are published every month for everyone to see where the money goes.",
    "",
    "If you like history and strategy, your opinion will help shape the game: what is fun, what is confusing, what is missing.",
    "",
    "\u{1F449} Join our Discord: https://discord.gg/j2kUW2GsWP"
  ].join("\n"),
  es: [
    "**Regla: difunde el juego**",
    "Comparte este texto con tus amigos y en otras comunidades:",
    "",
    "**Juego indie brasile\xF1o de geopol\xEDtica. FUNCIONA EN CUALQUIER CELULAR O PC, DIRECTAMENTE DESDE EL NAVEGADOR**",
    "",
    "\xBFTe gustan HOI4, EU4 o Victoria 3? Estoy desarrollando Era do Bronze, un juego de geopol\xEDtica y simulaci\xF3n hist\xF3rica (por ahora en portugu\xE9s), y busco gente para probarlo.",
    "",
    "\u{1F539} Empieza en el a\xF1o 1000 a. C., con el mapa y las civilizaciones conocidos",
    "\u{1F539} Hecho para que sea f\xE1cil entrar, aunque nunca hayas jugado un juego de geopol\xEDtica",
    "\u{1F539} Ya est\xE1 casi listo, falta muy poco",
    "",
    "\u{1F49A} **Transparencia:** el juego no se vender\xE1 y no tiene fines de lucro. Aun as\xED, mantener el servidor y la API cuesta dinero, por eso los extractos se publican cada mes para que todos vean a d\xF3nde va el dinero.",
    "",
    "Si te gustan la historia y la estrategia, tu opini\xF3n ayudar\xE1 a dar forma al juego: qu\xE9 es divertido, qu\xE9 confunde, qu\xE9 falta.",
    "",
    "\u{1F449} Entra a nuestro Discord: https://discord.gg/j2kUW2GsWP"
  ].join("\n"),
  pt: ""
};
function ch(lang, key, slug, extra = {}) {
  return { key, name: `${FLAG[lang]}\u30FB${slug}`, ...extra };
}
function buildLayout() {
  const en = [
    { lang: "en", name: `${FLAG.en} START HERE`, match: ["[en] start here"], channels: [
      ch("en", "welcome", "welcome", { match: ["en-welcome"], post: WELCOME.en }),
      ch("en", "rules", "rules", { match: ["en-rules"], post: RULES.en, clearFirst: true, extra: { marker: "spread the word", lines: [PROMO.en] } }),
      ch("en", "announcements", "announcements", { match: ["en-announcements"] })
    ] },
    { lang: "en", name: `${FLAG.en} COMMUNITY`, match: ["[en] community"], channels: [
      ch("en", "general", "general"),
      ch("en", "introductions", "introductions"),
      ch("en", "off-topic", "off-topic"),
      ch("en", "partners", "partners")
    ] },
    { lang: "en", name: `${FLAG.en} GAME`, match: ["[en] game"], channels: [
      ch("en", "game-news", "game-news"),
      ch("en", "how-to-play", "how-to-play"),
      ch("en", "strategies", "strategies"),
      ch("en", "civilizations", "civilizations-and-history"),
      ch("en", "costs", "costs")
    ] },
    { lang: "en", name: `${FLAG.en} TESTING`, match: ["[en] testing"], channels: [
      ch("en", "feedback", "feedback"),
      ch("en", "bugs", "bugs"),
      ch("en", "suggestions", "suggestions")
    ] }
  ];
  const voice = {
    name: `\u{1F310} VOICE \xB7 VOZ`,
    match: ["voz"],
    channels: [
      { key: "voice-general", name: `${ALL_FLAGS} General`, match: ["geral"], type: VOICE },
      { key: "voice-match", name: `${ALL_FLAGS} Match`, match: ["partida"], type: VOICE }
    ]
  };
  const pt = [
    { lang: "pt", name: `${FLAG.pt} IN\xCDCIO`, match: ["in\xEDcio"], channels: [
      ch("pt", "welcome", "boas-vindas", { match: ["boas-vindas"] }),
      ch("pt", "rules", "regras", { match: ["regras"] }),
      ch("pt", "announcements", "an\xFAncios", { match: ["an\xFAncios"] })
    ] },
    { lang: "pt", name: `${FLAG.pt} COMUNIDADE`, match: ["comunidade"], channels: [
      ch("pt", "general", "geral", { match: ["geral"] }),
      ch("pt", "introductions", "apresenta\xE7\xF5es", { match: ["apresenta\xE7\xF5es"] }),
      ch("pt", "off-topic", "off-topic", { match: ["off-topic"] }),
      ch("pt", "partners", "parceiros", { match: ["parceiros"] })
    ] },
    { lang: "pt", name: `${FLAG.pt} JOGO`, match: ["jogo"], channels: [
      ch("pt", "game-news", "novidades-do-jogo", { match: ["novidades-do-jogo"] }),
      ch("pt", "how-to-play", "como-jogar", { match: ["como-jogar"] }),
      ch("pt", "strategies", "estrat\xE9gias", { match: ["estrat\xE9gias"] }),
      ch("pt", "civilizations", "civiliza\xE7\xF5es-e-hist\xF3ria", { match: ["civiliza\xE7\xF5es-e-hist\xF3ria"] }),
      ch("pt", "costs", "custos", { match: ["custos"] })
    ] },
    { lang: "pt", name: `${FLAG.pt} TESTES`, match: ["testes"], channels: [
      ch("pt", "feedback", "feedback", { match: ["feedback"] }),
      ch("pt", "bugs", "bugs", { match: ["bugs"] }),
      ch("pt", "suggestions", "sugest\xF5es", { match: ["sugest\xF5es"] })
    ] }
  ];
  const es = [
    { lang: "es", name: `${FLAG.es} INICIO`, channels: [
      ch("es", "welcome", "bienvenida", { post: WELCOME.es }),
      ch("es", "rules", "reglas", { post: RULES.es, extra: { marker: "difunde el juego", lines: [PROMO.es] } }),
      ch("es", "announcements", "anuncios")
    ] },
    { lang: "es", name: `${FLAG.es} COMUNIDAD`, channels: [
      ch("es", "general", "general"),
      ch("es", "introductions", "presentaciones"),
      ch("es", "off-topic", "off-topic"),
      ch("es", "partners", "socios")
    ] },
    { lang: "es", name: `${FLAG.es} JUEGO`, channels: [
      ch("es", "game-news", "novedades-del-juego"),
      ch("es", "how-to-play", "como-jugar"),
      ch("es", "strategies", "estrategias"),
      ch("es", "civilizations", "civilizaciones-e-historia"),
      ch("es", "costs", "costos")
    ] },
    { lang: "es", name: `${FLAG.es} PRUEBAS`, channels: [
      ch("es", "feedback", "comentarios"),
      ch("es", "bugs", "errores"),
      ch("es", "suggestions", "sugerencias")
    ] }
  ];
  return [...en, voice, ...pt, ...es];
}
var norm = (s) => (s ?? "").toLowerCase().replace(/\s+/g, "-");
async function applyLayout(token2, guildId, dryRun, signal) {
  const log = [];
  const say = (m) => {
    log.push(m);
    console.error(m);
  };
  const problems = [];
  say(dryRun ? "DRY-RUN: nada ser\xE1 alterado." : "APLICANDO altera\xE7\xF5es.");
  const api = (method, path, body2, query) => discord(method, path, { token: token2, body: body2, query, signal });
  const existing = await api("GET", `/guilds/${guildId}/channels`);
  const me = await api("GET", "/users/@me");
  const claimed = /* @__PURE__ */ new Set();
  const currentParent = new Map(existing.map((c) => [c.id, c.parent_id ?? null]));
  let fake = 0;
  async function ensure(name, match, type, parent) {
    const wanted = [name, ...match].map(norm);
    const found = existing.find((c) => !claimed.has(c.id) && c.type === type && (c.parent_id ?? null) === parent && wanted.includes(norm(c.name)));
    if (found) {
      claimed.add(found.id);
      if (norm(found.name) !== norm(name)) {
        say(`renomear: ${found.name} \u2192 ${name}`);
        if (!dryRun) {
          try {
            await api("PATCH", `/channels/${found.id}`, { name });
          } catch (e) {
            if (!(e instanceof DiscordError) || e.status !== 403) throw e;
            problems.push(`SEM PERMISS\xC3O para renomear "${found.name}" \u2192 "${name}"`);
            say(`  \u26A0 sem permiss\xE3o para renomear ${found.name}; pulando`);
          }
        }
      }
      return found.id;
    }
    say(`criar: ${name}`);
    if (dryRun) return `dry-${++fake}`;
    try {
      const created = await api("POST", `/guilds/${guildId}/channels`, { name, type, parent_id: parent ?? void 0 });
      currentParent.set(created.id, parent);
      return created.id;
    } catch (e) {
      if (!(e instanceof DiscordError) || e.status !== 403) throw e;
      problems.push(`SEM PERMISS\xC3O para criar "${name}"`);
      say(`  \u26A0 sem permiss\xE3o para criar ${name}; pulando`);
      return null;
    }
  }
  const layout = buildLayout();
  const ids = /* @__PURE__ */ new Map();
  const order = [];
  const posts = [];
  for (const cat of layout) {
    const catId = await ensure(cat.name, cat.match ?? [], CATEGORY, null);
    if (!catId) {
      say(`  \u26A0 categoria ${cat.name} ignorada (e seus canais)`);
      continue;
    }
    order.push({ id: catId, parent: null });
    for (const spec of cat.channels) {
      const id = await ensure(spec.name, spec.match ?? [], spec.type ?? TEXT, catId);
      if (!id) continue;
      order.push({ id, parent: catId });
      if (cat.lang) ids.set(`${cat.lang}:${spec.key}`, id);
      if ((spec.post || spec.extra) && cat.lang) posts.push({ id, lang: cat.lang, spec });
    }
  }
  for (const o of order) {
    if (o.id.startsWith("dry-") || currentParent.get(o.id) === o.parent) continue;
    say(`mover canal ${o.id} para outra categoria`);
    if (dryRun) continue;
    try {
      await api("PATCH", `/channels/${o.id}`, { parent_id: o.parent });
      currentParent.set(o.id, o.parent);
    } catch (e) {
      if (!(e instanceof DiscordError) || e.status !== 403) throw e;
      problems.push(`SEM PERMISS\xC3O para mover o canal ${o.id}`);
    }
  }
  const cats = order.filter((o) => o.parent === null);
  const body = order.map((o) => ({
    id: o.id,
    position: o.parent === null ? cats.indexOf(o) : order.filter((x) => x.parent === o.parent).indexOf(o)
  }));
  say(`ordenar: ${cats.length} categorias e ${order.length - cats.length} canais`);
  if (!dryRun) {
    try {
      await api("PATCH", `/guilds/${guildId}/channels`, body.filter((b) => !b.id.startsWith("dry-")));
    } catch (e) {
      if (!(e instanceof DiscordError) || e.status !== 403) throw e;
      problems.push("SEM PERMISS\xC3O para reordenar os canais");
      say("  \u26A0 reordena\xE7\xE3o recusada (403)");
    }
  }
  for (const { id, lang, spec } of posts) {
    const text = (spec.post ?? []).map(
      (line) => line.replace(/\{([\w-]+)\}/g, (_m, key) => ids.get(`${lang}:${key}`) ? `<#${ids.get(`${lang}:${key}`)}>` : key)
    );
    try {
      const isNew = id.startsWith("dry-");
      const msgs = isNew ? [] : await api("GET", `/channels/${id}/messages`, void 0, { limit: 50 });
      const extra = spec.extra?.lines ?? [];
      if (msgs.some((m) => m.author.id === me.id)) {
        const missing = spec.extra && !msgs.some((m) => (m.content ?? "").toLowerCase().includes(spec.extra.marker.toLowerCase()));
        if (!missing) {
          say(`pulado (o bot j\xE1 postou em ${spec.name})`);
          continue;
        }
        say(`${dryRun ? "postar" : "postando"} a regra de divulga\xE7\xE3o em ${spec.name}`);
        if (!dryRun) for (const line of extra) await api("POST", `/channels/${id}/messages`, { content: line });
        continue;
      }
      const wipe = spec.clearFirst && msgs.length > 0;
      if (dryRun) {
        say(`postar ${text.length + extra.length} mensagens em ${spec.name}${wipe ? ` (apagando ${msgs.length} antigas)` : ""}`);
        continue;
      }
      if (wipe) {
        for (const m of msgs) await api("DELETE", `/channels/${id}/messages/${m.id}`);
        say(`apagadas ${msgs.length} mensagens antigas em ${spec.name}`);
      }
      for (const line of [...text, ...extra]) await api("POST", `/channels/${id}/messages`, { content: line });
      say(`postadas ${text.length + extra.length} mensagens em ${spec.name}`);
    } catch (e) {
      if (!(e instanceof DiscordError) || e.status !== 403) throw e;
      problems.push(`SEM PERMISS\xC3O para postar/apagar mensagens em ${spec.name}`);
      say(`  \u26A0 sem permiss\xE3o em ${spec.name}; pulando mensagens`);
    }
  }
  if (problems.length) {
    say("\nPROBLEMAS (o bot n\xE3o tem permiss\xE3o nesses itens):");
    problems.forEach((x) => say(" - " + x));
  }
  say(dryRun ? "Fim do dry-run. Rode de novo com apply para executar." : "Pronto.");
  return log;
}

// src/roles.ts
var LANGS = [
  {
    key: "en",
    role: "\u{1F1FA}\u{1F1F8} English",
    keyword: "english",
    color: 3947374,
    flag: "\u{1F1FA}\u{1F1F8}",
    title: "English",
    description: "English channels",
    channelNames: ["\u{1F1FA}\u{1F1F8}\u30FBgame-news", "\u{1F1FA}\u{1F1F8}\u30FBhow-to-play", "\u{1F1FA}\u{1F1F8}\u30FBstrategies", "\u{1F1FA}\u{1F1F8}\u30FBcivilizations-and-history", "\u{1F1FA}\u{1F1F8}\u30FBcosts", "\u{1F1FA}\u{1F1F8}\u30FBfeedback", "\u{1F1FA}\u{1F1F8}\u30FBbugs", "\u{1F1FA}\u{1F1F8}\u30FBsuggestions"]
  },
  {
    key: "pt",
    role: "\u{1F1E7}\u{1F1F7} Brazilian",
    keyword: "brazilian",
    color: 39995,
    flag: "\u{1F1E7}\u{1F1F7}",
    title: "Portugu\xEAs",
    description: "Canais em portugu\xEAs",
    channelNames: ["\u{1F1E7}\u{1F1F7}\u30FBboas-vindas", "\u{1F1E7}\u{1F1F7}\u30FBregras", "\u{1F1E7}\u{1F1F7}\u30FBan\xFAncios", "\u{1F1E7}\u{1F1F7}\u30FBgeral", "\u{1F1E7}\u{1F1F7}\u30FBapresenta\xE7\xF5es", "\u{1F1E7}\u{1F1F7}\u30FBoff-topic", "\u{1F1E7}\u{1F1F7}\u30FBparceiros", "\u{1F1E7}\u{1F1F7}\u30FBnovidades-do-jogo", "\u{1F1E7}\u{1F1F7}\u30FBcomo-jogar", "\u{1F1E7}\u{1F1F7}\u30FBestrat\xE9gias", "\u{1F1E7}\u{1F1F7}\u30FBciviliza\xE7\xF5es-e-hist\xF3ria", "\u{1F1E7}\u{1F1F7}\u30FBcustos", "\u{1F1E7}\u{1F1F7}\u30FBfeedback", "\u{1F1E7}\u{1F1F7}\u30FBbugs", "\u{1F1E7}\u{1F1F7}\u30FBsugest\xF5es"]
  },
  {
    key: "es",
    role: "\u{1F1EA}\u{1F1F8} Spanish",
    keyword: "spanish",
    color: 11146523,
    flag: "\u{1F1EA}\u{1F1F8}",
    title: "Espa\xF1ol",
    description: "Canales en espa\xF1ol",
    channelNames: ["\u{1F1EA}\u{1F1F8}\u30FBbienvenida", "\u{1F1EA}\u{1F1F8}\u30FBreglas", "\u{1F1EA}\u{1F1F8}\u30FBanuncios", "\u{1F1EA}\u{1F1F8}\u30FBgeneral", "\u{1F1EA}\u{1F1F8}\u30FBpresentaciones", "\u{1F1EA}\u{1F1F8}\u30FBoff-topic", "\u{1F1EA}\u{1F1F8}\u30FBsocios", "\u{1F1EA}\u{1F1F8}\u30FBnovedades-del-juego", "\u{1F1EA}\u{1F1F8}\u30FBcomo-jugar", "\u{1F1EA}\u{1F1F8}\u30FBestrategias", "\u{1F1EA}\u{1F1F8}\u30FBcivilizaciones-e-historia", "\u{1F1EA}\u{1F1F8}\u30FBcostos", "\u{1F1EA}\u{1F1F8}\u30FBcomentarios", "\u{1F1EA}\u{1F1F8}\u30FBerrores", "\u{1F1EA}\u{1F1F8}\u30FBsugerencias"]
  }
];
var DEFAULT_CHANNELS = ["\u{1F1FA}\u{1F1F8}\u30FBwelcome", "\u{1F1FA}\u{1F1F8}\u30FBrules", "\u{1F1FA}\u{1F1F8}\u30FBannouncements", "\u{1F1FA}\u{1F1F8}\u30FBgeneral", "\u{1F1FA}\u{1F1F8}\u30FBintroductions", "\u{1F1FA}\u{1F1F8}\u30FBoff-topic", "\u{1F1FA}\u{1F1F8}\u30FBpartners"];
var seq = 0;
function newId() {
  const ms = BigInt(Date.now() - 14200704e5);
  return String(ms << 22n | BigInt(Math.floor(Math.random() * 16383) << 8 | seq++ & 255));
}
var norm2 = (s) => (s ?? "").toLowerCase().replace(/\s+/g, "-");
function logger() {
  const log = [];
  return { log, say: (m) => {
    log.push(m);
    console.error(m);
  } };
}
async function ensureRoles(token2, guildId, dryRun, say, signal) {
  const roles = await discord("GET", `/guilds/${guildId}/roles`, { token: token2, signal });
  const ids = /* @__PURE__ */ new Map();
  for (const l of LANGS) {
    const found = roles.find((r) => r.name.toLowerCase().includes(l.keyword));
    if (found) {
      ids.set(l.key, found.id);
      say(`cargo j\xE1 existe: ${found.name}`);
      continue;
    }
    say(`criar cargo: ${l.role}`);
    if (dryRun) {
      ids.set(l.key, `dry-${l.key}`);
      continue;
    }
    const created = await discord("POST", `/guilds/${guildId}/roles`, { token: token2, signal, body: { name: l.role, color: l.color, hoist: false, mentionable: false } });
    ids.set(l.key, created.id);
  }
  return ids;
}
async function allMembers(token2, guildId, signal) {
  const out = [];
  let after = "0";
  for (; ; ) {
    const page = await discord("GET", `/guilds/${guildId}/members`, { token: token2, signal, query: { limit: 1e3, after } });
    out.push(...page);
    if (page.length < 1e3) break;
    after = page[page.length - 1].user?.id ?? "";
    if (!after) break;
  }
  return out;
}
async function setupRoles(token2, guildId, dryRun, signal) {
  const { log, say } = logger();
  say(dryRun ? "DRY-RUN (cargos): nada ser\xE1 alterado." : "APLICANDO (cargos).");
  const ids = await ensureRoles(token2, guildId, dryRun, say, signal);
  const brazilian = ids.get("pt");
  const members = (await allMembers(token2, guildId, signal)).filter((m) => m.user && !m.user.bot);
  const todo = members.filter((m) => !m.roles.includes(brazilian));
  say(`${members.length} jogadores (sem bots); ${members.length - todo.length} j\xE1 t\xEAm Brazilian; ${todo.length} v\xE3o receber.`);
  let done = 0, failed = 0;
  for (const m of todo) {
    const name = m.nick ?? m.user.global_name ?? m.user.username;
    if (dryRun) {
      say(`  daria Brazilian a: ${name}`);
      continue;
    }
    try {
      await discord("PUT", `/guilds/${guildId}/members/${m.user.id}/roles/${brazilian}`, { token: token2, signal });
      done++;
    } catch (e) {
      if (!(e instanceof DiscordError)) throw e;
      failed++;
      say(`  \u26A0 n\xE3o consegui dar o cargo a ${name}: ${e.message.slice(0, 120)}`);
    }
  }
  if (!dryRun) say(`Brazilian atribu\xEDdo a ${done} jogadores${failed ? `, ${failed} falharam (veja acima; o cargo do bot precisa estar ACIMA de Brazilian na lista de cargos)` : ""}.`);
  return log;
}
async function setupOnboarding(token2, guildId, dryRun, signal) {
  const { log, say } = logger();
  say(dryRun ? "DRY-RUN (tela de idioma): nada ser\xE1 alterado." : "APLICANDO (tela de idioma).");
  const guild2 = await discord("GET", `/guilds/${guildId}`, { token: token2, signal });
  if (!guild2.features?.includes("COMMUNITY")) {
    say("O servidor ainda n\xE3o est\xE1 no modo COMUNIDADE, e a tela de entrada s\xF3 existe nesse modo.");
    say("Ative em: Configura\xE7\xF5es do servidor > Ativar Comunidade. O Discord pede um canal de regras (use \u{1F1FA}\u{1F1F8}\u30FBrules) e um de atualiza\xE7\xF5es (use \u{1F1FA}\u{1F1F8}\u30FBannouncements). Depois rode este passo de novo.");
    return log;
  }
  const roleIds = await ensureRoles(token2, guildId, dryRun, say, signal);
  const channels = await discord("GET", `/guilds/${guildId}/channels`, { token: token2, signal });
  const byName = (names) => names.map((n) => channels.find((c) => norm2(c.name) === norm2(n))?.id).filter((x) => !!x);
  const defaults = byName(DEFAULT_CHANNELS);
  say(`canais padr\xE3o para todos: ${defaults.length}/${DEFAULT_CHANNELS.length}`);
  const ourTitle = "\u{1F310} Language / Idioma / Idioma";
  const prompt = {
    id: newId(),
    title: ourTitle,
    single_select: true,
    required: true,
    in_onboarding: true,
    type: 0,
    options: LANGS.map((l) => ({
      id: newId(),
      title: l.title,
      description: l.description,
      emoji_name: l.flag,
      role_ids: [roleIds.get(l.key)],
      channel_ids: byName(l.channelNames)
    }))
  };
  say(`pergunta: "${ourTitle}" com ${prompt.options.length} op\xE7\xF5es (${LANGS.map((l) => l.title).join(", ")})`);
  if (dryRun) return log;
  const current = await discord("GET", `/guilds/${guildId}/onboarding`, { token: token2, signal });
  const keep = (current.prompts ?? []).filter((p) => p.title !== ourTitle);
  const mine = (current.prompts ?? []).find((p) => p.title === ourTitle);
  await discord("PUT", `/guilds/${guildId}/onboarding`, {
    token: token2,
    signal,
    body: {
      prompts: [...keep, mine ? { ...prompt, id: mine.id, options: prompt.options.map((o) => ({ ...o, id: mine.options?.find((x) => x.title === o.title)?.id ?? o.id })) } : prompt],
      default_channel_ids: defaults,
      enabled: true,
      mode: 0
    }
  });
  say("Tela de idioma criada e ativada.");
  return log;
}

// src/announcements.ts
var FLAGS = { pt: "\u{1F1E7}\u{1F1F7}", en: "\u{1F1FA}\u{1F1F8}", es: "\u{1F1EA}\u{1F1F8}" };
var TARGETS = ["en", "es"];
var LIMIT = 1900;
var stripAccents = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function findAnnouncements(channels, lang) {
  return channels.find(
    (c) => (c.type === 0 || c.type === 5) && (c.name ?? "").includes(FLAGS[lang]) && /anuncio|announcement/.test(stripAccents(c.name ?? ""))
  );
}
function protect(text) {
  const saved = [];
  const masked = text.replace(/```[\s\S]*?```|`[^`\n]+`|<a?:\w+:\d+>|<[@#][&!]?\d+>|<t:\d+(?::\w)?>|https?:\/\/\S+|@everyone|@here/g, (m) => {
    saved.push(m);
    return `\u27E6${saved.length - 1}\u27E7`;
  });
  return { masked, restore: (t) => t.replace(/⟦\s*(\d+)\s*⟧/g, (_m, i) => saved[Number(i)] ?? "") };
}
var ratesCache;
function getRates() {
  ratesCache ??= fetch("https://open.er-api.com/v6/latest/BRL", { signal: AbortSignal.timeout(15e3) }).then((r) => r.json()).then((d) => ({ usd: d.rates?.USD, eur: d.rates?.EUR })).catch(() => ({}));
  return ratesCache;
}
async function smartPrompt(lang) {
  const r = await getRates();
  const money = r.usd ? `Today's rate: 1 BRL = ${r.usd.toFixed(4)} USD${r.eur ? ` = ${r.eur.toFixed(4)} EUR` : ""}. Convert every amount in reais (R$) and write it as "US$ X (R$ Y)"${lang === "es" && r.eur ? ` and also in euros, like "US$ X / \u20AC Z (R$ Y)"` : ""}; round sensibly and use the target language's number format.` : `Keep amounts in reais but write them as "R$ Y (BRL)" since the reader may not know the currency.`;
  return [
    `You adapt Discord announcements of the indie game "Era do Bronze" (a historical geopolitics simulation) from Portuguese into ${lang === "en" ? "natural American English" : "natural neutral Spanish for Latin America and Spain"}, for international players.`,
    `Do not translate word by word: write it the way a native community manager would. Be concise: cut filler, repetition and Brazil-only context, and summarize long posts into the key points, but never drop dates, version numbers, names, numbers, links, or anything players must act on.`,
    money,
    `Convert dates like 15/03 to a clear format for the target language. Explain Brazil-only terms briefly (for example "Pix" -> "Pix, Brazil's instant payment system") or remove them if irrelevant.`,
    `Keep Discord markdown, emojis and tokens like \u27E60\u27E7 exactly as they are. Keep the game name "Era do Bronze" (you may add "Bronze Age" in English on first mention). Output only the final text, with no comments.`
  ].join("\n");
}
var geminiModel = process.env.GEMINI_MODEL;
async function pickGeminiModel(key) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(3e4) });
  if (!res.ok) throw new Error(`Gemini: n\xE3o consegui listar os modelos (HTTP ${res.status}). Confira a GEMINI_API_KEY.`);
  const data = await res.json();
  const ok = (data.models ?? []).filter((m) => m.supportedGenerationMethods?.includes("generateContent") && /flash/.test(m.name) && !/(lite|image|tts|live|audio|thinking|exp|preview)/.test(m.name));
  const ver = (n) => Number(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  ok.sort((a, b) => ver(b.name) - ver(a.name));
  if (!ok[0]) throw new Error("Gemini: nenhum modelo 'flash' dispon\xEDvel para essa chave. Defina GEMINI_MODEL manualmente.");
  return ok[0].name.replace(/^models\//, "");
}
async function translateGemini(text, lang, key) {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: await smartPrompt(lang) }] },
    contents: [{ role: "user", parts: [{ text }] }]
  });
  const call = (model) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body,
    signal: AbortSignal.timeout(9e4)
  });
  geminiModel ??= await pickGeminiModel(key);
  let res = await call(geminiModel);
  if (res.status === 404 && !process.env.GEMINI_MODEL) {
    geminiModel = await pickGeminiModel(key);
    res = await call(geminiModel);
  }
  if (!res.ok) throw new Error(`Gemini (${geminiModel}) retornou HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const out = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!out) throw new Error("O Gemini n\xE3o devolveu texto (pode ter sido bloqueado).");
  return out;
}
async function convertMoney(text, lang) {
  const r = await getRates();
  if (!r.usd) return text;
  return text.replace(/R\$\s?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g, (m, n) => {
    const brl = Number(n.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(brl)) return m;
    const fmt = (v) => v >= 100 ? Math.round(v).toLocaleString(lang === "en" ? "en-US" : "es-ES") : v.toFixed(2);
    return `US$ ${fmt(brl * r.usd)}${lang === "es" && r.eur ? ` / \u20AC ${fmt(brl * r.eur)}` : ""} (${m})`;
  });
}
async function translateClaude(text, lang, key) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
      max_tokens: 2e3,
      system: await smartPrompt(lang),
      messages: [{ role: "user", content: text }]
    }),
    signal: AbortSignal.timeout(6e4)
  });
  if (!res.ok) throw new Error(`API do Claude retornou HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}
async function translateDeepL(text, lang, key) {
  const host = key.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";
  const xml = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/⟦(\d+)⟧/g, "<x>$1</x>");
  const res = await fetch(`https://${host}/v2/translate`, {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      text: [xml],
      source_lang: "PT",
      target_lang: lang === "en" ? "EN-US" : "ES",
      tag_handling: "xml",
      ignore_tags: ["x"],
      preserve_formatting: true
    }),
    signal: AbortSignal.timeout(6e4)
  });
  if (res.status === 403) throw new Error("DeepL recusou a chave (DEEPL_API_KEY inv\xE1lida).");
  if (res.status === 456) throw new Error("Acabou a cota mensal gratuita do DeepL (500 mil caracteres).");
  if (!res.ok) throw new Error(`DeepL retornou HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.translations[0].text.replace(/<x>\s*(\d+)\s*<\/x>/g, "\u27E6$1\u27E7").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
async function translateGoogle(text, lang) {
  const lines = text.split("\n");
  const out = [];
  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    const body = new URLSearchParams({ q: batch.join("\n") });
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=pt&tl=${lang}&dt=t`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(3e4)
    });
    if (!res.ok) throw new Error(`Tradutor retornou HTTP ${res.status}`);
    const data = await res.json();
    out.push(data[0].map((p) => p[0]).join(""));
    batch = [];
  };
  let size = 0;
  for (const line of lines) {
    if (size + line.length > 3e3) {
      await flush();
      size = 0;
    }
    batch.push(line);
    size += line.length + 1;
  }
  await flush();
  return out.join("\n");
}
async function translate(text, lang) {
  if (!text.trim()) return "";
  const { masked, restore } = protect(text);
  const gemini = process.env.GEMINI_API_KEY;
  const claude = process.env.ANTHROPIC_API_KEY;
  const deepl = process.env.DEEPL_API_KEY;
  let translated;
  if (claude) translated = await translateClaude(masked, lang, claude);
  else if (gemini) translated = await translateGemini(masked, lang, gemini);
  else {
    const pre = await convertMoney(text, lang);
    const p2 = protect(pre);
    const t = deepl ? await translateDeepL(p2.masked, lang, deepl) : await translateGoogle(p2.masked, lang);
    return p2.restore(t);
  }
  return restore(translated);
}
async function fetchAll(token2, channelId, signal) {
  const all = [];
  let before;
  for (; ; ) {
    const page = await discord("GET", `/channels/${channelId}/messages`, { token: token2, signal, query: { limit: 100, ...before ? { before } : {} } });
    if (!page.length) break;
    all.push(...page);
    before = page[page.length - 1].id;
    if (page.length < 100) break;
  }
  return all.reverse();
}
function chunk(text) {
  const parts = [];
  let rest = text;
  while (rest.length > LIMIT) {
    let cut = rest.lastIndexOf("\n", LIMIT);
    if (cut < LIMIT / 2) cut = rest.lastIndexOf(" ", LIMIT);
    if (cut < LIMIT / 2) cut = LIMIT;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}
var DEFAULT_AFTER_ID = "1571691260962406400";
async function syncAnnouncements({ token: token2, guildId, dryRun, redo, signal, log = (s) => console.error(s) }) {
  const lines = [];
  const say = (s) => {
    lines.push(s);
    log(s);
  };
  const channels = await discord("GET", `/guilds/${guildId}/channels`, { token: token2, signal });
  const src = process.env.PT_ANNOUNCEMENTS_ID ? channels.find((c) => c.id === process.env.PT_ANNOUNCEMENTS_ID) : findAnnouncements(channels, "pt");
  if (!src) throw new Error("N\xE3o achei o canal de an\xFAncios em portugu\xEAs (\u{1F1E7}\u{1F1F7}\u30FBan\xFAncios). Defina PT_ANNOUNCEMENTS_ID com o ID dele.");
  const dests = TARGETS.map((lang) => ({
    lang,
    channel: process.env[`${lang.toUpperCase()}_ANNOUNCEMENTS_ID`] ? channels.find((c) => c.id === process.env[`${lang.toUpperCase()}_ANNOUNCEMENTS_ID`]) : findAnnouncements(channels, lang)
  }));
  for (const d of dests) if (!d.channel) throw new Error(`N\xE3o achei o canal de an\xFAncios em ${d.lang === "en" ? "ingl\xEAs" : "espanhol"}. Rode 'node dist/cli.js layout --apply' antes.`);
  const floor = BigInt(process.env.ANNOUNCEMENTS_AFTER_ID ?? DEFAULT_AFTER_ID);
  const originals = (await fetchAll(token2, src.id, signal)).filter((m) => (m.content.trim() || m.attachments?.length) && BigInt(m.id) > floor);
  say(`Canal de origem: ${src.name} \u2014 ${originals.length} mensagens`);
  let copied = 0;
  const me = redo ? await discord("GET", "/users/@me", { token: token2, signal }) : void 0;
  for (const { lang, channel } of dests) {
    let mine = await fetchAll(token2, channel.id, signal);
    if (redo && me) {
      const old = mine.filter((m) => m.author.id === me.id);
      say(`${FLAGS[lang]} ${channel.name}: ${dryRun ? "apagaria" : "apagando"} ${old.length} mensagens antigas do bot`);
      if (!dryRun) for (const m of old) await discord("DELETE", `/channels/${channel.id}/messages/${m.id}`, { token: token2, signal });
      mine = mine.filter((m) => m.author.id !== me.id);
    }
    const done = /* @__PURE__ */ new Set();
    for (const m of mine) for (const r of m.content.matchAll(/ref:(\d+)/g)) done.add(r[1]);
    const todo = originals.filter((m) => !done.has(m.id));
    say(`${FLAGS[lang]} ${channel.name}: ${done.size} j\xE1 copiadas, ${todo.length} novas`);
    for (const m of todo) {
      const when = Math.floor(new Date(m.timestamp).getTime() / 1e3);
      if (dryRun) {
        say(`  copiaria ${m.id} (${m.content.slice(0, 50).replace(/\n/g, " ")}...)`);
        continue;
      }
      const body = await translate(m.content, lang);
      if (!body.trim()) {
        say(`  (pulada ${m.id}: tradu\xE7\xE3o vazia)`);
        continue;
      }
      const files = (m.attachments ?? []).map((a) => a.url).join("\n");
      const header = `\u{1F4C5} <t:${when}:D>`;
      const footer = `-# ${FLAGS.pt} auto-translated from the original \xB7 ref:${m.id}`;
      const full = [header, body, files].filter(Boolean).join("\n\n");
      const parts = chunk(full);
      for (let i = 0; i < parts.length; i++) {
        const content = i === parts.length - 1 ? `${parts[i]}
${footer}` : parts[i];
        try {
          await discord("POST", `/channels/${channel.id}/messages`, { token: token2, signal, body: { content, allowed_mentions: { parse: [] } } });
        } catch (e) {
          if (e instanceof DiscordError && e.status === 403) throw new Error(`O bot n\xE3o pode escrever em ${channel.name}. Confira as permiss\xF5es do canal.`);
          throw e;
        }
      }
      copied++;
      say(`  \u2713 ${m.id} \u2192 ${channel.name}`);
    }
  }
  say(dryRun ? "Dry-run: nada foi enviado." : `Pronto: ${copied} mensagens copiadas.`);
  return { copied, lines };
}
async function watchAnnouncements(opts, everySec = 60) {
  for (; ; ) {
    try {
      await syncAnnouncements({ ...opts, dryRun: false, log: () => {
      } }).then((r) => r.copied && opts.log?.(`${(/* @__PURE__ */ new Date()).toLocaleTimeString()} \u2014 ${r.copied} novas copiadas`));
    } catch (e) {
      (opts.log ?? console.error)(`erro: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, everySec * 1e3));
  }
}
async function postManual(token2, guildId, file, dryRun, redo, signal, log = (s) => console.error(s), only) {
  const { readFile } = await import("node:fs/promises");
  const posts = JSON.parse(await readFile(file, "utf-8")).sort((a, b) => a.timestamp - b.timestamp);
  const channels = await discord("GET", `/guilds/${guildId}/channels`, { token: token2, signal });
  const me = await discord("GET", "/users/@me", { token: token2, signal });
  let sent = 0;
  for (const lang of TARGETS.filter((l) => !only || l === only)) {
    const channel = process.env[`${lang.toUpperCase()}_ANNOUNCEMENTS_ID`] ? channels.find((c) => c.id === process.env[`${lang.toUpperCase()}_ANNOUNCEMENTS_ID`]) : findAnnouncements(channels, lang);
    if (!channel) throw new Error(`N\xE3o achei o canal de an\xFAncios em ${lang === "en" ? "ingl\xEAs" : "espanhol"}. Rode 'node dist/cli.js layout --apply' antes.`);
    let mine = await fetchAll(token2, channel.id, signal);
    if (redo) {
      const old = mine.filter((m) => m.author.id === me.id);
      log(`${FLAGS[lang]} ${channel.name}: ${dryRun ? "apagaria" : "apagando"} ${old.length} mensagens antigas do bot`);
      if (!dryRun) for (const m of old) await discord("DELETE", `/channels/${channel.id}/messages/${m.id}`, { token: token2, signal });
      mine = mine.filter((m) => m.author.id !== me.id);
    }
    const done = /* @__PURE__ */ new Set();
    for (const m of mine) for (const r of m.content.matchAll(/ref:(m\d+)/g)) done.add(r[1]);
    for (const p of posts.filter((x) => !done.has(x.ref))) {
      if (dryRun) {
        log(`  ${FLAGS[lang]} postaria ${p.ref} (${p[lang].length} caracteres)`);
        continue;
      }
      const parts = chunk(`\u{1F4C5} <t:${p.timestamp}:D>

${p[lang]}`);
      for (let i = 0; i < parts.length; i++) {
        const content = i === parts.length - 1 ? `${parts[i]}
-# ${FLAGS.pt} translated & summarized from the original \xB7 ref:${p.ref}` : parts[i];
        await discord("POST", `/channels/${channel.id}/messages`, { token: token2, signal, body: { content, allowed_mentions: { parse: [] } } });
      }
      sent++;
      log(`  \u2713 ${FLAGS[lang]} ${p.ref}`);
    }
  }
  log(dryRun ? "Dry-run: nada foi enviado." : `Pronto: ${sent} mensagens postadas.`);
  return sent;
}

// src/cli.ts
var token = process.env.DISCORD_BOT_TOKEN;
var guild = process.env.DISCORD_GUILD_ID;
if (!token || !guild) {
  console.error("Defina DISCORD_BOT_TOKEN e DISCORD_GUILD_ID.");
  process.exit(1);
}
var apply = process.argv.includes("--apply");
var cmd = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "layout";
var steps = {
  layout: [() => applyLayout(token, guild, !apply)],
  roles: [() => setupRoles(token, guild, !apply)],
  onboarding: [() => setupOnboarding(token, guild, !apply)],
  all: [() => applyLayout(token, guild, !apply), () => setupRoles(token, guild, !apply), () => setupOnboarding(token, guild, !apply)]
};
if (cmd === "post-manual") {
  await postManual(token, guild, new URL("../announcements-manual.json", import.meta.url), !apply, process.argv.includes("--redo"), void 0, void 0, process.argv.includes("--es") ? "es" : process.argv.includes("--en") ? "en" : void 0);
  process.exit(0);
}
if (cmd === "announcements") {
  if (process.argv.includes("--watch")) {
    console.error("Vigiando an\xFAncios em portugu\xEAs (Ctrl+C para parar)...");
    await watchAnnouncements({ token, guildId: guild, log: (s) => console.error(s) });
  }
  await syncAnnouncements({ token, guildId: guild, dryRun: !apply, redo: process.argv.includes("--redo") });
  process.exit(0);
}
if (!steps[cmd]) {
  console.error("Comando inv\xE1lido. Use: layout, roles, onboarding, announcements ou all.");
  process.exit(1);
}
for (const step of steps[cmd]) {
  await step();
  console.error("");
}
