// Punctuation rules shared by the copy and shell gates. The banned characters
// are built from char codes so no source file holds a literal one.
export const EM_DASH = String.fromCharCode(0x2014);
export const EN_DASH = String.fromCharCode(0x2013);
export const SEMICOLON = String.fromCharCode(0x3b);

/** Banned anywhere in a file, comments included: em dash and en dash. */
export const DASH_RULE = new RegExp(`[${EM_DASH}${EN_DASH}]`);

/** Banned in user-facing copy strings: both dashes plus the semicolon. */
export const COPY_RULE = new RegExp(`[${EM_DASH}${EN_DASH}${SEMICOLON}]`);
