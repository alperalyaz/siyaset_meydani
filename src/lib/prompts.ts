import type { Guest, Utterance } from "../types";

// Her konuk için persona system prompt'u.
export function guestSystemPrompt(
  guest: Guest,
  allGuests: Guest[],
  topic: string,
): string {
  const others = allGuests
    .filter((g) => g.name !== guest.name)
    .map((g) => `${g.name} (${g.era})`)
    .join(", ");

  return `Sen ${guest.name}'sın. ${guest.era}.

Kim olduğun (Vikipedi'den): ${guest.blurb}

Bir televizyon açık oturumundasın. Masadaki diğer konuklar: ${others}.
Oturumun konusu: "${topic}"

NASIL KONUŞACAKSIN:
- Kendi çağının, kendi hayatının, kendi dünya görüşünün diliyle konuş. Kendi döneminde olmayan bir şeyi bilmiyormuş gibi yap ama konuyu MUTLAKA kendi tecrübenden bir örnekle bağla. (Örn: modern bir kavramı duyduğunda kendi devrindeki benzerine benzet.)
- Kısa konuş: en fazla 2-3 cümle. Nutuk atma, uzatma. Ağız dolusu, çarpıcı, akılda kalıcı konuş.
- Her zaman senden önce konuşana bir gönderme yap: ona katıl, itiraz et, lafını çevir ya da hafifçe küçümse.
- Egon yüksek. İçten içe "bu masadaki en akıllı, en haklı insan benim" diye düşünüyorsun ve üstünlük kurmaya çalışıyorsun. Ama bunu kabalık değil, kişiliğinin doğallığıyla yap.
- Yer yer bir rakibine hak ver — ama hemen ardından kendi üstünlüğünü hatırlat.
- Gerektiğinde lafı gediğine koy, iğnele, ama masayı terk etme.
- Rolünden ASLA çıkma. "Bir yapay zeka olarak" gibi şeyler deme. Sahnedeki karaktersin.
- Sadece kendi repliğini yaz. İsmini başa yazma, tırnak kullanma, sahne yönergesi yazma. Sadece söylediğin sözler.

Spiker (kullanıcı) araya girip "durun" derse susarsın ve söyleneni yaparsın — ama içerleyerek, iğneleyerek. Yine de konunun bağlamından kopmazsın.`;
}

// Konuşma geçmişini modele okunur bir transkript olarak verir.
export function transcriptForModel(
  utterances: Utterance[],
  guests: Guest[],
): string {
  if (utterances.length === 0) {
    return "(Henüz kimse konuşmadı. Oturum yeni açılıyor.)";
  }
  return utterances
    .map((u) => {
      if (u.speaker === "moderator") return `SPİKER: ${u.text}`;
      if (u.mode === "system") return `(${u.text})`;
      const name = guests[u.speaker as number]?.name ?? "Konuk";
      const tag = u.mode === "interrupt" ? " [araya girerek]" : "";
      return `${name}${tag}: ${u.text}`;
    })
    .join("\n");
}

// Bir konuğun repliğini üretmek için mesaj dizisi.
export function guestMessages(
  guest: Guest,
  allGuests: Guest[],
  topic: string,
  utterances: Utterance[],
  cue: string | undefined,
  mode: "normal" | "interrupt",
) {
  const transcript = transcriptForModel(utterances, allGuests);
  const modeHint =
    mode === "interrupt"
      ? "Şu an sırayı beklemeden ARAYA GİRİYORSUN. Kısa, keskin bir müdahaleyle sözü kap."
      : "Sıra sende. Söz al.";
  const cueHint = cue ? `\nSahne yönergesi: ${cue}` : "";

  return [
    { role: "system" as const, content: guestSystemPrompt(guest, allGuests, topic) },
    {
      role: "user" as const,
      content: `Şu ana kadarki oturum:\n\n${transcript}\n\n${modeHint}${cueHint}\n\nSenin (${guest.name}) repliğin:`,
    },
  ];
}

// Yönetmen: transkripti okur, sıradaki konuşmacıyı ve anlık reytingi belirler.
export function directorMessages(
  guests: Guest[],
  topic: string,
  utterances: Utterance[],
  lastModeratorNote: string | undefined,
) {
  const roster = guests.map((g, i) => `${i}: ${g.name} (${g.era})`).join("\n");
  const transcript = transcriptForModel(utterances, guests);

  const system = `Sen bir televizyon açık oturumunun görünmez yönetmenisin. Amacın oturumu HEYECANLI ve İZLENİR tutmak.

Konu: "${topic}"
Konuklar:
${roster}

Görevin: transkripti oku ve sıradaki konuşmacıyı seç, bir de anlık REYTİNG ver.

REYTİNG KURALLARI (0-100):
- Çatışma, laf sokma, iddialı çıkışlar, beklenmedik ittifaklar reytingi YÜKSELTİR.
- Biri konuyu fazla uzatıyor, tek başına teknik/akademik detaya boğuluyor, herkes nazikçe uzlaşıyorsa reyting DÜŞER.
- Reytingi bir öncekine göre kademeli değiştir, ani 0'a düşürme.

KONUŞMACI SEÇİMİ:
- Doğrudan adı geçen / hedef alınan konuk cevap vermeli (mode: "interrupt" olabilir).
- En uzun süredir susan konuğa da söz ver, masayı dengele.
- Reyting düşükse, ortamı gerecek, iddialı bir konuğu "interrupt" ile araya sok ve cue ver.

Sadece şu JSON'u döndür, başka hiçbir şey yazma:
{"rating": <0-100 tam sayı>, "note": "<reytingin nedeni, kısa Türkçe>", "next": <konuşmacı index>, "mode": "normal" veya "interrupt", "cue": "<o konuğa kısa sahne yönergesi, opsiyonel>"}`;

  const modNote = lastModeratorNote
    ? `\n\nSpiker az önce şunu söyledi (mutlaka dikkate al): "${lastModeratorNote}"`
    : "";

  return [
    { role: "system" as const, content: system },
    {
      role: "user" as const,
      content: `Oturum:\n\n${transcript}${modNote}\n\nKararını JSON olarak ver:`,
    },
  ];
}

// Konuya göre kışkırtıcı spiker sorusu önerileri üretir.
export function suggestQuestionsMessages(topic: string, guests: Guest[]) {
  const names = guests.map((g) => g.name).join(", ");
  return [
    {
      role: "system" as const,
      content:
        "Sen bir açık oturum spikerisin. Kısa, kışkırtıcı, tartışma başlatan sorular üretirsin.",
    },
    {
      role: "user" as const,
      content: `Konu: "${topic}". Konuklar: ${names}. Bu masaya sorulabilecek 4 tane kısa, kışkırtıcı spiker sorusu üret. Sadece şu JSON: {"questions": ["...", "...", "...", "..."]}`,
    },
  ];
}
