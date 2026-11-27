"use client";

import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Archive,
	ArrowDown,
	ArrowLeft,
	Ban,
	Bell,
	BellOff,
	Bold,
	Bookmark,
	Check,
	CheckCheck,
	ChevronDown,
	ChevronRight,
	ChevronUp,
	CircleDot,
	CircleHelp,
	Copy,
	CornerUpLeft,
	Ear,
	Forward,
	Image,
	Italic,
	Languages,
	LogOut,
	Maximize2,
	Menu,
	Mic,
	Minus,
	Monitor,
	Moon,
	MoreHorizontal,
	Music2,
	Palette,
	Paperclip,
	Pause,
	Pencil,
	Phone,
	PhoneCall,
	Pin,
	PinOff,
	Play,
	Plus,
	Radio,
	Reply,
	Search,
	Send,
	Settings2,
	ShieldAlert,
	Smile,
	Strikethrough,
	Sun,
	Trash2,
	Type,
	Underline,
	UserPlus,
	Users,
	Video,
	X,
} from "lucide-react";
import {
	type ChangeEvent,
	type FormEvent,
	Fragment,
	type ReactNode,
	type UIEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { AccountDialog } from "@/components/AccountDialog";
import { AuthScreen } from "@/components/AuthScreen";
import { AvatarCarouselDialog } from "@/components/AvatarCarouselDialog";
import { CallOverlay } from "@/components/CallOverlay";
import { CreateChannelDialog } from "@/components/CreateChannelDialog";
import { CreateGroupDialog } from "@/components/CreateGroupDialog";
import { EmojiGifPicker } from "@/components/EmojiGifPicker";
import { ForwardDialog } from "@/components/ForwardDialog";
import { LanguageDialog } from "@/components/LanguageDialog";
import { MediaLightbox } from "@/components/MediaLightbox";
import {
	RichTextEditor,
	type RichTextEditorHandle,
} from "@/components/RichTextEditor";
import { SettingsPickerDialog } from "@/components/SettingsPickerDialog";
import {
	ACCENT_COLORS,
	ACCENT_PALETTES,
	type AccentColor,
} from "@/lib/chat/accentColors";
import {
	type ChannelPreview,
	type GroupMember,
	type LinkPreview,
	listGroupMembers,
	type MediaUploadKind,
	mediaUrl,
} from "@/lib/chat/api";
import type { GifResult } from "@/lib/chat/giphy";
import {
	avatarForUsername,
	colorForUsername,
	formatDuration,
	formatFileSize,
} from "@/lib/chat/presentation";
import {
	playNotificationSound,
	SOUND_THEME_LABELS,
	SOUND_THEMES,
	type SoundTheme,
} from "@/lib/chat/sound";
import {
	extractFirstUrl,
	parseFormattedText,
	splitCodeBlocks,
	splitLinks,
	stripFormatting,
	type TextAlign,
	trimFormattedText,
} from "@/lib/chat/textFormat";
import type {
	UIConversation,
	UIMedia,
	UIMessage,
} from "@/lib/chat/useChatSession";
import { useChatSession } from "@/lib/chat/useChatSession";

type Locale =
	| "uz"
	| "uzc"
	| "en"
	| "ru"
	| "de"
	| "es"
	| "ky"
	| "kk"
	| "tg"
	| "tk"
	| "tr"
	| "fr"
	| "it";
type Theme = "system" | "light" | "dark";
type Wallpaper = "waves" | "dots" | "leaves" | "none";

const WALLPAPERS: Wallpaper[] = ["waves", "dots", "leaves", "none"];
const WALLPAPER_LABELS: Record<Wallpaper, string> = {
	waves: "Waves",
	dots: "Dots",
	leaves: "Leaves",
	none: "Plain",
};
// A percentage multiplier on every font-size in the app (see the
// `--text-scale` CSS variable every `font-size: calc(...)` rule reads) —
// not just chat bubbles, every piece of UI text scales together, the same
// way Telegram Desktop's own "Interface scale" setting works.
const TEXT_SCALE_MIN = 70;
const TEXT_SCALE_MAX = 150;
const TEXT_SCALE_STEP = 10;
const TEXT_SCALE_DEFAULT = 100;
type TranslationKey =
	| "search"
	| "chats"
	| "pinned"
	| "settings"
	| "theme"
	| "system"
	| "light"
	| "dark"
	| "language"
	| "online"
	| "typing"
	| "message"
	| "placeholder"
	| "secure"
	| "call"
	| "video"
	| "more"
	| "attach"
	| "photo"
	| "emoji"
	| "roundVideo"
	| "close"
	| "noResults"
	| "globalSearch"
	| "me"
	| "preferences"
	| "account"
	| "personalSpace"
	| "today"
	| "members"
	| "subscribers"
	| "lastSeen";

const copy: Record<Locale, Record<TranslationKey, string>> = {
	uz: {
		search: "Xabarlar yoki odamlarni qidiring",
		chats: "Suhbatlar",
		pinned: "QADALGAN",
		settings: "Sozlamalar",
		theme: "Ko‘rinish",
		system: "Tizim",
		light: "Yorug‘",
		dark: "Qorong‘i",
		language: "Til",
		online: "tarmoqda",
		typing: "yozmoqda…",
		message: "Xabar",
		placeholder: "Xabar yozing…",
		secure: "Xabarlaringiz maxfiy va shifrlangan",
		call: "Ovozli qo‘ng‘iroq",
		video: "Videoqo‘ng‘iroq",
		more: "Suhbat sozlamalari",
		attach: "Fayl biriktirish",
		photo: "Rasm yuborish",
		emoji: "Emoji qo‘shish",
		roundVideo: "Dumaloq video yuborish",
		close: "Suhbatlar ro‘yxatini yopish",
		noResults: "Suhbatlar topilmadi",
		globalSearch: "Foydalanuvchilar",
		me: "Siz",
		preferences: "Afzalliklar",
		account: "Hisob",
		personalSpace: "Shaxsiy makon",
		today: "Bugun",
		members: "aʼzo",
		subscribers: "obunachi",
		lastSeen: "yaqinda ko‘rilgan",
	},
	uzc: {
		search: "Хабарлар ёки одамларни қидиринг",
		chats: "Суҳбатлар",
		pinned: "ҚАДАЛГАН",
		settings: "Созламалар",
		theme: "Кўриниш",
		system: "Тизим",
		light: "Ёруғ",
		dark: "Қоронғи",
		language: "Тил",
		online: "тармоқда",
		typing: "ёзмоқда…",
		message: "Хабар",
		placeholder: "Хабар ёзинг…",
		secure: "Хабарларингиз махфий ва шифрланган",
		call: "Овозли қўнғироқ",
		video: "Видео қўнғироқ",
		more: "Суҳбат созламалари",
		attach: "Файл бириктириш",
		photo: "Расм юбориш",
		emoji: "Эмодзи қўшиш",
		roundVideo: "Думалоқ видео юбориш",
		close: "Суҳбатлар рўйхатини ёпиш",
		noResults: "Суҳбатлар топилмади",
		globalSearch: "Фойдаланувчилар",
		me: "Сиз",
		preferences: "Афзалликлар",
		account: "Ҳисоб",
		personalSpace: "Шахсий макон",
		today: "Бугун",
		members: "аъзо",
		subscribers: "обуначи",
		lastSeen: "яқинда кўрилган",
	},
	en: {
		search: "Search messages or people",
		chats: "Chats",
		pinned: "PINNED",
		settings: "Settings",
		theme: "Appearance",
		system: "System",
		light: "Light",
		dark: "Dark",
		language: "Language",
		online: "online",
		typing: "typing…",
		message: "Message",
		placeholder: "Write a message…",
		secure: "Your messages are private and encrypted",
		call: "Start voice call",
		video: "Start video call",
		more: "More conversation options",
		attach: "Attach a file",
		photo: "Send a photo",
		emoji: "Add emoji",
		roundVideo: "Record a round video",
		close: "Close conversation list",
		noResults: "No conversations found",
		globalSearch: "Users",
		me: "You",
		preferences: "Preferences",
		account: "Account",
		personalSpace: "Personal space",
		today: "Today",
		members: "members",
		subscribers: "subscribers",
		lastSeen: "last seen recently",
	},
	ru: {
		search: "Поиск сообщений и людей",
		chats: "Чаты",
		pinned: "ЗАКРЕПЛЁННЫЕ",
		settings: "Настройки",
		theme: "Оформление",
		system: "Системная",
		light: "Светлая",
		dark: "Тёмная",
		language: "Язык",
		online: "в сети",
		typing: "печатает…",
		message: "Сообщение",
		placeholder: "Напишите сообщение…",
		secure: "Ваши сообщения конфиденциальны и зашифрованы",
		call: "Голосовой звонок",
		video: "Видеозвонок",
		more: "Другие параметры чата",
		attach: "Прикрепить файл",
		photo: "Отправить фото",
		emoji: "Добавить эмодзи",
		roundVideo: "Записать круглое видео",
		close: "Закрыть список чатов",
		noResults: "Чаты не найдены",
		globalSearch: "Пользователи",
		me: "Вы",
		preferences: "Предпочтения",
		account: "Аккаунт",
		personalSpace: "Личное пространство",
		today: "Сегодня",
		members: "участников",
		subscribers: "подписчиков",
		lastSeen: "недавно был(а)",
	},
	de: {
		search: "Nachrichten oder Personen suchen",
		chats: "Chats",
		pinned: "ANGEHEFTET",
		settings: "Einstellungen",
		theme: "Darstellung",
		system: "System",
		light: "Hell",
		dark: "Dunkel",
		language: "Sprache",
		online: "online",
		typing: "schreibt…",
		message: "Nachricht",
		placeholder: "Nachricht schreiben…",
		secure: "Deine Nachrichten sind privat und verschlüsselt",
		call: "Sprachanruf starten",
		video: "Videoanruf starten",
		more: "Weitere Chatoptionen",
		attach: "Datei anhängen",
		photo: "Foto senden",
		emoji: "Emoji hinzufügen",
		roundVideo: "Rundvideo aufnehmen",
		close: "Chatliste schließen",
		noResults: "Keine Chats gefunden",
		globalSearch: "Benutzer",
		me: "Du",
		preferences: "Einstellungen",
		account: "Konto",
		personalSpace: "Persönlicher Bereich",
		today: "Heute",
		members: "Mitglieder",
		subscribers: "Abonnenten",
		lastSeen: "zuletzt kürzlich online",
	},
	es: {
		search: "Buscar mensajes o personas",
		chats: "Chats",
		pinned: "FIJADOS",
		settings: "Ajustes",
		theme: "Apariencia",
		system: "Sistema",
		light: "Claro",
		dark: "Oscuro",
		language: "Idioma",
		online: "en línea",
		typing: "escribiendo…",
		message: "Mensaje",
		placeholder: "Escribe un mensaje…",
		secure: "Tus mensajes son privados y están cifrados",
		call: "Iniciar llamada de voz",
		video: "Iniciar videollamada",
		more: "Más opciones de conversación",
		attach: "Adjuntar archivo",
		photo: "Enviar foto",
		emoji: "Añadir emoji",
		roundVideo: "Grabar un video redondo",
		close: "Cerrar lista de conversaciones",
		noResults: "No se encontraron conversaciones",
		globalSearch: "Usuarios",
		me: "Tú",
		preferences: "Preferencias",
		account: "Cuenta",
		personalSpace: "Espacio personal",
		today: "Hoy",
		members: "miembros",
		subscribers: "suscriptores",
		lastSeen: "visto recientemente",
	},
	ky: {
		search: "Билдирүүлөрдү же адамдарды издөө",
		chats: "Маектер",
		pinned: "БЕКИТИЛГЕН",
		settings: "Жөндөөлөр",
		theme: "Көрүнүшү",
		system: "Система",
		light: "Ачык",
		dark: "Караңгы",
		language: "Тил",
		online: "тармакта",
		typing: "жазып жатат…",
		message: "Билдирүү",
		placeholder: "Билдирүү жазыңыз…",
		secure: "Билдирүүлөрүңүз купуя жана шифрленген",
		call: "Үн чалуу",
		video: "Видео чалуу",
		more: "Маектин башка жөндөөлөрү",
		attach: "Файл тиркөө",
		photo: "Сүрөт жөнөтүү",
		emoji: "Эмодзи кошуу",
		roundVideo: "Тегерек видео жазуу",
		close: "Маектер тизмесин жабуу",
		noResults: "Маектер табылган жок",
		globalSearch: "Пайдаланушылар",
		me: "Сиз",
		preferences: "Тандоолор",
		account: "Аккаунт",
		personalSpace: "Жеке мейкиндик",
		today: "Бүгүн",
		members: "мүчө",
		subscribers: "жазылуучу",
		lastSeen: "жакында көрүлгөн",
	},
	kk: {
		search: "Хабарларды немесе адамдарды іздеу",
		chats: "Чаттар",
		pinned: "БЕКІТІЛГЕН",
		settings: "Баптаулар",
		theme: "Көрініс",
		system: "Жүйе",
		light: "Ашық",
		dark: "Қою",
		language: "Тіл",
		online: "желіде",
		typing: "жазып жатыр…",
		message: "Хабарлама",
		placeholder: "Хабарлама жазыңыз…",
		secure: "Хабарларыңыз құпия және шифрланған",
		call: "Дауыстық қоңырау",
		video: "Бейнеқоңырау",
		more: "Чаттың басқа параметрлері",
		attach: "Файл тіркеу",
		photo: "Сурет жіберу",
		emoji: "Эмодзи қосу",
		roundVideo: "Дөңгелек видео жазу",
		close: "Чаттар тізімін жабу",
		noResults: "Чаттар табылмады",
		globalSearch: "Колдонуучулар",
		me: "Сіз",
		preferences: "Қалаулар",
		account: "Тіркелгі",
		personalSpace: "Жеке кеңістік",
		today: "Бүгін",
		members: "қатысушы",
		subscribers: "жазылушы",
		lastSeen: "жақында болған",
	},
	tg: {
		search: "Ҷустуҷӯи паёмҳо ё одамон",
		chats: "Чатҳо",
		pinned: "САБТШУДА",
		settings: "Танзимот",
		theme: "Намуди зоҳирӣ",
		system: "Система",
		light: "Равшан",
		dark: "Торик",
		language: "Забон",
		online: "онлайн",
		typing: "менависад…",
		message: "Паём",
		placeholder: "Паём нависед…",
		secure: "Паёмҳои шумо махфӣ ва рамзгузорӣ шудаанд",
		call: "Занги овозӣ",
		video: "Занги видеоӣ",
		more: "Имконоти дигари чат",
		attach: "Замима кардани файл",
		photo: "Фиристодани акс",
		emoji: "Илова кардани эмодзи",
		roundVideo: "Сабти видеои гард",
		close: "Пӯшидани рӯйхати чатҳо",
		noResults: "Чат ёфт нашуд",
		globalSearch: "Корбарон",
		me: "Шумо",
		preferences: "Бартариҳо",
		account: "Ҳисоб",
		personalSpace: "Фазои шахсӣ",
		today: "Имрӯз",
		members: "аъзо",
		subscribers: "обуначӣ",
		lastSeen: "ба наздикӣ дида шуд",
	},
	tk: {
		search: "Habarları ýa-da adamlary gözle",
		chats: "Söhbetler",
		pinned: "BERKITLENEN",
		settings: "Sazlamalar",
		theme: "Daşky görnüş",
		system: "Ulgam",
		light: "Açyk",
		dark: "Garaňky",
		language: "Dil",
		online: "onlaýn",
		typing: "ýazýar…",
		message: "Habar",
		placeholder: "Habar ýazyň…",
		secure: "Habarlaryňyz gizlin we şifrlenen",
		call: "Sesli jaň",
		video: "Wideo jaň",
		more: "Söhbetiň beýleki sazlamalary",
		attach: "Faýl goş",
		photo: "Surat iber",
		emoji: "Emoji goş",
		roundVideo: "Tegelek wideo ýazdyr",
		close: "Söhbet sanawyny ýap",
		noResults: "Söhbet tapylmady",
		globalSearch: "Ulanyjylar",
		me: "Siz",
		preferences: "Saýlamalar",
		account: "Hasap",
		personalSpace: "Şahsy giňişlik",
		today: "Şu gün",
		members: "agza",
		subscribers: "abuna",
		lastSeen: "ýakynda görüldi",
	},
	tr: {
		search: "Mesaj veya kişi ara",
		chats: "Sohbetler",
		pinned: "SABİTLENEN",
		settings: "Ayarlar",
		theme: "Görünüm",
		system: "Sistem",
		light: "Açık",
		dark: "Koyu",
		language: "Dil",
		online: "çevrimiçi",
		typing: "yazıyor…",
		message: "Mesaj",
		placeholder: "Mesaj yaz…",
		secure: "Mesajların gizli ve şifreli",
		call: "Sesli arama başlat",
		video: "Görüntülü arama başlat",
		more: "Diğer sohbet seçenekleri",
		attach: "Dosya ekle",
		photo: "Fotoğraf gönder",
		emoji: "Emoji ekle",
		roundVideo: "Yuvarlak video kaydet",
		close: "Sohbet listesini kapat",
		noResults: "Sohbet bulunamadı",
		globalSearch: "Kullanıcılar",
		me: "Sen",
		preferences: "Tercihler",
		account: "Hesap",
		personalSpace: "Kişisel alan",
		today: "Bugün",
		members: "üye",
		subscribers: "abone",
		lastSeen: "yakın zamanda görüldü",
	},
	fr: {
		search: "Rechercher des messages ou des personnes",
		chats: "Discussions",
		pinned: "ÉPINGLÉS",
		settings: "Paramètres",
		theme: "Apparence",
		system: "Système",
		light: "Clair",
		dark: "Sombre",
		language: "Langue",
		online: "en ligne",
		typing: "écrit…",
		message: "Message",
		placeholder: "Écrire un message…",
		secure: "Vos messages sont privés et chiffrés",
		call: "Démarrer un appel vocal",
		video: "Démarrer un appel vidéo",
		more: "Plus d'options de discussion",
		attach: "Joindre un fichier",
		photo: "Envoyer une photo",
		emoji: "Ajouter un emoji",
		roundVideo: "Enregistrer une vidéo ronde",
		close: "Fermer la liste des discussions",
		noResults: "Aucune discussion trouvée",
		globalSearch: "Utilisateurs",
		me: "Vous",
		preferences: "Préférences",
		account: "Compte",
		personalSpace: "Espace personnel",
		today: "Aujourd'hui",
		members: "membres",
		subscribers: "abonnés",
		lastSeen: "vu récemment",
	},
	it: {
		search: "Cerca messaggi o persone",
		chats: "Chat",
		pinned: "FISSATE",
		settings: "Impostazioni",
		theme: "Aspetto",
		system: "Sistema",
		light: "Chiaro",
		dark: "Scuro",
		language: "Lingua",
		online: "online",
		typing: "sta scrivendo…",
		message: "Messaggio",
		placeholder: "Scrivi un messaggio…",
		secure: "I tuoi messaggi sono privati e crittografati",
		call: "Avvia chiamata vocale",
		video: "Avvia videochiamata",
		more: "Altre opzioni della chat",
		attach: "Allega un file",
		photo: "Invia una foto",
		emoji: "Aggiungi emoji",
		roundVideo: "Registra un video rotondo",
		close: "Chiudi l'elenco delle chat",
		noResults: "Nessuna chat trovata",
		globalSearch: "Utenti",
		me: "Tu",
		preferences: "Preferenze",
		account: "Account",
		personalSpace: "Spazio personale",
		today: "Oggi",
		members: "membri",
		subscribers: "iscritti",
		lastSeen: "visto di recente",
	},
};

const localeNames: Record<Locale, string> = {
	uz: "O‘zbekcha",
	uzc: "Ўзбекча (Кирилл)",
	en: "English",
	ru: "Русский",
	de: "Deutsch",
	es: "Español",
	ky: "Кыргызча",
	kk: "Қазақша",
	tg: "Тоҷикӣ",
	tk: "Türkmençe",
	tr: "Türkçe",
	fr: "Français",
	it: "Italiano",
};

// Uzbek Latin/Cyrillic share one flag — same country, different script.
const localeFlags: Record<Locale, string> = {
	uz: "🇺🇿",
	uzc: "🇺🇿",
	en: "🇬🇧",
	ru: "🇷🇺",
	de: "🇩🇪",
	es: "🇪🇸",
	ky: "🇰🇬",
	kk: "🇰🇿",
	tg: "🇹🇯",
	tk: "🇹🇲",
	tr: "🇹🇷",
	fr: "🇫🇷",
	it: "🇮🇹",
};

const ACCENT_LABELS: Record<AccentColor, string> = {
	teal: "Teal",
	blue: "Blue",
	coral: "Coral",
	plum: "Plum",
	gold: "Gold",
	sage: "Sage",
};

const ROUND_VIDEO_MAX_MS = 60_000;
const VOICE_MAX_MS = 5 * 60_000;

// A plain Math.random() shuffle, called during render, is flagged by
// Next.js as an "unstable value" (it'd otherwise get frozen at prerender
// time) — this derives the same "looks shuffled" effect deterministically
// from a seed string instead, which also means it doesn't re-shuffle
// itself on every re-render of the same chat.
function seededShuffle<T>(items: readonly T[], seed: string): T[] {
	let state = 0;
	for (let i = 0; i < seed.length; i++) {
		state = (state * 31 + seed.charCodeAt(i)) | 0;
	}
	state = state >>> 0 || 1;
	const next = () => {
		state = (state * 1664525 + 1013904223) >>> 0;
		return state / 0xffffffff;
	};
	const shuffled = [...items];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(next() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

// A picked file, stopped recording, or chosen GIF, held back from actually
// uploading until the user confirms (optionally adding a caption first) —
// the same "preview before send" step every mainstream chat app puts in
// front of an attachment, rather than firing it off the instant it's
// picked. `previewUrl` is only set for kinds worth rendering a thumbnail
// for (image/round_video); it's an object URL for a local blob, or Giphy's
// own preview URL when picked from the GIF tab.
type PendingMedia = {
	kind: MediaUploadKind;
	name?: string;
	durationMs?: number;
	previewUrl?: string;
} & ({ source: "blob"; blob: Blob } | { source: "gif"; gif: GifResult });

// Shown as one-tap icebreakers in a brand new, still-empty chat — the same
// "say hi" nudge Telegram shows before either side has sent anything.
const GREETING_STICKERS = [
	"👋",
	"😊",
	"🎉",
	"❤️",
	"👍",
	"🤝",
	"😄",
	"🥳",
	"☕",
	"🙌",
];

// A message whose entire text is a handful of emoji (no other characters)
// renders as an oversized "sticker" instead of a normal text bubble —
// matches how most chat apps treat emoji-only messages, including the
// greeting stickers above once sent. Matched as a sequence (base pictograph
// plus optional variation-selector/ZWJ continuations), not a character
// class — a joined sequence like a family emoji can't be matched by
// classing its individual code points together.
const EMOJI_TOKEN_PATTERN =
	/^\p{Extended_Pictographic}(?:\u{fe0f}|\u{200d}\p{Extended_Pictographic})*$/u;

function isEmojiOnlyMessage(text: string): boolean {
	const trimmed = text.trim();
	if (!trimmed || trimmed.length > 40) return false;
	const tokens = trimmed.split(/\s+/);
	return (
		tokens.length <= 6 &&
		tokens.every((token) => EMOJI_TOKEN_PATTERN.test(token))
	);
}

function mediaKindLabel(kind: string): string {
	if (kind === "image") return "Photo";
	if (kind === "round_video") return "Round video";
	if (kind === "voice") return "Voice message";
	return "File";
}

// Click-to-copy inline code span — `like this`. Rendered purely as React
// text content (never dangerouslySetInnerHTML, never eval/Function'd), so
// whatever a user pastes here is inert: it can only ever be displayed and,
// on click, written verbatim to the clipboard — never executed.
function InlineCode({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	async function handleCopy(event: { stopPropagation: () => void }) {
		event.stopPropagation();
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 1200);
		} catch {
			// clipboard permission denied/unavailable — nothing more to do
		}
	}

	return (
		<button
			type="button"
			className={`inline-code ${copied ? "inline-code-copied" : ""}`}
			title={copied ? "Copied!" : "Click to copy"}
			onClick={handleCopy}
		>
			{text}
		</button>
	);
}

function renderRunText(text: string): ReactNode {
	const parts = splitLinks(text);
	if (parts.length === 1 && !parts[0].url && !parts[0].code) return text;
	// Keyed by the part's starting offset in `text` rather than its array
	// index — still a static, non-reorderable list, but a plain index key
	// trips the linter's "could silently mask reordering bugs" heuristic.
	let offset = 0;
	return (
		<>
			{parts.map((part) => {
				const key = offset;
				offset += part.text.length;
				if (part.code) return <InlineCode key={key} text={part.text} />;
				return part.url ? (
					<a
						key={key}
						href={part.url}
						target="_blank"
						rel="noreferrer"
						className="message-link"
						onClick={(event) => event.stopPropagation()}
					>
						{part.text}
					</a>
				) : (
					<Fragment key={key}>{part.text}</Fragment>
				);
			})}
		</>
	);
}

function LinkPreviewCard({
	url,
	getLinkPreview,
}: {
	url: string;
	getLinkPreview: (url: string) => Promise<LinkPreview | null>;
}) {
	const [preview, setPreview] = useState<LinkPreview | null>(null);

	useEffect(() => {
		let cancelled = false;
		setPreview(null);
		getLinkPreview(url).then((result) => {
			if (!cancelled) setPreview(result);
		});
		return () => {
			cancelled = true;
		};
	}, [url, getLinkPreview]);

	if (!preview || (!preview.title && !preview.description && !preview.image))
		return null;

	return (
		<a
			href={url}
			target="_blank"
			rel="noreferrer"
			className="link-preview-card"
			onClick={(event) => event.stopPropagation()}
		>
			{preview.image && (
				// biome-ignore lint/performance/noImgElement: remote, arbitrary-origin preview thumbnail — next/image's optimizer can't proxy it
				<img className="link-preview-image" src={preview.image} alt="" />
			)}
			<span className="link-preview-copy">
				{preview.siteName && <small>{preview.siteName}</small>}
				{preview.title && <strong>{preview.title}</strong>}
				{preview.description && <span>{preview.description}</span>}
			</span>
		</a>
	);
}

// Fenced code block — ```lang\n...\n``` — rendered verbatim (plain text
// content only) with a copy button, same never-executed guarantee as
// InlineCode: this is display + clipboard only, nothing here is eval'd,
// templated, or passed to a shell/interpreter in any language.
function CodeBlock({ code, lang }: { code: string; lang: string | null }) {
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 1200);
		} catch {
			// clipboard permission denied/unavailable — nothing more to do
		}
	}

	return (
		<div className="code-block">
			<div className="code-block-header">
				<span>{lang || "code"}</span>
				<button
					type="button"
					className="code-block-copy"
					onClick={(event) => {
						event.stopPropagation();
						void handleCopy();
					}}
				>
					{copied ? <Check size={13} /> : <Copy size={13} />}
					{copied ? "Copied" : "Copy"}
				</button>
			</div>
			<pre>
				<code>{code}</code>
			</pre>
		</div>
	);
}

