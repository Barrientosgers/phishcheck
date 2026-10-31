/**
 * Phrase patterns for the content checks, in English and Spanish.
 *
 * They run against normalised text: lowercase, accents removed, whitespace collapsed. So write
 * them without accents (`contrasena`, not `contraseña`) and in lowercase. Prefer multi-word
 * phrases: single words like "urgent" appear in plenty of legitimate email. Patterns must not
 * use the `g` flag, and gaps are bounded (`{0,40}`) to keep matching fast on huge emails.
 */

export const URGENCY_PATTERNS: readonly RegExp[] = [
  // English
  /\b(?:act|respond|reply|verify|confirm|update|pay) (?:now|immediately|today)\b/,
  /\bwithin (?:the next )?\d+ hours?\b/,
  /\b(?:your )?account (?:has been |will be |is |was )?(?:suspended|locked|closed|disabled|deactivated|limited)\b/,
  /\b(?:immediate|urgent) (?:action|attention|response)\b/,
  /\b(?:final notice|final warning|last warning|last chance)\b/,
  /\bfailure to (?:comply|respond|verify|confirm|act)\b/,
  /\bavoid (?:suspension|closure|termination|penalties)\b/,
  // Spanish
  /\b(?:actue|responda|verifique|confirme|actualice|pague) (?:ahora|ya|inmediatamente|hoy mismo)\b/,
  /\bpago inmediato\b/,
  /\bhoy mismo\b/,
  /\bde inmediato\b/,
  /\bdentro de (?:las )?(?:proximas )?\d+ horas\b/,
  /\bsu cuenta (?:sera|ha sido|fue|esta) (?:suspendida|bloqueada|cerrada|desactivada|limitada)\b/,
  /\b(?:ultimo aviso|ultima oportunidad|aviso final)\b/,
  /\baccion (?:inmediata|urgente)\b/,
]

export const CREDENTIAL_PATTERNS: readonly RegExp[] = [
  // English: a "give us" verb followed shortly by something secret
  /\b(?:enter|confirm|verify|update|provide|send|share|submit|reply with)\b[^.]{0,40}\b(?:password|passcode|pin|credentials|card number|credit card|debit card|cvv|security code|social security|ssn|bank details|login details)\b/,
  /\bpassword (?:has )?expired\b/,
  // Spanish
  /\b(?:ingrese|ingresa|introduzca|confirme|verifique|actualice|proporcione|envie|comparta|responda con)\b[^.]{0,40}\b(?:contrasena|clave|pin|credenciales|numero de tarjeta|tarjeta de credito|tarjeta de debito|cvv|codigo de seguridad|datos bancarios|datos de su tarjeta|seguro social)\b/,
  /\bcontrasena (?:ha )?expirado\b/,
]

export const PAYMENT_PATTERNS: readonly RegExp[] = [
  // English
  /\b(?:pay|paid|payment|send|purchase|buy)\b[^.]{0,40}\bgift cards?\b/,
  /\bgift cards? (?:codes?|numbers?|pins?)\b/,
  /\bwire (?:transfer|the money|funds)\b/,
  /\b(?:western union|moneygram)\b/,
  /\b(?:pay|send|transfer|payment)\b[^.]{0,40}\b(?:bitcoin|btc|ethereum|usdt|cryptocurrency|crypto)\b/,
  /\b(?:bitcoin|btc|ethereum|usdt) wallet\b/,
  // Spanish
  /\b(?:pago|pague|pagar|envie|compre|comprar)\b[^.]{0,40}\btarjetas? de regalo\b/,
  /\b(?:realice|haga|efectue|envie)\b[^.]{0,40}\btransferencia\b/,
  /\b(?:pague|pago|envie|transfiera)\b[^.]{0,40}\b(?:bitcoin|btc|usdt|criptomonedas?)\b/,
  /\b(?:billetera|cartera) (?:de )?(?:bitcoin|cripto\w*)\b/,
]

/** Only checked near the start of the body, where a greeting belongs. */
export const GREETING_PATTERNS: readonly RegExp[] = [
  /\b(?:dear|hello|hi|greetings)[,\s]+(?:valued\s+|esteemed\s+)?(?:customer|user|member|client|account holder|sir or madam|sir\/madam|sir|madam)\b/,
  /\b(?:estimado|estimada|querido|querida|apreciado|apreciada|hola)[,\s]+(?:cliente|usuario|usuaria|socio|socia|miembro)\b/,
]