function FormattedText({ text }: { text: string }) {
	const segments = splitCodeBlocks(text);
	if (segments.length === 1 && segments[0].type === "text") {
		return <FormattedTextLines text={text} />;
	}
	// Keyed by the segment's starting offset in `text`, same reasoning as
	// the other static-split keys in this file (see renderRunText).
	let offset = 0;
	return (
		<>
			{segments.map((segment) => {
				const key = offset;
				offset +=
					segment.type === "code" ? segment.code.length : segment.text.length;
				return segment.type === "code" ? (
					<CodeBlock key={key} code={segment.code} lang={segment.lang} />
				) : (
					<FormattedTextLines key={key} text={segment.text} />
				);
			})}
		</>
	);
}

function FormattedTextLines({ text }: { text: string }) {
	const lines = parseFormattedText(text);
	return (
		<>
			{lines.map((line, lineIndex) => (
				<p
					// biome-ignore lint/suspicious/noArrayIndexKey: lines are a static parse of the current text, not a reorderable/stateful list
					key={lineIndex}
					className="message-text"
					style={line.align === "left" ? undefined : { textAlign: line.align }}
				>
					{line.runs.length === 0 && " "}
					{line.runs.map((run, runIndex) => {
						let node: ReactNode = renderRunText(run.text);
						if (run.bold) node = <strong>{node}</strong>;
						if (run.italic) node = <em>{node}</em>;
						if (run.underline) node = <u>{node}</u>;
						if (run.strikethrough) node = <s>{node}</s>;
						// biome-ignore lint/suspicious/noArrayIndexKey: runs are a static parse of the current text, not a reorderable/stateful list
						return <Fragment key={runIndex}>{node}</Fragment>;
					})}
				</p>
			))}
		</>
	);
}

function VoiceBubble({ media }: { media: UIMedia }) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const [playing, setPlaying] = useState(false);
	const [progress, setProgress] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const durationSeconds = (media.durationMs ?? 0) / 1000;

	function togglePlay() {
		const audio = audioRef.current;
		if (!audio) return;
		if (playing) audio.pause();
		else void audio.play();
	}

	return (
		<div className="bubble-voice">
			{/* biome-ignore lint/a11y/useMediaCaption: user-recorded chat voice note, no transcript to provide */}
			<audio
				ref={audioRef}
				src={mediaUrl(media.url)}
				onPlay={() => setPlaying(true)}
				onPause={() => setPlaying(false)}
				onEnded={() => {
					setPlaying(false);
					setProgress(0);
					setCurrentTime(0);
				}}
				onTimeUpdate={(event) => {
					const el = event.currentTarget;
					setCurrentTime(el.currentTime);
					if (el.duration) setProgress(el.currentTime / el.duration);
				}}
			/>
			<button
				type="button"
				className="bubble-voice-play"
				onClick={togglePlay}
				aria-label={playing ? "Pause" : "Play"}
			>
				{playing ? <Pause size={15} /> : <Play size={15} />}
			</button>
			<div className="bubble-voice-track">
				<div
					className="bubble-voice-progress"
					style={{ width: `${progress * 100}%` }}
				/>
			</div>
			<span className="bubble-voice-time">
				{formatDuration(
					Math.round(currentTime > 0 ? currentTime : durationSeconds),
				)}
			</span>
		</div>
	);
}

function MediaBubble({
	media,
	onOpen,
	onLoad,
}: {
	media: UIMedia;
	onOpen?: () => void;
	onLoad?: () => void;
}) {
	const url = mediaUrl(media.url);
	if (media.kind === "image") {
		return (
			<button
				type="button"
				className="bubble-media bubble-media-image"
				onClick={onOpen}
			>
				{/* biome-ignore lint/performance/noImgElement: remote, signed, short-lived URL — next/image's optimizer has no use here */}
				<img
					src={url}
					alt={media.name ?? "Photo"}
					loading="lazy"
					onLoad={onLoad}
				/>
			</button>
		);
	}
	if (media.kind === "round_video") {
		return (
			<div className="bubble-media bubble-round-video">
				{/* biome-ignore lint/a11y/useMediaCaption: user-recorded chat video, no transcript to provide */}
				<video src={url} playsInline controls onLoadedMetadata={onLoad} />
				{onOpen && (
					<button
						type="button"
						className="bubble-media-expand"
						onClick={onOpen}
						aria-label="View fullscreen"
					>
						<Maximize2 size={13} />
					</button>
				)}
			</div>
		);
	}
	if (media.kind === "voice") {
		return <VoiceBubble media={media} />;
	}
	return (
		<a
			className="bubble-media bubble-media-file"
			href={url}
			download={media.name ?? undefined}
		>
			<Paperclip size={16} />
			<span className="bubble-file-name">{media.name ?? "File"}</span>
			<span className="bubble-file-size">{formatFileSize(media.size)}</span>
		</a>
	);
}

// Roughly 10 lines of composer text at the app's base font size/line-height
// before the textarea stops growing and starts scrolling internally.
// 10 lines at the composer textarea's own line-height (20px) + vertical
// padding (13px) — kept in sync with the CSS max-height on .composer-textarea.
const COMPOSER_MAX_HEIGHT = 213;
const COMPOSER_AUTOGROW = { maxHeight: COMPOSER_MAX_HEIGHT };

// Drag-resize range for the sidebar. The minimum stops right at avatar
// width — narrower than that and the conversation name/preview text would
// have nowhere to go, so the list collapses into an icon rail instead.
const SIDEBAR_MIN_WIDTH = 72;
const SIDEBAR_MAX_WIDTH = 480;
const SIDEBAR_DEFAULT_WIDTH = 326;
const SIDEBAR_COLLAPSE_THRESHOLD = 110;

export default function Home() {
	const session = useChatSession();
	const [activeId, setActiveId] = useState<string | null>(null);
	const [navBackId, setNavBackId] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [globalUserResults, setGlobalUserResults] = useState<
		{ userId: string; username: string }[]
	>([]);
	const [draft, setDraft] = useState("");
	// Purely a display concern now — which align button looks "pressed" for
	// the line the caret is currently in. Alignment itself lives inline in
	// `draft` (each line carries its own marker), so this never feeds back
	// into serialization.
	const [draftAlign, setDraftAlign] = useState<TextAlign>("left");
	const draftEditorRef = useRef<RichTextEditorHandle>(null);
	const [theme, setTheme] = useState<Theme>("system");
	const [locale, setLocale] = useState<Locale>("en");
	const [wallpaper, setWallpaper] = useState<Wallpaper>("waves");
	const [textScale, setTextScale] = useState(TEXT_SCALE_DEFAULT);
	const [accentColor, setAccentColor] = useState<AccentColor>("teal");
	const [systemIsDark, setSystemIsDark] = useState(false);
	const [preferencesLoaded, setPreferencesLoaded] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [archiveViewOpen, setArchiveViewOpen] = useState(false);
	const [blockedViewOpen, setBlockedViewOpen] = useState(false);
	const [savedMessagesPinned, setSavedMessagesPinned] = useState(false);
	const [mobileListOpen, setMobileListOpen] = useState(false);
	const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
	const [resizingSidebar, setResizingSidebar] = useState(false);
	const sidebarResizeStartRef = useRef({ x: 0, width: SIDEBAR_DEFAULT_WIDTH });
	const [callMinimized, setCallMinimized] = useState(false);
	const [mediaError, setMediaError] = useState<string | null>(null);
	const [recording, setRecording] = useState<{
		stream: MediaStream;
		startedAt: number;
		elapsedMs: number;
	} | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const imageInputRef = useRef<HTMLInputElement>(null);
	const recordingVideoRef = useRef<HTMLVideoElement>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const recordedChunksRef = useRef<Blob[]>([]);
	const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const [recordingVoice, setRecordingVoice] = useState<{
		stream: MediaStream;
		startedAt: number;
		elapsedMs: number;
	} | null>(null);
	const voiceRecorderRef = useRef<MediaRecorder | null>(null);
	const voiceChunksRef = useRef<Blob[]>([]);
	const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const [attachMenuOpen, setAttachMenuOpen] = useState(false);
	const [recordMenuOpen, setRecordMenuOpen] = useState(false);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
	// Extra files picked alongside `pendingMedia` in the same selection —
	// `pendingMedia` is always the one currently previewed/captioned; these
	// are sent right after it, in order, once the user hits send once.
	const [pendingMediaQueue, setPendingMediaQueue] = useState<PendingMedia[]>(
		[],
	);
	const [sendingPendingMedia, setSendingPendingMedia] = useState(false);
	const [replyTo, setReplyTo] = useState<UIMessage | null>(null);
	const [forwarding, setForwarding] = useState<{
		message: UIMessage;
		sourceChatId: string;
	} | null>(null);
	const [forwardBusy, setForwardBusy] = useState(false);
	const [forwardError, setForwardError] = useState<string | null>(null);
	const [creatingGroupOpen, setCreatingGroupOpen] = useState(false);
	const [createGroupBusy, setCreateGroupBusy] = useState(false);
	const [createGroupError, setCreateGroupError] = useState<string | null>(null);
	const [creatingChannelOpen, setCreatingChannelOpen] = useState(false);
	const [createChannelBusy, setCreateChannelBusy] = useState(false);
	const [createChannelError, setCreateChannelError] = useState<string | null>(
		null,
	);
	const [channelSearchResult, setChannelSearchResult] =
		useState<ChannelPreview | null>(null);
	const [channelSearchBusy, setChannelSearchBusy] = useState(false);
	const [groupInfoOpen, setGroupInfoOpen] = useState(false);
	const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
	const [groupMemberQuery, setGroupMemberQuery] = useState("");
	const [languageDialogOpen, setLanguageDialogOpen] = useState(false);
	const [accountDialogOpen, setAccountDialogOpen] = useState(false);
	const [avatarCarouselMediaId, setAvatarCarouselMediaId] = useState<
		string | null
	>(null);
	const [activeSettingsPicker, setActiveSettingsPicker] = useState<
		"sound" | "ringtone" | "wallpaper" | "accent" | null
	>(null);
	const [lightboxId, setLightboxId] = useState<string | null>(null);
	const [messageMenuOpenId, setMessageMenuOpenId] = useState<string | null>(
		null,
	);
	const [chatSearchOpen, setChatSearchOpen] = useState(false);
	const [chatSearchQuery, setChatSearchQuery] = useState("");
	const [chatSearchIndex, setChatSearchIndex] = useState(0);
	const [pinnedIndex, setPinnedIndex] = useState(0);
	const [lightboxLoadingOlder, setLightboxLoadingOlder] = useState(false);
	const [editing, setEditing] = useState<{
		chatId: string;
		message: UIMessage;
	} | null>(null);
	const [deleting, setDeleting] = useState<{
		chatId: string;
		message: UIMessage;
	} | null>(null);
	const [chatMenuOpen, setChatMenuOpen] = useState(false);
	const [chatActionBusy, setChatActionBusy] = useState(false);
	const [chatActionError, setChatActionError] = useState<string | null>(null);
	const t = copy[locale];
	const conversations = session.conversations;
	const active =
		conversations.find((conversation) => conversation.id === activeId) ??
		conversations[0] ??
		null;
	// A channel is a broadcast surface — only the owner/admins may post;
	// every other chat kind has no such restriction.
	const canPostInActiveChat =
		!active?.isChannel ||
		active.myRole === "owner" ||
		active.myRole === "admin";
	const mediaItems = useMemo(() => {
		if (!active) return [];
		return active.messages
			.filter(
				(m): m is UIMessage & { media: UIMedia } =>
					!!m.media &&
					(m.media.kind === "image" || m.media.kind === "round_video"),
			)
			.map((m) => ({
				id: m.id,
				media: m.media,
				fromMe: m.fromMe,
				time: m.time,
			}));
	}, [active]);
	// Re-shuffled whenever the active chat changes, but stable across
	// re-renders of the same chat so the row doesn't jump around as you look at it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: only the id should trigger a reshuffle, not every field of the conversation object
	const greetingStickers = useMemo(() => {
		if (!active) return [];
		return seededShuffle(GREETING_STICKERS, active.id).slice(0, 6);
	}, [active?.id]);
	// "Search messages or people" (see the placeholder copy) means exactly
	// that — matching only the contact name left half the promise unmet.
	// Message search is necessarily limited to history this client already
	// has loaded (there's no server-side search index), same trade-off any
	// lazily-loaded chat history implies.
	const trimmedQuery = query.trim().toLowerCase();

	const pinnedMessages = active?.pinnedMessages ?? [];
	const clampedPinnedIndex = pinnedMessages.length
		? Math.min(pinnedIndex, pinnedMessages.length - 1)
		: 0;
	const activePinnedMessage = pinnedMessages[clampedPinnedIndex] ?? null;

	const trimmedChatSearchQuery = chatSearchQuery.trim().toLowerCase();
	const chatSearchMatches =
		chatSearchOpen && active && trimmedChatSearchQuery
			? active.messages.filter(
					(m) =>
						!m.deleted &&
						!m.isSystem &&
						!m.isCallEvent &&
						stripFormatting(m.text)
							.toLowerCase()
							.includes(trimmedChatSearchQuery),
				)
			: [];
	const clampedChatSearchIndex = chatSearchMatches.length
		? Math.min(chatSearchIndex, chatSearchMatches.length - 1)
		: 0;

	// Jump to the first match as soon as a new query turns up any — further
	// moves between matches are driven by the prev/next buttons instead, not
	// by this effect, so it only reacts to the query itself.
	// biome-ignore lint/correctness/useExhaustiveDependencies: only the typed query should trigger the initial jump, not every match-array identity change
	useEffect(() => {
		if (!chatSearchOpen || chatSearchMatches.length === 0) return;
		scrollToMessage(chatSearchMatches[0].id);
	}, [chatSearchQuery, chatSearchOpen]);

	function jumpToSearchMatch(delta: number) {
		if (chatSearchMatches.length === 0) return;
		const next =
			(clampedChatSearchIndex + delta + chatSearchMatches.length) %
			chatSearchMatches.length;
		setChatSearchIndex(next);
		scrollToMessage(chatSearchMatches[next].id);
	}

	function jumpToPinnedMessage() {
		if (!activePinnedMessage) return;
		scrollToMessage(activePinnedMessage.id);
		setPinnedIndex((clampedPinnedIndex + 1) % pinnedMessages.length);
	}

	useEffect(() => {
		const q = query.trim();
		if (!q) {
			setGlobalUserResults([]);
			return;
		}
		let cancelled = false;
		const timeout = setTimeout(async () => {
			const results = await session.searchUsers(q);
			if (!cancelled) setGlobalUserResults(results);
		}, 250);
		return () => {
			cancelled = true;
			clearTimeout(timeout);
		};
	}, [query, session.searchUsers]);

	// The same "search for everything" box also finds a public channel by
	// its exact @handle — there's no separate "join a channel" entry point,
	// this is it. Harmless to attempt on every query (a 404-equivalent
	// null just means no channel has that handle).
	useEffect(() => {
		const q = query.trim().replace(/^@/, "");
		if (!q) {
			setChannelSearchResult(null);
			return;
		}
		let cancelled = false;
		setChannelSearchBusy(true);
		const timeout = setTimeout(async () => {
			const result = await session.findChannelByHandle(q);
			if (!cancelled) {
				setChannelSearchResult(result);
				setChannelSearchBusy(false);
			}
		}, 250);
		return () => {
			cancelled = true;
			clearTimeout(timeout);
		};
	}, [query, session.findChannelByHandle]);

	// Global search also surfaces users you don't have a conversation with
	// yet — Telegram shows these below your own chats instead of silently
	// limiting "search" to chats you already started. Anyone with an
	// existing conversation is excluded here since they're already in
	// `filtered` above.
	const existingPartnerIds = new Set(
		conversations.map((c) => c.otherUserId).filter(Boolean),
	);
	const globalResults = trimmedQuery
		? globalUserResults.filter((u) => !existingPartnerIds.has(u.userId))
		: [];
	const joinableChannelResult =
		channelSearchResult &&
		!conversations.some((c) => c.id === channelSearchResult.chatId)
			? channelSearchResult
			: null;

	const archivedChats = conversations
		.filter((c) => c.archived)
		.filter((c) => {
			if (!trimmedQuery) return true;
			const name = c.isSelf ? "saved messages" : c.name.toLowerCase();
			return name.includes(trimmedQuery);
		});

	const trimmedGroupMemberQuery = groupMemberQuery.trim().toLowerCase();
	const filteredGroupMembers = trimmedGroupMemberQuery
		? groupMembers.filter((member) =>
				member.username.toLowerCase().includes(trimmedGroupMemberQuery),
			)
		: groupMembers;

	const blockedUserIds = new Set(session.blockedUsers.map((u) => u.userId));
	const blockedChats = conversations
		.filter((c) => !c.isSelf && blockedUserIds.has(c.otherUserId))
		.filter(
			(c) => !trimmedQuery || c.name.toLowerCase().includes(trimmedQuery),
		);

	// Saved Messages always sorts first in the sidebar, the same way
	// Telegram pins it — but `conversations` itself (used for the default-
	// active chat on load) stays activity-ordered, so opening the app
	// doesn't silently redirect a returning user away from their actual
	// most recent conversation.
	const filtered = conversations
		.filter((conversation) => {
			if (conversation.archived) return false;
			if (!conversation.isSelf && blockedUserIds.has(conversation.otherUserId))
				return false;
			if (conversation.isSelf && !savedMessagesPinned) return false;
			if (!trimmedQuery) return true;
			if (conversation.name.toLowerCase().includes(trimmedQuery)) return true;
			if (
				conversation.handle
					?.toLowerCase()
					.includes(trimmedQuery.replace(/^@/, ""))
			) {
				return true;
			}
			return conversation.messages.some(
				(m) =>
					!m.deleted &&
					!m.isCallEvent &&
					m.text.toLowerCase().includes(trimmedQuery),
			);
		})
		.sort((a, b) => {
			if (!savedMessagesPinned) return 0;
			return a.isSelf === b.isSelf ? 0 : a.isSelf ? -1 : 1;
		});
	const savedPinned = savedMessagesPinned && filtered[0]?.isSelf === true;

	// When a chat only matched because of something *in* it rather than its
	// name, show that message as the subtitle instead of the normal last-
	// message preview — otherwise a search hit looks unexplained.
	function matchedMessageSnippet(conversation: UIConversation): string | null {
		if (
			!trimmedQuery ||
			conversation.name.toLowerCase().includes(trimmedQuery)
		) {
			return null;
		}
		const match = [...conversation.messages]
			.reverse()
			.find(
				(m) =>
					!m.deleted &&
					!m.isCallEvent &&
					m.text.toLowerCase().includes(trimmedQuery),
			);
		return match ? stripFormatting(match.text) : null;
	}

	useEffect(() => {
		if (!resizingSidebar) return;
		function handleMove(event: MouseEvent) {
			const delta = event.clientX - sidebarResizeStartRef.current.x;
			const next = Math.min(
				SIDEBAR_MAX_WIDTH,
				Math.max(
					SIDEBAR_MIN_WIDTH,
					sidebarResizeStartRef.current.width + delta,
				),
			);
			setSidebarWidth(next);
		}
		function handleUp() {
			setResizingSidebar(false);
		}
		window.addEventListener("mousemove", handleMove);
		window.addEventListener("mouseup", handleUp);
		return () => {
			window.removeEventListener("mousemove", handleMove);
			window.removeEventListener("mouseup", handleUp);
		};
	}, [resizingSidebar]);

	useEffect(() => {
		const storedTheme = localStorage.getItem("chat-theme") as Theme | null;
		const storedLocale = localStorage.getItem("chat-locale") as Locale | null;
		const storedWallpaper = localStorage.getItem(
			"chat-wallpaper",
		) as Wallpaper | null;
		const storedAccent = localStorage.getItem(
			"chat-accent",
		) as AccentColor | null;
		const storedTextScale = Number.parseInt(
			localStorage.getItem("chat-text-scale") ?? "",
			10,
		);
		if (storedTheme && ["system", "light", "dark"].includes(storedTheme))
			setTheme(storedTheme);
		if (storedLocale && Object.hasOwn(localeNames, storedLocale))
			setLocale(storedLocale);
		if (storedWallpaper && WALLPAPERS.includes(storedWallpaper))
			setWallpaper(storedWallpaper);
		if (storedAccent && ACCENT_COLORS.includes(storedAccent))
			setAccentColor(storedAccent);
		if (
			Number.isFinite(storedTextScale) &&
			storedTextScale >= TEXT_SCALE_MIN &&
			storedTextScale <= TEXT_SCALE_MAX
		)
			setTextScale(storedTextScale);
		setPreferencesLoaded(true);
	}, []);

	useEffect(() => {
		const query = window.matchMedia("(prefers-color-scheme: dark)");
		setSystemIsDark(query.matches);
		const handleChange = (event: MediaQueryListEvent) =>
			setSystemIsDark(event.matches);
		query.addEventListener("change", handleChange);
		return () => query.removeEventListener("change", handleChange);
	}, []);

	useEffect(() => {
		if (!preferencesLoaded) return;
		localStorage.setItem("chat-theme", theme);
		document.documentElement.dataset.theme = theme;
	}, [preferencesLoaded, theme]);

	useEffect(() => {
		if (!preferencesLoaded) return;
		localStorage.setItem("chat-wallpaper", wallpaper);
		document.documentElement.dataset.wallpaper = wallpaper;
	}, [preferencesLoaded, wallpaper]);

	useEffect(() => {
		if (!preferencesLoaded) return;
		localStorage.setItem("chat-text-scale", String(textScale));
		document.documentElement.style.setProperty(
			"--text-scale",
			String(textScale / 100),
		);
	}, [preferencesLoaded, textScale]);

	useEffect(() => {
		if (!preferencesLoaded) return;
		localStorage.setItem("chat-accent", accentColor);
		const isDark = theme === "dark" || (theme === "system" && systemIsDark);
		const palette = ACCENT_PALETTES[accentColor][isDark ? "dark" : "light"];
		const root = document.documentElement.style;
		root.setProperty("--accent", palette.accent);
		root.setProperty("--accent-dark", palette.accentDark);
		root.setProperty("--accent-wash", palette.accentWash);
	}, [preferencesLoaded, accentColor, theme, systemIsDark]);

	useEffect(() => {
		if (!preferencesLoaded) return;
		localStorage.setItem("chat-locale", locale);
		document.documentElement.lang = locale === "uzc" ? "uz-Cyrl" : locale;
	}, [locale, preferencesLoaded]);

	const [historyReadyIds, setHistoryReadyIds] = useState<Set<string>>(
		new Set(),
	);

	useEffect(() => {
		if (!active) return;
		void session.ensureMessagesLoaded(active.id).then(() => {
			setHistoryReadyIds((current) => new Set(current).add(active.id));
		});
	}, [active, session.ensureMessagesLoaded]);

	useEffect(() => {
		if (!active) return;
		void session.refreshPinnedMessages(active.id);
	}, [active, session.refreshPinnedMessages]);

	useEffect(() => {
		setGroupMemberQuery("");
		if (
			!groupInfoOpen ||
			!(active?.isGroup || active?.isChannel) ||
			!session.session
		) {
			setGroupMembers([]);
			return;
		}
		let cancelled = false;
		void listGroupMembers(session.session.token, active.id).then((members) => {
			if (!cancelled) setGroupMembers(members);
		});
		return () => {
			cancelled = true;
		};
	}, [
		groupInfoOpen,
		active?.isGroup,
		active?.isChannel,
		active?.id,
		session.session,
	]);

	useEffect(() => {
		session.setActiveChatId(activeId);
	}, [activeId, session.setActiveChatId]);

	useEffect(() => {
		if (!mediaError) return;
		const timeout = setTimeout(() => setMediaError(null), 4000);
		return () => clearTimeout(timeout);
	}, [mediaError]);

	useEffect(() => {
		if (recordingVideoRef.current) {
			recordingVideoRef.current.srcObject = recording?.stream ?? null;
		}
	}, [recording?.stream]);

	// Every new call starts maximized, even if the previous one ended minimized.
	useEffect(() => {
		if (
			session.call.status === "outgoing" ||
			session.call.status === "incoming"
		) {
			setCallMinimized(false);
		}
	}, [session.call.status]);

	const messageScrollRef = useRef<HTMLDivElement>(null);
	// Anchors the scroll position to a specific message's on-screen position
	// (rather than a raw scrollHeight delta) whenever older history is
	// prepended above it — immune to that message's own position shifting
	// again later as a late-loading image/video bubble above it (inside the
	// very batch that was just prepended) grows from ~0 height to its real
	// size, which a one-shot scrollHeight-diff correction can't account for.
	const topAnchorRef = useRef<{
		chatId: string;
		messageId: string;
		top: number;
	} | null>(null);
	const lastBottomScrollRef = useRef<{
		chatId: string;
		messageCount: number;
	} | null>(null);
	// Whether the view should keep snapping to the latest message as the
	// scroll container's content grows. An image/video bubble has ~0 height
	// until its bytes finish loading, so the effect below can decide "we're
	// at the bottom" the instant a message is added, then the media loads a
	// moment later and silently grows past that point — this ref lets
	// handleMediaLoad snap back down again when that happens, without
	// yanking the view if the user had deliberately scrolled up to read
	// something unrelated.
	const stickToBottomRef = useRef(true);
	// One-shot: set right before `loadOlderMessages` fires, consumed by the
	// effect below the moment the prepended history lands — separate from
	// `topAnchorRef` itself, which stays alive afterward so a late-loading
	// image/video *inside* that same prepended batch can keep re-correcting
	// via `handleMediaLoad` (see `topAnchorRef`'s own comment).
	const pendingTopRestoreRef = useRef(false);
	const [loadingOlder, setLoadingOlder] = useState(false);
	const [newBelowCount, setNewBelowCount] = useState(0);
	const [scrolledUp, setScrolledUp] = useState(false);

	// Records `messageId`'s current on-screen position so `restoreTopAnchor`
	// can put it back there later, after content is inserted above it.
	function captureTopAnchor() {
		const el = messageScrollRef.current;
		if (!el || !active) return;
		const firstMessage = active.messages[0];
		if (!firstMessage) return;
		const node = el.querySelector<HTMLElement>(
			`[data-message-id="${firstMessage.id}"]`,
		);
		if (!node) return;
		topAnchorRef.current = {
			chatId: active.id,
			messageId: firstMessage.id,
			top: node.getBoundingClientRect().top,
		};
	}

	// Re-measures the anchored message and nudges scrollTop by however much
	// it moved — works regardless of *why* it moved (a scrollHeight-diff
	// calculation only accounts for content inserted since the snapshot, not
	// content above the anchor that keeps growing afterward, e.g. an image
	// finishing its load a moment later).
	function restoreTopAnchor() {
		const el = messageScrollRef.current;
		const anchor = topAnchorRef.current;
		if (!el || !anchor || !active || anchor.chatId !== active.id) return;
		const node = el.querySelector<HTMLElement>(
			`[data-message-id="${anchor.messageId}"]`,
		);
		if (!node) return;
		const newTop = node.getBoundingClientRect().top;
		el.scrollTop += newTop - anchor.top;
		anchor.top = newTop;
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: restoreTopAnchor is a plain function redeclared every render, not state — depending on active (which actually changes) is what should drive this effect
	useEffect(() => {
		const el = messageScrollRef.current;
		if (!el || !active) return;

		if (pendingTopRestoreRef.current) {
			// Older history was just prepended — keep the messages the user
			// was looking at in the same visual spot instead of jumping.
			pendingTopRestoreRef.current = false;
			restoreTopAnchor();
			stickToBottomRef.current = false;
			lastBottomScrollRef.current = {
				chatId: active.id,
				messageCount: active.messages.length,
			};
			return;
		}

		const previous = lastBottomScrollRef.current;
		const isFreshView =
			previous?.chatId !== active.id ||
			(previous.messageCount === 0 && active.messages.length > 0);
		if (isFreshView) {
			// Just switched conversations, or this one's history just
			// finished its first load — jump straight to the latest message.
			el.scrollTop = el.scrollHeight;
			setNewBelowCount(0);
			setScrolledUp(false);
			stickToBottomRef.current = true;
			lastBottomScrollRef.current = {
				chatId: active.id,
				messageCount: active.messages.length,
			};
			return;
		}

		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		const added = active.messages.length - previous.messageCount;
		if (distanceFromBottom < 150) {
			el.scrollTop = el.scrollHeight;
			setNewBelowCount(0);
			stickToBottomRef.current = true;
		} else if (added > 0) {
			setNewBelowCount((count) => count + added);
			stickToBottomRef.current = false;
		}
		lastBottomScrollRef.current = {
			chatId: active.id,
			messageCount: active.messages.length,
		};
	}, [active]);

	// Bound to every media bubble's onLoad/onLoadedMetadata — a bubble has
	// ~0 height until its bytes finish loading, so whichever direction the
	// view is anchored to needs to re-snap once that settles: re-snaps to
	// the bottom if the view was stuck there, otherwise re-corrects against
	// the top anchor (see topAnchorRef) so a late-loading image inside a
	// just-prepended older batch doesn't shove the current view down.
	function handleMediaLoad() {
		if (!stickToBottomRef.current) {
			requestAnimationFrame(restoreTopAnchor);
			return;
		}
		requestAnimationFrame(() => {
			const el = messageScrollRef.current;
			if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
		});
	}

	function handleMessageScroll(event: UIEvent<HTMLDivElement>) {
		const el = event.currentTarget;
		const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
		stickToBottomRef.current = nearBottom;
		setScrolledUp(!nearBottom);
		if (nearBottom) setNewBelowCount(0);
		if (!active || loadingOlder || !active.hasMoreHistory || el.scrollTop > 80)
			return;
		captureTopAnchor();
		pendingTopRestoreRef.current = true;
		setLoadingOlder(true);
		void session
			.loadOlderMessages(active.id)
			.finally(() => setLoadingOlder(false));
	}

	function jumpToBottom() {
		const el = messageScrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
		setNewBelowCount(0);
		setScrolledUp(false);
		stickToBottomRef.current = true;
	}

	function sendMessage(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		handleSendMessage();
	}

	function handleSendMessage() {
		if (editing) {
			const text = trimFormattedText(draft);
			if (!text) return;
			session.editMessage(editing.chatId, editing.message.id, text);
			setEditing(null);
			setDraft("");
			return;
		}
		if (pendingMedia) {
			void sendPendingMedia();
			return;
		}
		const text = trimFormattedText(draft);
		if (!text || !active) return;
		session.sendMessage(active.id, text, replyTo?.id);
		setDraft("");
		setReplyTo(null);
	}

	// Revokes the old blob preview(s) (if any) before swapping in the new
	// pending attachment, so picking a different file doesn't leak object
	// URLs — each one lives until explicitly replaced or discarded. Also
	// drops any queued multi-file selection — a single-attachment pick
	// (voice/GIF/round video) replaces the whole pending batch, not just
	// the one currently previewed.
	function replacePendingMedia(next: PendingMedia) {
		if (pendingMedia) revokePendingMediaPreview(pendingMedia);
		for (const queued of pendingMediaQueue) revokePendingMediaPreview(queued);
		setPendingMediaQueue([]);
		setPendingMedia(next);
	}

	function revokePendingMediaPreview(media: PendingMedia) {
		if (media.source === "blob" && media.previewUrl) {
			URL.revokeObjectURL(media.previewUrl);
		}
	}

	function discardPendingMedia() {
		if (pendingMedia) revokePendingMediaPreview(pendingMedia);
		for (const queued of pendingMediaQueue) revokePendingMediaPreview(queued);
		setPendingMedia(null);
		setPendingMediaQueue([]);
	}

	// Removes just the currently previewed/captioned file, promoting the
	// next queued one (if any) into its place — lets the user drop one bad
	// pick out of a multi-file selection without losing the rest.
	function removeCurrentPendingMedia() {
		if (pendingMedia) revokePendingMediaPreview(pendingMedia);
		setPendingMedia(pendingMediaQueue[0] ?? null);
		setPendingMediaQueue((current) => current.slice(1));
	}

	async function sendPendingMedia() {
		if (!pendingMedia || !active) return;
		const queue = [pendingMedia, ...pendingMediaQueue];
		const formattedCaption = trimFormattedText(draft);
		setSendingPendingMedia(true);
		try {
			for (let i = 0; i < queue.length; i++) {
				const item = queue[i];
				const isLast = i === queue.length - 1;
				let blob: Blob;
				if (item.source === "gif") {
					const res = await fetch(item.gif.sendUrl);
					blob = await res.blob();
				} else {
					blob = item.blob;
				}
				const result = await session.sendMediaMessage(
					active.id,
					item.kind,
					blob,
					{
						// The caption (and reply) belongs to the batch as a
						// whole, not every individual file — Telegram attaches
						// it to the last message in the group the same way.
						caption: isLast ? formattedCaption : "",
						name: item.name,
						durationMs: item.durationMs,
						replyToId: isLast ? replyTo?.id : undefined,
					},
				);
				if (!result.ok) {
					setMediaError(result.error);
					// Drop whatever already sent successfully, keep the rest
					// queued so the user can retry without reselecting files.
					const remaining = queue.slice(i);
					setPendingMedia(remaining[0] ?? null);
					setPendingMediaQueue(remaining.slice(1));
					return;
				}
			}
			for (const item of queue) revokePendingMediaPreview(item);
			setDraft("");
			setReplyTo(null);
			setPendingMedia(null);
			setPendingMediaQueue([]);
		} catch {
			setMediaError("Could not send that");
		} finally {
			setSendingPendingMedia(false);
		}
	}

	function startEditingMessage(message: UIMessage) {
		if (!active) return;
		setEditing({ chatId: active.id, message });
		setReplyTo(null);
		setDraft(message.text);
	}

	function cancelEditingMessage() {
		setEditing(null);
		setDraft("");
	}

	function confirmDeleteMessage() {
		if (!deleting) return;
		session.deleteMessage(deleting.chatId, deleting.message.id);
		setDeleting(null);
	}

	function handleFilePicked(
		event: ChangeEvent<HTMLInputElement>,
		kind: "file" | "image",
	) {
		const files = [...(event.target.files ?? [])];
		event.target.value = "";
		if (files.length === 0 || !active) return;
		const items: PendingMedia[] = files.map((file) => ({
			kind,
			source: "blob",
			blob: file,
			name: file.name,
			previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
		}));
		// Revoke whatever was already queued before replacing it wholesale —
		// same cleanup rule as a single replacePendingMedia, just for every
		// item in this new batch's predecessor.
		if (pendingMedia) revokePendingMediaPreview(pendingMedia);
		for (const queued of pendingMediaQueue) revokePendingMediaPreview(queued);
		setPendingMedia(items[0]);
		setPendingMediaQueue(items.slice(1));
	}

	async function startRoundVideoRecording() {
		if (!active || recording || pendingMedia) return;
		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: { width: { ideal: 480 }, height: { ideal: 480 } },
				audio: true,
			});
		} catch {
			setMediaError("Could not access the camera/microphone");
			return;
		}
		const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
			? "video/webm;codecs=vp9,opus"
			: "video/webm";
		const recorder = new MediaRecorder(stream, { mimeType });
		recordedChunksRef.current = [];
		recorder.ondataavailable = (event) => {
			if (event.data.size > 0) recordedChunksRef.current.push(event.data);
		};
		recorder.start();
		mediaRecorderRef.current = recorder;
		const startedAt = Date.now();
		setRecording({ stream, startedAt, elapsedMs: 0 });
		recordingTimerRef.current = setInterval(() => {
			const elapsedMs = Date.now() - startedAt;
			setRecording((current) =>
				current ? { ...current, elapsedMs } : current,
			);
			if (elapsedMs >= ROUND_VIDEO_MAX_MS) void stopRoundVideoRecording(true);
		}, 200);
	}

	async function stopRoundVideoRecording(send: boolean) {
		const recorder = mediaRecorderRef.current;
		const current = recording;
		if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
		recordingTimerRef.current = null;
		mediaRecorderRef.current = null;
		setRecording(null);
		if (!recorder || !current) {
			recordedChunksRef.current = [];
			return;
		}

		const stopped = new Promise<void>((resolve) => {
			recorder.addEventListener("stop", () => resolve(), { once: true });
		});
		recorder.stop();
		await stopped;
		for (const track of current.stream.getTracks()) track.stop();

		const chunks = recordedChunksRef.current;
		recordedChunksRef.current = [];
		if (!send || !active || chunks.length === 0) return;

		const durationMs = Date.now() - current.startedAt;
		const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
		replacePendingMedia({
			kind: "round_video",
			source: "blob",
			blob,
			durationMs,
			previewUrl: URL.createObjectURL(blob),
		});
	}

	async function startVoiceRecording() {
		if (!active || recordingVoice || pendingMedia) return;
		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch {
			setMediaError("Could not access the microphone");
			return;
		}
		const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
			? "audio/webm;codecs=opus"
			: "audio/webm";
		const recorder = new MediaRecorder(stream, { mimeType });
		voiceChunksRef.current = [];
		recorder.ondataavailable = (event) => {
			if (event.data.size > 0) voiceChunksRef.current.push(event.data);
		};
		recorder.start();
		voiceRecorderRef.current = recorder;
		const startedAt = Date.now();
		setRecordingVoice({ stream, startedAt, elapsedMs: 0 });
		voiceTimerRef.current = setInterval(() => {
			const elapsedMs = Date.now() - startedAt;
			setRecordingVoice((current) =>
				current ? { ...current, elapsedMs } : current,
			);
			if (elapsedMs >= VOICE_MAX_MS) void stopVoiceRecording(true);
		}, 200);
	}

	async function stopVoiceRecording(send: boolean) {
		const recorder = voiceRecorderRef.current;
		const current = recordingVoice;
		if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
		voiceTimerRef.current = null;
		voiceRecorderRef.current = null;
		setRecordingVoice(null);
		if (!recorder || !current) {
			voiceChunksRef.current = [];
			return;
		}

		const stopped = new Promise<void>((resolve) => {
			recorder.addEventListener("stop", () => resolve(), { once: true });
		});
		recorder.stop();
		await stopped;
		for (const track of current.stream.getTracks()) track.stop();

		const chunks = voiceChunksRef.current;
		voiceChunksRef.current = [];
		if (!send || !active || chunks.length === 0) return;

		const durationMs = Date.now() - current.startedAt;
		const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
		replacePendingMedia({
			kind: "voice",
			source: "blob",
			blob,
			durationMs,
			previewUrl: URL.createObjectURL(blob),
		});
	}

	function insertEmoji(emoji: string) {
		if (draftEditorRef.current) draftEditorRef.current.insertText(emoji);
		else setDraft((current) => current + emoji);
	}

	function pickGif(gif: GifResult) {
		if (!active) return;
		setPickerOpen(false);
		replacePendingMedia({
			kind: "image",
			source: "gif",
			gif,
			name: "gif.gif",
			previewUrl: gif.previewUrl,
		});
	}

	function selectConversation(id: string) {
		setActiveId(id);
		setNavBackId(null);
		setMobileListOpen(false);
		setChatSearchOpen(false);
		setChatSearchQuery("");
		setChatSearchIndex(0);
		setPinnedIndex(0);
		setMessageMenuOpenId(null);
		setReplyTo(null);
		setLightboxId(null);
		setEditing(null);
		setDraft("");
		setDraftAlign("left");
		setChatMenuOpen(false);
		setPickerOpen(false);
		setAttachMenuOpen(false);
		setRecordMenuOpen(false);
		discardPendingMedia();
		// Navigating to the chat a pending/active call belongs to is a clear
		// enough signal that the user wants it back in front of them.
		if (session.call.chatId === id && session.call.status !== "idle") {
			setCallMinimized(false);
		}
	}

	async function handleClearChat() {
		if (!active) return;
		setChatActionBusy(true);
		setChatActionError(null);
		const result = await session.clearChat(active.id);
		setChatActionBusy(false);
		if (!result.ok) setChatActionError(result.error);
	}

	async function handleToggleArchive() {
		if (!active) return;
		setChatActionBusy(true);
		setChatActionError(null);
		const result = await session.setChatArchived(active.id, !active.archived);
		setChatActionBusy(false);
		if (!result.ok) setChatActionError(result.error);
	}

	async function handleDeleteChat() {
		if (!active) return;
		setChatActionBusy(true);
		setChatActionError(null);
		const result = await session.deleteChat(active.id);
		setChatActionBusy(false);
		if (!result.ok) {
			setChatActionError(result.error);
			return;
		}
		const remaining = session.conversations.filter((c) => c.id !== active.id);
		setActiveId(remaining[0]?.id ?? null);
	}

	async function handleToggleBlock() {
		if (!active) return;
		setChatActionBusy(true);
		setChatActionError(null);
		const isBlocked = session.blockedUsers.some(
			(b) => b.userId === active.otherUserId,
		);
		const result = isBlocked
			? await session.unblockUser(active.otherUserId)
			: await session.blockUser(active.otherUserId, active.name);
		setChatActionBusy(false);
		if (!result.ok) setChatActionError(result.error);
	}

	async function handleReportSpam() {
		if (!active) return;
		setChatActionBusy(true);
		setChatActionError(null);
		const result = await session.reportSpam(
			active.otherUserId,
			active.name,
			active.id,
		);
		setChatActionBusy(false);
		if (!result.ok) {
			setChatActionError(result.error);
			return;
		}
		const remaining = session.conversations.filter((c) => c.id !== active.id);
		setActiveId(remaining[0]?.id ?? null);
	}

	function scrollToMessage(id: string) {
		const el = messageScrollRef.current?.querySelector<HTMLElement>(
			`[data-message-id="${id}"]`,
		);
		if (!el) return;
		el.scrollIntoView({ behavior: "smooth", block: "center" });
		el.classList.add("message-highlight");
		setTimeout(() => el.classList.remove("message-highlight"), 1200);
	}

	// Clicking "Forwarded from X" jumps to (or starts) a direct chat with
	// that original sender — reuses the existing chat if one's already open
	// locally, otherwise goes through the normal lookup+create flow.
	async function openForwardedFromChat(userId: string, username: string) {
		const fromId = activeId;
		const existing = session.conversations.find(
			(c) => c.otherUserId === userId,
		);
		if (existing) {
			if (existing.id === fromId) return;
			selectConversation(existing.id);
			setNavBackId(fromId);
			return;
		}
		const result = await session.startChat(username);
		if (result.ok) {
			selectConversation(result.chatId);
			setNavBackId(fromId);
		}
	}

	async function handleForwardPick(destChatId: string, comment: string) {
		if (!forwarding) return;
		setForwardBusy(true);
		setForwardError(null);
		const result = await session.forwardMessage(
			forwarding.sourceChatId,
			forwarding.message,
			destChatId,
		);
		setForwardBusy(false);
		if (!result.ok) {
			setForwardError(result.error);
			return;
		}
		const trimmedComment = comment.trim();
		if (trimmedComment) session.sendMessage(destChatId, trimmedComment);
		setForwarding(null);
	}

	async function handleCreateGroup(input: {
		title: string;
		description: string;
		avatarBlob: Blob | null;
		memberUserIds: string[];
	}) {
		setCreateGroupBusy(true);
		setCreateGroupError(null);
		const result = await session.createGroup(
			input.title,
			input.description,
			input.avatarBlob,
			input.memberUserIds,
		);
		setCreateGroupBusy(false);
		if (result.ok) {
			setCreatingGroupOpen(false);
			setActiveId(result.chatId);
		} else {
			setCreateGroupError(result.error);
		}
	}

	async function handleCreateChannel(input: {
		title: string;
		description: string;
		avatarBlob: Blob | null;
		handle: string;
		memberUserIds: string[];
	}) {
		setCreateChannelBusy(true);
		setCreateChannelError(null);
		const result = await session.createChannel(
			input.title,
			input.description,
			input.avatarBlob,
			input.handle,
			input.memberUserIds,
		);
		setCreateChannelBusy(false);
		if (result.ok) {
			setCreatingChannelOpen(false);
			setActiveId(result.chatId);
		} else {
			setCreateChannelError(result.error);
		}
	}

	async function handleToggleChannelAdmin(userId: string, currentRole: string) {
		if (!active) return;
		const result =
			currentRole === "admin"
				? await session.demoteMember(active.id, userId)
				: await session.promoteMember(active.id, userId);
		if (result.ok && session.session) {
			const members = await listGroupMembers(session.session.token, active.id);
			setGroupMembers(members);
		}
	}

	async function handleJoinChannelFromSearch() {
		if (!channelSearchResult) return;
		setChannelSearchBusy(true);
		const result = await session.joinChannel(channelSearchResult.chatId);
		setChannelSearchBusy(false);
		if (result.ok) {
			setQuery("");
			setChannelSearchResult(null);
			setActiveId(channelSearchResult.chatId);
		}
	}

	async function startNewChatWith(username: string) {
		const result = await session.startChat(username);
		if (result.ok) {
			setActiveId(result.chatId);
		} else {
			console.error("could not start chat:", result.error);
		}
	}

	if (!session.sessionLoaded) {
		return null;
	}

	if (!session.session) {
		return (
			<AuthScreen
				busy={session.authBusy}
				error={session.authError}
				onRegister={session.register}
				onLogin={session.login}
			/>
		);
	}

	const me = session.session;

	return (
		<main className="app-frame">
			<header className="app-header">
				<button
					type="button"
					className={`icon-button settings-trigger ${settingsOpen ? "settings-trigger-active" : ""}`}
					onClick={() => setSettingsOpen(!settingsOpen)}
					aria-label={t.settings}
					title={t.settings}
				>
					<Settings2 size={19} />
				</button>
				<button
					type="button"
					className={`icon-button ${savedMessagesPinned ? "settings-trigger-active" : ""}`}
					onClick={() => {
						if (savedMessagesPinned) {
							setSavedMessagesPinned(false);
							return;
						}
						setSavedMessagesPinned(true);
						const saved = conversations.find((c) => c.isSelf);
						if (saved) setActiveId(saved.id);
					}}
					aria-label="Saved Messages"
					title="Saved Messages"
				>
					<Bookmark size={19} />
				</button>
				<button
					type="button"
					className={`icon-button ${archiveViewOpen ? "settings-trigger-active" : ""}`}
					onClick={() => {
						setBlockedViewOpen(false);
						setArchiveViewOpen((open) => !open);
					}}
					aria-label="Archived chats"
					title="Archived chats"
				>
					<Archive size={19} />
				</button>
				<button
					type="button"
					className={`icon-button ${blockedViewOpen ? "settings-trigger-active" : ""}`}
					onClick={() => {
						setArchiveViewOpen(false);
						setBlockedViewOpen((open) => !open);
					}}
					aria-label="Blocked chats"
					title="Blocked chats"
				>
					<Ban size={19} />
				</button>
				<button
					type="button"
					className={`icon-button ${creatingGroupOpen ? "settings-trigger-active" : ""}`}
					onClick={() => {
						setCreateGroupError(null);
						setCreatingGroupOpen(true);
					}}
					aria-label="Create group"
					title="Create group"
				>
					<UserPlus size={19} />
				</button>
				<button
					type="button"
					className={`icon-button ${creatingChannelOpen ? "settings-trigger-active" : ""}`}
					onClick={() => {
						setCreateChannelError(null);
						setCreatingChannelOpen(true);
					}}
					aria-label="Create channel"
					title="Create channel"
				>
					<Radio size={19} />
				</button>
				<div className="header-actions-right">
					<button
						type="button"
						className="icon-button"
						onClick={() => setLanguageDialogOpen(true)}
						aria-label={t.language}
						title={localeNames[locale]}
					>
						<Languages size={19} />
					</button>
					<button
						type="button"
						className="icon-button"
						onClick={() =>
							setTheme((current) =>
								current === "system"
									? "light"
									: current === "light"
										? "dark"
										: "system",
							)
						}
						aria-label={t.theme}
						title={`${t.theme}: ${theme === "system" ? t.system : theme === "light" ? t.light : t.dark}`}
					>
						{theme === "light" ? (
							<Sun size={19} />
						) : theme === "dark" ? (
							<Moon size={19} />
						) : (
							<Monitor size={19} />
						)}
					</button>
				</div>
			</header>
			<div
				className="chat-app"
				style={{ gridTemplateColumns: `${sidebarWidth}px minmax(0, 1fr)` }}
			>
				<aside
					className={`sidebar mt-2 ${mobileListOpen ? "sidebar-open" : ""} ${sidebarWidth <= SIDEBAR_COLLAPSE_THRESHOLD ? "sidebar-collapsed" : ""}`}
				>
					<button
						type="button"
						className="sidebar-resize-handle"
						aria-label="Resize sidebar"
						onMouseDown={(event) => {
							event.preventDefault();
							sidebarResizeStartRef.current = {
								x: event.clientX,
								width: sidebarWidth,
							};
							setResizingSidebar(true);
						}}
						onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}
					/>
					<label className="search-field search-box">
						<Search size={17} />
						<input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={t.search}
						/>
						{query && (
							<button
								type="button"
								className="search-field-clear"
								onClick={() => setQuery("")}
								aria-label="Clear search"
							>
								<X size={15} />
							</button>
						)}
					</label>

					{(archiveViewOpen || blockedViewOpen) && (
						<div className="sidebar-section-heading">
							<button
								type="button"
								className="sidebar-section-heading-button"
								onClick={() => {
									setArchiveViewOpen(false);
									setBlockedViewOpen(false);
								}}
								aria-label="Back"
							>
								<ArrowLeft size={16} />
								<span>
									{archiveViewOpen ? "Archived chats" : "Blocked chats"}
								</span>
							</button>
						</div>
					)}

					<div className="conversation-list">
						{archiveViewOpen || blockedViewOpen ? (
							<>
								{(archiveViewOpen ? archivedChats : blockedChats).length ===
									0 && (
									<p className="empty-results">
										{trimmedQuery
											? t.noResults
											: archiveViewOpen
												? "No archived chats"
												: "No blocked chats"}
									</p>
								)}
								{(archiveViewOpen ? archivedChats : blockedChats).map(
									(conversation) => (
										<button
											key={conversation.id}
											type="button"
											className={`conversation ${activeId === conversation.id ? "conversation-active" : ""}`}
											onClick={() => selectConversation(conversation.id)}
										>
											<span
												className={`avatar avatar-${conversation.color} ${conversation.isSelf ? "avatar-saved" : ""}`}
											>
												{conversation.isSelf ? (
													<Bookmark size={16} />
												) : (
													conversation.avatar
												)}
											</span>
											<span className="conversation-copy">
												<span className="conversation-name">
													{conversation.isSelf
														? "Saved Messages"
														: conversation.name}
												</span>
												<span className="conversation-preview">
													{conversation.preview}
												</span>
											</span>
										</button>
									),
								)}
							</>
						) : (
							<>
								{filtered.length === 0 && (
									<p className="empty-results">{t.noResults}</p>
								)}
								{filtered.map((conversation, index) => (
									<div key={conversation.id}>
										{!query && savedPinned && index === 0 && (
											<p className="list-kicker">{t.pinned}</p>
										)}
										<button
											type="button"
											className={`conversation ${activeId === conversation.id ? "conversation-active" : ""}`}
											onClick={() => selectConversation(conversation.id)}
										>
											<span
												className={`avatar avatar-${conversation.color} ${conversation.isSelf ? "avatar-saved" : ""}`}
											>
												{!conversation.isSelf && conversation.avatarUrl ? (
													// biome-ignore lint/performance/noImgElement: server-optimized, cache-friendly avatar URL — next/image's optimizer has no use here
													<img src={conversation.avatarUrl} alt="" />
												) : conversation.isSelf ? (
													<Bookmark size={16} />
												) : (
													conversation.avatar
												)}
												{!conversation.isSelf &&
													!conversation.isGroup &&
													conversation.status === "online" && (
														<i className="online-dot" />
													)}
											</span>
											<span className="conversation-copy">
												<span className="conversation-name">
													{conversation.isSelf
														? "Saved Messages"
														: conversation.name}
												</span>
												{session.call.chatId === conversation.id &&
												session.call.status !== "idle" ? (
													<span className="conversation-calling">
														<Phone size={11} />
														{session.call.status === "incoming"
															? "Incoming call"
															: session.call.status === "outgoing"
																? "Calling…"
																: "On call"}
													</span>
												) : conversation.partnerTyping ? (
													<span className="conversation-typing">
														{t.typing}
														<span className="conversation-typing-dots">
															<i />
															<i />
															<i />
														</span>
													</span>
												) : (
													<span className="conversation-preview">
														{matchedMessageSnippet(conversation) ??
															conversation.preview}
													</span>
												)}
											</span>
											<span className="conversation-meta">
												<span className="conversation-time">
													{conversation.time}
												</span>
												{conversation.unreadCount > 0 && (
													<span className="unread-count">
														{conversation.unreadCount > 99
															? "99+"
															: conversation.unreadCount}
													</span>
												)}
											</span>
										</button>
									</div>
								))}
								{globalResults.length > 0 && (
									<>
										<p className="list-kicker">{t.globalSearch}</p>
										{globalResults.map((user) => (
											<button
												key={user.userId}
												type="button"
												className="conversation"
												onClick={() => startNewChatWith(user.username)}
											>
												<span className="avatar avatar-teal">
													{user.username.slice(0, 2).toUpperCase()}
												</span>
												<span className="conversation-copy">
													<span className="conversation-name">
														{user.username}
													</span>
												</span>
											</button>
										))}
									</>
								)}
								{joinableChannelResult && (
									<>
										<p className="list-kicker">Channels</p>
										<button
											type="button"
											className="conversation"
											disabled={channelSearchBusy}
											onClick={() => void handleJoinChannelFromSearch()}
										>
											<span className="avatar avatar-teal">
												{joinableChannelResult.avatarUrl ? (
													// biome-ignore lint/performance/noImgElement: server-optimized, cache-friendly avatar URL
													<img src={joinableChannelResult.avatarUrl} alt="" />
												) : (
													avatarForUsername(joinableChannelResult.title)
												)}
											</span>
											<span className="conversation-copy">
												<span className="conversation-name">
													{joinableChannelResult.title}
												</span>
												<span className="conversation-preview">
													{channelSearchBusy
														? "Joining…"
														: `${joinableChannelResult.memberCount} subscribers — tap to join`}
												</span>
											</span>
										</button>
									</>
								)}
							</>
						)}
					</div>
				</aside>

				<section className="conversation-pane">
					{active ? (
						<>
							<header className="chat-header">
								<button
									type="button"
									className="icon-button mobile-menu"
									onClick={() => setMobileListOpen(true)}
									aria-label={t.chats}
								>
									<Menu size={20} />
								</button>
								{navBackId && navBackId !== active.id && (
									<button
										type="button"
										className="icon-button"
										title="Back"
										aria-label="Back"
										onClick={() => {
											const backTo = navBackId;
											setNavBackId(null);
											if (backTo) selectConversation(backTo);
										}}
									>
										<ArrowLeft size={18} />
									</button>
								)}
								<button
									type="button"
									className="chat-person"
									onClick={() => {
										setMobileListOpen(false);
										if (active.isGroup || active.isChannel)
											setGroupInfoOpen(true);
									}}
								>
									<span
										className={`avatar avatar-${active.color} ${active.isSelf ? "avatar-saved" : ""}`}
									>
										{!active.isSelf && active.avatarUrl ? (
											// biome-ignore lint/performance/noImgElement: server-optimized, cache-friendly avatar URL — next/image's optimizer has no use here
											<img src={active.avatarUrl} alt="" />
										) : active.isSelf ? (
											<Bookmark size={18} />
										) : (
											active.avatar
										)}
										{!active.isSelf && !active.isGroup && !active.isChannel && (
											<i className="online-dot" />
										)}
									</span>
									<span className="chat-person-copy">
										<strong>
											{active.isSelf ? "Saved Messages" : active.name}
										</strong>
										{active.isGroup || active.isChannel ? (
											<small>
												{active.memberCount}{" "}
												{active.isChannel ? t.subscribers : t.members}
											</small>
										) : active.isSelf ? (
											<small>Notes to yourself</small>
										) : (
											<small>
												<i className="status-dot status-online" />
												{t.online}
											</small>
										)}
									</span>
								</button>
								{session.call.chatId === active.id &&
									session.call.status !== "idle" && (
										<button
											type="button"
											className="chat-header-call-pill"
											onClick={() => setCallMinimized(false)}
										>
											<Phone size={12} />
											{session.call.status === "incoming"
												? "Incoming call"
												: session.call.status === "outgoing"
													? "Calling…"
													: "On call"}
										</button>
									)}
								<div className="header-actions">
									<button
										type="button"
										className={`icon-button ${chatSearchOpen ? "settings-trigger-active" : ""}`}
										title="Search messages"
										aria-label="Search messages"
										onClick={() => {
											setChatSearchOpen((open) => !open);
											setChatSearchQuery("");
											setChatSearchIndex(0);
										}}
									>
										<Search size={18} />
									</button>
									{!active.isSelf && !active.isGroup && !active.isChannel && (
										<>
											<button
												type="button"
												className="icon-button"
												title={t.call}
												aria-label={t.call}
												disabled={session.call.status !== "idle"}
												onClick={() => session.startCall(active.id, false)}
											>
												<Phone size={18} />
											</button>
											<button
												type="button"
												className="icon-button video-action"
												title={t.video}
												aria-label={t.video}
												disabled={session.call.status !== "idle"}
												onClick={() => session.startCall(active.id, true)}
											>
												<Video size={19} />
											</button>
											<span className="header-divider" />
										</>
									)}
									<div className="chat-menu-wrap">
										<button
											type="button"
											className="icon-button"
											title={t.more}
											aria-label={t.more}
											onClick={() => {
												setChatActionError(null);
												setChatMenuOpen((open) => !open);
											}}
										>
											<MoreHorizontal size={20} />
										</button>
										{chatMenuOpen && (
											<>
												<button
													type="button"
													className="chat-menu-backdrop"
													aria-label="Close menu"
													onClick={() => setChatMenuOpen(false)}
												/>
												<div className="chat-menu">
													{chatActionError && (
														<p className="chat-menu-error">{chatActionError}</p>
													)}
													<button
														type="button"
														disabled={chatActionBusy}
														onClick={() => {
															setChatMenuOpen(false);
															void handleClearChat();
														}}
													>
														<Trash2 size={14} />
														Clear chat
													</button>
													<button
														type="button"
														disabled={chatActionBusy}
														onClick={() => {
															setChatMenuOpen(false);
															void handleToggleArchive();
														}}
													>
														<Archive size={14} />
														{active.archived
															? "Unarchive chat"
															: "Archive chat"}
													</button>
													{!active.isSelf && (
														<button
															type="button"
															disabled={chatActionBusy}
															onClick={() => {
																setChatMenuOpen(false);
																void handleDeleteChat();
															}}
														>
															<X size={14} />
															{active.isGroup ? "Leave group" : "Delete chat"}
														</button>
													)}
													{!active.isSelf && !active.isGroup && (
														<>
															<button
																type="button"
																disabled={chatActionBusy}
																onClick={() => {
																	setChatMenuOpen(false);
																	void handleToggleBlock();
																}}
															>
																<Ban size={14} />
																{session.blockedUsers.some(
																	(b) => b.userId === active.otherUserId,
																)
																	? `Unblock ${active.name}`
																	: `Block ${active.name}`}
															</button>
															<button
																type="button"
																className="chat-menu-danger"
																disabled={chatActionBusy}
																onClick={() => {
																	setChatMenuOpen(false);
																	void handleReportSpam();
																}}
															>
																<ShieldAlert size={14} />
																Report spam
															</button>
														</>
													)}
												</div>
											</>
										)}
									</div>
								</div>
							</header>

							{chatSearchOpen ? (
								<div className="chat-search-bar">
									<label className="search-field chat-search-field">
										<Search size={16} />
										<input
											value={chatSearchQuery}
											onChange={(event) => {
												setChatSearchQuery(event.target.value);
												setChatSearchIndex(0);
											}}
											onKeyDown={(event) => {
												if (event.key === "Enter") jumpToSearchMatch(1);
												if (event.key === "Escape") setChatSearchOpen(false);
											}}
											placeholder="Search in this chat"
										/>
										{chatSearchQuery && (
											<button
												type="button"
												className="search-field-clear"
												onClick={() => {
													setChatSearchQuery("");
													setChatSearchIndex(0);
												}}
												aria-label="Clear search"
											>
												<X size={15} />
											</button>
										)}
									</label>
									<span className="chat-search-count">
										{trimmedChatSearchQuery
											? `${chatSearchMatches.length ? clampedChatSearchIndex + 1 : 0}/${chatSearchMatches.length}`
											: ""}
									</span>
									<button
										type="button"
										className="icon-button"
										aria-label="Previous match"
										disabled={chatSearchMatches.length === 0}
										onClick={() => jumpToSearchMatch(-1)}
									>
										<ChevronUp size={16} />
									</button>
									<button
										type="button"
										className="icon-button"
										aria-label="Next match"
										disabled={chatSearchMatches.length === 0}
										onClick={() => jumpToSearchMatch(1)}
									>
										<ChevronDown size={16} />
									</button>
									<button
										type="button"
										className="icon-button"
										aria-label="Close search"
										onClick={() => setChatSearchOpen(false)}
									>
										<X size={16} />
									</button>
								</div>
							) : (
								activePinnedMessage && (
									<div className="pinned-message-bar">
										<button
											type="button"
											className="pinned-message-jump"
											onClick={jumpToPinnedMessage}
										>
											<Pin size={14} />
											<span className="pinned-message-copy">
												<strong>Pinned message</strong>
												<span className="pinned-message-text">
													{activePinnedMessage.deleted
														? "Message deleted"
														: activePinnedMessage.media &&
																!activePinnedMessage.text
															? mediaKindLabel(activePinnedMessage.media.kind)
															: stripFormatting(activePinnedMessage.text)}
												</span>
											</span>
											{pinnedMessages.length > 1 && (
												<span className="pinned-message-count">
													{clampedPinnedIndex + 1}/{pinnedMessages.length}
												</span>
											)}
										</button>
										<button
											type="button"
											className="icon-button"
											aria-label="Unpin message"
											onClick={() =>
												void session.unpinMessage(
													active.id,
													activePinnedMessage.id,
												)
											}
										>
											<X size={14} />
										</button>
									</div>
								)
							)}

							<div
								className="message-scroll"
								ref={messageScrollRef}
								onScroll={handleMessageScroll}
							>
								{loadingOlder && (
									<p className="loading-older">Loading older messages…</p>
								)}
								{(active.isGroup || active.isChannel) &&
								historyReadyIds.has(active.id) &&
								active.messages.length === 0 ? (
									<div className="empty-chat group-intro">
										<span
											className={`avatar avatar-${active.color} group-intro-avatar`}
										>
											{active.avatarUrl ? (
												// biome-ignore lint/performance/noImgElement: server-optimized, cache-friendly avatar URL — next/image's optimizer has no use here
												<img src={active.avatarUrl} alt="" />
											) : (
												active.avatar
											)}
										</span>
										<p className="empty-chat-title">{active.name}</p>
										<p className="group-intro-members">
											{active.memberCount}{" "}
											{active.isChannel ? t.subscribers : t.members}
										</p>
										{active.description && (
											<FormattedText text={active.description} />
										)}
									</div>
								) : !active.isSelf &&
									!active.isGroup &&
									!active.isChannel &&
									historyReadyIds.has(active.id) &&
									active.messages.length === 0 ? (
									<div className="empty-chat">
										<p className="empty-chat-title">
											Say hi to {active.name} 👋
										</p>
										<div className="empty-chat-stickers">
											{greetingStickers.map((emoji) => (
												<button
													key={emoji}
													type="button"
													className="empty-chat-sticker"
													onClick={() => session.sendMessage(active.id, emoji)}
												>
													{emoji}
												</button>
											))}
										</div>
									</div>
								) : (
									<>
										<div className="day-divider">
											<span>{t.today}</span>
										</div>
										<div className="message-stack">
											{active.messages.map((message, index) => {
												if (message.isCallEvent) {
													return (
														<div
															key={message.id}
															className={`call-event-row ${message.callAnswered ? "call-event-answered" : "call-event-missed"} ${message.fromMe ? "call-event-mine" : "call-event-theirs"}`}
														>
															<Phone size={11} />
															<span>{message.text}</span>
															<span className="call-event-time">
																{message.time}
															</span>
														</div>
													);
												}
												if (message.isSystem) {
													return (
														<div
															key={message.id}
															className="call-event-row system-event-row"
														>
															<Users size={11} />
															<span>{message.text}</span>
															<span className="call-event-time">
																{message.time}
															</span>
														</div>
													);
												}
												const previous = active.messages[index - 1];
												// A channel is a single broadcast stream, not a
												// 2-way conversation — every post (including the
												// posting admin's own) renders in the same
												// "incoming" style, anonymized as being from the
												// channel rather than from them personally. Edit/
												// delete permission below still checks the real
												// `message.fromMe`, unaffected by this.
												const renderAsMine =
													message.fromMe && !active.isChannel;
												const showAvatar =
													!renderAsMine && (!previous || previous.fromMe);
												const actions = !message.deleted && (
													<div className="message-actions chat-menu-wrap">
														<button
															type="button"
															className="icon-button message-action"
															aria-label="Message actions"
															onClick={() =>
																setMessageMenuOpenId((current) =>
																	current === message.id ? null : message.id,
																)
															}
														>
															<MoreHorizontal size={14} />
														</button>
														{messageMenuOpenId === message.id && (
															<>
																<button
																	type="button"
																	className="chat-menu-backdrop"
																	aria-label="Close menu"
																	onClick={() => setMessageMenuOpenId(null)}
																/>
																<div className="chat-menu">
																	<button
																		type="button"
																		onClick={() => {
																			setMessageMenuOpenId(null);
																			setReplyTo(message);
																		}}
																	>
																		<Reply size={14} />
																		Reply
																	</button>
																	<button
																		type="button"
																		onClick={() => {
																			setMessageMenuOpenId(null);
																			setForwardError(null);
																			setForwarding({
																				message,
																				sourceChatId: active.id,
																			});
																		}}
																	>
																		<Forward size={14} />
																		Forward
																	</button>
																	<button
																		type="button"
																		onClick={() => {
																			setMessageMenuOpenId(null);
																			if (message.pinned) {
																				void session.unpinMessage(
																					active.id,
																					message.id,
																				);
																			} else {
																				void session.pinMessage(
																					active.id,
																					message,
																				);
																			}
																		}}
																	>
																		{message.pinned ? (
																			<PinOff size={14} />
																		) : (
																			<Pin size={14} />
																		)}
																		{message.pinned
																			? "Unpin message"
																			: "Pin message"}
																	</button>
																	{message.fromMe && (
																		<button
																			type="button"
																			onClick={() => {
																				setMessageMenuOpenId(null);
																				startEditingMessage(message);
																			}}
																		>
																			<Pencil size={14} />
																			Edit
																		</button>
																	)}
																	{message.fromMe && (
																		<button
																			type="button"
																			className="chat-menu-danger"
																			onClick={() => {
																				setMessageMenuOpenId(null);
																				setDeleting({
																					chatId: active.id,
																					message,
																				});
																			}}
																		>
																			<Trash2 size={14} />
																			Delete
																		</button>
																	)}
																</div>
															</>
														)}
													</div>
												);
												return (
													<div
														key={message.id}
														data-message-id={message.id}
														className={`message-row ${renderAsMine ? "message-row-mine" : ""} ${showAvatar ? "message-row-first" : ""}`}
													>
														{renderAsMine && actions}
														{(() => {
															const isSticker =
																!message.deleted &&
																!message.media &&
																!message.replyTo &&
																!message.forwardedFrom &&
																isEmojiOnlyMessage(message.text);
															return (
																<div
																	className={`message-bubble ${renderAsMine ? "bubble-mine" : ""} ${message.deleted ? "bubble-deleted" : ""} ${isSticker ? "message-sticker" : ""} ${message.media ? `bubble-has-media bubble-media-${message.media.kind}` : ""}`}
																>
																	{message.deleted ? (
																		<p className="deleted-text">
																			<Ban size={12} />
																			Message deleted
																		</p>
																	) : (
																		<>
																			{message.forwardedFrom &&
																				(message.forwardedFrom.userId ===
																				session.session?.userId ? (
																					<div className="forwarded-label">
																						<Forward size={11} />
																						<span>Forwarded from you</span>
																					</div>
																				) : (
																					<button
																						type="button"
																						className="forwarded-label forwarded-label-link"
																						onClick={() => {
																							const { userId, username } =
																								message.forwardedFrom as NonNullable<
																									typeof message.forwardedFrom
																								>;
																							void openForwardedFromChat(
																								userId,
																								username,
																							);
																						}}
																					>
																						<Forward size={11} />
																						<span>
																							Forwarded from{" "}
																							{message.forwardedFrom.username}
																						</span>
																					</button>
																				))}
																			{message.replyTo && (
																				<button
																					type="button"
																					className="reply-quote"
																					onClick={() =>
																						scrollToMessage(
																							message.replyTo?.messageId ?? "",
																						)
																					}
																				>
																					<CornerUpLeft size={11} />
																					<span className="reply-quote-text">
																						{message.replyTo.deleted
																							? "Message deleted"
																							: message.replyTo.mediaKind
																								? mediaKindLabel(
																										message.replyTo.mediaKind,
																									)
																								: stripFormatting(
																										message.replyTo.text,
																									)}
																					</span>
																				</button>
																			)}
																			{message.media && (
																				<MediaBubble
																					media={message.media}
																					onOpen={() =>
																						setLightboxId(message.id)
																					}
																					onLoad={handleMediaLoad}
																				/>
																			)}
																			{message.text && (
																				<FormattedText text={message.text} />
																			)}
																			{!message.deleted &&
																				(() => {
																					const previewUrl = message.text
																						? extractFirstUrl(message.text)
																						: null;
																					return previewUrl ? (
																						<LinkPreviewCard
																							url={previewUrl}
																							getLinkPreview={
																								session.getLinkPreview
																							}
																						/>
																					) : null;
																				})()}
																		</>
																	)}
																	<span className="message-meta">
																		{message.editedAtMs && !message.deleted && (
																			<span className="edited-tag">edited</span>
																		)}
																		{message.time}
																		{renderAsMine && <CheckCheck size={14} />}
																	</span>
																</div>
															);
														})()}
														{!renderAsMine && actions}
													</div>
												);
											})}
											{active.partnerTyping && (
												<div className="typing-row">
													<span className="typing-indicator">
														<i />
														<i />
														<i />
													</span>
													<span className="typing-label">{t.typing}</span>
												</div>
											)}
										</div>
									</>
								)}
							</div>

							<div className="composer-wrap">
								{canPostInActiveChat ? (
									<>
										{mediaError && (
											<p className="media-error-banner">{mediaError}</p>
										)}
										{editing && (
											<div className="reply-compose-bar">
												<Pencil size={14} />
												<div className="reply-compose-text">
													<span className="reply-compose-author">
														Editing message
													</span>
												</div>
												<button
													type="button"
													className="icon-button"
													onClick={cancelEditingMessage}
													aria-label="Cancel edit"
												>
													<X size={16} />
												</button>
											</div>
										)}
										{replyTo && !editing && (
											<div className="reply-compose-bar">
												<CornerUpLeft size={14} />
												<div className="reply-compose-text">
													<span className="reply-compose-author">
														{replyTo.fromMe ? "You" : active.name}
													</span>
													<span className="reply-compose-snippet">
														{replyTo.media
															? mediaKindLabel(replyTo.media.kind)
															: stripFormatting(replyTo.text)}
													</span>
												</div>
												<button
													type="button"
													className="icon-button"
													onClick={() => setReplyTo(null)}
													aria-label="Cancel reply"
												>
													<X size={16} />
												</button>
											</div>
										)}
										{pendingMedia && (
											<div className="pending-media-bar">
												{pendingMedia.kind === "voice" &&
												pendingMedia.previewUrl ? (
													<>
														<span className="pending-media-icon">
															<Mic size={18} />
														</span>
														{/** biome-ignore lint/a11y/useMediaCaption: a self-recorded voice message has no caption track to attach */}
														<audio
															src={pendingMedia.previewUrl}
															className="pending-media-audio"
															controls
														/>
													</>
												) : pendingMedia.previewUrl ? (
													pendingMedia.kind === "round_video" ? (
														// biome-ignore lint/a11y/useMediaCaption: a self-recorded round video has no caption track to attach
														<video
															src={pendingMedia.previewUrl}
															className="pending-media-thumb pending-media-thumb-video"
															controls
															playsInline
														/>
													) : (
														// biome-ignore lint/performance/noImgElement: local object URL / remote preview thumbnail, next/image's optimizer has no use here
														<img
															src={pendingMedia.previewUrl}
															alt=""
															className="pending-media-thumb"
														/>
													)
												) : (
													<span className="pending-media-icon">
														{pendingMedia.kind === "voice" ? (
															<Mic size={18} />
														) : (
															<Paperclip size={18} />
														)}
													</span>
												)}
												{pendingMedia.kind !== "voice" && (
													<span className="pending-media-label">
														{pendingMedia.kind === "image"
															? "Photo"
															: pendingMedia.kind === "round_video"
																? "Round video"
																: (pendingMedia.name ?? "File")}
														{pendingMediaQueue.length > 0 && (
															<small className="pending-media-count">
																+{pendingMediaQueue.length} more
															</small>
														)}
													</span>
												)}
												<button
													type="button"
													className="icon-button"
													onClick={removeCurrentPendingMedia}
													aria-label="Remove attachment"
												>
													<X size={16} />
												</button>
											</div>
										)}
										{recording && (
											<div className="round-record-overlay">
												<div className="round-record-preview">
													<video
														ref={recordingVideoRef}
														autoPlay
														muted
														playsInline
													/>
													<span className="round-record-dot" />
												</div>
												<span className="round-record-timer">
													{formatDuration(
														Math.floor(recording.elapsedMs / 1000),
													)}
												</span>
												<button
													type="button"
													className="icon-button round-record-cancel"
													onClick={() => void stopRoundVideoRecording(false)}
													aria-label="Cancel recording"
												>
													<Trash2 size={18} />
												</button>
												<button
													type="button"
													className="icon-button round-record-send"
													onClick={() => void stopRoundVideoRecording(true)}
													aria-label={t.roundVideo}
												>
													<Send size={18} />
												</button>
											</div>
										)}
										{recordingVoice && (
											<div className="round-record-overlay">
												<div className="voice-record-pulse">
													<Mic size={16} />
												</div>
												<span className="round-record-timer">
													{formatDuration(
														Math.floor(recordingVoice.elapsedMs / 1000),
													)}
												</span>
												<button
													type="button"
													className="icon-button round-record-cancel"
													onClick={() => void stopVoiceRecording(false)}
													aria-label="Cancel recording"
												>
													<Trash2 size={18} />
												</button>
												<button
													type="button"
													className="icon-button round-record-send"
													onClick={() => void stopVoiceRecording(true)}
													aria-label="Send voice message"
												>
													<Send size={18} />
												</button>
											</div>
										)}
										{pickerOpen && (
											<EmojiGifPicker
												onPickEmoji={(emoji) => insertEmoji(emoji)}
												onPickGif={(gif) => pickGif(gif)}
												onClose={() => setPickerOpen(false)}
											/>
										)}
										<input
											ref={fileInputRef}
											type="file"
											multiple
											className="composer-hidden-input"
											onChange={(event) => handleFilePicked(event, "file")}
										/>
										<input
											ref={imageInputRef}
											type="file"
											multiple
											accept="image/*"
											className="composer-hidden-input"
											onChange={(event) => handleFilePicked(event, "image")}
										/>
										<form className="composer" onSubmit={sendMessage}>
											<div className="chat-menu-wrap">
												<button
													type="button"
													className="icon-button composer-tool"
													title={t.attach}
													aria-label={t.attach}
													onClick={() => {
														setRecordMenuOpen(false);
														setAttachMenuOpen((open) => !open);
													}}
												>
													<Paperclip size={19} />
												</button>
												{attachMenuOpen && (
													<>
														<button
															type="button"
															className="chat-menu-backdrop"
															aria-label="Close menu"
															onClick={() => setAttachMenuOpen(false)}
														/>
														<div className="chat-menu composer-popover-up">
															<button
																type="button"
																onClick={() => {
																	setAttachMenuOpen(false);
																	imageInputRef.current?.click();
																}}
															>
																<Image size={15} />
																{t.photo}
															</button>
															<button
																type="button"
																onClick={() => {
																	setAttachMenuOpen(false);
																	fileInputRef.current?.click();
																}}
															>
																<Paperclip size={15} />
																{t.attach}
															</button>
														</div>
													</>
												)}
											</div>
											<div className="composer-input-area">
												<div className="composer-format-bar">
													<button
														type="button"
														className="icon-button format-tool"
														title="Bold"
														aria-label="Bold"
														onMouseDown={(event) => event.preventDefault()}
														onClick={() =>
															draftEditorRef.current?.toggleMark("bold")
														}
													>
														<Bold size={14} />
													</button>
													<button
														type="button"
														className="icon-button format-tool"
														title="Italic"
														aria-label="Italic"
														onMouseDown={(event) => event.preventDefault()}
														onClick={() =>
															draftEditorRef.current?.toggleMark("italic")
														}
													>
														<Italic size={14} />
													</button>
													<button
														type="button"
														className="icon-button format-tool"
														title="Underline"
														aria-label="Underline"
														onMouseDown={(event) => event.preventDefault()}
														onClick={() =>
															draftEditorRef.current?.toggleMark("underline")
														}
													>
														<Underline size={14} />
													</button>
													<button
														type="button"
														className="icon-button format-tool"
														title="Strikethrough"
														aria-label="Strikethrough"
														onMouseDown={(event) => event.preventDefault()}
														onClick={() =>
															draftEditorRef.current?.toggleMark(
																"strikethrough",
															)
														}
													>
														<Strikethrough size={14} />
													</button>
													<span className="composer-format-divider" />
													<button
														type="button"
														className={`icon-button format-tool ${draftAlign === "left" ? "format-tool-active" : ""}`}
														title="Align left"
														aria-label="Align left"
														onMouseDown={(event) => event.preventDefault()}
														onClick={() =>
															draftEditorRef.current?.setAlign("left")
														}
													>
														<AlignLeft size={14} />
													</button>
													<button
														type="button"
														className={`icon-button format-tool ${draftAlign === "center" ? "format-tool-active" : ""}`}
														title="Align center"
														aria-label="Align center"
														onMouseDown={(event) => event.preventDefault()}
														onClick={() =>
															draftEditorRef.current?.setAlign("center")
														}
													>
														<AlignCenter size={14} />
													</button>
													<button
														type="button"
														className={`icon-button format-tool ${draftAlign === "right" ? "format-tool-active" : ""}`}
														title="Align right"
														aria-label="Align right"
														onMouseDown={(event) => event.preventDefault()}
														onClick={() =>
															draftEditorRef.current?.setAlign("right")
														}
													>
														<AlignRight size={14} />
													</button>
												</div>
												<RichTextEditor
													ref={draftEditorRef}
													ariaLabel={t.message}
													className="composer-textarea"
													value={draft}
													onChange={setDraft}
													onTyping={() => {
														if (active) session.notifyTyping(active.id);
													}}
													onAlignChange={setDraftAlign}
													onEnterSubmit={handleSendMessage}
													autoGrow={COMPOSER_AUTOGROW}
													placeholder={
														pendingMedia ? "Add a caption…" : t.placeholder
													}
												/>
											</div>
											<button
												type="button"
												className="icon-button composer-tool emoji-tool"
												title={t.emoji}
												aria-label={t.emoji}
												onClick={() => setPickerOpen((open) => !open)}
											>
												<Smile size={19} />
											</button>
											<div className="chat-menu-wrap">
												<button
													type="button"
													className={`icon-button composer-tool round-video-tool ${recording || recordingVoice ? "round-video-tool-active" : ""}`}
													title={
														recording
															? t.roundVideo
															: recordingVoice
																? "Record a voice message"
																: "Record"
													}
													aria-label={
														recording
															? t.roundVideo
															: recordingVoice
																? "Record a voice message"
																: "Record"
													}
													onClick={() => {
														if (recording) {
															void stopRoundVideoRecording(true);
															return;
														}
														if (recordingVoice) {
															void stopVoiceRecording(true);
															return;
														}
														setAttachMenuOpen(false);
														setRecordMenuOpen((open) => !open);
													}}
												>
													{recordingVoice ? (
														<Mic size={19} />
													) : (
														<CircleDot size={19} />
													)}
												</button>
												{recordMenuOpen && (
													<>
														<button
															type="button"
															className="chat-menu-backdrop"
															aria-label="Close menu"
															onClick={() => setRecordMenuOpen(false)}
														/>
														<div className="chat-menu composer-popover-up">
															<button
																type="button"
																onClick={() => {
																	setRecordMenuOpen(false);
																	void startRoundVideoRecording();
																}}
															>
																<CircleDot size={15} />
																{t.roundVideo}
															</button>
															<button
																type="button"
																onClick={() => {
																	setRecordMenuOpen(false);
																	void startVoiceRecording();
																}}
															>
																<Mic size={15} />
																Voice message
															</button>
														</div>
													</>
												)}
											</div>
											<button
												type="submit"
												className="send-button"
												aria-label={t.message}
												disabled={
													pendingMedia ? sendingPendingMedia : !draft.trim()
												}
											>
												<Send size={17} />
											</button>
										</form>
									</>
								) : (
									<div className="channel-readonly-bar">
										<span>Only channel admins can post here.</span>
										<button
											type="button"
											className="channel-readonly-leave"
											onClick={() => void handleDeleteChat()}
										>
											Leave channel
										</button>
									</div>
								)}
							</div>
						</>
					) : (
						<p className="empty-results">{t.noResults}</p>
					)}
				</section>
				{mobileListOpen && (
					<button
						type="button"
						className="mobile-scrim"
						onClick={() => setMobileListOpen(false)}
						aria-label={t.close}
					>
						<X size={20} />
					</button>
				)}
				{scrolledUp && (
					<button
						type="button"
						className="jump-bottom"
						onClick={jumpToBottom}
						aria-label="Jump to latest message"
					>
						<ArrowDown size={17} />
						{newBelowCount > 0 && (
							<span className="jump-bottom-badge">
								{newBelowCount > 99 ? "99+" : newBelowCount}
							</span>
						)}
					</button>
				)}
				<button type="button" className="help-button" aria-label="Help">
					<CircleHelp size={19} />
				</button>
				<button
					type="button"
					className="notification-button"
					aria-label="Notifications"
				>
					<Bell size={17} />
				</button>
				<button
					type="button"
					className="archive-button"
					aria-label="Archived chats"
				>
					<Archive size={17} />
				</button>
			</div>
			{settingsOpen && (
				<>
					<button
						type="button"
						className="settings-scrim"
						onClick={() => setSettingsOpen(false)}
						aria-label={t.close}
					/>
					<aside className="settings-drawer" aria-label={t.settings}>
						<div className="settings-drawer-heading">
							<button
								type="button"
								className="settings-account-trigger"
								onClick={() => setAccountDialogOpen(true)}
							>
								<span className="avatar avatar-profile">
									{session.myProfile.avatarUrl ? (
										// biome-ignore lint/performance/noImgElement: server-optimized, cache-friendly avatar URL — next/image's optimizer has no use here
										<img src={session.myProfile.avatarUrl} alt="" />
									) : (
										me.username.slice(0, 2).toUpperCase()
									)}
								</span>
								<span className="profile-copy">
									<strong>{me.username}</strong>
									<small>
										{session.myProfile.handle
											? `@${session.myProfile.handle}`
											: t.personalSpace}
									</small>
								</span>
							</button>
							<button
								type="button"
								className="icon-button"
								onClick={() => setSettingsOpen(false)}
								aria-label={t.close}
							>
								<X size={19} />
							</button>
						</div>
						<section className="settings-section">
							<button
								type="button"
								className="settings-field settings-field-button"
								onClick={() => setActiveSettingsPicker("sound")}
							>
								<span className="settings-field-label">
									<span className="settings-field-icon">
										<Music2 size={15} />
									</span>
									<span className="settings-field-text">
										<strong>Message sound</strong>
										<small>{SOUND_THEME_LABELS[session.soundTheme]}</small>
									</span>
								</span>
								<ChevronRight size={16} className="settings-field-chevron" />
							</button>
							<button
								type="button"
								className="settings-field settings-field-button"
								onClick={() => setActiveSettingsPicker("ringtone")}
							>
								<span className="settings-field-label">
									<span className="settings-field-icon">
										<PhoneCall size={15} />
									</span>
									<span className="settings-field-text">
										<strong>Call ringtone</strong>
										<small>{session.ringtoneEnabled ? "On" : "Off"}</small>
									</span>
								</span>
								<ChevronRight size={16} className="settings-field-chevron" />
							</button>
							<div className="settings-field">
								<span className="settings-field-label">
									<span className="settings-field-icon">
										<Type size={15} />
									</span>
									<span className="settings-field-text">
										<strong>Text size</strong>
										<small>Scales every chat and menu text</small>
									</span>
								</span>
								<span className="text-size-stepper">
									<button
										type="button"
										className="icon-button"
										aria-label="Decrease text size"
										disabled={textScale <= TEXT_SCALE_MIN}
										onClick={() =>
											setTextScale((current) =>
												Math.max(TEXT_SCALE_MIN, current - TEXT_SCALE_STEP),
											)
										}
									>
										<Minus size={14} />
									</button>
									<span className="text-size-value">{textScale}%</span>
									<button
										type="button"
										className="icon-button"
										aria-label="Increase text size"
										disabled={textScale >= TEXT_SCALE_MAX}
										onClick={() =>
											setTextScale((current) =>
												Math.min(TEXT_SCALE_MAX, current + TEXT_SCALE_STEP),
											)
										}
									>
										<Plus size={14} />
									</button>
								</span>
							</div>
							<button
								type="button"
								className="settings-field settings-field-button"
								onClick={() => setActiveSettingsPicker("wallpaper")}
							>
								<span className="settings-field-label">
									<span className="settings-field-icon">
										<Image size={15} />
									</span>
									<span className="settings-field-text">
										<strong>Chat background</strong>
										<small>{WALLPAPER_LABELS[wallpaper]}</small>
									</span>
								</span>
								<ChevronRight size={16} className="settings-field-chevron" />
							</button>
							<button
								type="button"
								className="settings-field settings-field-button"
								onClick={() => setActiveSettingsPicker("accent")}
							>
								<span className="settings-field-label">
									<span className="settings-field-icon">
										<Palette size={15} />
									</span>
									<span className="settings-field-text">
										<strong>Theme color</strong>
										<small>{ACCENT_LABELS[accentColor]}</small>
									</span>
								</span>
								<span
									className="picker-dialog-swatch settings-field-swatch"
									style={{
										background: ACCENT_PALETTES[accentColor].light.accent,
									}}
								/>
							</button>
						</section>
						<button
							type="button"
							className="settings-logout"
							onClick={session.logout}
						>
							<LogOut size={14} style={{ marginRight: 6 }} />
							Log out
						</button>
					</aside>
				</>
			)}
			<CallOverlay
				call={session.call}
				minimized={callMinimized}
				onAccept={session.acceptCall}
				onDecline={session.declineCall}
				onEnd={session.endCall}
				onToggleMute={session.toggleMute}
				onToggleVideo={session.toggleVideo}
				onMinimize={() => setCallMinimized(true)}
				onMuteRing={session.muteRing}
			/>
			{lightboxId && (
				<MediaLightbox
					items={mediaItems}
					activeId={lightboxId}
					onClose={() => setLightboxId(null)}
					onNavigate={(id) => setLightboxId(id)}
					hasOlder={active?.hasMoreHistory ?? false}
					loadingOlder={lightboxLoadingOlder}
					onLoadOlder={() => {
						if (!active || lightboxLoadingOlder) return;
						setLightboxLoadingOlder(true);
						void session
							.loadOlderMessages(active.id)
							.finally(() => setLightboxLoadingOlder(false));
					}}
				/>
			)}
			{forwarding && (
				<ForwardDialog
					conversations={conversations}
					busy={forwardBusy}
					error={forwardError}
					onPick={(destChatId, comment) =>
						void handleForwardPick(destChatId, comment)
					}
					onClose={() => setForwarding(null)}
				/>
			)}
			{creatingGroupOpen && (
				<CreateGroupDialog
					conversations={conversations}
					searchUsers={session.searchUsers}
					busy={createGroupBusy}
					error={createGroupError}
					onCreate={(input) => void handleCreateGroup(input)}
					onClose={() => setCreatingGroupOpen(false)}
				/>
			)}
			{creatingChannelOpen && (
				<CreateChannelDialog
					conversations={conversations}
					searchUsers={session.searchUsers}
					busy={createChannelBusy}
					error={createChannelError}
					onCreate={(input) => void handleCreateChannel(input)}
					onClose={() => setCreatingChannelOpen(false)}
				/>
			)}
			{accountDialogOpen && (
				<AccountDialog
					username={me.username}
					handle={session.myProfile.handle}
					bio={session.myProfile.bio}
					avatarUrl={session.myProfile.avatarUrl}
					listAvatars={session.listMyAvatars}
					onUpload={session.uploadMyAvatar}
					onSetHandle={session.setMyHandle}
					onSetBio={session.setMyBio}
					onOpenCarousel={(mediaId) => setAvatarCarouselMediaId(mediaId)}
					onClose={() => setAccountDialogOpen(false)}
				/>
			)}
			{avatarCarouselMediaId && (
				<AvatarCarouselDialog
					initialMediaId={avatarCarouselMediaId}
					onActivate={session.activateMyAvatar}
					onDelete={session.deleteMyAvatar}
					onUpload={session.uploadMyAvatar}
					onRefresh={session.listMyAvatars}
					onClose={() => setAvatarCarouselMediaId(null)}
				/>
			)}
			{languageDialogOpen && (
				<LanguageDialog
					options={Object.entries(localeNames).map(([code, label]) => ({
						code,
						label,
						flag: localeFlags[code as Locale],
					}))}
					value={locale}
					onSelect={(code) => setLocale(code as Locale)}
					onClose={() => setLanguageDialogOpen(false)}
				/>
			)}
			{activeSettingsPicker === "sound" && (
				<SettingsPickerDialog
					title="Message sound"
					value={session.soundTheme}
					onSelect={(value) => session.setSoundTheme(value as SoundTheme)}
					onClose={() => setActiveSettingsPicker(null)}
					options={SOUND_THEMES.map((option) => ({
						value: option,
						label: SOUND_THEME_LABELS[option],
						onPreview: () => playNotificationSound(option),
					}))}
				/>
			)}
			{activeSettingsPicker === "ringtone" && (
				<SettingsPickerDialog
					title="Call ringtone"
					value={session.ringtoneEnabled ? "on" : "off"}
					onSelect={(value) => session.setRingtoneEnabled(value === "on")}
					onClose={() => setActiveSettingsPicker(null)}
					options={[
						{
							value: "on",
							label: "On",
							swatch: <Bell size={16} />,
						},
						{
							value: "off",
							label: "Off",
							swatch: <BellOff size={16} />,
						},
					]}
				/>
			)}
			{activeSettingsPicker === "wallpaper" && (
				<SettingsPickerDialog
					title="Chat background"
					value={wallpaper}
					onSelect={(value) => setWallpaper(value as Wallpaper)}
					onClose={() => setActiveSettingsPicker(null)}
					options={WALLPAPERS.map((option) => ({
						value: option,
						label: WALLPAPER_LABELS[option],
						swatch:
							option === "none" ? null : (
								<span
									className="wallpaper-swatch-thumb"
									style={{ backgroundImage: `var(--wallpaper-${option})` }}
								/>
							),
					}))}
				/>
			)}
			{activeSettingsPicker === "accent" && (
				<SettingsPickerDialog
					title="Theme color"
					value={accentColor}
					onSelect={(value) => setAccentColor(value as AccentColor)}
					onClose={() => setActiveSettingsPicker(null)}
					options={ACCENT_COLORS.map((color) => ({
						value: color,
						label: ACCENT_LABELS[color],
						swatch: (
							<span
								className="picker-dialog-swatch"
								style={{ background: ACCENT_PALETTES[color].light.accent }}
							/>
						),
					}))}
				/>
			)}
			{groupInfoOpen && (active?.isGroup || active?.isChannel) && (
				<>
					<button
						type="button"
						className="settings-scrim"
						onClick={() => setGroupInfoOpen(false)}
						aria-label={t.close}
					/>
					<aside
						className="settings-drawer group-info-drawer"
						aria-label={active.isChannel ? "Channel info" : "Group info"}
					>
						<div className="settings-drawer-heading">
							<h2>{active.isChannel ? "Channel info" : "Group info"}</h2>
							<button
								type="button"
								className="icon-button"
								onClick={() => setGroupInfoOpen(false)}
								aria-label={t.close}
							>
								<X size={19} />
							</button>
						</div>
						<div className="settings-account">
							<span
								className={`avatar avatar-${active.color} group-info-avatar`}
							>
								{active.avatarUrl ? (
									// biome-ignore lint/performance/noImgElement: server-optimized, cache-friendly avatar URL — next/image's optimizer has no use here
									<img src={active.avatarUrl} alt="" />
								) : (
									active.avatar
								)}
							</span>
							<span className="profile-copy">
								<strong>{active.name}</strong>
								<small>
									{active.memberCount}{" "}
									{active.isChannel ? t.subscribers : t.members}
								</small>
							</span>
						</div>
						{active.description && (
							<section className="settings-section group-info-description">
								<FormattedText text={active.description} />
							</section>
						)}
						<section className="settings-section">
							<label className="search-field group-info-member-search">
								<Search size={16} />
								<input
									value={groupMemberQuery}
									onChange={(event) => setGroupMemberQuery(event.target.value)}
									placeholder={
										active.isChannel ? "Search subscribers" : "Search members"
									}
								/>
								{groupMemberQuery && (
									<button
										type="button"
										className="search-field-clear"
										onClick={() => setGroupMemberQuery("")}
										aria-label="Clear search"
									>
										<X size={15} />
									</button>
								)}
							</label>
							<ul className="group-info-member-list">
								{filteredGroupMembers.length === 0 && (
									<li className="forward-list-empty">
										No {active.isChannel ? "subscribers" : "members"} found.
									</li>
								)}
								{filteredGroupMembers.map((member) => (
									<li key={member.userId} className="forward-list-item">
										<span
											className={`avatar avatar-${colorForUsername(member.username)}`}
										>
											{avatarForUsername(member.username)}
										</span>
										<span className="forward-list-name">{member.username}</span>
										{member.role === "owner" && (
											<span className="group-info-role-badge">Owner</span>
										)}
										{member.role === "admin" && (
											<span className="group-info-role-badge">Admin</span>
										)}
										{active.isChannel &&
											active.myRole === "owner" &&
											member.role !== "owner" && (
												<button
													type="button"
													className="group-info-role-action"
													onClick={() =>
														void handleToggleChannelAdmin(
															member.userId,
															member.role,
														)
													}
												>
													{member.role === "admin"
														? "Remove admin"
														: "Make admin"}
												</button>
											)}
									</li>
								))}
							</ul>
						</section>
					</aside>
				</>
			)}
			{deleting && (
				<div className="modal-overlay">
					<div className="modal-card">
						<h2>Delete message?</h2>
						<p className="modal-copy">
							This removes it for everyone in the chat. This can't be undone.
						</p>
						<div className="modal-actions">
							<button
								type="button"
								className="modal-cancel"
								onClick={() => setDeleting(null)}
							>
								Cancel
							</button>
							<button
								type="button"
								className="modal-submit modal-submit-danger"
								onClick={confirmDeleteMessage}
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}
		</main>
	);
}
